// ============================================================
// Shared round-building logic for Group Court & Hot Takes.
//
// Both modes are "vote → reveal the data" games built as a
// deterministic ordered list of Round objects, compiled once from
// `analytics`. Pure + deterministic: no Math.random / Date.now —
// any pick/shuffle is seeded off chat content (seedFromStr).
// ============================================================

// ── Seeded helpers (same algorithm as GuessWho.jsx) ─────────────
export function seedFromStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Top-3 ranking for the bar-chart reveal, given a metric accessor.
function rankingTop3(users, metric) {
  return users
    .map(u => ({ name: u.author, value: metric(u) }))
    .filter(r => r.value != null && !Number.isNaN(r.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

// Classify a round's reveal drama by comparing the data winner to the
// "obvious" social pick (the loudest person, analytics.users[0]) and to
// the runner-up margin.
//   open_shut  — winner's value is far ahead of the runner-up (>= 1.6x or no runner-up)
//   plot_twist — the loudest person exists, isn't the winner, AND isn't even
//                 the runner-up close behind (a genuinely surprising result)
//   split      — everything else (close race)
function classifyRarity(ranking, loudestAuthor) {
  if (ranking.length === 0) return 'split';
  const [first, second] = ranking;
  const margin = second && second.value > 0 ? first.value / second.value : Infinity;
  const isPlotTwist = loudestAuthor
    && first.name !== loudestAuthor
    && (!second || second.name !== loudestAuthor || margin < 1.15);
  if (isPlotTwist) return 'plot_twist';
  if (!second || margin >= 1.6) return 'open_shut';
  return 'split';
}

// ── GROUP COURT ──────────────────────────────────────────────────
// Each case maps to one analytics field. `eligible` gates inclusion
// (mirrors the thresholds used for superlative winners elsewhere).
const COURT_CASES = [
  {
    id: 'midnight',
    promptKey: 'gc_q_midnight',
    metricKey: 'gc_ev_midnight',
    metric: u => u.nightMessages,
    unit: 'messages',
    eligible: (users, analytics) => analytics.groupNightPct > 0 && users.some(u => u.nightMessages > 0),
  },
  {
    id: 'ignored',
    promptKey: 'gc_q_ignored',
    metricKey: 'gc_ev_ignored',
    metric: u => Math.round(u.ignoredRate * 100),
    unit: 'pct',
    eligible: users => users.some(u => u.messageCount >= 30 && u.ignoredRate > 0),
    minMessages: 30,
  },
  {
    id: 'carrying',
    promptKey: 'gc_q_carrying',
    metricKey: 'gc_ev_carrying',
    metric: u => u.conversationsRevived,
    unit: 'revives',
    eligible: users => users.some(u => u.conversationsRevived >= 1),
  },
  {
    id: 'spammer',
    promptKey: 'gc_q_spammer',
    metricKey: 'gc_ev_spammer',
    metric: u => u.maxBurst,
    unit: 'messages',
    eligible: users => users.some(u => u.maxBurst >= 3),
  },
  {
    id: 'drama',
    promptKey: 'gc_q_drama',
    metricKey: 'gc_ev_drama',
    metric: u => u.conversationsKilled,
    unit: 'conversations',
    eligible: users => users.some(u => u.conversationsKilled >= 1),
  },
  {
    id: 'mainCharacter',
    promptKey: 'gc_q_main_character',
    metricKey: 'gc_ev_main_character',
    metric: u => Math.round(u.sharePct),
    unit: 'pct',
    eligible: users => users.length >= 2,
  },
  {
    id: 'ghost',
    promptKey: 'gc_q_ghost',
    metricKey: 'gc_ev_ghost',
    metric: u => u.longestAbsenceDays,
    unit: 'days',
    eligible: users => users.some(u => u.longestAbsenceDays >= 3),
  },
  {
    id: 'fastest',
    promptKey: 'gc_q_fastest',
    metricKey: 'gc_ev_fastest',
    metric: u => u.avgRespMin,
    unit: 'minutes',
    lowerIsWinner: true,
    eligible: users => users.filter(u => u.avgRespMin != null && u.respSampleSize >= 10).length >= 1,
  },
  {
    id: 'voice',
    promptKey: 'gc_q_voice',
    metricKey: 'gc_ev_voice',
    metric: u => u.voiceCount,
    unit: 'voice notes',
    eligible: users => users.some(u => u.voiceCount >= 5),
  },
  {
    id: 'questions',
    promptKey: 'gc_q_questions',
    metricKey: 'gc_ev_questions',
    metric: u => Math.round(u.questionRate * 100),
    unit: 'pct',
    eligible: users => users.some(u => u.questionRate > 0),
  },
  {
    id: 'lastWord',
    promptKey: 'gc_q_last_word',
    metricKey: 'gc_ev_last_word',
    metric: u => u.finalMessagesOfDay,
    unit: 'days',
    eligible: users => users.some(u => u.finalMessagesOfDay >= 1),
  },
  {
    id: 'emoji',
    promptKey: 'gc_q_emoji',
    metricKey: 'gc_ev_emoji',
    metric: u => u.emojiCount,
    unit: 'emojis',
    eligible: users => users.some(u => u.emojiCount >= 10),
  },
];

const MAX_COURT_ROUNDS = 7;

// Build the deterministic ordered list of Group Court rounds.
// `optionCount` caps how many suspects appear per round (2-4).
export function buildCourtRounds(analytics) {
  const users = analytics?.users || [];
  if (users.length < 2) return [];
  const loudestAuthor = users[0]?.author;
  const optionCount = Math.min(4, users.length);

  const built = [];
  for (const c of COURT_CASES) {
    if (!c.eligible(users, analytics)) continue;
    let pool = users;
    if (c.minMessages) pool = users.filter(u => u.messageCount >= c.minMessages);
    if (c.id === 'fastest') pool = users.filter(u => u.avgRespMin != null && u.respSampleSize >= 10);
    if (pool.length < 2) continue;

    const sorted = [...pool].sort((a, b) => {
      const av = c.metric(a), bv = c.metric(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      return c.lowerIsWinner ? av - bv : bv - av;
    });
    const ranking = sorted.slice(0, 3).map(u => ({ name: u.author, value: c.metric(u) }));
    if (!ranking.length) continue;

    const winner = sorted[0];
    const rarity = classifyRarity(ranking, loudestAuthor);

    // Suspect options: winner + a seeded sample of other users.
    const others = users.filter(u => u.author !== winner.author);
    const seed = seedFromStr(`court|${c.id}|${winner.author}`);
    const decoys = seededShuffle(others, seed).slice(0, optionCount - 1);
    const options = seededShuffle([winner.author, ...decoys.map(u => u.author)], (seed ^ 0x9e3779b9) >>> 0);

    const winnerVal = c.metric(winner);
    const evidenceVars = c.unit === 'minutes'
      ? { n: Math.round(winnerVal * 10) / 10 }
      : { n: Math.round(winnerVal) };

    built.push({
      kind: 'court',
      id: c.id,
      promptKey: c.promptKey,
      promptVars: {},
      options,
      truth: winner.author,
      evidence: {
        metricKey: c.metricKey,
        value: winnerVal,
        unit: c.unit,
        evidenceVars,
        rankingTop3: ranking,
        quote: pickQuote(analytics, winner.author),
      },
      rarity,
    });
  }

  return orderRounds(built).slice(0, MAX_COURT_ROUNDS);
}

// Pull one curated quote for an author from the GuessWho pool, if any.
function pickQuote(analytics, author) {
  const quotes = analytics?.guessWho?.quotes || [];
  const mine = quotes.filter(q => q.author === author);
  if (!mine.length) return null;
  const seed = seedFromStr(`quote|${author}`);
  return mine[seed % mine.length].content;
}

// Order rounds: open with an open_shut, alternate, save a plot_twist for
// the finale. Deterministic — based on rarity buckets, stable otherwise.
function orderRounds(rounds) {
  if (rounds.length <= 1) return rounds;
  const openShut = rounds.filter(r => r.rarity === 'open_shut');
  const split = rounds.filter(r => r.rarity === 'split');
  const plotTwist = rounds.filter(r => r.rarity === 'plot_twist');

  const finale = plotTwist.length ? plotTwist[plotTwist.length - 1] : null;
  const remainingPlotTwists = finale ? plotTwist.slice(0, -1) : [];
  const rest = [...openShut, ...split, ...remainingPlotTwists];

  const ordered = [];
  // Open with an open_shut if we have one, else whatever's first.
  if (openShut.length) {
    ordered.push(openShut[0]);
    rest.splice(rest.indexOf(openShut[0]), 1);
  } else if (rest.length) {
    ordered.push(rest.shift());
  }
  // Interleave the remainder.
  ordered.push(...rest);
  if (finale) ordered.push(finale);
  return ordered;
}

// ── HOT TAKES ────────────────────────────────────────────────────
// Each statement is about a named superlative (or the group as a whole).
// `truth` = 'agree' | 'disagree' — whether the data backs the statement.
// `verdict` = 'true' | 'misleading' | 'complicated' — fact-check stamp.
const HOTTAKE_STATEMENTS = [
  {
    id: 'mostImportant',
    statementKey: 'ht_s_most_important',
    metricKey: 'ht_ev_most_important',
    needsSubject: true,
    pickSubject: (users) => users[0], // loudest by sharePct (users[0])
    eligible: users => users.length >= 2,
    evaluate: (subject, users, analytics) => {
      const leadsShare = subject.sharePct === Math.max(...users.map(u => u.sharePct));
      const leadsRevive = subject.conversationsRevived === Math.max(...users.map(u => u.conversationsRevived));
      if (leadsShare && leadsRevive && subject.conversationsRevived > 0) {
        return { truth: 'agree', verdict: 'true', value: Math.round(subject.sharePct) };
      }
      return {
        truth: 'disagree',
        verdict: 'misleading',
        value: Math.round(subject.sharePct),
        metricKey: 'ht_ev_most_important_misleading',
      };
    },
  },
  {
    id: 'wouldDie',
    statementKey: 'ht_s_would_die',
    metricKey: 'ht_ev_would_die',
    needsSubject: true,
    pickSubject: (users) => [...users].sort((a, b) => b.conversationsRevived - a.conversationsRevived)[0],
    eligible: (users, analytics) => users.some(u => u.conversationsRevived >= 1),
    evaluate: (subject, users) => {
      const sorted = [...users].sort((a, b) => b.conversationsRevived - a.conversationsRevived);
      const top = sorted[0], second = sorted[1];
      const dominates = !second || second.conversationsRevived === 0 || top.conversationsRevived >= second.conversationsRevived * 1.6;
      return dominates
        ? { truth: 'agree', verdict: 'true', value: top.conversationsRevived }
        : { truth: 'disagree', verdict: 'complicated', value: top.conversationsRevived };
    },
  },
  {
    id: 'tooMany',
    statementKey: 'ht_s_too_many',
    metricKey: 'ht_ev_too_many',
    needsSubject: true,
    pickSubject: (users) => users[0],
    eligible: users => users.length >= 2,
    evaluate: (subject) => {
      const pct = Math.round(subject.sharePct);
      return pct > 35
        ? { truth: 'agree', verdict: 'true', value: pct }
        : { truth: 'disagree', verdict: 'misleading', value: pct };
    },
  },
  {
    id: 'nobodyReads',
    statementKey: 'ht_s_nobody_reads',
    metricKey: 'ht_ev_nobody_reads',
    needsSubject: true,
    pickSubject: (users) => [...users].filter(u => u.messageCount >= 20).sort((a, b) => b.avgWordsPerMsg - a.avgWordsPerMsg)[0],
    eligible: users => users.some(u => u.messageCount >= 20 && u.avgWordsPerMsg > 15),
    evaluate: (subject) => {
      const isLong = subject.avgWordsPerMsg > 25;
      const isIgnored = subject.replyReceivedRate < 0.5;
      if (isLong && isIgnored) return { truth: 'agree', verdict: 'true', value: Math.round(subject.replyReceivedRate * 100) };
      if (isLong) return { truth: 'disagree', verdict: 'misleading', value: Math.round(subject.replyReceivedRate * 100) };
      return { truth: 'disagree', verdict: 'complicated', value: Math.round(subject.replyReceivedRate * 100) };
    },
  },
  {
    id: 'lastToReply',
    statementKey: 'ht_s_last_to_reply',
    metricKey: 'ht_ev_last_to_reply',
    needsSubject: true,
    pickSubject: (users) => [...users].filter(u => u.avgRespMin != null && u.respSampleSize >= 10).sort((a, b) => b.avgRespMin - a.avgRespMin)[0],
    eligible: users => users.filter(u => u.avgRespMin != null && u.respSampleSize >= 10).length >= 2,
    evaluate: (subject, users) => {
      const eligible = users.filter(u => u.avgRespMin != null && u.respSampleSize >= 10);
      const sorted = [...eligible].sort((a, b) => b.avgRespMin - a.avgRespMin);
      const top = sorted[0], second = sorted[1];
      const margin = second && second.avgRespMin > 0 ? top.avgRespMin / second.avgRespMin : Infinity;
      const dominates = margin >= 1.5;
      return dominates
        ? { truth: 'agree', verdict: 'true', value: Math.round(top.avgRespMin) }
        : { truth: 'disagree', verdict: 'complicated', value: Math.round(top.avgRespMin) };
    },
  },
  {
    id: 'nightShift',
    statementKey: 'ht_s_night_shift',
    metricKey: 'ht_ev_night_shift',
    needsSubject: false,
    eligible: (users, analytics) => analytics.groupNightPct != null,
    evaluate: (_subject, _users, analytics) => {
      const pct = Math.round(analytics.groupNightPct);
      return pct > 30
        ? { truth: 'agree', verdict: 'true', value: pct }
        : { truth: 'disagree', verdict: pct > 15 ? 'complicated' : 'misleading', value: pct };
    },
  },
  {
    id: 'onlyMemes',
    statementKey: 'ht_s_only_memes',
    metricKey: 'ht_ev_only_memes',
    needsSubject: true,
    pickSubject: (users) => [...users].filter(u => u.messageCount >= 10).sort((a, b) => b.mediaRate - a.mediaRate)[0],
    eligible: users => users.some(u => u.messageCount >= 10 && u.mediaRate > 0.15),
    evaluate: (subject) => {
      const pct = Math.round(subject.mediaRate * 100);
      return pct > 35
        ? { truth: 'agree', verdict: 'true', value: pct }
        : { truth: 'disagree', verdict: 'complicated', value: pct };
    },
  },
  {
    id: 'therapist',
    statementKey: 'ht_s_therapist',
    metricKey: 'ht_ev_therapist',
    needsSubject: true,
    pickSubject: (users) => [...users].filter(u => u.messageCount >= 20).sort((a, b) => b.replyReceivedRate - a.replyReceivedRate)[0],
    eligible: users => users.some(u => u.messageCount >= 20 && u.replyReceivedRate > 0),
    evaluate: (subject) => {
      const pct = Math.round(subject.replyReceivedRate * 100);
      return pct > 55
        ? { truth: 'agree', verdict: 'true', value: pct }
        : { truth: 'disagree', verdict: 'complicated', value: pct };
    },
  },
  {
    id: 'talkingToSelf',
    statementKey: 'ht_s_talking_to_self',
    metricKey: 'ht_ev_talking_to_self',
    needsSubject: true,
    pickSubject: (users) => [...users].sort((a, b) => b.maxBurst - a.maxBurst)[0],
    eligible: users => users.some(u => u.maxBurst >= 5),
    evaluate: (subject) => {
      return subject.maxBurst >= 10
        ? { truth: 'agree', verdict: 'true', value: subject.maxBurst }
        : { truth: 'disagree', verdict: 'complicated', value: subject.maxBurst };
    },
  },
  {
    id: 'cantHoldConvo',
    statementKey: 'ht_s_cant_hold_convo',
    metricKey: 'ht_ev_cant_hold_convo',
    needsSubject: false,
    eligible: (users, analytics) => analytics.longestSilenceDays != null,
    evaluate: (_subject, users, analytics) => {
      const totalKills = users.reduce((s, u) => s + u.conversationsKilled, 0);
      const days = Math.round(analytics.longestSilenceDays || 0);
      const agree = days >= 5 || totalKills >= users.length * 2;
      return agree
        ? { truth: 'agree', verdict: 'true', value: days }
        : { truth: 'disagree', verdict: 'misleading', value: days };
    },
  },
];

// Couple-specific statement bank (2-participant chats).
const HOTTAKE_COUPLE_STATEMENTS = [
  {
    id: 'moreInvested',
    statementKey: 'ht_s_more_invested',
    metricKey: 'ht_ev_more_invested',
    needsSubject: true,
    pickSubject: (users) => {
      const [a, b] = users;
      const scoreA = a.messageCount + a.loveYouCount * 20 + (a.avgRespMin != null ? Math.max(0, 60 - a.avgRespMin) : 0);
      const scoreB = b.messageCount + b.loveYouCount * 20 + (b.avgRespMin != null ? Math.max(0, 60 - b.avgRespMin) : 0);
      return scoreA >= scoreB ? a : b;
    },
    eligible: users => users.length === 2,
    evaluate: (subject, users) => {
      const other = users.find(u => u.author !== subject.author);
      const moreLove = subject.loveYouCount >= (other?.loveYouCount || 0);
      const moreMsgs = subject.messageCount >= (other?.messageCount || 0);
      if (moreLove && moreMsgs) return { truth: 'agree', verdict: 'true', value: subject.loveYouCount };
      return { truth: 'disagree', verdict: 'complicated', value: subject.loveYouCount };
    },
  },
  {
    id: 'textsFirst',
    statementKey: 'ht_s_texts_first',
    metricKey: 'ht_ev_texts_first',
    needsSubject: true,
    pickSubject: (users) => [...users].sort((a, b) => b.conversationsRevived - a.conversationsRevived)[0],
    eligible: (users, analytics) => users.length === 2 && users.some(u => u.conversationsRevived >= 1),
    evaluate: (subject, users) => {
      const sorted = [...users].sort((a, b) => b.conversationsRevived - a.conversationsRevived);
      const top = sorted[0], second = sorted[1];
      const dominates = !second || top.conversationsRevived >= (second.conversationsRevived || 0) * 1.5;
      return dominates
        ? { truth: 'agree', verdict: 'true', value: top.conversationsRevived }
        : { truth: 'disagree', verdict: 'complicated', value: top.conversationsRevived };
    },
  },
];

const MAX_HOTTAKE_ROUNDS = 7;

// Build the deterministic ordered list of Hot Takes statements.
// `relationship` softens the bank for family/work chats.
export function buildHotTakeRounds(analytics, relationship) {
  const users = analytics?.users || [];
  if (users.length < 1) return [];
  const loudestAuthor = users[0]?.author;
  const isCouple = users.length === 2;
  const isSensitive = relationship === 'family' || relationship === 'work';

  let bank = isCouple ? HOTTAKE_COUPLE_STATEMENTS : HOTTAKE_STATEMENTS;
  if (isSensitive) {
    // Drop the harsher framings for family/work chats.
    bank = bank.filter(s => !['talkingToSelf', 'cantHoldConvo', 'tooMany'].includes(s.id));
  }

  const built = [];
  for (const s of bank) {
    if (!s.eligible(users, analytics)) continue;
    let subject = null;
    if (s.needsSubject) {
      subject = s.pickSubject(users);
      if (!subject) continue;
    }
    const result = s.evaluate(subject, users, analytics);
    if (!result) continue;

    // Rarity: plot_twist if the loudest person is the named subject but the
    // verdict goes against the statement (i.e. data contradicts the "obvious" take).
    let rarity = 'split';
    if (result.verdict === 'true') rarity = 'open_shut';
    if (subject && subject.author === loudestAuthor && result.truth === 'disagree') rarity = 'plot_twist';

    built.push({
      kind: 'hottake',
      id: s.id,
      promptKey: s.statementKey,
      promptVars: subject ? { name: subject.author } : {},
      options: ['agree', 'disagree'],
      truth: result.truth,
      evidence: {
        metricKey: result.metricKey || s.metricKey,
        value: result.value,
        unit: 'value',
        evidenceVars: { name: subject?.author, n: result.value },
        rankingTop3: [],
        quote: subject ? pickQuote(analytics, subject.author) : null,
      },
      verdict: result.verdict,
      rarity,
    });
  }

  return orderRounds(built).slice(0, MAX_HOTTAKE_ROUNDS);
}
