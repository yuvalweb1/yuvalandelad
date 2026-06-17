import React from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import { typedCopy } from '../../i18n';
import { DeltaChip, DEEP } from '../month/monthShared.jsx';
import { SEASON_THEMES } from '../../lib/seasonTheme.js';

// Opening hero for the season deck. Lightly themed by the detected season:
// seasonal accent on the glow, seasonal motif + decoration, seasonal label.
const SlideSeasonIntro = React.memo(function SlideSeasonIntro({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const theme = a.seasonTheme || SEASON_THEMES.spring;
  const s = a.season || {};
  const total = s.total ?? a.totalMessages ?? 0;
  const animated = useAnimatedNumber(total, 1600, [total]);
  const growth = s.growthPct;
  const seasonLabel = t[theme.labelKey] || 'The season';

  return (
    <SlideShell bg={theme.accent} accent={theme.accent}>
      <ListSlideDecor emojis={theme.decor} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '42px 22px 32px',
      }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          textAlign: 'center', fontSize: 13, color: '#4A0E4E',
          letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          {theme.motif} {t.s3_intro_eyebrow || 'The season in review'}
        </div>

        <div className="fs-display a-spring" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.18s',
          fontSize: 40, lineHeight: 1.0, letterSpacing: '-0.04em',
          fontWeight: 900, color: '#4A0E4E', margin: '10px 0 4px',
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
        }}>
          {seasonLabel}
        </div>
        <div className="fs-mono a-fade-up" dir="auto" style={{
          animationDelay: '0.3s', fontSize: 13, color: 'rgba(74,14,78,0.55)', fontWeight: 600, textAlign: 'center',
        }}>
          {typedCopy(t, 's3_intro_sub', type)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 10 }}>
          <div className="fs-display" style={{
            fontSize: total >= 100000 ? 62 : 78, lineHeight: 0.9, fontWeight: 900,
            color: '#4A0E4E', letterSpacing: '-0.05em',
            textShadow: `0 3px 0 rgba(255,255,255,0.7), 0 2px 18px ${theme.accent}77`,
          }}>
            {animated.toLocaleString()}
          </div>
          <div className="fs-sans" style={{
            fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase',
            fontWeight: 800, color: '#4A0E4E', opacity: 0.7,
          }}>
            {t.s3_intro_messages || 'messages this season'}
          </div>
          {growth != null && (
            <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 4 }}>
              <DeltaChip pct={growth} label={t.s3_vs_last || 'vs last season'} style={{ fontSize: 13, padding: '7px 14px' }} />
            </div>
          )}
        </div>

        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1s', fontSize: 11, color: 'rgba(74,14,78,0.45)', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center',
          background: '#fff', borderRadius: 999, padding: '7px 16px',
          border: '2px solid rgba(255,255,255,0.85)',
          boxShadow: `0 5px 0 ${DEEP}1a, 0 10px 18px -6px ${DEEP}33`,
        }}>
          {s.months?.length || 3} {t.s3_intro_months || 'months · 90 days'}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideSeasonIntro;
