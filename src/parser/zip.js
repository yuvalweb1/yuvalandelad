// ============================================================
// whatsapp-wrapped-parser — ZIP reader (browser-native, zero deps)
// ------------------------------------------------------------
// WhatsApp's "Export Chat -> Attach Media" produces a .zip. We
// hand-parse the central directory and inflate entries with the
// platform's DecompressionStream — no JSZip, nothing leaves the
// device. Works on the main thread or inside a Web Worker.
//
//   readZipText(file)   -> chat transcript string
//   readZipBundle(file) -> { text, media: [{ name, bytes, mime }] }
// ============================================================

const IMAGE_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif',
};

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

// Read the central directory once → list every entry's metadata.
function readCentralDirectory(buf, dv) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP file');
  const cdOffset = dv.getUint32(eocd + 16, true);
  const cdEntries = dv.getUint16(eocd + 10, true);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.slice(p + 46, p + 46 + nameLen));
    if (!name.endsWith('/')) entries.push({ name, method, compSize, uncompSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// Inflate a single entry to raw bytes (handles STORED + deflate).
async function inflateEntry(buf, dv, entry) {
  const lo = entry.localOffset;
  if (dv.getUint32(lo, true) !== 0x04034b50) throw new Error('Bad local header');
  const lNameLen = dv.getUint16(lo + 26, true);
  const lExtraLen = dv.getUint16(lo + 28, true);
  const dataStart = lo + 30 + lNameLen + lExtraLen;
  const raw = buf.slice(dataStart, dataStart + entry.compSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([raw]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error('Unsupported compression method ' + entry.method);
}

function pickChatEntry(entries) {
  const txt = entries.filter(e => e.name.toLowerCase().endsWith('.txt'));
  if (txt.length === 0) return null;
  return txt.find(e => e.name.toLowerCase().endsWith('_chat.txt'))
      || txt.find(e => e.name.toLowerCase().includes('chat'))
      || txt[0];
}

/**
 * Extract the chat transcript text from a WhatsApp export.
 * @param {Blob} file
 * @returns {Promise<string>}
 */
export async function readZipText(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  const entry = pickChatEntry(readCentralDirectory(buf, dv));
  if (!entry) throw new Error('No .txt file inside ZIP');
  return new TextDecoder('utf-8').decode(await inflateEntry(buf, dv, entry));
}

/**
 * Extract the chat transcript AND the image files from a WhatsApp export.
 * Memory-guarded: only images, capped count + per-file size, sampled evenly
 * across the chat when there are more than `maxImages`.
 * @param {Blob} file
 * @param {{maxImages?:number, maxBytes?:number, maxTotalBytes?:number}} [opts]
 * @returns {Promise<{ text: string, media: Array<{name:string, bytes:Uint8Array, mime:string}> }>}
 */
export async function readZipBundle(file, opts = {}) {
  const maxImages = opts.maxImages ?? 60;
  const maxBytes = opts.maxBytes ?? 6_000_000;       // skip any single huge image
  const maxTotalBytes = opts.maxTotalBytes ?? 45_000_000; // overall memory cap

  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  const entries = readCentralDirectory(buf, dv);

  const chatEntry = pickChatEntry(entries);
  if (!chatEntry) throw new Error('No .txt file inside ZIP');
  const text = new TextDecoder('utf-8').decode(await inflateEntry(buf, dv, chatEntry));

  // Candidate images: known image extension, not absurdly large.
  let images = entries
    .filter(e => IMAGE_MIME[extOf(e.name)] && e.uncompSize > 0 && e.uncompSize <= maxBytes)
    .sort((a, b) => a.name.localeCompare(b.name)); // ~chronological for WhatsApp names

  // Evenly sample if there are more than the cap (variety across the year).
  if (images.length > maxImages) {
    const step = images.length / maxImages;
    const picked = [];
    for (let i = 0; i < maxImages; i++) picked.push(images[Math.floor(i * step)]);
    images = picked;
  }

  const media = [];
  let total = 0;
  for (const e of images) {
    if (total + e.uncompSize > maxTotalBytes) break;
    try {
      const bytes = await inflateEntry(buf, dv, e);
      media.push({ name: e.name.split('/').pop(), bytes, mime: IMAGE_MIME[extOf(e.name)] });
      total += bytes.length;
    } catch { /* skip unreadable entry */ }
  }

  return { text, media };
}
