// ============================================================
// whatsapp-wrapped-parser — main-thread client
// ------------------------------------------------------------
// Friendly Promise wrapper around worker.js. Falls back to main-thread
// parsing where Workers are unavailable.
//
//   const { messages, diagnostics, media } = await parseChat({
//     file,                       // File (.zip or .txt)   — OR —
//     text,                       // raw transcript string
//     includeMedia: true,         // extract photos/voice/videos/stickers
//     onProgress: (phase) => {},  // 'unzip' | 'parse'
//   });
//
// `media` is { photos, voice, videos, stickers } — each item has `url`
// (object URL) ready for an <img>/<audio>/<video>. Call URL.revokeObjectURL
// on every url when done.
// ============================================================

let _idSeq = 0;

// Materialize transferred bytes into <img>/<audio>/<video>-ready blob URLs.
function materializeList(items) {
  if (!items || !items.length) return [];
  return items.map(m => ({
    name: m.name, mime: m.mime, author: m.author, ts: m.ts,
    size: m.size ?? (m.bytes && m.bytes.length) ?? 0,
    count: m.count, // stickers carry an occurrence count
    url: URL.createObjectURL(new Blob([m.bytes], { type: m.mime })),
  }));
}
function materializeMedia(media) {
  if (!media) return { photos: [], voice: [], videos: [], stickers: [] };
  return {
    photos:   materializeList(media.photos),
    voice:    materializeList(media.voice),
    videos:   materializeList(media.videos),
    stickers: materializeList(media.stickers),
  };
}

/**
 * Parse a WhatsApp export off the main thread.
 * @param {{ file?: File, text?: string, includeMedia?: boolean, onProgress?: (phase: string) => void }} opts
 */
export function parseChat({ file, text, includeMedia = true, onProgress } = {}) {
  if (!file && text == null) {
    return Promise.reject(new Error('parseChat requires { file } or { text }'));
  }

  if (typeof Worker === 'undefined') {
    return parseOnMainThread({ file, text, includeMedia, onProgress });
  }

  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch {
      parseOnMainThread({ file, text, includeMedia, onProgress }).then(resolve, reject);
      return;
    }

    const id = ++_idSeq;
    const cleanup = () => { worker.terminate(); };

    worker.onmessage = (e) => {
      const msg = e.data || {};
      if (msg.id !== id) return;
      if (msg.type === 'progress') {
        onProgress && onProgress(msg.phase);
      } else if (msg.type === 'result') {
        cleanup();
        resolve({ messages: msg.messages, diagnostics: msg.diagnostics, media: materializeMedia(msg.media) });
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.error));
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(err.message || 'Worker failed to parse the chat.'));
    };

    if (file) {
      worker.postMessage({ id, type: 'parseFile', file, includeMedia });
    } else {
      worker.postMessage({ id, type: 'parseText', text });
    }
  });
}

// Fallback path: identical result shape, just on the main thread.
async function parseOnMainThread({ file, text, includeMedia, onProgress }) {
  const { parseWhatsApp } = await import('./parse.js');
  let raw = text;
  let mediaRaw = null;
  if (file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.zip')) {
      onProgress && onProgress('unzip');
      if (includeMedia) {
        const { readZipBundle } = await import('./zip.js');
        const bundle = await readZipBundle(file);
        raw = bundle.text;
        mediaRaw = { photos: bundle.photos, voice: bundle.voice, videos: bundle.videos, stickers: bundle.stickers };
      } else {
        const { readZipText } = await import('./zip.js');
        raw = await readZipText(file);
      }
    } else {
      raw = await file.text();
    }
  }
  onProgress && onProgress('parse');
  const { messages, diagnostics } = parseWhatsApp(raw);
  if (mediaRaw) {
    const byName = {};
    for (const m of messages) if (m.mediaFile) byName[m.mediaFile] = m;
    const tag = (item) => { const ref = byName[item.name]; item.author = ref ? ref.author : null; item.ts = ref ? ref.timestamp : null; };
    mediaRaw.photos.forEach(tag);
    mediaRaw.voice.forEach(tag);
    mediaRaw.videos.forEach(tag);
    mediaRaw.stickers.forEach(tag);
  }
  return { messages, diagnostics, media: materializeMedia(mediaRaw) };
}
