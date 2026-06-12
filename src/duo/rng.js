// ============================================================
// Deterministic randomness for The Long Run.
// The whole game world must be a pure function of the chat —
// no Math.random(), no Date.now(). Same export, same world.
// ============================================================

// FNV-1a string hash → 32-bit uint. Stable across sessions.
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 — tiny seeded PRNG, returns () => float in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convenience: rng helpers bound to one generator.
export function makeRng(seedStr) {
  const next = mulberry32(hash32(seedStr));
  return {
    next,                                            // [0,1)
    range: (min, max) => min + next() * (max - min), // float in [min,max)
    int: (min, max) => Math.floor(min + next() * (max - min + 1)), // int incl.
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

// Stable identity for a chat+pair, used to seed levels and key saves.
// `start` survives re-exports of the same chat (new month = same start),
// so progression accumulates per relationship, not per file.
export function pairSeed(analytics, A, B) {
  const [a, b] = [A, B].sort();
  const start = new Date(analytics.start).getTime() || 0;
  return `${start}|${a}|${b}`;
}
