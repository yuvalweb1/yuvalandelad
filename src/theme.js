// ============================================================
// Ultra-Pop Social — theme tokens (single source of truth)
// ------------------------------------------------------------
// Mirrors the CSS variables in index.html (:root). Import these
// where styles are written inline (this app's main pattern); use
// var(--pop-*) / the .roast-card & .pop-btn classes elsewhere.
// ============================================================

export const POP = {
  bananaYellow:  '#FFD700', // primary bg — joyful
  mangoOrange:   '#FF8C00', // primary bg — energetic
  deepEggplant:  '#4A0E4E', // typography / card bg (high contrast)
  darkNavy:      '#0A192F', // typography / card bg (high contrast)
  skyBlue:       '#00BFFF', // accent / CTA
  bubblegumPink: '#FF69B4', // accent / CTA
};

export const THEME = {
  bg:     { joyful: POP.bananaYellow, energetic: POP.mangoOrange },
  ink:    { primary: POP.deepEggplant, alt: POP.darkNavy },
  card:   { bg: POP.deepEggplant, bgAlt: POP.darkNavy, text: '#FFFFFF' },
  cta:    { primary: POP.skyBlue, secondary: POP.bubblegumPink },
  radius: { card: 28, pill: 999 },
};

// Reusable "Roast Card" — rounded + soft, playful, floating shadow.
// variant: 'eggplant' (default) | 'navy'
export const roastCardStyle = (variant = 'eggplant') => ({
  background: variant === 'navy' ? THEME.card.bgAlt : THEME.card.bg,
  color: THEME.card.text,
  borderRadius: THEME.radius.card,
  padding: '20px 22px',
  border: '3px solid rgba(255,255,255,0.07)',
  boxShadow: variant === 'navy'
    ? '0 10px 0 rgba(10,25,47,0.25), 0 22px 45px -8px rgba(10,25,47,0.5)'
    : '0 10px 0 rgba(74,14,78,0.22), 0 22px 45px -8px rgba(74,14,78,0.45)',
});

// Reusable CTA button — chunky, game-UI press feel.
// variant: 'sky' (default) | 'pink'
export const popButtonStyle = (variant = 'sky') => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: variant === 'pink' ? THEME.cta.secondary : THEME.cta.primary,
  color: variant === 'pink' ? '#FFFFFF' : THEME.ink.alt,
  border: 'none',
  borderRadius: THEME.radius.pill,
  padding: '15px 30px',
  fontWeight: 800,
  fontSize: 17,
  cursor: 'pointer',
  boxShadow: variant === 'pink'
    ? '0 6px 0 rgba(0,0,0,0.2), 0 12px 26px -4px rgba(255,105,180,0.5)'
    : '0 6px 0 rgba(0,0,0,0.2), 0 12px 26px -4px rgba(0,191,255,0.5)',
});
