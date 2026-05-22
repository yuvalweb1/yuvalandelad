// ============================================================
// whatsapp-wrapped-parser — Web Worker entry
// ------------------------------------------------------------
// Runs the heavy work (ZIP inflate + line-by-line parse) off the
// main thread so the UI never freezes on large exports. A module
// worker; spawn it with:
//
//   new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
//
// Protocol (see client.js for the friendly Promise wrapper):
//   in : { id, type: 'parseFile', file }   // File (.zip or .txt)
//        { id, type: 'parseText', text }    // raw transcript text
//   out: { id, type: 'progress', phase }    // 'unzip' | 'parse'
//        { id, type: 'result', messages, diagnostics, media }
//        { id, type: 'error',  error }
//
// `media` (only for .zip "with media" exports) is an array of
// { name, mime, author, ts, bytes:Uint8Array } — bytes are transferred
// zero-copy; the main thread turns them into blob URLs. Date objects in
// `messages` survive structured clone.
// ============================================================

import { parseWhatsApp } from './parse.js';
import { readZipBundle } from './zip.js';

self.onmessage = async (e) => {
  const { id, type } = e.data || {};
  const post = (msg, transfer) => self.postMessage({ id, ...msg }, transfer || []);

  try {
    let text;
    let media = [];

    if (type === 'parseFile') {
      const file = e.data.file;
      const name = (file.name || '').toLowerCase();
      const isZip = name.endsWith('.zip') || (!name.endsWith('.txt') && (await looksLikeZip(file)));
      if (isZip) {
        post({ type: 'progress', phase: 'unzip' });
        const bundle = await readZipBundle(file);
        text = bundle.text;
        media = bundle.media;
      } else if (name.endsWith('.txt') || name === '') {
        text = await file.text();
      } else {
        throw new Error('Upload a .txt or .zip from WhatsApp export.');
      }
    } else if (type === 'parseText') {
      text = e.data.text;
    } else {
      throw new Error('Unknown message type: ' + type);
    }

    post({ type: 'progress', phase: 'parse' });
    const { messages, diagnostics } = parseWhatsApp(text);

    // Tie each extracted image to who sent it (and when) via the filename the
    // chat references. Drop images that don't decode to a known sender only if
    // we can't place them at all — we still keep them for the group collage.
    if (media.length > 0) {
      const byName = {};
      for (const m of messages) if (m.mediaFile) byName[m.mediaFile] = m;
      for (const item of media) {
        const ref = byName[item.name];
        item.author = ref ? ref.author : null;
        item.ts = ref ? ref.timestamp : null;
      }
    }

    const transfer = media.map(m => m.bytes.buffer);
    post({ type: 'result', messages, diagnostics, media }, transfer);
  } catch (err) {
    post({ type: 'error', error: err && err.message ? err.message : String(err) });
  }
};

// Sniff the PK\x03\x04 local-file signature so a mis-named .zip still works.
async function looksLikeZip(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  } catch {
    return false;
  }
}
