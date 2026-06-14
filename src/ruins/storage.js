// ============================================================
// Persistent progression for The Ruins of [GroupName].
// One localStorage blob, keyed per chat (chatKey), then per season
// (the export's last month) — same convention as cw_duoquest_v1.
// Each season holds: case seals (grade only ever upgrades), fog-of-
// war ink (visited grid cells), and the evidence inventory. Heart
// glow is derived from seals vs. total cases, not stored — it can
// never regress on its own.
// ============================================================
import { chatKey } from './rng.js';
import { seasonKey } from '../duo/storage.js';

const KEY = 'cw_ruins_v1';

function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export { seasonKey };

const EMPTY_SEASON = () => ({ seals: {}, ink: [], evidence: [] });

export function loadSave(analytics) {
  const all = loadAll();
  const ck = chatKey(analytics);
  const save = all[ck] || { seasons: {} };
  const sk = seasonKey(analytics);
  if (!save.seasons[sk]) save.seasons[sk] = EMPTY_SEASON();
  return { save, ck, sk };
}

function persist(ck, save) {
  const all = loadAll();
  all[ck] = save;
  saveAll(all);
}

const GRADE_RANK = { bronze: 1, silver: 2, gold: 3 };

// Record a case's verdict grade. Grades only ever upgrade
// (gold > silver > bronze), mirroring "stars only ever go up".
export function recordSeal(analytics, caseId, grade) {
  const { save, ck, sk } = loadSave(analytics);
  const season = save.seasons[sk];
  const prevRank = GRADE_RANK[season.seals[caseId]] || 0;
  const newRank = GRADE_RANK[grade] || 0;
  if (newRank > prevRank) season.seals[caseId] = grade;
  persist(ck, save);
  return save;
}

// Merge newly-visited fog-of-war cell keys ("gx,gy") into the
// permanent ink set for this season.
export function addInk(analytics, cellKeys) {
  if (!cellKeys || !cellKeys.length) return loadSave(analytics).save;
  const { save, ck, sk } = loadSave(analytics);
  const season = save.seasons[sk];
  const set = new Set(season.ink);
  for (const c of cellKeys) set.add(c);
  season.ink = Array.from(set);
  persist(ck, save);
  return save;
}

export function addEvidence(analytics, evidenceId) {
  const { save, ck, sk } = loadSave(analytics);
  const season = save.seasons[sk];
  if (!season.evidence.includes(evidenceId)) season.evidence.push(evidenceId);
  persist(ck, save);
  return save;
}

// Restoration % — the Heart's glow. Pure function of seals vs. the
// kingdom's case count, so it only ever moves up as seals are won.
export function heartGlowPct(save, sk, totalCases) {
  const season = save.seasons[sk];
  if (!season || !totalCases) return 0;
  const sealed = Object.keys(season.seals).length;
  return Math.round((sealed / totalCases) * 100);
}
