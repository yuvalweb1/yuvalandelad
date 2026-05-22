// ============================================================
// whatsapp-wrapped-parser — ZIP reader (browser-native, zero deps)
// ------------------------------------------------------------
// WhatsApp's "Export Chat -> Attach Media" produces a .zip. We
// hand-parse the central directory and inflate the chat .txt with
// the platform's DecompressionStream — no JSZip, nothing leaves
// the device. Works on the main thread or inside a Web Worker
// (both have DecompressionStream + TextDecoder).
// ============================================================

/**
 * Extract the chat transcript text from a WhatsApp export.
 * Accepts a Blob/File (.zip). Picks `*_chat.txt`, else the first
 * file containing "chat", else the first .txt entry.
 * @param {Blob} file
 * @returns {Promise<string>} decoded UTF-8 transcript
 */
export async function readZipText(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP file');
  const cdOffset = dv.getUint32(eocd + 16, true);
  const cdEntries = dv.getUint16(eocd + 10, true);
  const txtEntries = [];
  let p = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.slice(p + 46, p + 46 + nameLen));
    if (name.toLowerCase().endsWith('.txt') && !name.endsWith('/')) {
      txtEntries.push({ name, method, compSize, localOffset });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (txtEntries.length === 0) throw new Error('No .txt file inside ZIP');
  const entry = txtEntries.find(e => e.name.toLowerCase().endsWith('_chat.txt'))
             || txtEntries.find(e => e.name.toLowerCase().includes('chat'))
             || txtEntries[0];
  const lo = entry.localOffset;
  if (dv.getUint32(lo, true) !== 0x04034b50) throw new Error('Bad local header');
  const lNameLen = dv.getUint16(lo + 26, true);
  const lExtraLen = dv.getUint16(lo + 28, true);
  const dataStart = lo + 30 + lNameLen + lExtraLen;
  const raw = buf.slice(dataStart, dataStart + entry.compSize);
  let decompressed;
  if (entry.method === 0) {
    decompressed = raw;
  } else if (entry.method === 8) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([raw]).stream().pipeThrough(ds);
    decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error('Unsupported compression method ' + entry.method);
  }
  return new TextDecoder('utf-8').decode(decompressed);
}
