import React from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import { interp } from '../../i18n';
import { INK_SOFT, fmtDate } from '../month/monthShared.jsx';
import { themedDecor, SEASON_THEMES } from '../../lib/seasonTheme.js';

// A single big "moment" of the season, hero-styled (reads a.season).
const CFG = {
  biggest_convo: { accent: '#f3722c', icon: '💬', decor: ['💬', '🔥', '⏱️', '✨', '📈'] },
  longest_convo: { accent: '#277da1', icon: '⏳', decor: ['⏳', '💬', '🌙', '✨', '☕'] },
  weekend:       { accent: '#8338ec', icon: '🎉', decor: ['🎉', '🥳', '🍻', '✨', '🗓️'] },
  media_dump:    { accent: '#e05c8a', icon: '📸', decor: ['📸', '🖼️', '🎞️', '✨', '📷'] },
  busiest_day:   { accent: '#f94144', icon: '📈', decor: ['📈', '🔥', '🚀', '✨', '💥'] },
  chaos:         { accent: '#f94144', icon: '🌀', decor: ['🌀', '🔥', '😵', '⚡', '💥'] },
  streak:        { accent: '#43aa8b', icon: '🔥', decor: ['🔥', '✅', '📅', '✨', '💪'] },
};

function pick(cfg, a) {
  const s = a.season || {};
  switch (cfg) {
    case 'biggest_convo': { const b = s.biggestConversation; return (b && b.count >= 5) ? { number: b.count, unitKey: 's3_mo_biggest_convo_unit', b } : null; }
    case 'longest_convo': { const b = s.longestConversation; return (b && b.durationMin >= 10) ? { number: b.durationMin, unitKey: 's3_mo_longest_convo_unit', b } : null; }
    case 'weekend':       { const b = s.bestWeekend; return (b && b.count >= 5) ? { number: b.count, unitKey: 's3_mo_weekend_unit', b } : null; }
    case 'media_dump':    { const b = s.biggestMediaDay; return (b && b.count >= 3) ? { number: b.count, unitKey: 's3_mo_media_dump_unit', b } : null; }
    case 'busiest_day':   { const b = s.busiestDay; return (b && b.count >= 5) ? { number: b.count, unitKey: 's3_mo_busiest_day_unit', b } : null; }
    case 'chaos':         { const b = s.chaos10; return (b && b.count >= 5) ? { number: b.count, unitKey: 's3_mo_chaos_unit', b } : null; }
    case 'streak':        { return (s.groupStreak >= 2) ? { number: s.groupStreak, unitKey: 's3_mo_streak_unit', b: { days: s.groupStreak } } : null; }
    default: return null;
  }
}

export function seasonMomentHasData(cfg, a) { return pick(cfg, a) != null; }

const SlideSeasonMoment = React.memo(function SlideSeasonMoment({ a, t, cfg = 'biggest_convo' }) {
  const c = CFG[cfg] || CFG.biggest_convo;
  const theme = a.seasonTheme || SEASON_THEMES.spring;
  const data = pick(cfg, a);
  const animated = useAnimatedNumber(data ? data.number : 0, 1500, [data?.number]);
  if (!data) return null;

  const eyebrow = t[`s3_mo_${cfg}_eyebrow`] || 'BIG MOMENT';
  const title = t[`s3_mo_${cfg}_title`] || 'The moment of the season';
  const unit = t[data.unitKey] || '';

  let sub = '';
  const b = data.b;
  if (cfg === 'biggest_convo') sub = interp(t.s3_mo_biggest_convo_sub || '{mins}-min marathon · {date}', { mins: b.durationMin, date: fmtDate(b.startTs, t) });
  else if (cfg === 'longest_convo') sub = interp(t.s3_mo_longest_convo_sub || '{n} messages · {date}', { n: b.count, date: fmtDate(b.startTs, t) });
  else if (cfg === 'weekend') sub = interp(t.s3_mo_weekend_sub || 'the weekend of {date}', { date: fmtDate(b.startKey, t) });
  else if (cfg === 'media_dump') sub = interp(t.s3_mo_media_dump_sub || 'all in one day · {date}', { date: fmtDate(b.dayKey, t) });
  else if (cfg === 'busiest_day') { const x = b.avgPerDay > 0 ? (b.count / b.avgPerDay) : 0; sub = interp(t.s3_mo_busiest_day_sub || '{x}× a normal day · {date}', { x: x.toFixed(1), date: fmtDate(b.dayKey, t) }); }
  else if (cfg === 'chaos') sub = interp(t.s3_mo_chaos_sub || '{people} people · {date}', { people: b.participants, date: fmtDate(b.startTs, t) });
  else if (cfg === 'streak') sub = t.s3_mo_streak_sub || 'consecutive days you kept talking';

  return (
    <SlideShell bg="#573280" accent={c.accent}>
      <ListSlideDecor emojis={themedDecor(c.decor, theme)} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          fontSize: 12, color: c.accent, letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center',
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
        <div className="a-spring" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, animationDelay: '0.3s' }}>
          <div className="fs-display" style={{
            fontSize: 92, lineHeight: 0.9, fontWeight: 900, color: c.accent, letterSpacing: '-0.05em',
            textShadow: `0 3px 0 rgba(255,255,255,0.7), 0 2px 20px ${c.accent}55`,
          }}>
            {animated.toLocaleString()}
          </div>
          {unit && (
            <div className="fs-sans" style={{ fontSize: 13, color: c.accent, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {unit}
            </div>
          )}
        </div>
        <div className="fs-mono a-fade-up" dir="auto" style={{ marginTop: 18, fontSize: 13, color: INK_SOFT, textAlign: 'center', maxWidth: 300, animationDelay: '0.9s' }}>
          {sub}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideSeasonMoment;
