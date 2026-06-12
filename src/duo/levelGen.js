// ============================================================
// Level generator — the chat's year, compiled into terrain.
// 8 levels = 8 equal slices of the timeline. Per slice:
//   activity (seismogram)  → obstacle density + scroll speed
//   zero-day runs          → pit widths (the silences)
//   chaos peaks            → storm zone (raining ✉️, screen shake)
//   the longest dead zone  → the GHOST level (a 👻 stalks you)
//   era night share        → midnight palette + bats
//   the pair's top emojis  → the coins themselves
// Pure function of (analytics, A, B, idx) via seeded PRNG.
// World units: logical px in a 360×560 viewport.
// ============================================================
import { makeRng, pairSeed } from './rng.js';

export const LEVEL_COUNT = 8;

// Physics constants shared with the engine — the generator uses them
// to keep every gap and capsule platform reachable.
export const PHYS = {
  W: 360, H: 560,
  GRAVITY: 2200,        // px/s² falling
  GRAVITY_HOLD: 1300,   // px/s² while jump held and rising
  JUMP_V: 720,          // initial jump velocity
  SPEED_BASE: 190,      // world scroll px/s at level 0
  PLAYER_R: 14,
};

export const PALETTES = [
  { id: 'sunrise',  skyTop: '#241f3d', skyBot: '#6e3b5c', ground: '#2a1f42', edge: '#ffb86b', hill: '#352a52', night: false },
  { id: 'gold',     skyTop: '#2a2438', skyBot: '#9c6b3a', ground: '#2e2438', edge: '#f9c74f', hill: '#3d3050', night: false },
  { id: 'rose',     skyTop: '#2b1b38', skyBot: '#a04365', ground: '#271a36', edge: '#fb7185', hill: '#3a2548', night: false },
  { id: 'midnight', skyTop: '#0d1126', skyBot: '#27355e', ground: '#131a33', edge: '#8b9ff7', hill: '#1c2547', night: true },
];

// Per-slice stats pulled from the analytics the recap already computed.
function sliceStats(analytics, idx) {
  const seis = analytics.chaos?.seismogram || [];
  const L = seis.length;
  const from = Math.floor((idx / LEVEL_COUNT) * L);
  const to = Math.max(from + 1, Math.floor(((idx + 1) / LEVEL_COUNT) * L));
  const slice = seis.slice(from, to);

  let sumI = 0, maxI = 0, zeroRun = 0, bestZeroRun = 0;
  for (const d of slice) {
    sumI += d.intensity || 0;
    if (d.intensity > maxI) maxI = d.intensity;
    if (!d.count) { zeroRun++; if (zeroRun > bestZeroRun) bestZeroRun = zeroRun; }
    else zeroRun = 0;
  }
  const meanI = slice.length ? sumI / slice.length : 0.3;

  // Date range of the slice (for locating peaks / dead zone / era).
  const t0 = slice.length ? new Date(slice[0].day).getTime() : NaN;
  const t1 = slice.length ? new Date(slice[slice.length - 1].day).getTime() + 86400000 : NaN;
  const inSlice = (ts) => {
    const t = new Date(ts).getTime();
    return !isNaN(t) && !isNaN(t0) && t >= t0 && t < t1;
  };

  // Storm: this slice contains one of the chat's top chaos minutes.
  const storm = (analytics.chaos?.peaks || []).some(p => inSlice(p.ts));
  // Stalker: this slice contains the start of the great silence.
  const dz = analytics.chaos?.awards?.deadZone;
  const stalker = !!(dz && inSlice(dz.fromTs));
  // Night: the era covering the slice midpoint leans nocturnal.
  const mid = (t0 + t1) / 2;
  let night = false;
  for (const era of analytics.eras || []) {
    const es = new Date(era.startDate).getTime();
    const ee = new Date(era.endDate).getTime();
    if (!isNaN(es) && !isNaN(ee) && mid >= es && mid <= ee) {
      // eras don't carry nightPct in their output — approximate with the
      // group's overall night share concentrated by era name.
      night = era.name === 'The 3 AM Era';
    }
  }
  if (!night) night = (analytics.groupNightPct || 0) > 22 && idx >= LEVEL_COUNT - 2;

  return {
    density: Math.min(1, meanI * 1.6),        // 0..1 obstacle pressure
    silence: Math.min(1, bestZeroRun / 10),   // 0..1 pit width factor
    storm, stalker, night,
  };
}

// The pair's signature emojis become the level's coins.
function coinEmojis(analytics, A, B) {
  const ua = analytics.userMap?.[A];
  const ub = analytics.userMap?.[B];
  const pool = [];
  for (const e of ua?.top5Emojis || []) pool.push(e.emoji);
  for (const e of ub?.top5Emojis || []) pool.push(e.emoji);
  const uniq = Array.from(new Set(pool)).filter(Boolean);
  return uniq.length >= 2 ? uniq.slice(0, 6) : ['❤️', '😂', '✨'];
}

export function buildLevel(analytics, A, B, idx) {
  const rng = makeRng(pairSeed(analytics, A, B) + '|level' + idx);
  const stats = sliceStats(analytics, idx);
  const emojis = coinEmojis(analytics, A, B);
  const ramp = idx / (LEVEL_COUNT - 1);              // 0..1 across the season

  const speed = PHYS.SPEED_BASE + idx * 9;
  const worldLen = Math.round(5200 + idx * 520 + stats.density * 900);

  // Max jumpable gap at this speed (full hold), with a safety margin.
  const tAir = PHYS.JUMP_V / PHYS.GRAVITY_HOLD +
    Math.sqrt(2 * (PHYS.JUMP_V * PHYS.JUMP_V / (2 * PHYS.GRAVITY_HOLD)) / PHYS.GRAVITY);
  const maxGap = Math.floor(tAir * speed * 0.78);

  const platforms = [];
  const hazards = [];
  const coins = [];
  const hearts = [];

  // ── Terrain ───────────────────────────────────────────────
  let x = 0;
  let y = 430;
  const runway = idx === 0 ? 560 : 340;              // safe opening stretch
  platforms.push({ x: 0, w: runway, y });
  x = runway;
  while (x < worldLen - 400) {
    // Level 1 gaps clear with a plain tap; the ceiling stays well under
    // the max hold-jump range so no gap ever needs a perfect jump.
    const gapBase = 48 + ramp * 42 + stats.silence * 40;
    const gap = Math.min(maxGap, Math.round(rng.range(gapBase, gapBase + 34)));
    x += gap;
    y = Math.max(370, Math.min(470, y + rng.int(-2, 2) * 28));
    const w = Math.round(rng.range(270, 450));
    platforms.push({ x, w, y });
    x += w;
  }
  // Finish runway — calm landing into the gate.
  platforms.push({ x: x + 70, w: 420, y: 430 });
  const finishX = x + 70 + 320;
  const realLen = x + 70 + 420;

  // ── Hazards on platforms ──────────────────────────────────
  // Per-slot hazard chance — halved on the onboarding level.
  const densityP = Math.min(0.6, 0.10 + stats.density * 0.38 + ramp * 0.26) * (idx === 0 ? 0.5 : 1);
  for (let i = 1; i < platforms.length - 1; i++) {
    const p = platforms[i];
    const slots = Math.floor((p.w - 200) / 190);
    for (let s = 0; s < slots; s++) {
      if (!rng.chance(densityP)) continue;
      const hx = p.x + 110 + s * 190 + rng.range(-25, 25);
      const kind = rng.next();
      if (stats.night && kind < 0.45) {
        hazards.push({ type: 'bat', x: hx, baseY: p.y - 92, amp: 26 + rng.range(0, 14), freq: rng.range(1.6, 2.4) });
      } else if (kind < 0.3) {
        hazards.push({ type: 'ghost', x: hx, y: p.y - 18, drift: rng.range(4, 10) });
      } else {
        hazards.push({ type: 'block', x: hx, y: p.y - 14 });
      }
    }
  }

  // ── Storm zone ────────────────────────────────────────────
  const storm = stats.storm
    ? { x0: Math.round(realLen * 0.42), x1: Math.round(realLen * 0.62) }
    : null;
  if (storm) {
    // Pre-seeded rain columns: deterministic phases, engine animates fall.
    storm.drops = [];
    for (let rx = storm.x0; rx < storm.x1; rx += 90) {
      storm.drops.push({ x: rx + rng.range(-20, 20), phase: rng.range(0, 1), speed: rng.range(220, 300) });
    }
  }

  // ── Coins: arcs over gaps, rows on platforms ──────────────
  for (let i = 0; i < platforms.length - 1; i++) {
    const p = platforms[i];
    const nxt = platforms[i + 1];
    // Arc over the gap after this platform.
    const gapW = nxt.x - (p.x + p.w);
    if (gapW > 50) {
      const cx = p.x + p.w + gapW / 2;
      const topY = Math.min(p.y, nxt.y) - 120;
      for (let k = -2; k <= 2; k++) {
        coins.push({ x: cx + k * 30, y: topY + Math.abs(k) * 22, emoji: rng.pick(emojis) });
      }
    }
    // Row on the platform itself.
    if (p.w > 260 && rng.chance(0.7)) {
      const n = rng.int(3, 6);
      const startX = p.x + rng.range(60, p.w - 60 - n * 34);
      for (let k = 0; k < n; k++) {
        coins.push({ x: startX + k * 34, y: p.y - 46, emoji: rng.pick(emojis) });
      }
    }
  }

  // ── Heart pickup (later levels only — they hurt more) ─────
  if (idx >= 3) {
    const p = platforms[Math.floor(platforms.length * 0.6)];
    if (p) hearts.push({ x: p.x + p.w / 2, y: p.y - 52 });
  }

  // ── Memory capsule ────────────────────────────────────────
  // Level 1: on the ground, can't-miss (first win <60s).
  // Levels 2–5: floating platform, reachable with a full hold-jump.
  // Levels 6–8: higher route — realistically needs the double jump
  // unlocked at 6★, so old levels become new again.
  let capsule, capsulePlatform = null;
  const anchorIdx = Math.max(1, Math.floor(platforms.length * (idx === 0 ? 0.5 : rng.range(0.55, 0.75))));
  const anchor = platforms[Math.min(anchorIdx, platforms.length - 2)];
  if (idx === 0) {
    // Guaranteed first win: huge pickup radius — even a jump arc over it collects.
    capsule = { x: anchor.x + anchor.w / 2, y: anchor.y - 34, r: 80 };
  } else {
    const lift = idx >= 5 ? 185 : 128;
    capsulePlatform = { x: anchor.x + anchor.w / 2 - 52, w: 104, y: anchor.y - lift, float: true };
    platforms.push(capsulePlatform);
    capsule = { x: anchor.x + anchor.w / 2, y: capsulePlatform.y - 34 };
    // Coin breadcrumbs hinting "something is up there".
    coins.push({ x: capsule.x - 46, y: anchor.y - lift * 0.45, emoji: rng.pick(emojis) });
    coins.push({ x: capsule.x - 20, y: anchor.y - lift * 0.78, emoji: rng.pick(emojis) });
  }

  const zone = Math.min(3, Math.floor(idx / 2));
  const palette = stats.night ? PALETTES[3] : PALETTES[zone];

  return {
    idx, zone, palette,
    night: palette.night,
    worldLen: realLen,
    finishX,
    speed,
    platforms: platforms.sort((a, b) => a.x - b.x),
    hazards,
    coins,
    hearts,
    capsule,
    storm,
    stalker: stats.stalker,
    signpost: idx === 0,
  };
}
