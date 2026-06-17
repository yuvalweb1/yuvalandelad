import React from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { cardStyle, INK_SOFT, fmtHour } from './monthShared.jsx';

const ACCENT = '#f9456b';

// Couple "daily rhythm": the average time the first hello and the last
// goodnight land each day. Reads firstMsgAvgHour / lastMsgAvgHour from the
// month extras.
export function clockHasData(a) {
  const m = a.monthly || {};
  return m.firstMsgAvgHour != null && m.lastMsgAvgHour != null;
}

const SlideMonthClock = React.memo(function SlideMonthClock({ a, t }) {
  const m = a.monthly || {};
  if (m.firstMsgAvgHour == null || m.lastMsgAvgHour == null) return null;

  const cells = [
    { icon: '🌅', color: '#f9c74f', value: fmtHour(m.firstMsgAvgHour), label: t.m4_clock_first || 'first message', delay: '0.3s' },
    { icon: '🌙', color: '#8338ec', value: fmtHour(m.lastMsgAvgHour), label: t.m4_clock_last || 'last message', delay: '0.45s' },
  ];

  return (
    <SlideShell bg="#573280" accent={ACCENT}>
      <ListSlideDecor emojis={['🌅', '🌙', '💞', '✨', '⏰', '💌']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '38px 22px 30px' }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          textAlign: 'center', fontSize: 13, color: ACCENT, letterSpacing: '0.18em',
          fontWeight: 800, textTransform: 'uppercase',
        }}>
          💞 {t.m4_clock_eyebrow || 'Your daily rhythm'}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#4A0E4E', marginTop: 8, marginBottom: 24, padding: '0 8px',
          textShadow: '0 2px 0 rgba(255,255,255,0.6)',
        }}>
          {t.m4_clock_title || 'From good morning to good night'}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          {cells.map((c, i) => (
            <div key={i} className="a-slide-up-far" style={{
              ...cardStyle(false), animationDelay: c.delay, flex: 1, maxWidth: 160,
              padding: '22px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <div style={{ fontSize: 36, lineHeight: 1 }}>{c.icon}</div>
              <div className="fs-display" style={{
                fontSize: 38, fontWeight: 900, color: c.color, letterSpacing: '-0.02em', lineHeight: 1,
                textShadow: `0 2px 0 rgba(255,255,255,0.7), 0 1px 10px ${c.color}22`,
              }}>
                {c.value}
              </div>
              <div className="fs-sans" dir="auto" style={{
                fontSize: 10, color: INK_SOFT, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center',
              }}>
                {c.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideMonthClock;
