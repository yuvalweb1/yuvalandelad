// ============================================================
// voiceAuthor.test.js — voice ("monologue") slide sender resolution
// ------------------------------------------------------------
// Regression tests for the bug where the voice / "monologues" slide showed a
// dash ("—") instead of the sender's name.
//
// Root cause: a WhatsApp voice note is classified as `isVoice`, and the parser
// only extracted the attached filename (`mediaFile`) for `hasMedia` messages —
// never for voice. With no `mediaFile`, the media→sender match had nothing to
// key on, so `author` stayed null and the slide fell back to `v.author || '—'`.
//
// Coverage:
//   1. reconstructed Hebrew/Android voice lines resolve to their sender
//   2. stem match — transcript drops the extension, archive keeps `.opus`
//   3. chronological-position fallback when filenames can't be matched at all
//   4. (if present) the REAL with-media export under testdata/ — end to end
//      through readZipBundle + parse + the shared matcher
//
// testdata/ holds real personal exports and is gitignored, so the tests that
// depend on it SKIP when it is absent (e.g. CI) and only run locally.
//
// Run with: node src/parser/voiceAuthor.test.js
// ============================================================

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseWhatsApp } from './parse.js';
import { tagMediaAuthors } from './mediaMatch.js';
import { readZipBundle } from './zip.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTDATA = join(__dirname, '..', '..', 'testdata');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
// Throwing this marks a test as skipped (not failed) in the runner.
function skip(msg) {
  const e = new Error(msg);
  e.__skip = true;
  throw e;
}

// Find the real-export .txt inside a testdata WhatsApp subfolder, or null.
function findRealTranscript() {
  if (!existsSync(TESTDATA)) return null;
  for (const sub of readdirSync(TESTDATA)) {
    const dir = join(TESTDATA, sub);
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    const txt = entries.find(f => f.toLowerCase().endsWith('.txt'));
    if (txt) return readFileSync(join(dir, txt), 'utf8');
  }
  return null;
}

// Find a real with-media export .zip directly under testdata/, or null.
function findRealZip() {
  if (!existsSync(TESTDATA)) return null;
  const zip = readdirSync(TESTDATA).find(f => f.toLowerCase().endsWith('.zip'));
  return zip ? join(TESTDATA, zip) : null;
}

// Build the rows the voice ("monologues") slide renders: run the REAL shared
// matcher (parser/mediaMatch.js — the same code worker.js / client.js use),
// then mirror the slide's `v.author || '—'` fallback.
function voiceSlideRows(messages, voiceItems, voiceOrder) {
  const media = { voice: voiceItems, voiceOrder };
  tagMediaAuthors(messages, media);
  return media.voice.map(v => ({ url: v.url, author: v.author || '—' }));
}

// ---- Synthetic tests (always run, no real data needed) ----

// Core regression: Hebrew/Android voice lines resolve to their sender.
test('voice notes resolve to their sender (no "—" on the monologue slide)', () => {
  const senders = ['גוק הסקסי שמקסי', 'אלעד הימל', 'מתן מתן', 'רגלים'];
  const voiceFiles = senders.map((author, i) => {
    const name = `PTT-20260428-WA000${i + 1}.opus`;
    // ‏ = RLM, present in real Hebrew exports.
    const line = `28.4.2026, 20:3${i} - ${author}: ‏${name} (קובץ מצורף)`;
    return { author, name, line };
  });

  const { messages } = parseWhatsApp(voiceFiles.map(v => v.line).join('\n'));
  assert(
    messages.filter(m => m.isVoice).length === voiceFiles.length,
    'expected every reconstructed line to parse as a voice note'
  );

  const mediaVoice = voiceFiles.map(v => ({ name: v.name, url: `blob:${v.name}` }));
  const rows = voiceSlideRows(messages, mediaVoice);

  const dashed = rows.filter(r => r.author === '—');
  assert(dashed.length === 0, `${dashed.length}/${rows.length} voice rows fell back to "—"`);
  rows.forEach((row, i) => {
    assert(row.author === voiceFiles[i].author, `row ${i}: expected "${voiceFiles[i].author}", got "${row.author}"`);
  });
});

// Some exports reference a voice note WITHOUT the extension
// (`<attached: 0000042-AUDIO-…>`) while the zip keeps the `.opus`. Exact-name
// matching misses → '—'; the stem match must still resolve it.
test('voice note referenced without extension still resolves (stem match)', () => {
  const sender = 'גוק הסקסי שמקסי';
  const stem = '00000042-AUDIO-2026-04-28-12-00-00';
  const line = `[28.04.2026, 12:00:00] ${sender}: ‎<attached: ${stem}>`;
  const { messages } = parseWhatsApp(line);

  const rows = voiceSlideRows(messages, [{ name: `${stem}.opus`, url: 'blob:x' }]);
  assert(rows[0].author === sender, `expected "${sender}", got "${rows[0].author}"`);
});

// Last resort: filename can't be matched at all → attribute by chronological
// position (guarded by an exact voice-file ↔ voice-message count).
test('unmatched voice notes resolve by chronological position (ordinal fallback)', () => {
  const senders = ['אלעד הימל', 'מתן מתן', 'רגלים'];
  const text = senders
    .map((s, i) => `2${i}.4.2026, 10:00 - ${s}: ‏PTT-OTHER-${i}.opus (קובץ מצורף)`)
    .join('\n');
  const { messages } = parseWhatsApp(text);

  const voiceOrder = senders.map((_, i) => `voicefile_${i}.opus`);
  const mediaVoice = voiceOrder.map((name, i) => ({ name, url: `blob:${i}` }));

  const rows = voiceSlideRows(messages, mediaVoice, voiceOrder);
  const dashed = rows.filter(r => r.author === '—');
  assert(dashed.length === 0, `${dashed.length}/${rows.length} rows still dashed after ordinal fallback`);
  rows.forEach((row, i) => {
    assert(row.author === senders[i], `ordinal row ${i}: expected "${senders[i]}", got "${row.author}"`);
  });
});

// ---- Real-data tests (skip when testdata/ is absent) ----

test('real testdata transcript parses into a populated chat', () => {
  const text = findRealTranscript();
  if (!text) skip('no transcript under testdata/');
  const { messages } = parseWhatsApp(text);
  assert(messages.length > 1000, `expected a large real chat, got ${messages.length} messages`);
  assert(new Set(messages.map(m => m.author)).size >= 5, 'expected several participants');
});

// End-to-end against a real WITH-media export: unzip → parse → match, and assert
// the monologue slide shows a real sender for every note, via exact filename
// match (not just the fallback).
test('real with-media zip: every voice note shows its sender (end to end)', async () => {
  const zipPath = findRealZip();
  if (!zipPath) skip('no with-media .zip under testdata/');
  console.log(`        (reading ${(statSync(zipPath).size / 1e6).toFixed(0)} MB export…)`);

  const bundle = await readZipBundle(new Blob([readFileSync(zipPath)]));
  const { messages } = parseWhatsApp(bundle.text);

  const voiceMsgs = messages.filter(m => m.isVoice);
  assert(bundle.voice.length > 0, 'expected the export to contain voice notes');

  // The primary path must work: every shown voice file is named by a message.
  const refNames = new Set(messages.filter(m => m.mediaFile).map(m => m.mediaFile.toLowerCase()));
  const byFilename = bundle.voice.filter(v => refNames.has(String(v.name).toLowerCase()));
  assert(
    byFilename.length === bundle.voice.length,
    `${bundle.voice.length - byFilename.length} voice files not named in transcript (relying on fallback)`
  );

  const media = { ...bundle };
  tagMediaAuthors(messages, media);
  const dashed = media.voice.filter(v => !v.author);
  assert(dashed.length === 0, `${dashed.length}/${media.voice.length} real voice notes still show "—"`);
  console.log(`        resolved ${media.voice.length} voice notes, ${voiceMsgs.length} total in chat`);
});

// ---- Runner ----

(async () => {
  let passed = 0, failed = 0, skipped = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ok  ', t.name);
      passed++;
    } catch (e) {
      if (e && e.__skip) {
        console.log('  skip', t.name, '—', e.message);
        skipped++;
      } else {
        console.error('  FAIL', t.name);
        console.error('        ', e.message);
        failed++;
      }
    }
  }
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed > 0 ? 1 : 0);
})();
