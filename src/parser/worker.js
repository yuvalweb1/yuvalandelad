// ============================================================
// whatsapp-wrapped-parser — Web Worker entry
// ------------------------------------------------------------
// Runs the heavy work (ZIP inflate + parse) off the main thread.
// Spawn:
//   new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
//
// Protocol (see client.js for the friendly wrapper):
//   in : { id, type:'parseFile', file, includeMedia? }   // File (.zip|.txt)
//        { id, type:'parseText', text }                  // raw transcript
//   out: { id, type:'progress', phase }                  // 'unzip' | 'parse'
//        { id, type:'result', messages, diagnostics, media }
//        { id, type:'error',  error }
//
// `media` is { photos, voice, videos, stickers } — each [{name, bytes, mime,
// author, ts, ...}]. Bytes transferred zero-copy; main thread turns them into
// blob URLs. Date objects survive structured clone.
// ============================================================

import { parseWhatsApp } from './parse.js';
import { readZipBundle, readZipText } from './zip.js';

const EMPTY_MEDIA = { photos: [], voice: [], videos: [], stickers: [] };

self.onmessage = async (e) => {
  const { id, type } = e.data || {};
  const post = (msg, transfer) => self.postMessage({ id, ...msg }, transfer || []);

  try {
    let text;
    let media = EMPTY_MEDIA;

    if (type === 'parseFile') {
      const file = e.data.file;
      const includeMedia = e.data.includeMedia !== false; // default on
      const name = (file.name || '').toLowerCase();
      const isZip = name.endsWith('.zip') || (!name.endsWith('.txt') && (await looksLikeZip(file)));
      if (isZip) {
        post({ type: 'progress', phase: 'unzip' });
        if (includeMedia) {
          const bundle = await readZipBundle(file);
          text = bundle.text;
          media = { photos: bundle.photos, voice: bundle.voice, videos: bundle.videos, stickers: bundle.stickers };
        } else {
          // Text-only path — lighter, no media extraction.
          text = await readZipText(file);
        }
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

    // Tie each extracted media item to its sender via the filename the chat
    // references. Photos/voice/videos use filename match; stickers share a
    // representative file so association is less reliable — left as null.
    const byName = {};
    for (const m of messages) if (m.mediaFile) byName[m.mediaFile] = m;
    const tag = (item) => { const ref = byName[item.name]; item.author = ref ? ref.author : null; item.ts = ref ? ref.timestamp : null; };
    media.photos.forEach(tag);
    media.voice.forEach(tag);
    media.videos.forEach(tag);
    media.stickers.forEach(tag);

    const transfer = [
      ...media.photos.map(m => m.bytes.buffer),
      ...media.voice.map(m => m.bytes.buffer),
      ...media.videos.map(m => m.bytes.buffer),
      ...media.stickers.map(m => m.bytes.buffer),
    ];
    post({ type: 'result', messages, diagnostics, media }, transfer);
  } catch (err) {
    post({ type: 'error', error: err && err.message ? err.message : String(err) });
  }
};

async function looksLikeZip(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  } catch {
    return false;
  }
}
