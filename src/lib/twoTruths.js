// ============================================================
// Two Truths & a Lie — deterministic fact engine.
//
// Builds an endless, reproducible stream of rounds for the
// "spot the lie" party game. Each round is about ONE chat member
// and shows three claims about them: two are REAL (pulled straight
// from analytics) and one is FABRICATED but plausible. The player
// taps the claim they think is the lie.
//
// The whole point — and the thing that makes the lie fair instead
// of a coin flip — is HOW we fabricate. A lie value is, in order of
// preference:
//   1. a REAL value for the same metric borrowed from ANOTHER member
//      (a number that genuinely exists in this chat, just attached to
//      the wrong person), guaranteed to differ from the subject's true
//      value, or
//   2. a deterministically scaled version of the subject's own value,
//      rounded to a natural-looking number.
// Either way the displayed number is believable, and provably false.
//
// Everything here is a PURE, DETERMINISTIC function of `analytics`:
// no Math.random, no Date.now. Same chat → same rounds in the same
// order → same lies. (Mirrors the guarantee the rest of the app makes.)
//
// Consumed by src/views/TwoTruths.jsx, which only renders {key, vars}
// pairs through i18n — this module never touches copy or the DOM.
// ============================================================

// ── Seeded PRNG helpers (self-contained; mirror GuessWho) ──────────
function seedFromStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngFrom(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function shuffleIdx(n, seed) {
  const a = Array.from({ length: n }, (_, i) => i);
  return shuffle(a, rngFrom(seed));
}

// ── Display + math helpers ─────────────────────────────────────────
const fmtInt = (v) => Math.round(v).toLocaleString();
const relDiff = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1);

// Round to a "natural" magnitude so a fabricated count never reads like
// a suspiciously precise spreadsheet cell (e.g. 1,247 → 1,250).
function niceRound(v) {
  v = Math.round(v);
  const a = Math.abs(v);
  if (a < 20) return v;
  if (a < 100) return Math.round(v / 5) * 5;
  if (a < 1000) return Math.round(v / 10) * 10;
  if (a < 10000) return Math.round(v / 50) * 50;
  return Math.round(v / 100) * 100;
}

// Generic numeric fabricator. Prefers borrowing a believable real value
// from another member; falls back to a scaled-and-rounded version of the
// subject's own value. Always returns a number that DISPLAYS differently
// from the true value (so the lie is genuinely false), within [min,max].
function fabNum(value, others, rng, opt = {}) {
  const min = opt.min ?? 1;
  const max = opt.max ?? Infinity;
  const minRel = opt.minRel ?? 0.25;
  const differs = opt.differs || ((x, y) => Math.round(x) !== Math.round(y));
  const inRange = (v) => v >= min && v <= max;

  const cands = (others || []).filter(
    (o) => inRange(o) && differs(o, value) && relDiff(o, value) >= minRel
  );
  if (cands.length) return pick(cands, rng);

  // No borrowable value — scale the subject's own number into a new shape.
  const factors = shuffle(opt.factors || [0.4, 0.55, 0.7, 1.4, 1.7, 2.2, 2.8], rng);
  for (const f of factors) {
    let v = opt.nice === false ? value * f : niceRound(value * f);
    if (v < min) v = min;
    if (v > max) v = max;
    if (inRange(v) && differs(v, value)) return v;
  }
  // Last resort: nudge by a chunk in whichever direction stays in range.
  const bump = Math.max(opt.bump ?? 3, Math.round(value * 0.5));
  let v = value + bump;
  if (v > max || !differs(v, value)) v = value - bump;
  if (v < min) v = Math.min(max, value + bump);
  return v;
}

// Hour-of-day fabricator — picks a clock hour at least 3h away (circular),
// so "most active around 02:00" can't be quietly true-ish.
function fabHour(value, others, rng) {
  const circ = (a, b) => { const d = Math.abs(a - b) % 24; return Math.min(d, 24 - d); };
  const cands = (others || []).filter((o) => circ(o, value) >= 3);
  if (cands.length) return pick(cands, rng);
  const shifts = shuffle([4, 5, 7, 9, 11, -5, -7], rng);
  for (const s of shifts) {
    const v = ((value + s) % 24 + 24) % 24;
    if (circ(v, value) >= 3) return v;
  }
  return (value + 6) % 24;
}

// String fabricator (top word / top emoji). Borrows another member's
// signature, but only one the subject themselves doesn't actually use —
// so the swapped-in word is real and recognisable, yet a real lie. Returns
// null when nothing borrowable exists (→ this attr can't be the lie).
function fabFromSet(value, others, rng, ownSet) {
  const norm = (s) => String(s).toLowerCase();
  const cands = (others || []).filter((w) => w && !ownSet.has(norm(w)) && norm(w) !== norm(value));
  if (!cands.length) return null;
  return pick(cands, rng);
}

// ── Attribute descriptors ──────────────────────────────────────────
// Each describes one claimable fact about a member:
//   eligible(u) → is this a meaningful, true fact for this person?
//   value(u)    → the raw value used to render the truth AND seed the lie
//   key         → i18n template (SAME for truth and lie; only vars differ)
//   vars(v)     → display-ready template vars for a value
//   fabricate(value, others, rng, user) → a plausible false value (or null)
const ATTRS = [
  { id: 'messages', key: 'tt_s_messages',
    eligible: (u) => u.messageCount >= 20,
    value: (u) => u.messageCount,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 5 }) },

  { id: 'emojis', key: 'tt_s_emojis',
    eligible: (u) => u.emojiCount >= 15,
    value: (u) => u.emojiCount,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 5 }) },

  { id: 'voice', key: 'tt_s_voice',
    eligible: (u) => u.voiceCount >= 4,
    value: (u) => u.voiceCount,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 1 }) },

  { id: 'media', key: 'tt_s_media',
    eligible: (u) => u.mediaCount >= 4,
    value: (u) => u.mediaCount,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 1 }) },

  { id: 'links', key: 'tt_s_links',
    eligible: (u) => u.linkCount >= 4,
    value: (u) => u.linkCount,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 1 }) },

  { id: 'topword', key: 'tt_s_topword',
    eligible: (u) => !!u.topWord && u.topWordCount >= 4,
    value: (u) => u.topWord,
    vars: (v) => ({ word: v }),
    fabricate: (v, o, r, u) =>
      fabFromSet(v, o, r, new Set((u.top5Words || []).map((w) => String(w.word).toLowerCase()))) },

  { id: 'topemoji', key: 'tt_s_topemoji',
    eligible: (u) => !!u.topEmoji && u.topEmojiCount >= 3,
    value: (u) => u.topEmoji,
    vars: (v) => ({ emoji: v }),
    fabricate: (v, o, r, u) =>
      fabFromSet(v, o, r, new Set((u.top5Emojis || []).map((e) => e.emoji))) },

  { id: 'peakhour', key: 'tt_s_peakhour',
    eligible: (u) => u.messageCount >= 20,
    value: (u) => u.peakHour,
    vars: (v) => ({ hh: String(v).padStart(2, '0') }),
    fabricate: (v, o, r) => fabHour(v, o, r) },

  { id: 'nightpct', key: 'tt_s_nightpct',
    eligible: (u) => u.nightMessages >= 6 && u.nightPct >= 4,
    value: (u) => Math.round(u.nightPct),
    vars: (v) => ({ pct: v }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 2, max: 85, minRel: 0, differs: (x, y) => Math.abs(Math.round(x) - Math.round(y)) >= 5 }) },

  { id: 'questionpct', key: 'tt_s_questionpct',
    eligible: (u) => u.questionCount >= 6,
    value: (u) => Math.round(u.questionRate * 100),
    vars: (v) => ({ pct: v }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 2, max: 80, minRel: 0, differs: (x, y) => Math.abs(Math.round(x) - Math.round(y)) >= 5 }) },

  { id: 'streak', key: 'tt_s_streak',
    eligible: (u) => u.longestStreak >= 4,
    value: (u) => u.longestStreak,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 2 }) },

  { id: 'absence', key: 'tt_s_absence',
    eligible: (u) => u.longestAbsenceDays >= 3,
    value: (u) => u.longestAbsenceDays,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 2 }) },

  { id: 'burst', key: 'tt_s_burst',
    eligible: (u) => u.maxBurst >= 4,
    value: (u) => u.maxBurst,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 2 }) },

  { id: 'wordsper', key: 'tt_s_wordsper',
    eligible: (u) => u.messageCount >= 20 && u.avgWordsPerMsg >= 1,
    value: (u) => u.avgWordsPerMsg,
    vars: (v) => ({ n: v.toFixed(1) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 1, max: 80, nice: false, differs: (x, y) => x.toFixed(1) !== y.toFixed(1) }) },

  { id: 'revived', key: 'tt_s_revived',
    eligible: (u) => u.conversationsRevived >= 3,
    value: (u) => u.conversationsRevived,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 1 }) },

  { id: 'killed', key: 'tt_s_killed',
    eligible: (u) => u.conversationsKilled >= 3,
    value: (u) => u.conversationsKilled,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 1 }) },

  { id: 'lastword', key: 'tt_s_lastword',
    eligible: (u) => u.finalMessagesOfDay >= 4,
    value: (u) => u.finalMessagesOfDay,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 1 }) },

  { id: 'activedays', key: 'tt_s_activedays',
    eligible: (u) => u.activeDays >= 5,
    value: (u) => u.activeDays,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 2 }) },

  { id: 'reply', key: 'tt_s_reply',
    eligible: (u) => u.respSampleSize >= 10 && u.avgRespMin != null && isFinite(u.avgRespMin),
    value: (u) => u.avgRespMin,
    vars: (v) => ({ m: v < 10 ? v.toFixed(1) : String(Math.round(v)) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 0.3, max: 600, nice: false,
      differs: (x, y) => (x < 10 ? x.toFixed(1) : String(Math.round(x))) !== (y < 10 ? y.toFixed(1) : String(Math.round(y))) }) },

  // How often what they said actually got picked up by someone else within
  // half an hour — the closest thing the transcript has to "was I heard?".
  { id: 'replied', key: 'tt_s_replied',
    eligible: (u) => u.messageCount >= 25 && u.replyReceivedRate > 0,
    value: (u) => Math.round(u.replyReceivedRate * 100),
    vars: (v) => ({ pct: v }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 3, max: 95, minRel: 0, differs: (x, y) => Math.abs(Math.round(x) - Math.round(y)) >= 5 }) },

  { id: 'loveyou', key: 'tt_s_loveyou',
    eligible: (u) => u.loveYouCount >= 3,
    value: (u) => u.loveYouCount,
    vars: (v) => ({ n: fmtInt(v) }),
    fabricate: (v, o, r) => fabNum(v, o, r, { min: 1 }) },
];

// ── Subject building ───────────────────────────────────────────────
// A member can be a round "subject" only if they have ≥3 eligible facts
// (2 truths + 1 lie) and ≥1 that can actually be fabricated into a lie.
function buildSubjects(analytics) {
  const users = analytics?.users;
  if (!Array.isArray(users) || users.length < 2) return [];

  // Pool of real values per attribute across the group, so each subject's
  // lie can borrow a genuine number from someone else.
  const attrValues = {};
  for (const d of ATTRS) {
    const list = [];
    for (const u of users) {
      if (!d.eligible(u)) continue;
      const v = d.value(u);
      if (v == null) continue;
      list.push({ author: u.author, value: v });
    }
    attrValues[d.id] = list;
  }

  const subjects = [];
  for (const user of users) {
    const attrs = [];
    for (const d of ATTRS) {
      if (!d.eligible(user)) continue;
      const value = d.value(user);
      if (value == null) continue;
      const others = attrValues[d.id].filter((x) => x.author !== user.author).map((x) => x.value);
      // Probe lie-ability with a fixed seed (the real lie value is rolled
      // fresh per round; this only decides whether the attr CAN be a lie).
      const probe = rngFrom(seedFromStr(user.author + '#' + d.id));
      const lieable = d.fabricate(value, others, probe, user) != null;
      attrs.push({ d, value, others, lieable });
    }
    if (attrs.length >= 3 && attrs.some((a) => a.lieable)) {
      subjects.push({ author: user.author, user, attrs });
    }
  }
  // Stable order by volume (then name) so the pool is reproducible.
  subjects.sort((a, b) =>
    (b.user.messageCount || 0) - (a.user.messageCount || 0) || (a.author < b.author ? -1 : 1));
  return subjects;
}

// Build ONE round about a subject: 1 lie (fabricated) + 2 truths, shuffled.
function buildRound(subject, seed) {
  const r = rngFrom(seed);

  // The lie comes from a fabricate-able attribute.
  const lieAttr = pick(shuffle(subject.attrs.filter((a) => a.lieable), r), r);
  const fakeValue = lieAttr.d.fabricate(lieAttr.value, lieAttr.others, r, subject.user);

  // Two more truths from the remaining (distinct) attributes.
  const truths = shuffle(subject.attrs.filter((a) => a.d.id !== lieAttr.d.id), r).slice(0, 2);

  let cards = [
    {
      id: lieAttr.d.id, key: lieAttr.d.key, isLie: true,
      vars: lieAttr.d.vars(fakeValue),
      truthVars: lieAttr.d.vars(lieAttr.value), // the REAL value, for the reveal
    },
    ...truths.map((a) => ({ id: a.d.id, key: a.d.key, isLie: false, vars: a.d.vars(a.value) })),
  ];
  cards = shuffle(cards, rngFrom((seed ^ 0x9e3779b9) >>> 0));
  const lieIndex = cards.findIndex((c) => c.isLie);

  return {
    subject: subject.author,
    messageCount: subject.user.messageCount,
    cards,
    lieIndex,
    lieReveal: cards[lieIndex], // { key, truthVars } → "the truth was…"
  };
}

// ── Public: endless, deterministic round feed ──────────────────────
// Walks subjects in a seeded order; each pass re-shuffles with a fresh
// derived seed so the same subject yields different fact combos across
// cycles. Feels infinite, never an immediate subject repeat, fully
// reproducible. Returns null when the chat can't support the game.
export function makeTwoTruthsFeed(analytics) {
  const subjects = buildSubjects(analytics);
  if (subjects.length < 1) return null;

  const baseSeed = seedFromStr(subjects.map((s) => s.author).join('¦') + '#' + subjects.length);
  let order = shuffleIdx(subjects.length, baseSeed);
  let cursor = 0;
  let cycle = 0;

  return {
    subjects: subjects.map((s) => s.author),
    poolSize: subjects.length,
    next() {
      if (cursor >= order.length) {
        cycle++;
        order = shuffleIdx(subjects.length, (baseSeed ^ Math.imul(cycle, 0x9e3779b9)) >>> 0);
        cursor = 0;
      }
      const s = subjects[order[cursor]];
      const seed = seedFromStr(s.author + '|' + cycle + '|' + cursor);
      cursor++;
      return buildRound(s, seed);
    },
  };
}

// Whether the chat has any saved per-user data at all — lets the view tell
// "re-upload an old recap" apart from "this chat is just too quiet".
export function hasTwoTruthsData(analytics) {
  return Array.isArray(analytics?.users) && analytics.users.length >= 2;
}
