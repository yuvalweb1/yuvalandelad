import React from 'react';
import SlideShell from '../SlideShell.jsx';
import { interp } from '../../i18n';
import { cardStyle, INK_SOFT } from '../month/monthShared.jsx';
import { SEASON_THEMES } from '../../lib/seasonTheme.js';

const MON_KEYS = ['mon_jan','mon_feb','mon_mar','mon_apr','mon_may','mon_jun','mon_jul','mon_aug','mon_sep','mon_oct','mon_nov','mon_dec'];

// Crowns one month of the season for a given quality, with a mini month strip
// for context. Raw value always shown.
const CFG = {
  strongest:     { icon: '🏆', accent: '#f3722c', src: (s) => s.strongestMonth,     value: (m) => m.count, rawKey: 's3_ms_strongest_unit' },
  quietest:      { icon: '🤫', accent: '#577590', src: (s) => s.quietestMonth,      value: (m) => m.count, rawKey: 's3_ms_quietest_unit' },
  best_vibes:    { icon: '✨', accent: '#f9456b', src: (s) => s.bestVibesMonth,      value: (m) => m.emojiRate.toFixed(1), rawKey: 's3_ms_vibes_unit' },
  affectionate:  { icon: '❤️', accent: '#f9456b', src: (s) => s.affectionateMonth,  value: (m) => (m.emoji + m.media).toLocaleString(), rawKey: 's3_ms_affection_unit' },
  collaborative: { icon: '🤝', accent: '#43aa8b', src: (s) => s.collaborativeMonth,  value: (m) => m.senders, rawKey: 's3_ms_collab_unit' },
};

export function monthSpotlightHasData(cfg, a) {
  const def = CFG[cfg]; if (!def) return false;
  const m = def.src(a.season || {});
  return !!m && (a.season?.months?.length || 0) >= 2;
}

const SlideSeasonMonthSpotlight = React.memo(function SlideSeasonMonthSpotlight({ a, t, cfg = 'strongest' }) {
  const def = CFG[cfg]; if (!def) return null;
  const theme = a.seasonTheme || SEASON_THEMES.spring;
  const months = a.season?.months || [];
  const chosen = def.src(a.season || {});
  if (!chosen || months.length < 2) return null;

  const max = Math.max(...months.map(m => m.count), 1);
  const eyebrow = t[`s3_ms_${cfg}_eyebrow`] || 'STANDOUT MONTH';
  const title = t[`s3_ms_${cfg}_title`] || 'The month that defined the season';
  const monthName = t[MON_KEYS[chosen.monthIdx]] || '';

  return (
    <SlideShell bg="#573280" accent={def.accent}>
      <div style={{
        position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '36px 24px 26px',
      }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          fontSize: 12, color: def.accent, letterSpacing: '0.18em',
          fontWeight: 800, textTransform: 'uppercase', textAlign: 'center',
        }}>
          {def.icon} {eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 24, lineHeight: 1.14, letterSpacing: '-0.02em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16, padding: '0 6px',
          textShadow: '0 2px 0 rgba(255,255,255,0.6)',
        }}>
          {title}
        </div>

        <div className="a-spring" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 6 }}>
          <div className="fs-display" dir="auto" style={{
            fontSize: 56, fontWeight: 900, color: '#4A0E4E', letterSpacing: '-0.04em', lineHeight: 1,
            textShadow: `0 3px 0 rgba(255,255,255,0.7), 0 2px 18px ${def.accent}44`,
          }}>
            {monthName}
          </div>
          <div className="fs-mono" style={{ fontSize: 14, color: def.accent, fontWeight: 800, marginTop: 6 }}>
            {interp(t[def.rawKey] || '{v}', { v: def.value(chosen) })}
          </div>
        </div>

        {/* month strip for context */}
        <div className="a-fade-up" style={{
          ...cardStyle(false), animationDelay: '0.7s', marginTop: 'auto',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, padding: '14px 18px',
        }}>
          {months.map((m) => {
            const isChosen = m.monthIdx === chosen.monthIdx && m.key === chosen.key;
            return (
              <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div className="a-bar" style={{
                  width: 26, height: Math.max(8, Math.round((m.count / max) * 56)),
                  background: isChosen ? def.accent : 'rgba(42,6,69,0.16)',
                  borderRadius: 5, animationDelay: '0.85s',
                }} />
                <div className="fs-sans" style={{ fontSize: 10, fontWeight: isChosen ? 800 : 600, color: isChosen ? def.accent : INK_SOFT, textTransform: 'uppercase' }}>
                  {t[MON_KEYS[m.monthIdx]] || ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideSeasonMonthSpotlight;
