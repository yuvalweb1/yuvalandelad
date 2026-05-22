// ============================================================
// whatsapp-wrapped-parser — main-thread client
// ------------------------------------------------------------
// Friendly Promise wrapper around worker.js. Spawns a one-shot
// module worker, relays progress, resolves with the parse result,
// then terminates the worker. If Workers (or module workers) are
// unavailable, it transparently falls back to parsing on the main
// thread so the app still works everywhere.
//
//   const { messages, diagnostics, media } = await parseChat({
//     file,                       // File (.zip or .txt)   — OR —
//     text,                       // raw transcript string
//     onProgress: (phase) => {},  // 'unzip' | 'parse'
//   });
//
// `media` is an array of { name, mime, author, ts, url } where `url` is an
// object URL ready for an <img>. Call URL.revokeObjectURL(url) when done.
// ============================================================

let _idSeq = 0;

// Turn the transferred image bytes into <img>-ready object URLs (main thread).
function materializeMedia(media) {
  if (!media || !media.length) return [];
  return media.map(m => ({
    name: m.name, mime: m.mime, author: m.author, ts: m.ts,
    url: URL.createObjectURL(new Blob([m.bytes], { type: m.mime })),
  }));
}

/**
 * Parse a WhatsApp export off the main thread.
 * @param {{ file?: File, text?: string, onProgress?: (phase: string) => void }} opts
 * @returns {Promise<{ messages: Array, diagnostics: object, media: Array }>}
 */
export function parseChat({ file, text, onProgress } = {}) {
  if (!file && text == null) {
    return Promise.reject(new Error('parseChat requires { file } or { text }'));
  }

  if (typeof Worker === 'undefined') {
    return parseOnMainThread({ file, text, onProgress });
  }

  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch {
      // Some environments block module workers — degrade gracefully.
      parseOnMainThread({ file, text, onProgress }).then(resolve, reject);
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
      worker.postMessage({ id, type: 'parseFile', file });
    } else {
      worker.postMessage({ id, type: 'parseText', text });
    }
  });
}

// Fallback path: identical result shape, just on the main thread.
async function parseOnMainThread({ file, text, onProgress }) {
  const { parseWhatsApp } = await import('./parse.js');
  let raw = text;
  let mediaRaw = [];
  if (file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.zip')) {
      onProgress && onProgress('unzip');
      const { readZipBundle } = await import('./zip.js');
      const bundle = await readZipBundle(file);
      raw = bundle.text;
      mediaRaw = bundle.media;
    } else {
      raw = await file.text();
    }
  }
  onProgress && onProgress('parse');
  const { messages, diagnostics } = parseWhatsApp(raw);
  if (mediaRaw.length) {
    const byName = {};
    for (const m of messages) if (m.mediaFile) byName[m.mediaFile] = m;
    for (const item of mediaRaw) {
      const ref = byName[item.name];
      item.author = ref ? ref.author : null;
      item.ts = ref ? ref.timestamp : null;
    }
  }
  return { messages, diagnostics, media: materializeMedia(mediaRaw) };
}
