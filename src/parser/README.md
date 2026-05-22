# whatsapp-wrapped-parser

A tiny, **dependency-free**, **100% client-side** parser for WhatsApp chat
exports. No network calls, no analytics, no `Date.now()`, no `Math.random()` —
**the same input always produces the same output**, and your messages never
leave the device.

> This folder is self-contained. To open-source it at
> `github.com/yuvalweb1/whatsapp-wrapped-parser`, copy `src/parser/` as the
> package root — nothing here imports from the rest of the app.

## Why it exists

WhatsApp's "Export chat" feature produces wildly inconsistent `.txt` files:

- **iOS** wraps the header in brackets: `[12.03.2024, 21:05:43] Dana: hey`
- **Android** uses a dash: `12/03/2024, 21:05 - Dana: hey`
- 12-hour (`9:05 PM`) **and** 24-hour clocks, `.`/`/`/`-` date separators,
  2- or 4-digit years, ASCII or unicode dashes.
- **Multiline messages** (the user pressed Enter) have no header on the
  continuation lines — naive `split('\n')` parsers break here.
- **Hebrew/Arabic** exports are littered with invisible bidi control marks
  (LRM/RLM/isolates) and a UTF-8 BOM that corrupt matching.
- **System lines** ("X joined", "Messages are end-to-end encrypted", deleted
  messages, media/voice placeholders) must be classified, not counted as chat.

This parser handles all of the above and reports **honest diagnostics** so a UI
can show users exactly what was and wasn't counted.

## Install

```bash
npm install whatsapp-wrapped-parser
```

## Usage

### Synchronous (small files / Node / tests)

```js
import { parseWhatsApp } from 'whatsapp-wrapped-parser';

const { messages, diagnostics } = parseWhatsApp(rawText);
// messages    -> ParsedMessage[]  (deleted messages already filtered out)
// diagnostics -> { parsedMessages, systemMessages, mediaMessages,
//                  confidence, detectedFormat, warnings, sample, ... }
```

### Off the main thread (recommended in the browser)

For large histories, run the ZIP inflate + parse in a Web Worker so the UI
never freezes:

```js
import { parseChat } from 'whatsapp-wrapped-parser/client';

const { messages, diagnostics } = await parseChat({
  file,                                   // a File: .zip or .txt
  onProgress: (phase) => console.log(phase), // 'unzip' | 'parse'
});
```

`parseChat` spawns a one-shot module worker, relays progress, resolves with the
result, then terminates the worker. If Workers are unavailable it falls back to
main-thread parsing automatically — same result shape either way.

You can also pass raw text instead of a file: `parseChat({ text })`.

### ZIP exports (with media)

`parseChat({ file })` handles `.zip` automatically. To do it yourself:

```js
import { readZipText, parseWhatsApp } from 'whatsapp-wrapped-parser';

const text = await readZipText(zipFile);   // browser-native, no JSZip
const { messages } = parseWhatsApp(text);
```

`readZipText` hand-parses the ZIP central directory and inflates the chat `.txt`
using the platform `DecompressionStream('deflate-raw')` — zero dependencies.

## `ParsedMessage`

| field           | type       | notes                                        |
| --------------- | ---------- | -------------------------------------------- |
| `timestamp`     | `Date`     | local time; survives Worker structured clone |
| `author`        | `string`   | sender name, trimmed                         |
| `content`       | `string`   | full text incl. continuation lines           |
| `contentLength` | `number`   | characters — feed "longest avg message"      |
| `wordCount`     | `number`   | links/emoji stripped before counting         |
| `emojis`        | `string[]` | excludes emoji that appear in author names   |
| `hasMedia`      | `boolean`  | image/video/sticker/doc/attachment omitted   |
| `isVoice`       | `boolean`  | voice note / `.opus`                          |
| `hasLink`       | `boolean`  | / `linkCount`                                |
| `isQuestion`    | `boolean`  | contains `?` or `؟`                          |
| `hour`          | `number`   | 0–23 — feed "night owl" (00:00–05:59)        |
| `weekday`       | `number`   | 0–6 (Sun–Sat)                                |
| `dayKey`        | `string`   | `YYYY-MM-DD`                                 |

`isDeleted` messages are excluded from the returned array but counted in
`diagnostics.deletedMessages`.

## `diagnostics` — the trust layer

Every counter is traceable to the input, so a UI can prove nothing was fudged:

```js
{
  rawLineCount, nonEmptyLines, parsedMessages, continuationLines,
  systemMessages, deletedMessages, mediaMessages, voiceMessages,
  skippedUnparseable, detectedFormat,        // 'ios_bracket' | 'android_dash'
  perAuthorCount, perAuthorWordCount, perAuthorMediaCount, perAuthorVoiceCount,
  hadBOM, hadDirectionalMarks,
  confidence,                                // 0–100 heuristic
  warnings,                                  // human-readable strings
  sample,                                    // first 20 parsed rows for a debug view
}
```

## Files

| file          | purpose                                                   |
| ------------- | --------------------------------------------------------- |
| `parse.js`    | `parseWhatsApp`, `parseDate`, `stripDirectional` (pure)   |
| `patterns.js` | all locale/format regex tables (HE + EN, iOS + Android)   |
| `zip.js`      | `readZipText` — browser-native ZIP inflate                |
| `worker.js`   | Web Worker entry (module worker)                          |
| `client.js`   | `parseChat` — Promise wrapper + main-thread fallback      |
| `index.js`    | public API barrel                                         |

## Assumptions & limits

- Date order is assumed **DD/MM** (WhatsApp uses the device locale; this covers
  IL and most of the world). US **MM/DD** exports are ambiguous when both
  numbers are ≤ 12.
- System-event detection ships with **Hebrew + English** strings. Add your
  locale's strings to `SYSTEM_PATTERNS` in `patterns.js`.

## License

MIT
