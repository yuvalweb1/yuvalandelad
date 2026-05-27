# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install         # one-time
npm run dev         # Vite dev server on http://localhost:5173 (auto-opens)
npm run build       # production build to dist/
npm run preview     # serve dist/ locally
```

There are no tests, no linter, and no type checker configured. "Working" means: builds clean, runs in the browser, the demo flow (Try Demo link on landing) plays through every slide without errors.

## Architecture

This was originally a single-file React app — `src/App.jsx` is still the stage-machine root, but pipeline code has been pulled into focused modules. Roughly: parsing → analytics → slides → stage rendering. Inline styles + a small `<style>` block in `src/components/GlobalStyles.jsx`. No Tailwind, no CSS modules, no Framer Motion. Animations are CSS keyframes + the `useAnimatedNumber` hook ([src/hooks/useAnimatedNumber.js](src/hooks/useAnimatedNumber.js)). The app renders inside a `100vw × 100vh` "phone frame" (`.cw-frame`) — design for a 9:16 mobile viewport, not desktop.

### The pipeline

1. **ZIP decoder** — [src/parser/zip.js](src/parser/zip.js) hand-parses the ZIP central directory and inflates entries via `DecompressionStream('deflate-raw')`. Supports Zip64 (archives > 4 GB or > 65,535 entries). No JSZip dependency. `readZipText` returns the transcript; `readZipBundle` returns text + photos/voice/videos/stickers (each capped).
2. **Parser** — [src/parser/parse.js](src/parser/parse.js) handles iOS `[DD.MM.YYYY, HH:MM:SS] Sender: msg` and Android `DD/MM/YY, HH:MM - Sender: msg`. Strips LRM/RLM/directional marks (critical for Hebrew exports). Classifies system / deleted / media / voice via `*_PATTERNS` arrays in [src/parser/patterns.js](src/parser/patterns.js). Returns `{ messages, diagnostics }` — diagnostics are surfaced in VerifyView, so every parser change should keep those counters honest.
3. **Web Worker** — parsing runs in [src/parser/worker.js](src/parser/worker.js) via the [src/parser/client.js](src/parser/client.js) wrapper so huge exports never block the UI. Returns blob URLs for media; main thread is responsible for revoking them (see `reset()` in App.jsx).
4. **Analytics** — [src/lib/analytics.js](src/lib/analytics.js) `computeAll` is the only consumer of parsed messages. It produces per-user + group stats (bursts, conversation revivals/kills, trimmed-mean response times, eras, chaos moments, etc.). Every downstream slide reads from this object — do not compute metrics inside slides.
5. **Social layer** — deterministic rule engine inside `computeAll` and per-user fields. Titles, roasts, achievements, group descriptions all ship with an `evidence` string. **No LLM, no randomness, no network.** Same input → same output. Preserve this invariant.
6. **i18n** — [src/i18n/](src/i18n/) holds one file per locale (`en.js` is the canonical key list and fallback). [src/i18n/index.js](src/i18n/index.js) exposes `buildT(lang)` (merges requested locale over `en`), `RTL_LANGS` (`he`, `ar`), `typedCopy(t, key, type)` (relationship-aware copy), and `interp(template, vars)`. When you add UI copy, add it to `en.js` first (and ideally `he.js`) — never inline English strings into components.
7. **Slides** — [src/slides/index.js](src/slides/index.js) exports `SLIDE_COMPONENTS` (id → component map), `SLIDES_BY_TYPE` (per chat-type ordered lineup: `friends` / `family` / `work` / `couple` / `other`), and `slideHasData(id, analytics, user)` (per-slide data check). Wrapped picks the lineup by `profile.relationship`, filters via `slideHasData`. Generic "metric" slides (night_owls, early_birds, etc.) are factories around [src/slides/SlideMetric.jsx](src/slides/SlideMetric.jsx). To add a slide: add the component, register it in `SLIDE_COMPONENTS`, add data-check case in `slideHasData`, append to relevant `SLIDES_BY_TYPE` lineups.

### The stage machine

`ChatWrappedApp` in [src/App.jsx](src/App.jsx) holds a `stage` string. Current transitions:

```
howto → landing → parsing → [ad_post_parse] → onboard → [ad_pre_wrapped] → wrapped
                ↓
            settings (from gear icon; returns to caller via settingsReturn)
                ↓
wrapped → [ad_pre_menu] → menu → { verify | [ad_pre_roast] → roastmode
                                  | duo | chaos | profile | wrapped(replay) | landing(reset) }
```

Square brackets `[...]` are video-ad gates — only entered when `adEnabled(slot)` is true. State (analytics, diagnostics, profile, selectedAuthor, lang, isPremium, history) lives on this component and threads down as props. No context, no store, no router.

## Invariants worth preserving

- **No network calls beyond Google Fonts** — the privacy claim in README is load-bearing. Never add analytics, error reporting, or remote LLM calls.
- **Deterministic output** — analytics + social layer must be pure functions of the parsed messages. No `Math.random()`, no `Date.now()` in user-visible logic.
- **Diagnostics stay truthful** — VerifyView is the trust mechanism. If you change parsing or filtering, update the corresponding diagnostic counter so the numbers users see still add up.
- **i18n fallback chain** — never let a missing key crash a slide; `buildT` already falls back to `en`, so reach for `t.some_key` rather than hardcoded strings.

