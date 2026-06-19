// ============================================================
// seasonTheme.js — detect WHICH season a recap covers and hand back a very
// light theme (decorative emoji set + a soft seasonal accent + a motif).
//
// The theme is cosmetic ONLY — it never touches data, stats, ordering or copy.
// It swaps the floating decoration emojis, tints the hero glow, and gives the
// intro a seasonal label/motif, so a "winter" recap feels a touch frostier
// while still looking like the rest of the app (same ink, cards, type).
//
// Hemisphere: WhatsApp exports carry no location, so we assume the Northern
// Hemisphere meteorological calendar (Dec–Feb winter … Sep–Nov autumn). This
// is purely a visual choice; the numbers are identical either way.
// ============================================================

export const SEASON_THEMES = {
  winter: {
    key: 'winter',
    accent: '#5e9fd0',                 // soft icy blue — used only for glows/motifs
    decor: ['❄️', '⛄', '🧣', '✨', '🌨️', '🤍'],
    motif: '❄️',
    labelKey: 'season_winter',
  },
  spring: {
    key: 'spring',
    accent: '#5cb874',                 // fresh green
    decor: ['🌸', '🌷', '🦋', '🌱', '☘️', '✨'],
    motif: '🌸',
    labelKey: 'season_spring',
  },
  summer: {
    key: 'summer',
    accent: '#f4a72c',                 // warm sun
    decor: ['☀️', '🌊', '🍉', '😎', '🏖️', '✨'],
    motif: '☀️',
    labelKey: 'season_summer',
  },
  autumn: {
    key: 'autumn',
    accent: '#d97a3a',                 // amber
    decor: ['🍂', '🍁', '🎃', '🌰', '🧣', '✨'],
    motif: '🍂',
    labelKey: 'season_autumn',
  },
};

// Northern-hemisphere meteorological seasons by calendar month (0=Jan).
const MONTH_TO_SEASON = [
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
];

// Pick the season from the analytics window. Uses the month that holds the most
// messages inside the window (the "centre of gravity" of the recap) so a window
// that straddles a boundary themes to where the action actually was.
export function detectSeasonTheme(analytics) {
  let monthIdx;
  // Prefer the season extras' month buckets when present (most accurate).
  const months = analytics?.season?.months;
  if (months && months.length) {
    let best = months[0];
    for (const m of months) if (m.count > best.count) best = m;
    monthIdx = best.monthIdx;
  } else if (analytics?.end) {
    monthIdx = new Date(analytics.end).getMonth();
  } else {
    monthIdx = new Date().getMonth();
  }
  const key = MONTH_TO_SEASON[monthIdx] || 'spring';
  return SEASON_THEMES[key];
}

// Blend a slide's own decorative emojis with the active season theme so reused
// slides pick up the seasonal vibe without losing their metric flavour.
// (2 seasonal + the slide's own — capped at 6.)
export function themedDecor(baseDecor, theme) {
  if (!theme) return baseDecor;
  return [theme.decor[0], theme.decor[1], ...baseDecor].slice(0, 6);
}
