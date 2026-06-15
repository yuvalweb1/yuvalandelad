// ============================================================
// Light persistence for Group Court & Hot Takes.
// One localStorage blob: last-used juror names (shared across both
// modes) + best leaderboard score per mode, keyed by season so a
// fresh export resets the high score.
// ============================================================
const KEY = 'cw_votegames_v1';

function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

// Season = the month the export ends in (mirrors duo/storage.js).
export function seasonKey(analytics) {
  const end = new Date(analytics?.end);
  if (isNaN(end)) return 's0';
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
}

export function loadJurors() {
  const all = loadAll();
  return Array.isArray(all.jurors) ? all.jurors : [];
}

export function saveJurors(names) {
  const all = loadAll();
  all.jurors = names;
  saveAll(all);
}

// Best score for a mode this season: { topPlayer, score, total }.
export function loadBest(mode, analytics) {
  const all = loadAll();
  const sk = seasonKey(analytics);
  return all[mode]?.[sk] || null;
}

export function saveBest(mode, analytics, result) {
  const all = loadAll();
  const sk = seasonKey(analytics);
  if (!all[mode]) all[mode] = {};
  const prev = all[mode][sk];
  if (!prev || result.score > prev.score) {
    all[mode][sk] = result;
    saveAll(all);
  }
}
