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
//        { id, type: 'result', messages, diagnostics }
//        { id, type: 'error',  error }
//
// Date objects in `messages` survive structured clone, so no
// (de)serialization step is needed on the main thread.
// ============================================================

import { parseWhatsApp } from './parse.js';
import { readZipText } from './zip.js';

self.onmessage = async (e) => {
  const { id, type } = e.data || {};
  const post = (msg) => self.postMessage({ id, ...msg });

  try {
    let text;

    if (type === 'parseFile') {
      const file = e.data.file;
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.zip') || (!name.endsWith('.txt') && (await looksLikeZip(file)))) {
        post({ type: 'progress', phase: 'unzip' });
        text = await readZipText(file);
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
    post({ type: 'result', messages, diagnostics });
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
