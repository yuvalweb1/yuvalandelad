// ============================================================
// monthly.js — extra aggregates for the "4 weeks" (month) recap.
//
// The month deck shows DIFFERENT, more bite-sized stats than the year deck,
// several of which need a month-over-month comparison (e.g. "+14% vs last
// month"). The base `computeAll` only ever sees one window at a time, so this
// module re-slices the FULL message array into two trailing 28-day windows —
// "this month" (ending at the last message) and "last month" (the 28 days
// before that) — and derives the deltas + a handful of month-flavoured
// aggregates the slides need that aren't in the base analytics object.
//
// Pure + deterministic, like the rest of the pipeline: no Date.now(), no
// randomness, same messages → same output. Anchored to the last message so
// old exports stay meaningful.
// ============================================================

const DAY_MS = 86400000;
const WINDOW_DAYS = 28;            // mirrors period.js 'month'
const SESSION_GAP_MIN = 30;        // gap that ends a "conversation"
const CHAOS_BUCKET_MS = 10 * 60000; // 10-minute chaos buckets

// Good-morning / good-night phrase detection. Coverage spans the locales the
// app ships UI for; exports made on phones in other languages simply won't
// match (the stat fails-closed to 0 rather than guessing). Tested on the
// lowercased message text.
const GM_PATTERNS = [
  /good\s*morning/i, /\bgm\b/i, /mornin[g']/i,
  /buenos\s*d[ií]as/i, /bom\s*dia/i, /bonjour/i, /guten\s*morgen/i,
  /buongiorno/i, /доброе\s*утро/i, /g[üu]nayd[ıi]n/i,
  /בוקר\s*טוב/, /صباح\s*الخير/, /सुप्रभात/, /おはよ/, /좋은\s*아침/, /早安|早上好/,
];
const GN_PATTERNS = [
  /good\s*night/i, /\bgn\b/i, /nighty?\s*night/i,
  /buenas\s*noches/i, /boa\s*noite/i, /bonne\s*nuit/i, /gute\s*nacht/i,
  /buona\s*notte/i, /спокойной\s*ночи/i, /iyi\s*geceler/i,
  /לילה\s*טוב/, /تصبح\s*على\s*خير|ليلة\s*سعيدة/, /शुभ\s*रात्रि/, /おやすみ/, /잘\s*자/, /晚安/,
];

function matchesAny(text, patterns) {
  for (const re of patterns) if (re.test(text)) return true;
  return false;
}

function ts(m) {
  return m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime();
}

// Aggregate one window's worth of messages into the primitives the month
// slides read. `msgs` is assumed already restricted to the window.
function windowStats(msgs) {
  const total = msgs.length;
  let offHours = 0;          // before 9am or 6pm onward
  let nightMsgs = 0;         // 00:00–05:59
  let weekendMsgs = 0;       // Fri + Sat (weekday 5/6) — most regions' weekend
  let after7 = 0;            // 19:00 onward
  let gm = 0, gn = 0;
  const dayKeys = new Set();
  // first/last message hour per active day (decimal hours)
  const dayFirst = {};       // dayKey -> earliest decimal hour
  const dayLast = {};        // dayKey -> latest decimal hour

  for (const m of msgs) {
    const h = m.hour;
    if (h < 9 || h >= 18) offHours++;
    if (h >= 0 && h < 6) nightMsgs++;
    if (m.weekday === 5 || m.weekday === 6) weekendMsgs++;
    if (h >= 19) after7++;
    dayKeys.add(m.dayKey);
    const d = m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp);
    const dec = d.getHours() + d.getMinutes() / 60;
    if (dayFirst[m.dayKey] === undefined || dec < dayFirst[m.dayKey]) dayFirst[m.dayKey] = dec;
    if (dayLast[m.dayKey] === undefined || dec > dayLast[m.dayKey]) dayLast[m.dayKey] = dec;
    if (m.content) {
      const text = m.content;
      if (matchesAny(text, GM_PATTERNS)) gm++;
      if (matchesAny(text, GN_PATTERNS)) gn++;
    }
  }

  const activeDays = dayKeys.size;
  const firstHours = Object.values(dayFirst);
  const lastHours = Object.values(dayLast);
  const avg = (arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;

  return {
    total,
    offHours, offHoursPct: total ? (offHours / total) * 100 : 0,
    nightMsgs, nightPct: total ? (nightMsgs / total) * 100 : 0,
    weekendMsgs, weekdayMsgs: total - weekendMsgs,
    after7,
    gm, gn,
    activeDays,
    avgPerActiveDay: activeDays ? total / activeDays : 0,
    firstMsgAvgHour: avg(firstHours),
    lastMsgAvgHour: avg(lastHours),
    dayKeys,
  };
}

// Longest run of consecutive calendar days that had ≥1 message.
function longestDayStreak(dayKeys) {
  const days = Array.from(dayKeys).sort();
  if (days.length === 0) return 0;
  const tsOf = days.map(d => new Date(d).getTime());
  let best = 1, cur = 1;
  for (let i = 1; i < tsOf.length; i++) {
    const diff = Math.round((tsOf[i] - tsOf[i - 1]) / DAY_MS);
    if (diff === 1) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

// Biggest single "conversation": the longest unbroken back-and-forth where no
// gap between messages exceeds SESSION_GAP_MIN. Returns the session with the
// most messages.
function biggestConversation(sorted) {
  if (sorted.length === 0) return null;
  let best = null;
  let startTs = ts(sorted[0]);
  let count = 1;
  const tally = {};
  tally[sorted[0].author] = 1;
  const close = (endTs) => {
    if (!best || count > best.count) {
      let topAuthor = null, topN = 0;
      for (const a in tally) if (tally[a] > topN) { topN = tally[a]; topAuthor = a; }
      best = { count, startTs, durationMin: Math.round((endTs - startTs) / 60000), topAuthor };
    }
  };
  for (let i = 1; i < sorted.length; i++) {
    const gap = (ts(sorted[i]) - ts(sorted[i - 1])) / 60000;
    if (gap > SESSION_GAP_MIN) {
      close(ts(sorted[i - 1]));
      startTs = ts(sorted[i]);
      count = 1;
      for (const k in tally) delete tally[k];
      tally[sorted[i].author] = 1;
    } else {
      count++;
      tally[sorted[i].author] = (tally[sorted[i].author] || 0) + 1;
    }
  }
  close(ts(sorted[sorted.length - 1]));
  return best;
}

// Most chaotic fixed 10-minute window: the bucket with the most messages
// (requires ≥2 distinct authors so a one-person spam burst doesn't win).
function chaosTenMinutes(msgs) {
  const buckets = new Map();
  for (const m of msgs) {
    const key = Math.floor(ts(m) / CHAOS_BUCKET_MS);
    let b = buckets.get(key);
    if (!b) { b = { startTs: key * CHAOS_BUCKET_MS, count: 0, authors: new Set() }; buckets.set(key, b); }
    b.count++;
    b.authors.add(m.author);
  }
  let best = null;
  for (const b of buckets.values()) {
    if (b.authors.size < 2) continue;
    if (!best || b.count > best.count) best = b;
  }
  if (!best) return null;
  return { count: best.count, startTs: best.startTs, participants: best.authors.size };
}

// Busiest single day (max messages in one calendar day) within the window.
function busiestDay(msgs) {
  const daily = {};
  for (const m of msgs) daily[m.dayKey] = (daily[m.dayKey] || 0) + 1;
  let bestKey = null, bestVal = 0;
  for (const k in daily) if (daily[k] > bestVal) { bestVal = daily[k]; bestKey = k; }
  if (bestKey === null) return null;
  const dayCount = Object.keys(daily).length;
  const avg = dayCount ? msgs.length / dayCount : 0;
  return { dayKey: bestKey, count: bestVal, avgPerDay: avg };
}

/**
 * Build the month-recap extras from the FULL parsed message array.
 * @param {Array} messages parsed messages (any order)
 * @returns extras object consumed by the m4_* slides, or null when empty.
 */
export function computeMonthExtras(messages) {
  if (!messages || messages.length === 0) return null;
  const sorted = [...messages].sort((a, b) => ts(a) - ts(b));
  const end = ts(sorted[sorted.length - 1]);
  const thisStart = end - WINDOW_DAYS * DAY_MS;
  const prevStart = end - 2 * WINDOW_DAYS * DAY_MS;

  const thisMsgs = sorted.filter(m => ts(m) >= thisStart && ts(m) <= end);
  const prevMsgs = sorted.filter(m => ts(m) >= prevStart && ts(m) < thisStart);

  const cur = windowStats(thisMsgs);
  const prev = windowStats(prevMsgs);
  const hasComparison = prevMsgs.length > 0;

  const growthPct = (prev.total > 0)
    ? Math.round(((cur.total - prev.total) / prev.total) * 100)
    : null;

  return {
    windowDays: WINDOW_DAYS,
    hasComparison,
    // Activity + growth
    thisCount: cur.total,
    prevCount: prev.total,
    growthPct,
    activeDays: cur.activeDays,
    avgPerActiveDay: cur.avgPerActiveDay,
    avgPerDay: cur.total / WINDOW_DAYS,
    groupStreak: longestDayStreak(cur.dayKeys),
    // Hour / day distribution helpers (counts derived from the window itself so
    // they always agree with the deck's period-filtered base analytics)
    offHoursPct: cur.offHoursPct,
    prevOffHoursPct: prev.offHoursPct,
    offHoursTrendPct: hasComparison ? Math.round(cur.offHoursPct - prev.offHoursPct) : null,
    nightPct: cur.nightPct,
    after7: cur.after7,
    weekendMsgs: cur.weekendMsgs,
    weekdayMsgs: cur.weekdayMsgs,
    // Couple / lovers cute stats
    firstMsgAvgHour: cur.firstMsgAvgHour,
    lastMsgAvgHour: cur.lastMsgAvgHour,
    gmCount: cur.gm,
    gnCount: cur.gn,
    // Moments
    busiestDay: busiestDay(thisMsgs),
    biggestConversation: biggestConversation(thisMsgs),
    chaos10: chaosTenMinutes(thisMsgs),
  };
}
