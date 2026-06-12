// ============================================================
// Gatekeeper bets — the boss fight of every level.
// The player BETS on a hidden pair-fact ("Who owns the midnight
// hour?"), then watches the truth land. Candidates deliberately
// avoid the headline stats the main recap already showed
// (total messages, avg reply time, night %…) in favour of
// asymmetric pair facts: hour duels, weekend duels, who chases
// whom, who gets left on read, who says it first.
// Deterministic order, ties skipped. One question per level.
// ============================================================
import { makeRng, pairSeed } from './rng.js';

const sum = (arr, from, to) => {
  let s = 0;
  for (let i = from; i <= to; i++) s += arr?.[i] || 0;
  return s;
};

const fmtNum = (n) => Math.round(n).toLocaleString();
const fmtPct = (n) => `${Math.round(n)}%`;
const fmtDays = (n) => `${Math.round(n)}d`;
const fmt1 = (n) => Number(n).toFixed(1);

// Each candidate: id, emoji, value extractor per user, higherWins,
// eligibility check (skip when the data is too thin to be fun).
function candidates(analytics, A, B) {
  const ua = analytics.userMap?.[A];
  const ub = analytics.userMap?.[B];
  if (!ua || !ub) return [];
  const rm = analytics.replyMatrix || {};
  const aToB = (rm[A] && rm[A][B]) || 0;
  const bToA = (rm[B] && rm[B][A]) || 0;

  return [
    { id: 'midnight', emoji: '🌑', valA: sum(ua.hourCounts, 0, 2),  valB: sum(ub.hourCounts, 0, 2),
      higherWins: true, fmt: fmtNum, eligible: sum(ua.hourCounts, 0, 2) + sum(ub.hourCounts, 0, 2) >= 6 },
    { id: 'weekend',  emoji: '🏖️', valA: (ua.weekdayCounts?.[0] || 0) + (ua.weekdayCounts?.[6] || 0),
      valB: (ub.weekdayCounts?.[0] || 0) + (ub.weekdayCounts?.[6] || 0),
      higherWins: true, fmt: fmtNum, eligible: true },
    { id: 'chase',    emoji: '🎯', valA: aToB, valB: bToA,
      higherWins: true, fmt: fmtNum, eligible: aToB + bToA >= 10 },
    { id: 'ignored',  emoji: '🪦', valA: ua.gotNoReplyWithin30, valB: ub.gotNoReplyWithin30,
      higherWins: true, fmt: fmtNum, eligible: ua.gotNoReplyWithin30 + ub.gotNoReplyWithin30 >= 4 },
    { id: 'killer',   emoji: '💀', valA: ua.conversationsKilled, valB: ub.conversationsKilled,
      higherWins: true, fmt: fmtNum, eligible: ua.conversationsKilled + ub.conversationsKilled >= 4 },
    { id: 'reviver',  emoji: '⚡', valA: ua.conversationsRevived, valB: ub.conversationsRevived,
      higherWins: true, fmt: fmtNum, eligible: ua.conversationsRevived + ub.conversationsRevived >= 4 },
    { id: 'love',     emoji: '💘', valA: ua.loveYouCount, valB: ub.loveYouCount,
      higherWins: true, fmt: fmtNum, eligible: ua.loveYouCount + ub.loveYouCount >= 2 },
    { id: 'ghosting', emoji: '👻', valA: ua.longestAbsenceDays, valB: ub.longestAbsenceDays,
      higherWins: true, fmt: fmtDays, eligible: Math.max(ua.longestAbsenceDays, ub.longestAbsenceDays) >= 3 },
    { id: 'burst',    emoji: '🌋', valA: ua.maxBurst, valB: ub.maxBurst,
      higherWins: true, fmt: fmtNum, eligible: Math.max(ua.maxBurst, ub.maxBurst) >= 4 },
    { id: 'essay',    emoji: '✍️', valA: ua.avgWordsPerMsg, valB: ub.avgWordsPerMsg,
      higherWins: true, fmt: fmt1, eligible: true },
    { id: 'lastword', emoji: '🎤', valA: ua.finalMessagesOfDay, valB: ub.finalMessagesOfDay,
      higherWins: true, fmt: fmtNum, eligible: ua.finalMessagesOfDay + ub.finalMessagesOfDay >= 6 },
    { id: 'curious',  emoji: '❓', valA: (ua.questionRate || 0) * 100, valB: (ub.questionRate || 0) * 100,
      higherWins: true, fmt: fmtPct, eligible: ua.questionCount + ub.questionCount >= 8 },
    { id: 'earlybird', emoji: '🌅', valA: sum(ua.hourCounts, 5, 8), valB: sum(ub.hourCounts, 5, 8),
      higherWins: true, fmt: fmtNum, eligible: sum(ua.hourCounts, 5, 8) + sum(ub.hourCounts, 5, 8) >= 6 },
  ];
}

// Build the season's question list: eligible, non-tie, seeded order.
// Level i asks questions[i % length].
export function buildQuestions(analytics, A, B) {
  const rng = makeRng(pairSeed(analytics, A, B) + '|boss');
  const list = [];
  for (const c of candidates(analytics, A, B)) {
    if (!c.eligible) continue;
    if (c.valA == null || c.valB == null) continue;
    if (c.valA === c.valB) continue; // a bet needs a true answer
    list.push({
      id: c.id,
      emoji: c.emoji,
      valA: c.valA,
      valB: c.valB,
      fmt: c.fmt,
      answer: (c.higherWins ? c.valA > c.valB : c.valA < c.valB) ? 'A' : 'B',
    });
  }
  return rng.shuffle(list);
}
