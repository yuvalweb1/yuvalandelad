// ============================================================
// whatsapp-wrapped-parser — ZIP reader (browser-native, zero deps)
// ------------------------------------------------------------
// WhatsApp's "Export Chat -> Attach Media" produces a .zip. We
// hand-parse the central directory and inflate entries with the
// platform's DecompressionStream — no JSZip, nothing leaves the
// device. Works on the main thread or inside a Web Worker.
//
//   readZipText(file)   -> chat transcript string
//   readZipBundle(file) -> { text, photos, voice, videos, stickers }
//     each media list is [{ name, bytes, mime, ... }] — caps applied.
// ============================================================

const IMAGE_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif',
};
const VOICE_MIME = { opus: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg' };
const VIDEO_MIME = { mp4: 'video/mp4', '3gp': 'video/3gpp', mov: 'video/quicktime' };

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}
function basename(name) { return name.split('/').pop(); }

// Stickers are .webp and either prefixed STK- or live in a "Stickers" folder;
// regular photo .webp also exists, but in WhatsApp exports stickers reliably
// match these conventions.
function isStickerName(name) {
  const b = basename(name);
  return extOf(b) === 'webp' && (/^STK[-_]/i.test(b) || /sticker/i.test(name));
}

// Tiny deterministic 32-bit content hash (FNV-1a) — used to group identical
// sticker files (WhatsApp sends a new file per share, same image content).
function hash32(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
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
 * Extract chat text + media files (photos, voice, videos, stickers).
 * Memory-guarded: each kind has its own count/size caps; bigger files are
 * sampled evenly across the year for variety.
 * @param {Blob} file
 * @param {object} [opts]
 * @returns {Promise<{ text: string, photos: any[], voice: any[], videos: any[], stickers: any[] }>}
 */
export async function readZipBundle(file, opts = {}) {
  const cfg = {
    maxImages: 60,       maxImageBytes: 6_000_000,  maxImagesTotal: 45_000_000,
    maxVoice:  20,       maxVoiceBytes: 4_000_000,  maxVoiceTotal:  24_000_000,
    maxVideos: 12,       maxVideoBytes: 12_000_000, maxVideosTotal: 45_000_000,
    maxStickers: 120,    maxStickerBytes: 300_000,  maxStickersTotal: 14_000_000,
    ...opts,
  };

  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  const entries = readCentralDirectory(buf, dv);

  const chatEntry = pickChatEntry(entries);
  if (!chatEntry) throw new Error('No .txt file inside ZIP');
  const text = new TextDecoder('utf-8').decode(await inflateEntry(buf, dv, chatEntry));

  // Categorize candidates by extension/name (stickers split from photos).
  const candidates = { photos: [], voice: [], videos: [], stickers: [] };
  for (const e of entries) {
    if (e.uncompSize === 0) continue;
    const ext = extOf(e.name);
    if (isStickerName(e.name) && e.uncompSize <= cfg.maxStickerBytes) {
      candidates.stickers.push(e);
    } else if (IMAGE_MIME[ext] && e.uncompSize <= cfg.maxImageBytes) {
      candidates.photos.push(e);
    } else if (VOICE_MIME[ext] && e.uncompSize <= cfg.maxVoiceBytes) {
      candidates.voice.push(e);
    } else if (VIDEO_MIME[ext] && e.uncompSize <= cfg.maxVideoBytes) {
      candidates.videos.push(e);
    }
  }

  // Photos: sample evenly across the (~chronological) list when over the cap.
  candidates.photos.sort((a, b) => a.name.localeCompare(b.name));
  if (candidates.photos.length > cfg.maxImages) {
    const step = candidates.photos.length / cfg.maxImages;
    candidates.photos = Array.from({ length: cfg.maxImages }, (_, i) => candidates.photos[Math.floor(i * step)]);
  }
  // Voice & videos: pick the LONGEST (= biggest file size, deterministic proxy
  // for duration since opus voice is ~constant bitrate and mp4 grows with length).
  candidates.voice.sort((a, b) => b.uncompSize - a.uncompSize);
  candidates.voice = candidates.voice.slice(0, cfg.maxVoice);
  candidates.videos.sort((a, b) => b.uncompSize - a.uncompSize);
  candidates.videos = candidates.videos.slice(0, cfg.maxVideos);
  // Stickers: take up to maxStickers (we hash & dedup AFTER inflating).
  candidates.stickers = candidates.stickers.slice(0, cfg.maxStickers);

  async function pullList(items, mimeMap, totalCap) {
    const out = [];
    let total = 0;
    for (const e of items) {
      if (total + e.uncompSize > totalCap) break;
      try {
        const bytes = await inflateEntry(buf, dv, e);
        const ext = extOf(e.name);
        out.push({ name: basename(e.name), bytes, mime: mimeMap[ext] || 'application/octet-stream', size: bytes.length });
        total += bytes.length;
      } catch { /* skip unreadable */ }
    }
    return out;
  }

  const photos   = await pullList(candidates.photos,   IMAGE_MIME, cfg.maxImagesTotal);
  const voice    = await pullList(candidates.voice,    VOICE_MIME, cfg.maxVoiceTotal);
  const videos   = await pullList(candidates.videos,   VIDEO_MIME, cfg.maxVideosTotal);
  const stickersRaw = await pullList(candidates.stickers, IMAGE_MIME, cfg.maxStickersTotal);

  // Sticker dedup: same image sent multiple times → multiple identical files.
  // Group by content hash; pick one representative bytes + the total count.
  const byHash = new Map();
  for (const s of stickersRaw) {
    const h = hash32(s.bytes);
    const ex = byHash.get(h);
    if (ex) { ex.count++; }
    else byHash.set(h, { name: s.name, bytes: s.bytes, mime: s.mime, hash: h, count: 1 });
  }
  const stickers = [...byHash.values()].sort((a, b) => b.count - a.count);

  return { text, photos, voice, videos, stickers };
}
