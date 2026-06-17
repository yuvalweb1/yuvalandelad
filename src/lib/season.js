// ============================================================
// season.js — extra aggregates for the "season" (90-day) recap.
//
// The season deck tells a 3-month STORY: how the chat evolved month by month,
// who rose and who faded, which month had the best vibes, and how the season
// compares to the one before it. None of this lives in the base `computeAll`
// (which only sees a single flat window), so this module re-slices the FULL
// message array into:
//   • the season window  (last 90 days, ending at the last message)
//   • the previous season (the 90 days before that) — for "vs last season"
//   • calendar-month buckets inside the season — for the month-by-month story
//
// Pure + deterministic, like the rest of the pipeline. Anchored to the last
// message, never Date.now().
// ============================================================

const DAY_MS = 86400000;
const WINDOW_DAYS = 90;             // mirrors period.js 'season'
const SESSION_GAP_MIN = 30;
const CHAOS_BUCKET_MS = 10 * 60000;

function ts(m) {
  return m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime();
}
function asDate(m) {
  return m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp);
}
function mean(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null; }

// Group average reply time (minutes): consecutive cross-author messages within
// 2h. Mirrors the heuristic in analytics.js so the season figure is comparable.
function groupAvgResponse(sorted) {
  let sum = 0, n = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].author === sorted[i - 1].author) continue;
    const diff = (ts(sorted[i]) - ts(sorted[i - 1])) / 60000;
    if (diff > 0 && diff <= 120) { sum += diff; n++; }
  }
  return n > 0 ? sum / n : null;
}

// Average conversation length (messages per session, split on 30-min silence).
function avgSessionLength(sorted) {
  if (sorted.length === 0) return null;
  let sessions = 1, count = 1, sizes = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = (ts(sorted[i]) - ts(sorted[i - 1])) / 60000;
    if (gap > SESSION_GAP_MIN) { sizes.push(count); count = 1; sessions++; }
    else count++;
  }
  sizes.push(count);
  return mean(sizes);
}

// Flat aggregates for one window (used for season-vs-previous comparisons).
function windowAgg(msgs) {
  let media = 0, voice = 0, night = 0, weekend = 0, hourSum = 0;
  const days = new Set();
  for (const m of msgs) {
    if (m.hasMedia) media++;
    if (m.isVoice) voice++;
    if (m.hour >= 0 && m.hour < 6) night++;
    if (m.weekday === 5 || m.weekday === 6) weekend++;
    const d = asDate(m);
    hourSum += d.getHours() + d.getMinutes() / 60;
    days.add(m.dayKey);
  }
  const total = msgs.length;
  return {
    total,
    mediaPct: total ? (media / total) * 100 : 0,
    voicePct: total ? (voice / total) * 100 : 0,
    nightPct: total ? (night / total) * 100 : 0,
    weekend, weekday: total - weekend,
    avgHour: total ? hourSum / total : null,
    activeDays: days.size,
    avgResp: groupAvgResponse(msgs),
    avgConvLen: avgSessionLength(msgs),
  };
}

// ── Moment helpers (operate on the season window) ──
function biggestAndLongestConversation(sorted) {
  if (sorted.length === 0) return { biggest: null, longest: null };
  let biggest = null, longest = null;
  let startTs = ts(sorted[0]), count = 1;
  const tally = { [sorted[0].author]: 1 };
  const close = (endTs) => {
    let topAuthor = null, topN = 0;
    for (const a in tally) if (tally[a] > topN) { topN = tally[a]; topAuthor = a; }
    const durationMin = Math.round((endTs - startTs) / 60000);
    const sess = { count, startTs, durationMin, topAuthor };
    if (!biggest || count > biggest.count) biggest = sess;
    if (!longest || durationMin > longest.durationMin) longest = sess;
  };
  for (let i = 1; i < sorted.length; i++) {
    const gap = (ts(sorted[i]) - ts(sorted[i - 1])) / 60000;
    if (gap > SESSION_GAP_MIN) {
      close(ts(sorted[i - 1]));
      startTs = ts(sorted[i]); count = 1;
      for (const k in tally) delete tally[k];
      tally[sorted[i].author] = 1;
    } else {
      count++;
      tally[sorted[i].author] = (tally[sorted[i].author] || 0) + 1;
    }
  }
  close(ts(sorted[sorted.length - 1]));
  return { biggest, longest };
}

function chaosTenMinutes(msgs) {
  const buckets = new Map();
  for (const m of msgs) {
    const key = Math.floor(ts(m) / CHAOS_BUCKET_MS);
    let b = buckets.get(key);
    if (!b) { b = { startTs: key * CHAOS_BUCKET_MS, count: 0, authors: new Set() }; buckets.set(key, b); }
    b.count++; b.authors.add(m.author);
  }
  let best = null;
  for (const b of buckets.values()) {
    if (b.authors.size < 2) continue;
    if (!best || b.count > best.count) best = b;
  }
  return best ? { count: best.count, startTs: best.startTs, participants: best.authors.size } : null;
}

function busiestDay(msgs) {
  const daily = {};
  for (const m of msgs) daily[m.dayKey] = (daily[m.dayKey] || 0) + 1;
  let key = null, val = 0;
  for (const k in daily) if (daily[k] > val) { val = daily[k]; key = k; }
  if (key === null) return null;
  const n = Object.keys(daily).length;
  return { dayKey: key, count: val, avgPerDay: n ? msgs.length / n : 0 };
}

function biggestMediaDay(msgs) {
  const daily = {};
  for (const m of msgs) if (m.hasMedia) daily[m.dayKey] = (daily[m.dayKey] || 0) + 1;
  let key = null, val = 0;
  for (const k in daily) if (daily[k] > val) { val = daily[k]; key = k; }
  return key === null ? null : { dayKey: key, count: val };
}

// Most active weekend: bucket weekend messages (Fri/Sat) by the Friday of their
// week, pick the busiest weekend.
function bestWeekend(msgs) {
  const buckets = {};
  for (const m of msgs) {
    if (m.weekday !== 5 && m.weekday !== 6) continue;
    const d = asDate(m);
    const fri = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (m.weekday === 6 ? 1 : 0));
    const key = `${fri.getFullYear()}-${String(fri.getMonth() + 1).padStart(2, '0')}-${String(fri.getDate()).padStart(2, '0')}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }
  let key = null, val = 0;
  for (const k in buckets) if (buckets[k] > val) { val = buckets[k]; key = k; }
  return key === null ? null : { startKey: key, count: val };
}

function longestDayStreak(dayKeys) {
  const days = Array.from(dayKeys).sort();
  if (days.length === 0) return 0;
  const t = days.map(d => new Date(d).getTime());
  let best = 1, cur = 1;
  for (let i = 1; i < t.length; i++) {
    if (Math.round((t[i] - t[i - 1]) / DAY_MS) === 1) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

/**
 * Build the season extras from the FULL parsed message array.
 * @returns extras consumed by the s3_* slides, or null when empty.
 */
export function computeSeasonExtras(messages) {
  if (!messages || messages.length === 0) return null;
  const sorted = [...messages].sort((a, b) => ts(a) - ts(b));
  const end = ts(sorted[sorted.length - 1]);
  const seasonStart = end - WINDOW_DAYS * DAY_MS;
  const prevStart = end - 2 * WINDOW_DAYS * DAY_MS;

  const cur = sorted.filter(m => ts(m) >= seasonStart && ts(m) <= end);
  const prev = sorted.filter(m => ts(m) >= prevStart && ts(m) < seasonStart);

  // ── Calendar-month buckets inside the season ──
  const monthMap = new Map(); // 'YYYY-MM' -> bucket
  const dayKeys = new Set();
  for (const m of cur) {
    const d = asDate(m);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let b = monthMap.get(key);
    if (!b) {
      b = { key, monthIdx: d.getMonth(), year: d.getFullYear(), count: 0, media: 0, voice: 0, emoji: 0, night: 0, hourSum: 0, senders: new Set(), byUser: {} };
      monthMap.set(key, b);
    }
    b.count++;
    if (m.hasMedia) b.media++;
    if (m.isVoice) b.voice++;
    b.emoji += m.emojis ? m.emojis.length : 0;
    if (m.hour >= 0 && m.hour < 6) b.night++;
    b.hourSum += d.getHours() + d.getMinutes() / 60;
    b.senders.add(m.author);
    b.byUser[m.author] = (b.byUser[m.author] || 0) + 1;
    dayKeys.add(m.dayKey);
  }
  const months = Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  const monthIndexByKey = Object.fromEntries(months.map((m, i) => [m.key, i]));

  // Public, lightweight month view (drop the Set for serialisation safety).
  const monthsOut = months.map(m => ({
    key: m.key, monthIdx: m.monthIdx, year: m.year, count: m.count,
    media: m.media, voice: m.voice, emoji: m.emoji, night: m.night,
    senders: m.senders.size,
    avgHour: m.count ? m.hourSum / m.count : null,
    emojiRate: m.count ? m.emoji / m.count : 0,
    affection: m.count ? (m.emoji + m.media) / m.count : 0,
  }));

  // ── Per-user monthly counts (aligned to months order) ──
  const authors = Array.from(new Set(cur.map(m => m.author)));
  const byUser = {}; // author -> number[] per month
  for (const a of authors) byUser[a] = months.map(() => 0);
  for (const m of cur) {
    const mi = monthIndexByKey[`${asDate(m).getFullYear()}-${String(asDate(m).getMonth() + 1).padStart(2, '0')}`];
    if (mi != null) byUser[m.author][mi]++;
  }
  const totalByUser = {};
  for (const a of authors) totalByUser[a] = byUser[a].reduce((s, x) => s + x, 0);

  // ── Movers: increase / decrease first→last month ──
  const lastIdx = months.length - 1;
  const movers = [];
  if (months.length >= 2) {
    for (const a of authors) {
      if (totalByUser[a] < 5) continue;
      const first = byUser[a][0], last = byUser[a][lastIdx];
      movers.push({ author: a, first, last, delta: last - first, total: totalByUser[a], monthly: byUser[a] });
    }
  }
  const risers = [...movers].filter(x => x.delta > 0).sort((x, y) => y.delta - x.delta);
  const fallers = [...movers].filter(x => x.delta < 0).sort((x, y) => x.delta - y.delta);

  // ── Most consistent member (lowest coefficient of variation) ──
  let mostConsistent = null;
  for (const a of authors) {
    const arr = byUser[a];
    const activeMonths = arr.filter(x => x > 0).length;
    if (totalByUser[a] < 10 || activeMonths < 2) continue;
    const mu = mean(arr);
    if (!mu) continue;
    const variance = mean(arr.map(x => (x - mu) ** 2));
    const cov = Math.sqrt(variance) / mu;
    const score = Math.max(0, Math.round((1 - Math.min(cov, 1)) * 100));
    if (!mostConsistent || score > mostConsistent.score) {
      mostConsistent = { author: a, score, monthly: arr, total: totalByUser[a] };
    }
  }

  // ── Who became more involved (biggest share gain first→last month) ──
  let mostInvolved = null;
  if (months.length >= 2 && months[0].count && months[lastIdx].count) {
    for (const a of authors) {
      if (totalByUser[a] < 5) continue;
      const firstShare = byUser[a][0] / months[0].count;
      const lastShare = byUser[a][lastIdx] / months[lastIdx].count;
      const gain = (lastShare - firstShare) * 100;
      if (!mostInvolved || gain > mostInvolved.gainPts) {
        mostInvolved = { author: a, gainPts: Math.round(gain), firstShare: Math.round(firstShare * 100), lastShare: Math.round(lastShare * 100) };
      }
    }
    if (mostInvolved && mostInvolved.gainPts <= 0) mostInvolved = null;
  }

  // ── Each member's most-active month ──
  const peakMonthByUser = authors
    .filter(a => totalByUser[a] > 0)
    .map(a => {
      let bi = 0; for (let i = 1; i < months.length; i++) if (byUser[a][i] > byUser[a][bi]) bi = i;
      return { author: a, monthIdx: months[bi]?.monthIdx, count: byUser[a][bi], total: totalByUser[a] };
    })
    .sort((x, y) => y.total - x.total);

  // ── Month superlatives ──
  const pickMonth = (scoreFn, wantMax = true) => {
    if (months.length === 0) return null;
    let best = monthsOut[0];
    for (const m of monthsOut) {
      if (wantMax ? scoreFn(m) > scoreFn(best) : scoreFn(m) < scoreFn(best)) best = m;
    }
    return best;
  };
  const strongestMonth = pickMonth(m => m.count, true);
  const quietestMonth = pickMonth(m => m.count, false);
  const bestVibesMonth = pickMonth(m => m.emojiRate, true);
  const affectionateMonth = pickMonth(m => m.affection, true);
  const collaborativeMonth = pickMonth(m => m.senders * 1000 + m.count, true);

  // ── This-season vs previous-season comparisons ──
  const curAgg = windowAgg(cur);
  const prevAgg = windowAgg(prev);
  const hasComparison = prev.length > 0;
  const growthPct = prevAgg.total > 0 ? Math.round(((curAgg.total - prevAgg.total) / prevAgg.total) * 100) : null;

  const { biggest, longest } = biggestAndLongestConversation(cur);

  return {
    windowDays: WINDOW_DAYS,
    hasComparison,
    // headline
    total: curAgg.total,
    prevTotal: prevAgg.total,
    growthPct,
    activeDays: curAgg.activeDays,
    avgPerDay: curAgg.total / WINDOW_DAYS,
    groupStreak: longestDayStreak(dayKeys),
    // month-by-month story
    months: monthsOut,
    peakMonthByUser,
    risers, fallers, mostConsistent, mostInvolved,
    strongestMonth, quietestMonth, bestVibesMonth, affectionateMonth, collaborativeMonth,
    // moments
    biggestConversation: biggest,
    longestConversation: longest,
    busiestDay: busiestDay(cur),
    biggestMediaDay: biggestMediaDay(cur),
    bestWeekend: bestWeekend(cur),
    chaos10: chaosTenMinutes(cur),
    // trend verdicts (this season vs previous)
    trends: {
      activity: { cur: curAgg.total, prev: prevAgg.total, growthPct },
      timeOfDay: { cur: curAgg.avgHour, prev: prevAgg.avgHour },
      media: { cur: curAgg.mediaPct, prev: prevAgg.mediaPct },
      response: { cur: curAgg.avgResp, prev: prevAgg.avgResp },
      convLen: { cur: curAgg.avgConvLen, prev: prevAgg.avgConvLen },
      weekend: { weekend: curAgg.weekend, weekday: curAgg.weekday },
      collab: {
        firstSenders: months[0]?.senders.size ?? 0,
        lastSenders: months[lastIdx]?.senders.size ?? 0,
      },
    },
  };
}
