// Time-period filtering — trailing windows anchored to the chat's LAST message.
//
// The recap can be scoped to the whole chat or to a trailing window that ends
// at the most recent message (NOT `Date.now()`, so output stays deterministic
// and meaningful for old exports). Picking a window simply slices the message
// array; `computeAll` then runs on that slice with no other changes.
//
// Window lengths (days):
//   all    → no filter (entire transcript)
//   year   → last 365 days
//   season → last 90 days
//   month  → last 28 days  (surfaced in the UI as "4 weeks")

export const PERIOD_TYPES = ['all', 'year', 'season', 'month'];

const WINDOW_DAYS = {
  year: 365,
  season: 90,
  month: 28,
};

const DAY_MS = 86400000;

// Normalise whatever a caller hands us into a period type string.
// Accepts a bare string ('all') or an object ({ type: 'all' }).
function periodType(period) {
  if (!period) return 'all';
  if (typeof period === 'string') return period;
  return period.type || 'all';
}

// Last message timestamp (ms) across the array, or null when empty.
function lastTimestamp(messages) {
  let max = null;
  for (const m of messages) {
    const t = m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime();
    if (max === null || t > max) max = t;
  }
  return max;
}

// Inclusive [start, end] ms range for a window, or null for 'all' / empty.
// `end` is the last message instant; `start` is `end − windowDays`.
export function getPeriodRange(period, messages) {
  const type = periodType(period);
  if (type === 'all' || !WINDOW_DAYS[type]) return null;
  if (!messages || messages.length === 0) return null;
  const end = lastTimestamp(messages);
  if (end === null) return null;
  return { start: end - WINDOW_DAYS[type] * DAY_MS, end };
}

// Slice messages to the selected window. Returns the same array (not a copy)
// for 'all' so the common path stays allocation-free.
export function filterMessagesByPeriod(messages, period) {
  const range = getPeriodRange(period, messages);
  if (!range) return messages;
  return messages.filter(m => {
    const t = m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime();
    return t >= range.start && t <= range.end;
  });
}

// Predicate for media items (which carry `.ts`, a Date — see parser/mediaMatch).
// Fail-open: an item with no `.ts` is kept in every window so we never silently
// drop media the parser couldn't time-stamp.
export function makeInRange(period, messages) {
  const range = getPeriodRange(period, messages);
  if (!range) return () => true;
  return (item) => {
    if (!item || item.ts == null) return true;
    const t = item.ts instanceof Date ? item.ts.getTime() : new Date(item.ts).getTime();
    return t >= range.start && t <= range.end;
  };
}

// Lightweight stats for the Landing card — messages / participants / span — for
// a given window, WITHOUT running the full `computeAll` pipeline. O(n).
export function previewStatsForPeriod(messages, period) {
  const slice = filterMessagesByPeriod(messages, period);
  if (!slice || slice.length === 0) {
    return { totalMessages: 0, totalParticipants: 0, durationDays: 0 };
  }
  const authors = new Set();
  let min = Infinity, max = -Infinity;
  for (const m of slice) {
    authors.add(m.author);
    const t = m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime();
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return {
    totalMessages: slice.length,
    totalParticipants: authors.size,
    durationDays: Math.max(1, Math.round((max - min) / DAY_MS) + 1),
  };
}

// Which windows are worth offering for this chat: 'all' is always valid; a
// trailing window is offered only when the chat is LONGER than that window
// (otherwise it'd be identical to 'all'). Returns the ordered subset of
// PERIOD_TYPES a picker should render.
export function availablePeriods(messages) {
  if (!messages || messages.length === 0) return ['all'];
  const end = lastTimestamp(messages);
  let min = Infinity;
  for (const m of messages) {
    const t = m.timestamp instanceof Date ? m.timestamp.getTime() : new Date(m.timestamp).getTime();
    if (t < min) min = t;
  }
  const spanDays = (end - min) / DAY_MS;
  return PERIOD_TYPES.filter(type => type === 'all' || spanDays > WINDOW_DAYS[type]);
}

// Localised pill label for a period type. Falls back to English.
export function getPeriodLabel(period, t) {
  const type = periodType(period);
  const map = {
    all:    (t && t.period_all)    || 'All',
    year:   (t && t.period_year)   || 'Year',
    season: (t && t.period_season) || 'Season',
    month:  (t && t.period_month)  || '4 weeks',
  };
  return map[type] || map.all;
}
