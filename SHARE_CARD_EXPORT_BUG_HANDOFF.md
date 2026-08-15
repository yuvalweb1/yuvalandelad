# Share-card PNG export bug — RESOLVED

## The bug
`SlideShare.jsx` → `captureBlob()` rasterized a 540×960 share card
(`CardBananaDrop`, `CardStickerZine`, `CardReceipt`, `CardY2KChrome` in
`shareCards.jsx`) into a PNG for saving/sharing. The live in-app preview was
pixel-perfect, but **the exported PNG did not match it** — hero numbers
overlapping their labels, opaque bands painted over text, elements shifted out
of alignment. The symptom changed shape with the data (digit count, group name
length, Hebrew vs Latin names), which is why it survived ~3 sessions of fixes:
each fix tuned the card to compensate for one dataset and the next dataset
moved the error somewhere else.

## Root cause
**html2canvas.** It does not screenshot the browser's render — it re-derives
it twice, in JS:

1. **Layout runs again in its own off-screen iframe**
   (`html2canvas.js:5568`, `createElement('iframe')`). Flex-grow,
   `justify-content: center` and `minHeight: 0` get resolved from scratch in a
   differently-sized document. That is exactly the hero-number container.
2. **Text is painted with hand-rolled baseline math**, not the browser's:
   ```js
   // :6589 — how it decides where a font's baseline sits
   var baseline = img.offsetTop - span.offsetTop + 2;
   // :6706 — how it paints
   ctx.fillText(text.text, text.bounds.left, text.bounds.top + baseline);
   ```
   A probe element plus a literal `+ 2` fudge factor, per family and per size.
   `heroSize` comes from `heroNumSize()` and varies with the data, so the error
   moved with the data.

html2canvas 1.4.1 is a rendering engine reimplemented in JS, last released
2022. The card was never broken; the converter was.

## The fix
Replaced html2canvas with **html-to-image** (`src/slides/captureCard.js`),
which wraps the node in an SVG `<foreignObject>`, loads that as an `<img>`, and
draws it to a canvas. The browser's own layout and text engine do the work, so
the export matches the preview **by construction**.

`html2canvas` has been uninstalled and is gone from `package.json`.

Two things the foreignObject approach requires, both handled:
- **No network inside the SVG document.** Every external resource must be
  inlined first. html-to-image inlines `<img>` sources itself (the logo);
  fonts come from `getFontEmbedCSS()`, computed **once per session** and cached
  (`warmCardFonts`, kicked off on slide mount) because resolving them refetches
  every `@font-face` as a data URI.
- **Font failure is now benign.** `warmCardFonts` catches and resolves to `''`
  (not `null` — html-to-image treats non-null `fontEmbedCSS` as final and skips
  its own network-dependent pass). Worst case is "wrong typeface, correct
  layout", never overlapping text.

Also removed: the `onclone` Y2K Chrome `background-clip: text` workaround. It
existed only because html2canvas painted an opaque band over gradient text. The
real renderer handles it, so the export now keeps the actual gradient instead of
a flat white fallback.

## Measured result
Playwright probe, real components via the Vite dev server, real capture code,
`deviceScaleFactor: 3.75`, both datasets, all four cards. Metric is mean
per-pixel divergence from the live render (0–255, lower = closer):

| condition | html2canvas | foreignObject |
|---|---|---|
| Google Fonts blocked | 13.22 | **1.39** |
| Google Fonts allowed | 8.55 | **1.52** |

~1.4 is the antialiasing/resampling noise floor — the diff images show hairline
glyph outlines, not displacement. Every card and both datasets improved.

The starkest case was `CardY2KChrome`: the html2canvas export painted solid
magenta rectangles over the stat-cell labels ("CARRIED IT", "30% of messages",
"FAVE WORD") and rendered blurred background blobs as hard-edged circles. The
foreignObject export is clean.

## Still worth verifying on a real device
Desktop Chromium can't prove Android WebView behavior. Two things to look at on
an actual device export:
- **`backdropFilter`** (`shareCards.jsx` ~line 427, Y2K Chrome stat cells).
  backdrop-filter inside a foreignObject has historically been spotty in
  Chromium. Failure mode is cosmetic — the frosted panel loses its blur — not a
  layout break.
- **`maskImage`** (`shareCards.jsx` ~line 371, the receipt's notched edges).
  Unprefixed `mask-image` needs a reasonably current WebView. It renders in the
  live preview on the same engine, so it should hold, but confirm.

If either misbehaves, the fallback is **native WebView capture** via Capacitor
(Android `PixelCopy`, iOS `drawViewHierarchyInRect`) — the exported PNG becomes
literally the pixels the user saw, with zero conversion. ~50 lines of native
code per platform plus a web fallback.

## Reproduction technique (kept — it's the only one that works)
Desktop testing alone can't reproduce the device condition. Use a Playwright
probe:
- Serve the real components via the Vite dev server (`http://localhost:5173`)
  so they get the real `GlobalStyles`/fonts/CSS.
- Run the real capture code from `src/slides/captureCard.js`.
- `deviceScaleFactor: 3.75` (matches the user's device DPR).
- `ctx.route()` to block `fonts.googleapis.com` / `fonts.gstatic.com` to
  reproduce the "fonts not cached" condition — and run once without blocking.
- Screenshot the live DOM as ground truth, compare against the export with a
  per-pixel diff (sharp), and emit a visual diff image — the number tells you
  *whether*, the image tells you *where*.
- Test with BOTH short-Latin data (`totalMessages: 4049`, "The Group") AND
  long/Hebrew data (`3652`, "יעל מחובנים"). The bug's shape changed with the
  data; single-dataset testing gave false confidence more than once.
- **Always measure the before as well as the after on the same harness.** A
  good-looking absolute number proves nothing without the baseline.
- Clean up probe scaffolding when done (`__probe.html`, `__probe.jsx`,
  `__probe-run.mjs`) — established workflow in this repo.

## Things NOT to re-try
- **Compensating in the card's CSS.** Per-element `lineHeight`/`marginTop`
  tweaks scoped to the capture, font-metric fudging, etc. Every one of these
  fixed one dataset and broke another. The converter was the bug.
- **Global font injection using the live app's own family names** — caused a
  measurable live-render regression (it swapped the live font binary
  mid-session and visibly moved the hero number).
- **Testing only on desktop / only with one dataset.**

## Historical note
A font-loading-race theory (html2canvas's clone re-fetching Google Fonts and
painting before they land) was built out fully across an earlier session —
`scripts/embed-fonts.mjs`, `src/embeddedFonts.js` — and **disproven**: the
export stayed broken with fonts embedded while the live preview was flawless.
That code was deleted and is not the fix here. Font embedding reappears in
`captureCard.js` for a different and genuine reason: the foreignObject document
cannot fetch fonts at all.
