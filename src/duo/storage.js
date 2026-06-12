// ============================================================
// Persistent progression for The Long Run.
// One localStorage blob, keyed per pair (chat start + two names),
// then per season (the export's last month). The album and trail
// unlocks live at pair level so they accumulate across months —
// that's the long-term hook: each new export adds a season, the
// collection never resets.
// ============================================================
import { hash32, pairSeed } from './rng.js';

const KEY = 'cw_duoquest_v1';

function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export function pairKey(analytics, A, B) {
  return 'p' + hash32(pairSeed(analytics, A, B)).toString(36);
}

// Season = the month the export ends in. Re-running the same export
// lands in the same season; next month's export opens a new one.
export function seasonKey(analytics) {
  const end = new Date(analytics.end);
  if (isNaN(end)) return 's0';
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
}

const EMPTY_SEASON = () => ({ stars: {}, boss: {}, runs: 0 });

export function loadSave(analytics, A, B) {
  const all = loadAll();
  const pk = pairKey(analytics, A, B);
  const save = all[pk] || { seasons: {}, artifacts: {}, trail: null, coins: 0 };
  const sk = seasonKey(analytics);
  if (!save.seasons[sk]) save.seasons[sk] = EMPTY_SEASON();
  return { save, pk, sk };
}

function persist(pk, save) {
  const all = loadAll();
  all[pk] = save;
  saveAll(all);
}

// Record a finished run. Stars only ever go up; album only grows.
// Returns the updated save.
export function recordRun(analytics, A, B, levelIdx, result) {
  const { save, pk, sk } = loadSave(analytics, A, B);
  const season = save.seasons[sk];
  const prev = season.stars[levelIdx] || 0;
  if (result.stars > prev) season.stars[levelIdx] = result.stars;
  if (result.bossCorrect != null) season.boss[levelIdx] = result.bossCorrect;
  season.runs = (season.runs || 0) + 1;
  if (result.artifactId) save.artifacts[result.artifactId] = true;
  save.coins = (save.coins || 0) + (result.coins || 0);
  persist(pk, save);
  return save;
}

export function setTrail(analytics, A, B, trail) {
  const { save, pk } = loadSave(analytics, A, B);
  save.trail = trail;
  persist(pk, save);
  return save;
}

export function totalStars(save, sk) {
  const season = save.seasons[sk];
  if (!season) return 0;
  return Object.values(season.stars).reduce((s, n) => s + n, 0);
}

// All seasons for the pair, newest last — drives the season shelf.
export function seasonList(save) {
  return Object.keys(save.seasons).sort();
}

// ── Progression rules ──────────────────────────────────────────
// Linear unlock + two star gates so replaying for 3★ has purpose.
export const STAR_GATES = [0, 0, 0, 4, 4, 8, 8, 12];

export function isUnlocked(save, sk, levelIdx) {
  if (levelIdx === 0) return true;
  const season = save.seasons[sk];
  if (!season) return false;
  const prevDone = (season.stars[levelIdx - 1] || 0) > 0;
  return prevDone && totalStars(save, sk) >= (STAR_GATES[levelIdx] || 0);
}

// Ability + cosmetic thresholds (total stars in the active season).
export const DOUBLE_JUMP_AT = 6;
export const TRAILS = [
  { id: 'gold',  color: '#f9c74f', starsAt: 0  },
  { id: 'mint',  color: '#5eead4', starsAt: 3  },
  { id: 'viola', color: '#c084fc', starsAt: 9  },
  { id: 'ember', color: '#fb7185', starsAt: 15 },
];
