// ============================================================
// whatsapp-wrapped-parser — public API
// ------------------------------------------------------------
// This folder is self-contained and dependency-free. To open-source
// it (github.com/yuvalweb1/whatsapp-wrapped-parser) you can copy the
// whole src/parser/ directory as the package root — nothing here
// imports from the rest of the app.
//
// Everything runs in-memory: no fetch, no XHR, no analytics. The
// only browser APIs used are DecompressionStream, TextDecoder and
// (for the worker) the standard Worker/postMessage surface.
//
//   import { parseWhatsApp, readZipText } from 'whatsapp-wrapped-parser';
//   const { messages, diagnostics } = parseWhatsApp(text);
//
//   // Off-main-thread (recommended for large chats):
//   import { parseChat } from 'whatsapp-wrapped-parser/client';
//   const { messages, diagnostics } = await parseChat({ file });
// ============================================================

export { parseWhatsApp, parseDate, stripDirectional, extractMediaFile } from './parse.js';
export { readZipText, readZipBundle } from './zip.js';
export {
  SYSTEM_PATTERNS,
  MEDIA_PATTERNS,
  VOICE_PATTERNS,
  DELETED_PATTERNS,
  HEADER_PATTERNS,
  SYSTEM_HEADER_PATTERNS,
  LINK_RE,
  EMOJI_RE,
} from './patterns.js';
