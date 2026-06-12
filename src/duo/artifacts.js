// ============================================================
// Memory Capsules — the buried collectibles of The Long Run.
// One per level. Each is a *real* recovered moment from the chat,
// favouring material the main recap never surfaces for this pair:
// actual transcripts of their wildest minutes (chaos peaks),
// the origin day, the great silence, the record day, the bond share.
// Deterministic: pure function of (analytics, A, B).
// ============================================================
import { makeRng, pairSeed } from './rng.js';
import { LEVEL_COUNT } from './levelGen.js';

function fmtDate(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Build the per-level artifact list (length === LEVEL_COUNT).
// Types: origin | transcript | record | silence | bond | streak | nightcap
export function buildArtifacts(analytics, A, B) {
  const rng = makeRng(pairSeed(analytics, A, B) + '|artifacts');
  const ua = analytics.userMap?.[A];
  const ub = analytics.userMap?.[B];
  const pool = [];

  // Origin stone — always exists, always level 1 (guaranteed first win).
  pool.push({
    id: 'origin', icon: '🌱', type: 'origin',
    data: {
      date: fmtDate(analytics.start),
      days: analytics.durationDays,
      total: analytics.totalMessages,
    },
  });

  // Recovered transcripts — chaos peaks where at least one of the pair
  // appears in the excerpts. The crown jewels of the album.
  const peaks = (analytics.chaos?.peaks || [])
    .filter(p => (p.excerpts || []).some(e => e.author === A || e.author === B))
    .slice(0, 5);
  peaks.forEach((p, i) => {
    pool.push({
      id: `peak${i}`, icon: '📜', type: 'transcript',
      data: {
        date: fmtDate(p.ts),
        hour: p.hour,
        count: p.count,
        excerpts: (p.excerpts || []).filter(e => e.author === A || e.author === B).slice(0, 4),
      },
    });
  });

  // The Great Silence.
  const dz = analytics.chaos?.awards?.deadZone;
  if (dz && (dz.days >= 1 || dz.hours >= 12)) {
    pool.push({
      id: 'silence', icon: '🕳️', type: 'silence',
      data: { days: dz.days, hours: dz.hours, from: fmtDate(dz.fromTs) },
    });
  }

  // Record day — the single loudest day of the whole chat.
  if (analytics.peakDay) {
    pool.push({
      id: 'record', icon: '🏔️', type: 'record',
      data: { date: fmtDate(analytics.peakDay[0]), count: analytics.peakDay[1] },
    });
  }

  // The bond — what share of all back-and-forth is just these two.
  if (analytics.topDuo && analytics.topDuoShare > 0 &&
      analytics.topDuo.names?.includes(A) && analytics.topDuo.names?.includes(B)) {
    pool.push({
      id: 'bond', icon: '🔗', type: 'bond',
      data: { pct: Math.round(analytics.topDuoShare), count: analytics.topDuo.count },
    });
  }

  // Iron streak — the pair's best daily streak.
  const streakHolder = (ua?.longestStreak || 0) >= (ub?.longestStreak || 0) ? ua : ub;
  if (streakHolder && streakHolder.longestStreak >= 3) {
    pool.push({
      id: 'streak', icon: '🔥', type: 'streak',
      data: { days: streakHolder.longestStreak, who: streakHolder.author },
    });
  }

  // Night cap — how deep into the night this pair goes.
  const nightTotal = (ua?.nightMessages || 0) + (ub?.nightMessages || 0);
  if (nightTotal >= 10) {
    pool.push({
      id: 'nightcap', icon: '🌙', type: 'nightcap',
      data: { count: nightTotal },
    });
  }

  // Order: origin first, then transcripts and facts interleaved in a
  // seeded shuffle so the album reveals in a varied (but fixed) order.
  const origin = pool.shift();
  const shuffled = rng.shuffle(pool);
  const ordered = [origin, ...shuffled];

  // Pad by cycling (tiny chats) so every level still buries something.
  const out = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    out.push(ordered[i % ordered.length]);
  }
  return out;
}
