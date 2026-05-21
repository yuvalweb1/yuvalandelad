# ChatWrapped

A cinematic recap of your WhatsApp group chat year — Eras, Awards, Drama. Built like Spotify Wrapped, but for your group chat.

**100% privacy: nothing leaves your device.** All parsing and analysis runs in the browser.

---

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Build for production

```bash
npm run build
npm run preview   # to test the prod build locally
```

The output lives in `dist/`. Deploy to Vercel, Netlify, Cloudflare Pages, or any static host.

## How to export your WhatsApp chat

On your phone:

1. Open the WhatsApp chat.
2. Tap the chat name (top bar).
3. Scroll down → **Export Chat**.
4. Choose **Without Media** (smaller file).
5. Save the `.zip` or `.txt`.

Upload it to ChatWrapped — the file never leaves your browser.

## What you get

- 23 cinematic story slides (auto-advancing, vertical 9:16, screenshot-ready)
- Roast Mode — savage, evidence-based takes for every participant
- Per-person Wrapped — pick anyone in the chat
- VerifyView — full parser diagnostics so you can trust the numbers
- 10 languages (full UI + social layer in EN / HE; UI chrome in 6 more)

## Stack

- **React 18** + **Vite** (no Next.js — single page app)
- Inline styles + CSS keyframes (no Tailwind, no Framer Motion)
- Browser-native `DecompressionStream` for `.zip` parsing (no JSZip)
- Single-file component (`src/App.jsx`), ~7000 LOC

## Project structure

```
chatwrapped/
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── main.jsx       # React entry
    └── App.jsx        # The entire app — parser, analytics, social layer, all slides
```

## Architecture (in 30 seconds)

1. **Parser** (`parseWhatsApp`) — handles iOS + Android formats, DD/MM and MM/DD, strips invisible direction marks, returns `{messages, diagnostics}`.
2. **Analytics** (`computeAll`) — turns messages into per-user + group stats. Burst detection, conversation revivals/kills, response times (trimmed mean), eras, chaos moments.
3. **Social Layer** — deterministic rule engine that turns numbers into titles, roasts, achievements, group descriptions. Every output ships with an evidence string. No LLM.
4. **i18n** — `buildT(lang)` merges English fallback with locale overrides. All user-facing strings live in the `I18N` object. RTL support for HE/AR.
5. **Slides** — 23 components in a `SLIDES_DEF` array. Auto-advance every 6.5s. Each slide receives `t` for translation, plus the user analytics.

## Privacy

There is no backend. There are no analytics. There are no network calls (except loading Google Fonts in `index.html` — you can self-host those if you want).

Your WhatsApp `.zip` or `.txt` is read with `FileReader`, parsed in-browser, displayed, and discarded when you close the tab. Verify in DevTools → Network.

## License

Your code, your call.
