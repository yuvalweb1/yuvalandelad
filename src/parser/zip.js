// ============================================================
// whatsapp-wrapped-parser — ZIP reader (browser-native, zero deps)
// ------------------------------------------------------------
// WhatsApp's "Export Chat -> Attach Media" produces a .zip. We
// hand-parse the central directory and inflate entries with the
// platform's DecompressionStream — no JSZip, nothing leaves the
// device. Works on the main thread or inside a Web Worker.
//
// I/O uses Blob.slice(), so archives never have to fit in RAM —
// only the central directory (filenames + offsets, typically a
// few MB) and one entry's compressed payload are resident at a
// time. Zip64 is supported: archives with more than 65,535
// entries, central directories past 4 GB, or individual entries
// past 4 GB all parse correctly.
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

// Read a byte range from the file as a Uint8Array.
async function readSlice(file, offset, length) {
  return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
}

// Two getUint32 reads instead of DataView.getBigUint64 — the BigUint64
// API isn't available in every older WebView we ship to. Safe up to
// 2^53 bytes (~9 PB), well beyond any real WhatsApp export.
function readUint64(dv, offset) {
  const lo = dv.getUint32(offset, true);
  const hi = dv.getUint32(offset + 4, true);
  return hi * 0x100000000 + lo;
}

// Locate the End-of-Central-Directory record + (optional) Zip64
// locator/record in a single pass over the file tail. Returns the
// real central-directory location, preferring Zip64 values when the
// classic ones are sentinels.
async function locateCentralDirectory(file) {
  const size = file.size;
  const tailLen = Math.min(size, 65557 + 22);
  const tailStart = size - tailLen;
  const tail = await readSlice(file, tailStart, tailLen);
  const tdv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tdv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP file');

  let cdEntries = tdv.getUint16(eocd + 10, true);
  let cdSize    = tdv.getUint32(eocd + 12, true);
  let cdOffset  = tdv.getUint32(eocd + 16, true);

  // Same-pass probe: if any classic field is a sentinel, the Zip64 EOCD
  // locator sits exactly 20 bytes before the classic EOCD. Read it from
  // the tail buffer when possible; otherwise fall back to one more slice.
  const needsZip64 =
    cdEntries === 0xFFFF || cdOffset === 0xFFFFFFFF || cdSize === 0xFFFFFFFF;
  if (needsZip64) {
    const locInTail = eocd - 20;
    let locator;
    if (locInTail >= 0) {
      locator = tail.subarray(locInTail, locInTail + 20);
    } else {
      const locFileOffset = tailStart + locInTail;
      if (locFileOffset >= 0) {
        locator = await readSlice(file, locFileOffset, 20);
      }
    }
    if (locator) {
      const ldv = new DataView(locator.buffer, locator.byteOffset, locator.byteLength);
      if (ldv.getUint32(0, true) === 0x07064b50) {
        const z64Offset = readUint64(ldv, 8);
        const z64 = await readSlice(file, z64Offset, 56);
        const zdv = new DataView(z64.buffer, z64.byteOffset, z64.byteLength);
        if (zdv.getUint32(0, true) === 0x06064b50) {
          cdEntries = readUint64(zdv, 32);
          cdSize    = readUint64(zdv, 40);
          cdOffset  = readUint64(zdv, 48);
        }
      }
      // If the locator/record isn't there, fall through with classic values.
      // 65535 entries is a legal non-Zip64 count, so 0xFFFF alone isn't fatal.
    }
  }

  return { cdOffset, cdSize, cdEntries };
}

// Parse a central-directory buffer into entry metadata, expanding Zip64
// extra fields when the classic 32-bit values are sentinels.
function parseCentralDirectory(cd, cdEntries) {
  const dv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const decoder = new TextDecoder();
  const entries = [];
  let p = 0;
  for (let i = 0; i < cdEntries; i++) {
    if (p + 46 > cd.length) throw new Error('Central directory truncated at entry ' + i);
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Bad central directory signature at entry ' + i);
    const method      = dv.getUint16(p + 10, true);
    let   compSize    = dv.getUint32(p + 20, true);
    let   uncompSize  = dv.getUint32(p + 24, true);
    const nameLen     = dv.getUint16(p + 28, true);
    const extraLen    = dv.getUint16(p + 30, true);
    const commentLen  = dv.getUint16(p + 32, true);
    let   localOffset = dv.getUint32(p + 42, true);
    const nameStart   = p + 46;
    const name = decoder.decode(cd.subarray(nameStart, nameStart + nameLen));

    // Zip64 extra field (header ID 0x0001): fields are positional and
    // *conditional* — a slot is only present when the matching 32-bit
    // value was 0xFFFFFFFF. Order: uncompSize, compSize, localOffset,
    // diskNumber. Reading them positionally regardless of which were
    // actually sentinels silently misaligns sizes and offsets.
    const sentinelUncomp = uncompSize  === 0xFFFFFFFF;
    const sentinelComp   = compSize    === 0xFFFFFFFF;
    const sentinelOffset = localOffset === 0xFFFFFFFF;
    if (sentinelUncomp || sentinelComp || sentinelOffset) {
      const extraStart = nameStart + nameLen;
      const extraEnd   = extraStart + extraLen;
      let ep = extraStart;
      while (ep + 4 <= extraEnd) {
        const headerId = dv.getUint16(ep, true);
        const dataSize = dv.getUint16(ep + 2, true);
        if (headerId === 0x0001) {
          let zp = ep + 4;
          if (sentinelUncomp) { uncompSize  = readUint64(dv, zp); zp += 8; }
          if (sentinelComp)   { compSize    = readUint64(dv, zp); zp += 8; }
          if (sentinelOffset) { localOffset = readUint64(dv, zp); zp += 8; }
          break;
        }
        ep += 4 + dataSize;
      }
    }

    if (!name.endsWith('/')) entries.push({ name, method, compSize, uncompSize, localOffset });
    p = nameStart + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readCentralDirectory(file) {
  const { cdOffset, cdSize, cdEntries } = await locateCentralDirectory(file);
  const cd = await readSlice(file, cdOffset, cdSize);
  return parseCentralDirectory(cd, cdEntries);
}

// Inflate a single entry to raw bytes (handles STORED + deflate).
// Reads the 30-byte local header, then slices just the compressed payload —
// the file behind `file` is never fully resident.
async function inflateEntry(file, entry) {
  const lhdr = await readSlice(file, entry.localOffset, 30);
  const ldv = new DataView(lhdr.buffer, lhdr.byteOffset, lhdr.byteLength);
  if (ldv.getUint32(0, true) !== 0x04034b50) throw new Error('Bad local header');
  const lNameLen  = ldv.getUint16(26, true);
  const lExtraLen = ldv.getUint16(28, true);
  const dataStart = entry.localOffset + 30 + lNameLen + lExtraLen;
  if (entry.method === 0) {
    return await readSlice(file, dataStart, entry.compSize);
  }
  if (entry.method === 8) {
    const dataBlob = file.slice(dataStart, dataStart + entry.compSize);
    const stream = dataBlob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
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
  const entries = await readCentralDirectory(file);
  const entry = pickChatEntry(entries);
  if (!entry) throw new Error('No .txt file inside ZIP');
  return new TextDecoder('utf-8').decode(await inflateEntry(file, entry));
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

  const entries = await readCentralDirectory(file);

  const chatEntry = pickChatEntry(entries);
  if (!chatEntry) throw new Error('No .txt file inside ZIP');
  const text = new TextDecoder('utf-8').decode(await inflateEntry(file, chatEntry));

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
        const bytes = await inflateEntry(file, e);
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
