// ============================================================
// Deterministic randomness for The Ruins of [GroupName].
// Re-exports the same primitives The Long Run uses — same chat
// export, same kingdom, forever. No Math.random(), no Date.now().
// ============================================================
export { hash32, mulberry32, makeRng } from '../duo/rng.js';

import { hash32 } from '../duo/rng.js';

// Stable identity for a chat, used to seed the kingdom layout and
// key its save. One kingdom per chat (no pair names, unlike duo).
export function chatSeed(analytics) {
  const start = new Date(analytics.start).getTime() || 0;
  return `ruins|${start}`;
}

// Convenience: the localStorage key suffix for this chat's kingdom.
export function chatKey(analytics) {
  return 'r' + hash32(chatSeed(analytics)).toString(36);
}
