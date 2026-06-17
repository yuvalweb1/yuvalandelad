import React from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import MedalCoin from '../../components/MedalCoin.jsx';
import { interp } from '../../i18n';
import { cardStyle, INK_SOFT } from '../month/monthShared.jsx';
import { themedDecor, SEASON_THEMES } from '../../lib/seasonTheme.js';

// Single-person season award with a tiny per-month sparkline (raw data).
//   consistent → most consistent member (lowest month-to-month variance)
//   involved   → became most involved (biggest share gain first→last month)
//   new_active → biggest climber (new most-active energy)
const CFG = {
  consistent: { icon: '🎯', accent: '#43aa8b' },
  involved:   { icon: '🌱', accent: '#8338ec' },
  new_active: { icon: '🚀', accent: '#f3722c' },
};

function pick(cfg, a) {
  const s = a.season || {};
  if (cfg === 'consistent') {
    const m = s.mostConsistent; if (!m) return null;
    return { author: m.author, value: `${m.score}%`, monthly: m.monthly,
      label: 's3_label_consistency' };
  }
  if (cfg === 'involved') {
    const m = s.mostInvolved; if (!m) return null;
    return { author: m.author, value: `+${m.gainPts}pts`, shares: [m.firstShare, m.lastShare],
      label: 's3_label_involved' };
  }
  if (cfg === 'new_active') {
    const m = (s.risers || [])[0]; if (!m) return null;
    return { author: m.author, value: `+${m.delta}`, monthly: m.monthly, label: 's3_label_climb' };
  }
  return null;
}

export function personAwardHasData(cfg, a) { return pick(cfg, a) != null; }

const SlideSeasonPersonAward = React.memo(function SlideSeasonPersonAward({ a, t, cfg = 'consistent' }) {
  const c = CFG[cfg]; if (!c) return null;
  const theme = a.seasonTheme || SEASON_THEMES.spring;
  const data = pick(cfg, a);
  if (!data) return null;

  const eyebrow = t[`s3_pa_${cfg}_eyebrow`] || 'SEASON AWARD';
  const title = t[`s3_pa_${cfg}_title`] || 'Standout of the season';
  const label = t[`s3_pa_${cfg}_label`] || '';

  const spark = data.monthly && data.monthly.length
    ? data.monthly
    : data.shares && data.shares.length ? data.shares : null;
  const sparkMax = spark ? Math.max(...spark, 1) : 1;

  return (
    <SlideShell bg="#577590" accent={c.accent}>
      <ListSlideDecor emojis={themedDecor([c.icon, '✨', '🏅', '💫', '🌟'], theme)} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '34px 24px 30px',
      }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          fontSize: 12, color: c.accent, letterSpacing: '0.18em',
          fontWeight: 800, textTransform: 'uppercase', textAlign: 'center',
        }}>
          {eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 26, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 18, padding: '0 8px',
          textShadow: '0 2px 0 rgba(255,255,255,0.6)',
        }}>
          {title}
        </div>

        <div className="a-pop-in" style={{ animationDelay: '0.3s' }}>
          <MedalCoin accent={c.accent} emoji={c.icon} size={96} emojiSize={40} />
        </div>

        <div className="fs-display a-fade-up" dir="auto" style={{
          animationDelay: '0.5s', marginTop: 14, fontSize: 24, fontWeight: 800, color: '#2a0645',
          maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
        }}>
          {data.author}
        </div>
        <div className="fs-display" style={{ fontSize: 40, fontWeight: 900, color: c.accent, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 2 }}>
          {data.value}
        </div>
        <div className="fs-sans" style={{ fontSize: 11, color: INK_SOFT, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
          {t[data.label] || label}
        </div>

        {/* per-month sparkline — the raw shape behind the award */}
        {spark && (
          <div className="a-fade-up" style={{
            ...cardStyle(false), animationDelay: '0.8s', marginTop: 'auto',
            display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 16px', height: 64,
          }}>
            {spark.map((v, i) => (
              <div key={i} className="a-bar" style={{
                width: 22, height: Math.max(6, Math.round((v / sparkMax) * 40)),
                background: c.accent, borderRadius: 4, animationDelay: `${0.9 + i * 0.08}s`,
              }} />
            ))}
          </div>
        )}
      </div>
    </SlideShell>
  );
});

export default SlideSeasonPersonAward;
