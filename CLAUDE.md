# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install         # one-time
npm run dev         # Vite dev server on http://localhost:5173 (auto-opens)
npm run build       # production build to dist/
npm run preview     # serve dist/ locally
```

There are no tests, no linter, and no type checker configured. "Working" means: builds clean, runs in the browser, the demo flow (Try Demo button on landing) plays through all 23 slides without errors.

## Architecture

This is a **single-page React app where essentially the whole product lives in [src/App.jsx](src/App.jsx)** (~7150 LOC). [src/main.jsx](src/main.jsx) is a 9-line bootstrap. Treat App.jsx as a structured monolith — sections are demarcated with `// ===` banner comments. Use those banners (or the function names below) to navigate; do not split the file without a reason, since keeping everything in one module is an intentional simplicity choice (see README).

### The pipeline

1. **ZIP decoder** — [`readZipText`](src/App.jsx#L280) hand-parses the ZIP central directory and uses the browser-native `DecompressionStream('deflate-raw')`. There is no JSZip dependency. If you add file-format support, extend this directly.
2. **Parser** — [`parseWhatsApp`](src/App.jsx#L91) handles iOS `[DD.MM.YYYY, HH:MM:SS] Sender: msg` and Android `DD/MM/YY, HH:MM - Sender: msg`. Assumes DD/MM order. Strips LRM/RLM/directional marks (critical for Hebrew exports). Classifies system / deleted / media / voice via the `*_PATTERNS` arrays at the top. Returns `{ messages, diagnostics }` — diagnostics are surfaced in VerifyView, so every parser change should keep those counters honest.
3. **Analytics** — [`computeAll`](src/App.jsx#L341) is the only consumer of parsed messages. It produces per-user + group stats (bursts, conversation revivals/kills, trimmed-mean response times, eras, chaos moments, etc.). Every downstream slide reads from this object — do not compute metrics inside slides.
4. **Social layer** — deterministic rule engine inside `computeAll` and per-user fields. Titles, roasts, achievements, group descriptions all ship with an `evidence` string. **No LLM, no randomness, no network.** Same input → same output. Preserve this invariant.
5. **i18n** — [`I18N`](src/App.jsx#L1171) object holds every user-facing string keyed by locale (`en` is the fallback). [`buildT(lang)`](src/App.jsx#L3716) merges the requested locale over `en`. RTL is driven by `RTL_LANGS` (`he`, `ar`) and the `dir` attribute on the inner frame. When you add UI copy, add it as a key in `I18N.en` (and ideally `I18N.he`) — do not inline English strings into slides.
6. **Slides** — order lives in [`SLIDES_DEF`](src/App.jsx#L4367) (an array of 23 string ids). Each id maps to a `Slide*` component lower in the file. [`Wrapped`](src/App.jsx#L4658) is the auto-advancing player (6.5s/slide). To add/reorder slides, edit `SLIDES_DEF` and add the component — there is no separate registration step.

### The stage machine

[`ChatWrappedApp`](src/App.jsx#L3736) holds a `stage` string with these transitions:

```
landing → parsing → onboard → wrapped ⇄ menu → { verify | roastmode | wrapped(replay) | landing(reset) }
```

State (analytics, diagnostics, profile, selectedAuthor, lang) lives on this component and is threaded down as props. There is no context, no store, no router.

### Styling

Inline styles + `<style>` blocks in [`GlobalStyles`](src/App.jsx#L3931). No Tailwind, no CSS modules, no Framer Motion — animations are CSS keyframes and the `useAnimatedNumber` hook ([line 1121](src/App.jsx#L1121)). The whole app renders inside a fixed 380px-wide "phone frame" — design for that 9:16 viewport, not desktop width.

## Invariants worth preserving

- **No network calls beyond Google Fonts** — the privacy claim in README is load-bearing. Never add analytics, error reporting, or remote LLM calls.
- **Deterministic output** — analytics + social layer must be pure functions of the parsed messages. No `Math.random()`, no `Date.now()` in user-visible logic.
- **Diagnostics stay truthful** — VerifyView is the trust mechanism. If you change parsing or filtering, update the corresponding diagnostic counter so the numbers users see still add up.
- **i18n fallback chain** — never let a missing key crash a slide; `buildT` already falls back to `en`, so reach for `t.some_key` rather than hardcoded strings.

