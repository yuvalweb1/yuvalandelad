import React from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import { interp } from '../../i18n';
import { cardStyle, INK_SOFT } from '../month/monthShared.jsx';
import { themedDecor, SEASON_THEMES } from '../../lib/seasonTheme.js';

// The season's defining pair — the two people who went back and forth the most.
//   duo     → "the duo that talked the most"
//   rivalry → "biggest rivalry / most back-and-forth"
const CFG = {
  duo:     { icon: '👯', accent: '#8338ec', decor: ['👯', '💬', '🔗', '✨', '💞'] },
  rivalry: { icon: '⚔️', accent: '#f3722c', decor: ['⚔️', '🔥', '💬', '✨', '🥊'] },
};

export function duoHasData(a) {
  return !!(a.topDuo && a.topDuo.names && a.topDuo.names.length === 2 && a.topDuo.count > 0);
}

const SlideSeasonDuo = React.memo(function SlideSeasonDuo({ a, t, cfg = 'duo' }) {
  const c = CFG[cfg] || CFG.duo;
  const theme = a.seasonTheme || SEASON_THEMES.spring;
  const duo = a.topDuo;
  if (!duoHasData(a)) return null;
  const [n1, n2] = duo.names;
  const animated = useAnimatedNumber(duo.count, 1400, [duo.count]);
  const share = Math.round(a.topDuoShare || 0);

  const NameCard = ({ name, delay }) => (
    <div className="a-slide-up-far" style={{
      ...cardStyle(false), animationDelay: delay, flex: 1, maxWidth: 150,
      padding: '18px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: `linear-gradient(135deg, ${c.accent}, ${c.accent}aa)`,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 800,
      }}>{(name?.[0] || '?').toUpperCase()}</div>
      <div className="fs-display" dir="auto" style={{
        fontSize: 16, fontWeight: 800, color: '#2a0645', textAlign: 'center',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}</div>
    </div>
  );

  return (
    <SlideShell bg="#573280" accent={c.accent}>
      <ListSlideDecor emojis={themedDecor(c.decor, theme)} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '38px 22px 32px',
      }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          fontSize: 12, color: c.accent, letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center',
        }}>
          {c.icon} {t[`s3_duo_${cfg}_eyebrow`] || 'THE DEFINING DUO'}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 26, lineHeight: 1.14, letterSpacing: '-0.02em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 22, padding: '0 6px',
          textShadow: '0 2px 0 rgba(255,255,255,0.6)',
        }}>
          {t[`s3_duo_${cfg}_title`] || 'The pair that ran the season'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' }}>
          <NameCard name={n1} delay="0.3s" />
          <div className="fs-display a-pop-in" style={{ fontSize: 26, color: c.accent, fontWeight: 900, animationDelay: '0.45s' }} aria-hidden>↔</div>
          <NameCard name={n2} delay="0.4s" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 4 }}>
          <div className="fs-display" style={{
            fontSize: 64, fontWeight: 900, color: c.accent, letterSpacing: '-0.04em', lineHeight: 1,
            textShadow: `0 3px 0 rgba(255,255,255,0.7), 0 2px 16px ${c.accent}44`,
          }}>
            {animated.toLocaleString()}
          </div>
          <div className="fs-sans" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {t.s3_duo_exchanges || 'back-and-forth replies'}
          </div>
        </div>

        {share > 0 && (
          <div className="fs-mono a-fade-up" style={{ animationDelay: '0.9s', fontSize: 12, color: INK_SOFT }}>
            {interp(t.s3_duo_share || '{pct}% of all the chat’s replies', { pct: share })}
          </div>
        )}
      </div>
    </SlideShell>
  );
});

export default SlideSeasonDuo;
