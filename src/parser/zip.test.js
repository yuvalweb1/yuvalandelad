// ============================================================
// zip.js — synthetic-archive tests
// ------------------------------------------------------------
// Targets the Zip64 paths most likely to silently misread:
//   1. >65,535 entries (cdEntries sentinel → real count in Zip64 EOCD)
//   2. CD entry with ONLY localOffset extended (positional extra-field bug)
//
// Run with: node src/parser/zip.test.js
// Requires Node 18+ for globals: Blob, DecompressionStream, Response.
// ============================================================

import { readZipText } from './zip.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---- ZIP byte-level builders (just enough to forge fixtures) ----

function u16(v) { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, v, true); return a; }
function u32(v) { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, v >>> 0, true); return a; }
function u64(v) {
  const a = new Uint8Array(8);
  const dv = new DataView(a.buffer);
  dv.setUint32(0, v >>> 0, true);
  dv.setUint32(4, Math.floor(v / 0x100000000), true);
  return a;
}
function concat(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const enc = (s) => new TextEncoder().encode(s);

// Local File Header for a STORED entry. compSize === uncompSize === data.length.
function buildLFH(name, data) {
  const nameBytes = enc(name);
  return concat([
    u32(0x04034b50),    // signature
    u16(20),            // version needed
    u16(0),             // flags
    u16(0),             // method (STORED)
    u16(0), u16(0),     // time, date
    u32(0),             // crc32 (unchecked by our parser)
    u32(data.length),   // compSize
    u32(data.length),   // uncompSize
    u16(nameBytes.length),
    u16(0),             // extraLen
    nameBytes,
    data,
  ]);
}

// Central Directory Header for a STORED entry, with optional Zip64 extra
// expressing only the local-header offset (header ID 0x0001, 8 bytes).
function buildCDH(name, dataLen, localOffset, { offsetSentinel = false } = {}) {
  const nameBytes = enc(name);
  const extra = offsetSentinel
    ? concat([u16(0x0001), u16(8), u64(localOffset)])
    : new Uint8Array(0);
  return concat([
    u32(0x02014b50),    // signature
    u16(20), u16(20),   // version made by / needed
    u16(0),             // flags
    u16(0),             // method
    u16(0), u16(0),     // time, date
    u32(0),             // crc32
    u32(dataLen),       // compSize (32-bit, NOT a sentinel)
    u32(dataLen),       // uncompSize (32-bit, NOT a sentinel)
    u16(nameBytes.length),
    u16(extra.length),
    u16(0),             // commentLen
    u16(0),             // diskStart
    u16(0),             // internal attrs
    u32(0),             // external attrs
    u32(offsetSentinel ? 0xFFFFFFFF : localOffset),
    nameBytes,
    extra,
  ]);
}

function buildZip64EOCD(cdEntries, cdSize, cdOffset) {
  return concat([
    u32(0x06064b50),    // signature
    u64(44),            // size of this record (excludes sig + this field)
    u16(45), u16(45),   // version made by / needed
    u32(0), u32(0),     // disk numbers
    u64(cdEntries),     // entries on this disk
    u64(cdEntries),     // total entries
    u64(cdSize),
    u64(cdOffset),
  ]);
}

function buildZip64Locator(z64Offset) {
  return concat([
    u32(0x07064b50),    // signature
    u32(0),             // disk with start of Zip64 EOCD
    u64(z64Offset),
    u32(1),             // total disks
  ]);
}

function buildEOCD({ cdEntries, cdSize, cdOffset }) {
  return concat([
    u32(0x06054b50),    // signature
    u16(0), u16(0),     // disk numbers
    u16(Math.min(cdEntries, 0xFFFF)),
    u16(Math.min(cdEntries, 0xFFFF)),
    u32(Math.min(cdSize,    0xFFFFFFFF)),
    u32(Math.min(cdOffset,  0xFFFFFFFF)),
    u16(0),             // comment length
  ]);
}

// ---- Test 1: >65,535 entries ----
// Triggers cdEntries sentinel (0xFFFF) in classic EOCD; real count must come
// from the Zip64 EOCD record. Catches archives where someone reads the
// uint16 count literally and silently truncates to 65535 entries.

test('readCentralDirectory iterates >65,535 entries via Zip64 EOCD', async () => {
  const FILLER_COUNT = 65535;
  const fillerName = 'a';
  const chatName = 'chat.txt';
  const chatText = 'hello';
  const chatBytes = enc(chatText);

  const fillerLFH = buildLFH(fillerName, new Uint8Array(0));
  const chatLFH   = buildLFH(chatName, chatBytes);

  const lfhParts = [];
  const localOffsets = new Array(FILLER_COUNT + 1);
  let runningOffset = 0;
  for (let i = 0; i < FILLER_COUNT; i++) {
    localOffsets[i] = runningOffset;
    lfhParts.push(fillerLFH);
    runningOffset += fillerLFH.length;
  }
  localOffsets[FILLER_COUNT] = runningOffset;
  lfhParts.push(chatLFH);
  runningOffset += chatLFH.length;

  const cdOffset = runningOffset;
  const cdParts = [];
  let cdLen = 0;
  for (let i = 0; i < FILLER_COUNT; i++) {
    const cdh = buildCDH(fillerName, 0, localOffsets[i]);
    cdParts.push(cdh);
    cdLen += cdh.length;
  }
  const chatCDH = buildCDH(chatName, chatBytes.length, localOffsets[FILLER_COUNT]);
  cdParts.push(chatCDH);
  cdLen += chatCDH.length;

  const totalEntries = FILLER_COUNT + 1; // 65536
  const z64Offset = cdOffset + cdLen;
  const zip64Eocd = buildZip64EOCD(totalEntries, cdLen, cdOffset);
  const zip64Loc  = buildZip64Locator(z64Offset);
  // Mark cdEntries sentinel in classic EOCD; cdSize/cdOffset still fit in 32-bit.
  const eocd = buildEOCD({ cdEntries: 0xFFFF, cdSize: cdLen, cdOffset });

  const archive = concat([...lfhParts, ...cdParts, zip64Eocd, zip64Loc, eocd]);
  const blob = new Blob([archive]);

  const text = await readZipText(blob);
  if (text !== chatText) {
    throw new Error(`expected chat text "${chatText}", got "${text}"`);
  }
});

// ---- Test 2: only localOffset is a Zip64 sentinel ----
// Reproduces the positional-fields bug: the Zip64 extra field contains
// 8 bytes (just localOffset), but a naïve reader treats those 8 bytes as
// uncompSize and reads garbage for compSize/localOffset.

test('Zip64 extra with only localOffset reads the right field', async () => {
  const chatName = 'chat.txt';
  const chatText = 'hello world';
  const chatBytes = enc(chatText);

  const chatLFH = buildLFH(chatName, chatBytes);
  const realLocalOffset = 0;
  // sizes fit in 32 bits (NOT sentinels), localOffset IS a sentinel
  const chatCDH = buildCDH(chatName, chatBytes.length, realLocalOffset, { offsetSentinel: true });

  const cdOffset = chatLFH.length;
  const cdSize = chatCDH.length;
  const z64Offset = cdOffset + cdSize;
  const zip64Eocd = buildZip64EOCD(1, cdSize, cdOffset);
  const zip64Loc  = buildZip64Locator(z64Offset);
  const eocd = buildEOCD({ cdEntries: 1, cdSize, cdOffset });

  const archive = concat([chatLFH, chatCDH, zip64Eocd, zip64Loc, eocd]);
  const blob = new Blob([archive]);

  const text = await readZipText(blob);
  if (text !== chatText) {
    throw new Error(`expected chat text "${chatText}", got "${text}"`);
  }
});

// ---- Runner ----

(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ok  ', t.name);
      passed++;
    } catch (e) {
      console.error('  FAIL', t.name);
      console.error('       ', e.stack || e.message);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
