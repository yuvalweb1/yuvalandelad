import React from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import { typedCopy } from '../../i18n';
import { DeltaChip, DEEP } from './monthShared.jsx';

const ACCENT = '#f9c74f';
const HEAD = '#b87a00';

// Opening hero for the 4-week deck — a punchy "here's your month" cover with
// the headline message count counting up and the month-over-month delta.
const SlideMonthIntro = React.memo(function SlideMonthIntro({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const total = a.totalMessages || 0;
  const animated = useAnimatedNumber(total, 1500, [total]);
  const growth = a.monthly?.growthPct;

  const chips = [
    { icon: '📈', label: t.m4_chip_activity || 'Activity' },
    { icon: '🏆', label: t.m4_chip_awards || 'Awards' },
    { icon: '🔥', label: t.m4_chip_moments || 'Moments' },
    { icon: '✨', label: t.m4_chip_trends || 'Trends' },
  ];

  return (
    <SlideShell bg={ACCENT} accent={ACCENT}>
      <ListSlideDecor emojis={['🗓️', '✨', '📈', '🔥', '💬', '🏆']} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '40px 22px 30px',
      }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          textAlign: 'center', fontSize: 13, color: HEAD,
          letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          🗓️ {t.m4_intro_eyebrow || 'The last 4 weeks'}
        </div>

        <div className="fs-display a-spring" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.18s',
          fontSize: 30, lineHeight: 1.05, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#4A0E4E', margin: '8px 0 18px',
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
        }}>
          {typedCopy(t, 'm4_intro_title', type)}
        </div>

        {/* headline number */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 10 }}>
          <div className="fs-display" style={{
            fontSize: total >= 100000 ? 64 : 80, lineHeight: 0.9, fontWeight: 900,
            color: '#4A0E4E', letterSpacing: '-0.05em',
            textShadow: `0 3px 0 rgba(255,255,255,0.7), 0 2px 16px ${ACCENT}66`,
          }}>
            {animated.toLocaleString()}
          </div>
          <div className="fs-sans" style={{
            fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase',
            fontWeight: 800, color: HEAD,
          }}>
            {t.m4_intro_messages || 'messages'}
          </div>
          {growth != null && (
            <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 4 }}>
              <DeltaChip pct={growth} label={t.m4_vs_last || 'vs last month'} style={{ fontSize: 13, padding: '7px 14px' }} />
            </div>
          )}
        </div>

        {/* category preview chips */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          {chips.map((c, i) => (
            <div key={c.label} className="a-slide-up-far" style={{
              animationDelay: `${0.5 + i * 0.09}s`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: '9px 11px', background: '#fff', borderRadius: 15,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: `0 5px 0 ${DEEP}22, 0 10px 18px -6px ${DEEP}44`,
              minWidth: 56,
            }}>
              <span style={{ fontSize: 19 }}>{c.icon}</span>
              <span className="fs-sans" dir="auto" style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'rgba(74,14,78,0.5)',
              }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideMonthIntro;
