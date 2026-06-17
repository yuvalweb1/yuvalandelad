import React from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import { interp } from '../../i18n';
import { INK_SOFT, fmtDate } from './monthShared.jsx';

// One big "moment" of the month, hero-styled.
//   biggest_convo → longest unbroken conversation (message count)
//   chaos10       → wildest 10 minutes (message count, # people)
//   spike         → busiest single day vs the daily average
//   streak        → longest run of consecutive active days
const CFG = {
  biggest_convo: { accent: '#f3722c', bg: '#573280', icon: '💬', decor: ['💬', '🔥', '⏱️', '✨', '📈'] },
  chaos10:       { accent: '#f94144', bg: '#2a0645', icon: '🌀', decor: ['🌀', '🔥', '😵', '⚡', '💥'] },
  spike:         { accent: '#e05c8a', bg: '#573280', icon: '📈', decor: ['📈', '🔥', '🚀', '✨', '💥'] },
  streak:        { accent: '#43aa8b', bg: '#577590', icon: '🔥', decor: ['🔥', '✅', '📅', '✨', '💪'] },
};

function pick(cfg, a) {
  const m = a.monthly || {};
  if (cfg === 'biggest_convo') {
    const b = m.biggestConversation;
    if (!b || b.count < 5) return null;
    return { number: b.count, _b: b };
  }
  if (cfg === 'chaos10') {
    const ch = m.chaos10;
    if (!ch || ch.count < 5) return null;
    return { number: ch.count, _b: ch };
  }
  if (cfg === 'spike') {
    const d = m.busiestDay;
    if (!d || d.count < 3) return null;
    return { number: d.count, _b: d };
  }
  if (cfg === 'streak') {
    if (!m.groupStreak || m.groupStreak < 2) return null;
    return { number: m.groupStreak, _b: { days: m.groupStreak } };
  }
  return null;
}

export function momentHasData(cfg, a) {
  return pick(cfg, a) != null;
}

const SlideMonthMoment = React.memo(function SlideMonthMoment({ a, t, cfg = 'biggest_convo' }) {
  const c = CFG[cfg] || CFG.biggest_convo;
  const data = pick(cfg, a);
  const animated = useAnimatedNumber(data ? data.number : 0, 1500, [data?.number]);
  if (!data) return null;

  const eyebrow = t[`m4_mo_${cfg}_eyebrow`] || 'BIG MOMENT';
  const title = t[`m4_mo_${cfg}_title`] || 'The moment of the month';
  const unit = t[`m4_mo_${cfg}_unit`] || '';

  let sub = '';
  if (cfg === 'biggest_convo') {
    sub = interp(t.m4_mo_biggest_convo_sub || '{mins}-min marathon · {date}', {
      mins: data._b.durationMin, date: fmtDate(data._b.startTs, t),
    });
  } else if (cfg === 'chaos10') {
    sub = interp(t.m4_mo_chaos10_sub || '{people} people · {date}', {
      people: data._b.participants, date: fmtDate(data._b.startTs, t),
    });
  } else if (cfg === 'spike') {
    const x = data._b.avgPerDay > 0 ? (data._b.count / data._b.avgPerDay) : 0;
    sub = interp(t.m4_mo_spike_sub || '{x}× a normal day · {date}', {
      x: x.toFixed(1), date: fmtDate(data._b.dayKey, t),
    });
  } else if (cfg === 'streak') {
    sub = t.m4_mo_streak_sub || 'days in a row, no silence';
  }

  return (
    <SlideShell bg={c.bg} accent={c.accent}>
      <ListSlideDecor emojis={c.decor} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          fontSize: 12, color: c.accent, letterSpacing: '0.18em',
          fontWeight: 800, textTransform: 'uppercase', textAlign: 'center',
        }}>
          {c.icon} {eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 26, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 10, marginBottom: 18, padding: '0 8px',
          textShadow: '0 2px 0 rgba(255,255,255,0.6)',
        }}>
          {title}
        </div>

        <div className="a-spring" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          animationDelay: '0.3s',
        }}>
          <div className="fs-display" style={{
            fontSize: 96, lineHeight: 0.9, fontWeight: 900, color: c.accent,
            letterSpacing: '-0.05em',
            textShadow: `0 3px 0 rgba(255,255,255,0.7), 0 2px 20px ${c.accent}55`,
          }}>
            {animated.toLocaleString()}
          </div>
          {unit && (
            <div className="fs-sans" style={{
              fontSize: 13, color: c.accent, fontWeight: 800,
              letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>
              {unit}
            </div>
          )}
        </div>

        <div className="fs-mono a-fade-up" dir="auto" style={{
          marginTop: 18, fontSize: 13, color: INK_SOFT, textAlign: 'center', maxWidth: 280,
          animationDelay: '0.9s',
        }}>
          {sub}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideMonthMoment;
