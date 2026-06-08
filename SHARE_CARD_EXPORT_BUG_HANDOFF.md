# Share-card PNG export bug — handoff notes

## The bug (still unsolved)
`SlideShare.jsx` → `captureBlob()` uses `html2canvas` to rasterize a 540×960
share card (`CardBananaDrop`, `CardStickerZine`, `CardReceipt`,
`CardY2KChrome` in `shareCards.jsx`) into a PNG for saving/sharing.

**On the user's Android device, the exported PNG does not match the live
in-app preview.** Most recently confirmed symptom (screenshot, "The Team"
card, `totalMessages: 3652`, Hebrew name "יעל מחובנים"):

- **Live preview: pixel-perfect.** Hero number "3,652" sits cleanly above
  "MESSAGES SENT THIS YEAR" with correct spacing, nothing overlaps.
- **Exported PNG: "3,652" overlaps "MESSAGES SENT THIS YEAR"** — the label
  text renders through/behind the digits and the comma. Other elements
  (logo, "wrapped" pill, verdict, hero number) have also been seen shifted
  out of alignment in earlier exports with other data.

This is the **same family of symptom** that has persisted across ~3+ sessions
of attempted fixes — it just resurfaces in different shapes depending on the
test data (group name length, message count digit count, Hebrew vs Latin
names, etc).

## What's CONFIRMED FIXED (do not revert / re-break these)
These are real, validated fixes already in the working tree (uncommitted,
on top of commit `9aa2cc6`) — user confirmed "yes!!! not clipped!!!":

1. **Dot texture** (`shareCards.jsx` `DOT_TILE`): html2canvas can't rasterize
   repeating CSS `radial-gradient` — dots vanished in export. Fixed by
   switching to a tiled SVG `data:` URI background-image. **Working.**
2. **`boxSizing: 'border-box'` on all 4 card roots**: html2canvas's clone
   doesn't reliably inherit `.cw-frame * { box-sizing: border-box }`, so
   padding added ~72px to the 960px height and the bottom got cropped.
   **Working.**
3. **2×2 stat-cell grid → two flex rows** (`CardBananaDrop`): html2canvas
   mis-sizes CSS grid cells, clipping the 3-line "Carried the chat" cell.
   Converted to nested flexbox with `align-items: stretch`. **Working.**
4. **`data-hero-num` + Y2K Chrome gradient-text fallback** (in `onclone`):
   html2canvas can't rasterize `background-clip: text` gradients (paints an
   opaque band over the number). The `onclone` callback in `SlideShare.jsx`
   detects `[data-hero-num]` elements with `webkitBackgroundClip: 'text'`
   and swaps them to a solid white fill for the export only. **Working —
   kept in place.**
5. `lineHeight: 0.95` on `ACell` value / `lineHeight: 1.5` on `sub` lines —
   minor spacing tweaks, part of the "not clipped" confirmation.

## What was tried THIS session and DID NOT WORK (already reverted)

### The font-loading-race theory (disproven by the live-vs-export comparison)
Hypothesis: html2canvas's clone document re-fetches Google Fonts over the
network; mobile WebViews paint before they arrive and fall back to a system
font with different metrics, shifting every centered/spaced element.

This seemed to explain everything — multiple independently-positioned
elements all shifting together is exactly what a global metrics change would
cause. Built a full fix:
- `scripts/embed-fonts.mjs` — fetched the card's Google Fonts, base64-encoded
  them as woff2 data URIs into `src/embeddedFonts.js`, with family names
  suffixed `' XCard'` to avoid colliding with the live app's own fonts.
- `SlideShare.captureBlob`'s `onclone` loaded these directly into the
  **clone document only** via the `FontFace` API (`new FontFace(...)`,
  `.load()`, `doc.fonts.add()`), then injected a `<style>` redirecting
  `.fs-display`/`.fs-mono`/`.fs-sans`/`.fs-serif` to the suffixed families.

**v1 of this had a real, separate bug**: it injected fonts globally using the
SAME family names as the live app — which caused the browser to swap the
live render to a differently-fetched font binary mid-session (a real
regression the user caught: "this lowered the big number"). v2 fixed *that*
specific self-inflicted issue by scoping everything to the clone with unique
names — confirmed via a Playwright probe (rendering the real component,
running real html2canvas, blocking Google Fonts at the network level to
reproduce the device condition) that v2 was clone-safe and didn't touch the
live render.

**But the user's fresh test after v2 shipped (`index-CR9mid_8.js`) showed
the EXACT SAME overlap symptom in the export — while the live preview was
flawless.** This means the font-loading-race theory is likely **wrong, or at
minimum incomplete** as the root cause of THIS symptom. All of that code has
now been **fully removed**:
- Deleted `scripts/embed-fonts.mjs` and `src/embeddedFonts.js`.
- Reverted `captureBlob`'s `onclone` back to just the (working) Y2K gradient
  fallback — no font loading, no global/clone style overrides.
- Rebuilt + synced (`index-B_qX1Kzr.js`), verified zero remaining references
  to `embeddedFonts`/`FONT_FACES`/`FONT_SUFFIX` anywhere in `src/`.

## A concrete new lead worth investigating first
Caught mid-investigation when this session ended — **don't re-chase fonts,
chase layout measurement instead**:

The hero-number block in `CardBananaDrop` (`shareCards.jsx` ~line 191) is:
```jsx
<div style={{ flex: story ? 1 : '0 0 auto', display: 'flex',
              flexDirection: 'column', justifyContent: 'center',
              minHeight: 0, ... }}>
  <div data-hero-num className="fs-display" style={{ ..., lineHeight: 0.84, ... }}>{heroStr}</div>
  <div className="fs-mono" style={{ marginTop: story ? 14 : 8, ... }}>messages sent this year</div>
</div>
```
This relies on `flex: 1` + `minHeight: 0` to size the container, then
`justify-content: center` to position the (number + label) pair within it.

**Overlap between two flow siblings can really only happen if the number's
rendered box is taller than the browser computed it live** (its declared
`marginTop: 14` to the label can't go negative on its own). That points at
html2canvas's text-measurement/layout engine computing a different line-box
height for the `fs-display` text at `fontSize: heroSize` (a dynamically
computed size from `heroNumSize()`) than the real browser does — independent
of which font is *actually* painted. Also worth checking: does
`documentClone.fonts.ready` (which html2canvas itself already awaits before
calling `onclone` — confirmed in `node_modules/html2canvas/dist/html2canvas.js`
line ~5247) resolve before the fonts are *visually correct* in the clone?
That would mean the "fonts not ready" framing was never quite right — the
fonts ARE "ready" per the spec, but html2canvas's internal text-measurement
pass may run against different metrics than what later paints.

**Suggested next steps, roughly in order of effort:**
1. Add a temporary on-device diagnostic: in `onclone`, measure and
   `console.log` (or render into the card itself, e.g. as a debug overlay)
   the actual `getBoundingClientRect()` of `[data-hero-num]` and its sibling
   label, compare to the live DOM's rects for the same element. This tells
   you definitively whether html2canvas's clone is *measuring* the text
   differently (font-metrics / line-box issue) or *positioning* the flex
   container differently (layout-engine issue) — two very different fixes.
2. If it's a flex/layout measurement issue: try replacing the `flex: 1` +
   `justify-content: center` centering with fixed/explicit heights or
   `position: absolute` + `top: 50%; transform: translateY(-50%)` — i.e.
   remove html2canvas's need to resolve flex-grow at all.
3. If it's still font-metrics: don't try to *replace* fonts pre-capture;
   instead make the layout robust to *any* font's metrics — e.g. give the
   hero-number container a fixed `minHeight` derived from `fontSize *
   lineHeight` plus headroom, so even a taller fallback glyph box can't
   physically reach the label.
4. Nuclear option if html2canvas itself proves unreliable for this layout:
   render the card to an off-screen `<canvas>` manually (draw text/shapes
   with the Canvas 2D API at fixed coordinates) instead of DOM rasterization
   — total control over metrics, zero clone/measurement ambiguity, but a
   much bigger rewrite of all 4 card components.

## Reproduction technique that actually works (the only one that does)
Desktop testing CANNOT reproduce this — fonts are cached, DPR is different.
Use a Playwright probe:
- Serve the real component via the Vite dev server (`http://localhost:5173`)
  so it gets the real `GlobalStyles`/fonts/CSS.
- Run the real `html2canvas` + the real `onclone` from `SlideShare.jsx`.
- Set `deviceScaleFactor: 3.75` (matches the user's device DPR).
- Use `ctx.route()` to block `fonts.googleapis.com` / `fonts.gstatic.com` —
  this reproduces the "fonts not cached" device condition.
- Compare a Playwright screenshot of the live DOM (ground truth) against the
  html2canvas export, side by side, for the SAME data.
- Test with BOTH short-Latin data (e.g. `totalMessages: 4049`, "The Group")
  AND long/Hebrew data (e.g. `totalMessages: 1450`/`3652`, Hebrew names like
  "אלעד הימל" / "יעל מחובנים") — the bug's *shape* changes with the data,
  so single-dataset testing gives false confidence.
- **Clean up probe scaffolding when done** (`__probe.html`, `__probe.jsx`,
  `__probe-run.mjs`, temp PNGs) — established workflow in this repo.

## Files touched this session (final state)
- `src/slides/SlideShare.jsx` — `captureBlob`'s `onclone` is back to ONLY the
  Y2K gradient-text fallback (no font loading). **Working / minimal.**
- `src/slides/shareCards.jsx` — unchanged from the confirmed-working state
  described above (dots, boxSizing, grid→flex, `data-hero-num`, lineHeight).
- `scripts/embed-fonts.mjs`, `src/embeddedFonts.js` — **deleted** (failed
  approach).
- Rebuilt and synced: `index-B_qX1Kzr.js`, confirmed present in both
  `dist/assets/` and `android/app/src/main/assets/public/assets/`, and
  confirmed zero remaining references to `embeddedFonts`/`FONT_SUFFIX`/
  `FONT_FACES` anywhere in `src/`.

## Memory note
`C:\Users\User\.claude\projects\c--workspace-whatsappRecap\memory\project_share_card_export_fonts.md`
documents the (now-disproven-as-sufficient) font-loading-race theory in
detail — useful historical context on what's been tried and ruled out, but
**do not treat its "root cause" claim as settled** — the live-vs-export
comparison this session shows the export is still broken with the fonts
"fixed," so the real root cause is still open. Consider updating that memory
once the actual root cause is found.

## Things NOT to re-try
- Global font injection with names matching the live app's fonts (caused a
  measurable live-render regression — confirmed root-caused this session).
- Per-element `lineHeight`/`marginTop` "compensation" hacks scoped to
  `onclone` (tried in earlier sessions, made live/export parity worse, fully
  removed once the (still-unproven) font theory suggested they shouldn't be
  needed).
- Testing only on desktop / only with one dataset — both have produced false
  "looks fixed!" confidence in this saga more than once.
