import React from 'react';
import SlideShell from '../SlideShell.jsx';
import { dayName } from './monthShared.jsx';

// Weekday distribution bar chart with a configurable highlight:
//   busy    → spotlight the single busiest day
//   weekend → spotlight Fri+Sat, caption = weekend share
//   work    → spotlight busiest weekday, caption = busiest + quietest workday
const CFG = {
  busy:    { accent: '#f3722c', bg: '#577590', icon: '🔥' },
  weekend: { accent: '#8338ec', bg: '#577590', icon: '🎉' },
  work:    { accent: '#277da1', bg: '#577590', icon: '💼' },
};
const WEEKEND = new Set([5, 6]); // Fri, Sat
const MAX_BAR_H = 120;

const SlideMonthWeekday = React.memo(function SlideMonthWeekday({ a, t, cfg = 'busy' }) {
  const weekly = a.groupWeekly || [];
  if (weekly.length !== 7 || weekly.every(v => v === 0)) return null;
  const c = CFG[cfg] || CFG.busy;
  const total = weekly.reduce((s, v) => s + v, 0);
  const max = Math.max(...weekly);

  let peakIdx = 0;
  for (let i = 1; i < 7; i++) if (weekly[i] > weekly[peakIdx]) peakIdx = i;

  // workday peak/quiet among Sun–Thu+Fri excluding Sat (weekday work spans
  // differ by region; we treat Mon–Fri-ish by simply excluding the weekend set
  // for the "quietest" pick but keeping all bars visible).
  const workIdx = [0, 1, 2, 3, 4];
  let workPeak = workIdx[0], workQuiet = workIdx[0];
  for (const i of workIdx) {
    if (weekly[i] > weekly[workPeak]) workPeak = i;
    if (weekly[i] < weekly[workQuiet]) workQuiet = i;
  }

  const highlight = new Set(
    cfg === 'weekend' ? [...WEEKEND] : cfg === 'work' ? [workPeak] : [peakIdx]
  );

  const eyebrow = t[`m4_wd_${cfg}_eyebrow`] || t.bw_eyebrow || 'THE WEEK';
  const title = t[`m4_wd_${cfg}_title`] || t.bw_title || 'When the chat is loudest';

  let caption;
  if (cfg === 'weekend') {
    const pct = total ? Math.round(((weekly[5] + weekly[6]) / total) * 100) : 0;
    caption = (
      <>
        <span className="fs-mono" style={{ fontSize: 11, color: c.accent, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
          {t.m4_wd_weekend_label || 'weekend share'}
        </span>
        <div className="fs-display" style={{ fontSize: 26, fontWeight: 800, color: '#2a0645', marginTop: 2 }}>
          {pct}%
        </div>
      </>
    );
  } else if (cfg === 'work') {
    caption = (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 26 }}>
        <div>
          <div className="fs-mono" style={{ fontSize: 10, color: c.accent, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            {t.m4_wd_work_busiest || 'busiest'}
          </div>
          <div className="fs-display" style={{ fontSize: 18, fontWeight: 800, color: '#2a0645' }}>{dayName(t, workPeak)}</div>
        </div>
        <div>
          <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(42,6,69,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            {t.m4_wd_work_quietest || 'quietest'}
          </div>
          <div className="fs-display" style={{ fontSize: 18, fontWeight: 800, color: 'rgba(42,6,69,0.6)' }}>{dayName(t, workQuiet)}</div>
        </div>
      </div>
    );
  } else {
    caption = (
      <>
        <span className="fs-mono" style={{ fontSize: 11, color: c.accent, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
          {t.bw_peak_label || 'peak day'}
        </span>
        <div className="fs-display" style={{ fontSize: 22, fontWeight: 800, color: '#2a0645', marginTop: 2 }}>
          {dayName(t, peakIdx)}
        </div>
      </>
    );
  }

  return (
    <SlideShell bg={c.bg} accent={c.accent}>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          textAlign: 'center', fontSize: 12, color: c.accent, letterSpacing: '0.15em',
          fontWeight: 700, textTransform: 'uppercase',
        }}>
          {c.icon} {eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 20, padding: '0 8px',
        }}>
          {title}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, padding: '8px 4px 4px' }}>
          {weekly.map((count, i) => {
            const barPx = max > 0 ? Math.max(10, Math.round((count / max) * MAX_BAR_H)) : 10;
            const isHot = highlight.has(i);
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
                <div className="fs-mono" style={{ fontSize: 10, fontWeight: 700, color: isHot ? c.accent : 'transparent', height: 13, lineHeight: '13px' }}>
                  {count.toLocaleString()}
                </div>
                <div className="a-bar" style={{
                  width: '100%', height: barPx,
                  background: isHot ? `linear-gradient(180deg, ${c.accent} 0%, ${c.accent}bb 100%)` : 'rgba(42,6,69,0.16)',
                  borderRadius: '8px 8px 4px 4px',
                  animationDelay: `${0.3 + i * 0.06}s`,
                  boxShadow: isHot ? `0 8px 18px ${c.accent}55` : 'none',
                }} />
                <div className="fs-sans" style={{
                  fontSize: 11, fontWeight: isHot ? 800 : 600,
                  color: isHot ? c.accent : 'rgba(42,6,69,0.6)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {dayName(t, i, true)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="a-fade-up" style={{
          marginTop: 18, textAlign: 'center',
          background: `${c.accent}1a`, borderRadius: 14, padding: '12px 14px',
          animationDelay: '0.9s',
        }}>
          {caption}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideMonthWeekday;
