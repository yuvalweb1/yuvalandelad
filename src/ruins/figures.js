// ============================================================
// Legendary Figures — per-member statues + interrogable echoes.
// buildFigures(analytics, t) derives up to 7 archetypes (design
// doc §8) via argmax over analytics.users, each gated by a
// minimum threshold so weak signals are skipped entirely. Echo
// "tells" are seasoned with the member's real top word/emoji/stat —
// those tells are gameplay: Reconstruct authorship deduction in
// the figure's case depends on having learned them. Pure +
// deterministic — same analytics, same figures, forever.
// ============================================================
import { argmax } from '../lib/analytics.js';
import { interp } from '../i18n/index.js';

const ARCHETYPES = [
  {
    key: 'lightbringer',
    emoji: '🕯️',
    stat: u => u.conversationsRevived,
    threshold: v => v >= 3,
    tellVars: u => ({ name: u.author, n: u.conversationsRevived, word: u.topWord || '…' }),
  },
  {
    key: 'closer',
    emoji: '⚰️',
    stat: u => u.conversationsKilled,
    threshold: v => v >= 3,
    tellVars: u => ({ name: u.author, n: u.conversationsKilled, word: u.topWord || '…' }),
  },
  {
    key: 'sentinel',
    emoji: '🌙',
    stat: u => u.nightPct,
    threshold: v => v > 25,
    tellVars: u => ({ name: u.author, pct: Math.round(u.nightPct) }),
  },
  {
    key: 'herald',
    emoji: '📯',
    stat: u => u.voiceRate,
    threshold: (v, u) => u.voiceCount >= 5,
    tellVars: u => ({ name: u.author, n: u.voiceCount, pct: Math.round(u.voiceRate * 100) }),
  },
  {
    key: 'illuminator',
    emoji: '💡',
    stat: u => u.topEmojiCount,
    threshold: v => v >= 10,
    tellVars: u => ({ name: u.author, emoji: u.topEmoji || '✨', n: u.topEmojiCount }),
  },
  {
    key: 'vanished',
    emoji: '👻',
    stat: u => u.longestAbsenceDays,
    threshold: v => v >= 14,
    tellVars: u => ({ name: u.author, n: u.longestAbsenceDays }),
  },
  {
    key: 'stormcaller',
    emoji: '⚡',
    stat: u => u.maxBurst,
    threshold: v => v >= 8,
    tellVars: u => ({ name: u.author, n: u.maxBurst }),
  },
];

// Average of `stat` across the group — used to gauge how far the
// winner stands out (a flat-stat group makes for a weak "figure").
function groupAverage(users, stat) {
  if (!users.length) return 0;
  return users.reduce((sum, u) => sum + (stat(u) || 0), 0) / users.length;
}

export function buildFigures(analytics, t) {
  const users = analytics?.users || [];
  if (!users.length) return [];

  const figures = [];
  for (const arc of ARCHETYPES) {
    const winner = argmax(users, arc.stat);
    if (!winner) continue;
    const value = arc.stat(winner) || 0;
    if (!arc.threshold(value, winner)) continue;

    const tellVars = arc.tellVars(winner);
    const avg = groupAverage(users, arc.stat);
    const marginScore = avg > 0 ? (value - avg) / avg : value;

    figures.push({
      archetypeKey: arc.key,
      author: winner.author,
      emoji: arc.emoji,
      title: t[`ruins_figure_${arc.key}_title`] || FALLBACK_TITLE[arc.key],
      lead: t[`ruins_figure_${arc.key}_lead`] || FALLBACK_LEAD[arc.key],
      tells: [
        interp(t[`ruins_figure_${arc.key}_tell1`] || FALLBACK_TELL1[arc.key], tellVars),
        interp(t[`ruins_figure_${arc.key}_tell2`] || FALLBACK_TELL2[arc.key], tellVars),
      ],
      tellVars,
      statValue: value,
      marginScore,
    });
  }
  return figures;
}

// Picks the `max` most "dominant" figures (winner stands out most
// from the group average) — tie-broken via `rng` for determinism
// without favoring archetype-table order.
export function pickFigureCases(figures, rng, max = 3) {
  return figures
    .map(f => ({ f, tie: rng.next() }))
    .sort((a, b) => (b.f.marginScore - a.f.marginScore) || (a.tie - b.tie))
    .slice(0, max)
    .map(({ f }) => f);
}

const FALLBACK_TITLE = {
  lightbringer: "The Lightbringer's Plinth",
  closer: "The Closer's Tomb",
  sentinel: "The Sentinel's Watch",
  herald: "The Herald's Horn",
  illuminator: "The Illuminator's Lantern",
  vanished: 'The Empty Plinth',
  stormcaller: "The Stormcaller's Spire",
};

const FALLBACK_LEAD = {
  lightbringer: 'A statue holds up a torch that never burns out. Who does it depict?',
  closer: 'An epitaph with no name — only silence follows whoever carved it.',
  sentinel: 'A statue stands watch at the edge of the Night District, eyes open.',
  herald: 'A horn rests on a pedestal, still warm. Whose breath last filled it?',
  illuminator: 'A lantern burns with an unmistakable glow. Everyone recognizes it — but whose is it?',
  vanished: 'An empty plinth. Something — someone — used to stand here.',
  stormcaller: 'Lightning scars radiate from this spire in rapid, overlapping bursts.',
};

const FALLBACK_TELL1 = {
  lightbringer: "I've restarted this chat {n} times. Someone has to.",
  closer: '{n} conversations ended right after I spoke. Coincidence? Maybe.',
  sentinel: '{pct}% of my messages were sent after midnight.',
  herald: '{n} voice notes. Some things can’t be typed.',
  illuminator: '{emoji} — I used it {n} times. It’s basically my signature.',
  vanished: 'I was gone for {n} days once. No one noticed until I came back.',
  stormcaller: '{n} messages in a row. I had a lot to say.',
};

const FALLBACK_TELL2 = {
  lightbringer: "Usually with '{word}'. It works.",
  closer: "My last word is usually '{word}'. Then... nothing.",
  sentinel: 'The Night District never sleeps. Neither do I.',
  herald: '{pct}% of what I sent, you had to listen to.',
  illuminator: "You'll know my messages by the {emoji}.",
  vanished: 'The plinth was empty the whole time.',
  stormcaller: "Nobody got a word in until I was done.",
};
