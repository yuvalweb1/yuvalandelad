import React from 'react';
import SlideShell from '../SlideShell.jsx';
import { typedCopy, interp } from '../../i18n';
import { INK_SOFT } from '../month/monthShared.jsx';
import { SEASON_THEMES } from '../../lib/seasonTheme.js';

const MON_KEYS = ['mon_jan','mon_feb','mon_mar','mon_apr','mon_may','mon_jun','mon_jul','mon_aug','mon_sep','mon_oct','mon_nov','mon_dec'];
const MAX_BAR_H = 130;

// The 📈 centrepiece: month-by-month message volume across the season, with the
// raw count printed over every bar (the raw data IS the story) and a trend
// read-out comparing the first month to the last.
const SlideSeasonTrend = React.memo(function SlideSeasonTrend({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const theme = a.seasonTheme || SEASON_THEMES.spring;
  const months = a.season?.months || [];
  if (months.length < 2) return null;

  const max = Math.max(...months.map(m => m.count), 1);
  let peakIdx = 0;
  for (let i = 1; i < months.length; i++) if (months[i].count > months[peakIdx].count) peakIdx = i;

  const first = months[0].count, last = months[months.length - 1].count;
  const dir = last > first ? 'up' : last < first ? 'down' : 'flat';
  const pct = first > 0 ? Math.round(((last - first) / first) * 100) : null;
  const trendColor = dir === 'up' ? '#1a8754' : dir === 'down' ? '#e5484d' : INK_SOFT;
  const trendArrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '▬';
  const trendWord = dir === 'up' ? (t.s3_trend_up || 'trending up')
    : dir === 'down' ? (t.s3_trend_down || 'cooling off') : (t.s3_trend_flat || 'holding steady');

  return (
    <SlideShell bg="#573280" accent={theme.accent}>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '34px 22px 24px' }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          textAlign: 'center', fontSize: 12, color: theme.accent, letterSpacing: '0.15em',
          fontWeight: 800, textTransform: 'uppercase',
        }}>
          📈 {t.s3_trend_eyebrow || 'Month by month'}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 22, padding: '0 8px',
        }}>
          {typedCopy(t, 's3_trend_title', type)}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 10, flex: 1, minHeight: 0 }}>
          {months.map((m, i) => {
            const barPx = Math.max(12, Math.round((m.count / max) * MAX_BAR_H));
            const isPeak = i === peakIdx;
            const col = isPeak ? theme.accent : 'rgba(42,6,69,0.18)';
            return (
              <div key={m.key} style={{ flex: 1, maxWidth: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                <div className="fs-display" style={{ fontSize: 17, fontWeight: 800, color: isPeak ? theme.accent : '#2a0645' }}>
                  {m.count.toLocaleString()}
                </div>
                <div className="a-bar" style={{
                  width: '100%', height: barPx,
                  background: isPeak ? `linear-gradient(180deg, ${col} 0%, ${col}bb 100%)` : col,
                  borderRadius: '10px 10px 5px 5px',
                  animationDelay: `${0.3 + i * 0.12}s`,
                  boxShadow: isPeak ? `0 8px 20px ${theme.accent}55` : 'none',
                }} />
                <div className="fs-sans" style={{
                  fontSize: 12, fontWeight: isPeak ? 800 : 600,
                  color: isPeak ? theme.accent : 'rgba(42,6,69,0.6)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {t[MON_KEYS[m.monthIdx]] || ''}
                </div>
              </div>
            );
          })}
        </div>

        <div className="a-fade-up" style={{
          marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: `${trendColor}14`, borderRadius: 16, padding: '12px 16px', animationDelay: '0.9s',
        }}>
          <span className="fs-display" style={{ color: trendColor, fontSize: 18, fontWeight: 900 }} aria-hidden>{trendArrow}</span>
          <span className="fs-sans" dir="auto" style={{ fontSize: 14, fontWeight: 800, color: '#2a0645' }}>
            {pct != null && dir !== 'flat'
              ? interp(t.s3_trend_caption || '{word} · {pct}% across the season', { word: trendWord, pct: Math.abs(pct) })
              : trendWord}
          </span>
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideSeasonTrend;
