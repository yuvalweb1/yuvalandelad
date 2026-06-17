import React from 'react';
import SlideShell from '../SlideShell.jsx';
import { INK_SOFT } from './monthShared.jsx';

// 24-hour activity strip with a highlighted band.
//   dinner    → 18:00–21:59, caption = share at dinner time
//   latenight → 00:00–05:59, caption = late-night share
//   peak      → single busiest hour, caption = that hour
const CFG = {
  dinner:    { accent: '#f3722c', bg: '#573280', icon: '🍽️', band: [18, 19, 20, 21] },
  latenight: { accent: '#8338ec', bg: '#2a0645', icon: '🌙', band: [0, 1, 2, 3, 4, 5] },
  peak:      { accent: '#e05c8a', bg: '#573280', icon: '⏰', band: null },
};
const MAX_BAR_H = 110;

const SlideMonthHeatmap = React.memo(function SlideMonthHeatmap({ a, t, cfg = 'peak' }) {
  const hourly = a.groupHourly || [];
  if (hourly.length !== 24 || hourly.every(v => v === 0)) return null;
  const c = CFG[cfg] || CFG.peak;
  const total = hourly.reduce((s, v) => s + v, 0);
  const max = Math.max(...hourly);

  let peakHour = 0;
  for (let h = 1; h < 24; h++) if (hourly[h] > hourly[peakHour]) peakHour = h;

  const band = c.band || [peakHour];
  const bandSet = new Set(band);
  const bandCount = band.reduce((s, h) => s + (hourly[h] || 0), 0);
  const bandPct = total ? Math.round((bandCount / total) * 100) : 0;

  const eyebrow = t[`m4_heat_${cfg}_eyebrow`] || 'WHEN YOU TALK';
  const title = t[`m4_heat_${cfg}_title`] || 'Your daily rhythm';

  let bigValue, bigLabel;
  if (cfg === 'peak') {
    bigValue = `${String(peakHour).padStart(2, '0')}:00`;
    bigLabel = t.m4_heat_peak_label || 'your golden hour';
  } else {
    bigValue = `${bandPct}%`;
    bigLabel = cfg === 'dinner'
      ? (t.m4_heat_dinner_label || 'of messages at dinner time')
      : (t.m4_heat_latenight_label || 'of messages after midnight');
  }

  const ticks = [0, 6, 12, 18, 23];

  return (
    <SlideShell bg={c.bg} accent={c.accent}>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 18px 22px' }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          textAlign: 'center', fontSize: 12, color: c.accent, letterSpacing: '0.15em',
          fontWeight: 700, textTransform: 'uppercase',
        }}>
          {c.icon} {eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 24, padding: '0 6px',
        }}>
          {title}
        </div>

        {/* 24 thin bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, height: MAX_BAR_H + 4 }}>
          {hourly.map((count, h) => {
            const barPx = max > 0 ? Math.max(4, Math.round((count / max) * MAX_BAR_H)) : 4;
            const hot = bandSet.has(h);
            return (
              <div key={h} className="a-bar" style={{
                flex: 1, height: barPx, borderRadius: 3,
                background: hot ? `linear-gradient(180deg, ${c.accent} 0%, ${c.accent}aa 100%)` : 'rgba(42,6,69,0.14)',
                animationDelay: `${0.25 + h * 0.018}s`,
                boxShadow: hot ? `0 5px 12px ${c.accent}44` : 'none',
              }} />
            );
          })}
        </div>
        {/* hour ticks */}
        <div style={{ position: 'relative', height: 16, marginTop: 6 }}>
          {ticks.map(h => (
            <span key={h} className="fs-mono" style={{
              position: 'absolute', left: `${(h / 23) * 100}%`, transform: 'translateX(-50%)',
              fontSize: 9, color: INK_SOFT, fontWeight: 600,
            }}>
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>

        <div className="a-fade-up" style={{
          marginTop: 'auto', textAlign: 'center',
          background: `${c.accent}1a`, borderRadius: 16, padding: '16px 14px',
          animationDelay: '0.9s',
        }}>
          <div className="fs-display" style={{ fontSize: 44, fontWeight: 900, color: c.accent, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {bigValue}
          </div>
          <div className="fs-sans" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 6 }}>
            {bigLabel}
          </div>
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideMonthHeatmap;
