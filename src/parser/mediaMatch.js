// ============================================================
// mediaMatch.js — tie extracted media files to their sender
// ------------------------------------------------------------
// The chat transcript names the file each media message references; we match
// those names against the files pulled out of the .zip so every photo / voice
// note / video / sticker can show who sent it. Shared by parser/worker.js and
// the main-thread fallback in parser/client.js so the two never drift.
//
// Matching is layered, most precise first:
//   1. exact filename  (after folder strip + trim + lowercase + NFC)
//   2. filename stem   (no extension) — some exports reference a voice note as
//                        `<attached: 0000042-AUDIO-…>` while the zip keeps the
//                        `.opus`, which otherwise mismatches → '—'
//   3. voice-only: chronological position — last-resort attribution for notes
//      whose filename can't be matched at all. Guarded by an exact 1:1 count
//      between voice files and voice messages so it can never mis-attribute;
//      if parity doesn't hold the note simply keeps its '—'.
// ============================================================

// Strip any folder, trim, lowercase, NFC-normalize. iOS stores filenames as
// NFD while the transcript references them as NFC — without this they silently
// fail to match (→ '—').
export function normName(s) {
  return String(s).split(/[\\/]/).pop().trim().toLowerCase().normalize('NFC');
}

function stemOf(n) {
  const dot = n.lastIndexOf('.');
  return dot > 0 ? n.slice(0, dot) : n;
}

/**
 * Mutates each media item, setting `author` + `ts` from the message that
 * referenced its file (or null when unmatched). Returns the same media object.
 * @param {Array} messages  parsed messages (chronological)
 * @param {{photos?:any[],voice?:any[],videos?:any[],stickers?:any[],voiceOrder?:string[]}} media
 */
export function tagMediaAuthors(messages, media) {
  if (!media) return media;

  const byName = new Map();
  const byStem = new Map();
  for (const m of messages) {
    if (!m.mediaFile) continue;
    const n = normName(m.mediaFile);
    if (!byName.has(n)) byName.set(n, m);
    const s = stemOf(n);
    if (!byStem.has(s)) byStem.set(s, m);
  }

  const tag = (item) => {
    const n = normName(item.name);
    const ref = byName.get(n) || byStem.get(stemOf(n)) || null;
    item.author = ref ? ref.author : null;
    item.ts = ref ? ref.timestamp : null;
  };

  for (const list of [media.photos, media.voice, media.videos, media.stickers]) {
    (list || []).forEach(tag);
  }

  // Voice last-resort: attribute any still-unmatched note by chronological
  // position. `voiceOrder` is every voice filename in the archive, sorted into
  // chat order; pairing it 1:1 with the voice messages (also chat order) yields
  // the sender even when filenames don't line up. Only when counts match exactly.
  const unmatched = (media.voice || []).filter(v => !v.author);
  if (unmatched.length && Array.isArray(media.voiceOrder)) {
    const voiceMsgs = messages.filter(m => m.isVoice);
    if (voiceMsgs.length > 0 && media.voiceOrder.length === voiceMsgs.length) {
      const idxByName = new Map();
      media.voiceOrder.forEach((name, i) => idxByName.set(normName(name), i));
      for (const v of unmatched) {
        const i = idxByName.get(normName(v.name));
        if (i != null) {
          v.author = voiceMsgs[i].author;
          v.ts = voiceMsgs[i].timestamp;
        }
      }
    }
  }

  return media;
}
