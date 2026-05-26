import React from 'react';
import SlideShell from './SlideShell.jsx';
import { typedCopy, interp } from '../i18n';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const SlideBusiestWeekday = React.memo(function SlideBusiestWeekday({ a, t, profile }) {
  const weekly = a.groupWeekly || [];
  if (weekly.length !== 7 || weekly.every(v => v === 0)) return null;

  const type = profile?.relationship || 'other';
  const eyebrow = typedCopy(t, 'bw_eyebrow', type);
  const title = typedCopy(t, 'bw_title', type);

  const max = Math.max(...weekly);
  let peakIdx = 0;
  for (let i = 1; i < 7; i++) if (weekly[i] > weekly[peakIdx]) peakIdx = i;
  const peakDay = t[`day_${DAY_KEYS[peakIdx]}`] || DAY_KEYS[peakIdx];

  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#277da1', letterSpacing: '0.15em',
          fontWeight: 500, textTransform: 'uppercase',
        }}>
          {eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 20,
          padding: '0 8px',
        }}>
          {title}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, padding: '8px 4px 4px' }}>
          {weekly.map((count, i) => {
            const pct = max > 0 ? Math.max(6, (count / max) * 100) : 6;
            const isPeak = i === peakIdx;
            const label = (t[`day_${DAY_KEYS[i]}_short`] || DAY_KEYS[i]).slice(0, 3);
            return (
              <div key={i} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                minWidth: 0,
              }}>
                <div className="fs-mono" style={{
                  fontSize: 11, fontWeight: 700,
                  color: isPeak ? '#277da1' : 'rgba(42,6,69,0.5)',
                  height: 14,
                }}>
                  {isPeak ? count.toLocaleString() : ''}
                </div>
                <div className="a-bar" style={{
                  width: '100%', height: `${pct}%`, minHeight: 12,
                  background: isPeak
                    ? 'linear-gradient(180deg, #277da1 0%, #4a99c0 100%)'
                    : 'rgba(42,6,69,0.16)',
                  borderRadius: '8px 8px 4px 4px',
                  animationDelay: `${0.3 + i * 0.06}s`,
                  boxShadow: isPeak ? '0 8px 18px rgba(39,125,161,0.35)' : 'none',
                }} />
                <div className="fs-sans" style={{
                  fontSize: 11, fontWeight: isPeak ? 800 : 600,
                  color: isPeak ? '#277da1' : 'rgba(42,6,69,0.6)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
        <div className="a-fade-up" style={{
          marginTop: 18, textAlign: 'center',
          background: 'rgba(39,125,161,0.10)', borderRadius: 14, padding: '12px 14px',
          animationDelay: '0.95s',
        }}>
          <span className="fs-mono" style={{ fontSize: 11, color: '#277da1', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
            {t.bw_peak_label || 'peak day'}
          </span>
          <div className="fs-display" style={{ fontSize: 22, fontWeight: 800, color: '#2a0645', marginTop: 4 }}>
            {peakDay}
          </div>
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideBusiestWeekday;
