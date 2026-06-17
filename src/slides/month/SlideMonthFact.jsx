import React from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { interp } from '../../i18n';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import { cardStyle, INK_SOFT } from './monthShared.jsx';

// Single signature "fact" of the month.
//   emoji → the group's most-used emoji this month
//   word  → the group's most-shared word this month
const CFG = {
  emoji: { accent: '#f9456b', bg: '#573280', icon: '😊', decor: ['😊', '🎉', '💎', '✨', '🌟'] },
  word:  { accent: '#43aa8b', bg: '#577590', icon: '💬', decor: ['💬', '🔤', '✍️', '✨', '📣'] },
};

function topThree(cfg, a) {
  if (cfg === 'emoji') {
    return (a.topEmojisGroup || []).slice(0, 3).map(x => ({ label: x.emoji, count: x.count }));
  }
  return (a.topWordsGroup || []).slice(0, 3).map(x => ({ label: x.word, count: x.count }));
}

export function factHasData(cfg, a) {
  return topThree(cfg, a).length > 0;
}

const SlideMonthFact = React.memo(function SlideMonthFact({ a, t, cfg = 'emoji' }) {
  const c = CFG[cfg] || CFG.emoji;
  const list = topThree(cfg, a);
  if (list.length === 0) return null;
  const top = list[0];
  const animated = useAnimatedNumber(top.count, 1400, [top.count]);

  const eyebrow = t[`m4_fact_${cfg}_eyebrow`] || (cfg === 'emoji' ? 'EMOJI OF THE MONTH' : 'WORD OF THE MONTH');
  const title = t[`m4_fact_${cfg}_title`] || (cfg === 'emoji' ? 'Your most-used emoji' : 'Your most-shared word');
  const times = cfg === 'emoji'
    ? interp(t.m4_fact_emoji_times || 'used {n} times', { n: animated.toLocaleString() })
    : interp(t.m4_fact_word_times || 'said {n} times', { n: animated.toLocaleString() });

  return (
    <SlideShell bg={c.bg} accent={c.accent}>
      <ListSlideDecor emojis={c.decor} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '38px 22px 28px',
      }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          fontSize: 13, color: c.accent, letterSpacing: '0.18em',
          fontWeight: 800, textTransform: 'uppercase', textAlign: 'center',
        }}>
          {c.icon} {eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#4A0E4E', marginTop: 8, marginBottom: 8, padding: '0 8px',
          textShadow: '0 2px 0 rgba(255,255,255,0.6)',
        }}>
          {title}
        </div>

        {/* hero */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {cfg === 'emoji' ? (
            <div className="a-spring" style={{ fontSize: 120, lineHeight: 1, filter: 'drop-shadow(0 8px 16px rgba(74,14,78,0.25))' }}>
              {top.label}
            </div>
          ) : (
            <div className="a-spring fs-display" dir="auto" style={{
              ...cardStyle(true),
              padding: '16px 26px', maxWidth: '92%',
              fontSize: top.label.length > 9 ? 34 : 48, fontWeight: 900, color: '#4A0E4E',
              letterSpacing: '-0.02em', textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {top.label}
            </div>
          )}
          <div className="fs-mono a-fade-up" style={{ animationDelay: '0.7s', fontSize: 14, color: INK_SOFT, fontWeight: 700 }}>
            {times}
          </div>
        </div>

        {/* runner-up chips */}
        {list.length > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {list.slice(1).map((x, i) => (
              <div key={i} className="a-slide-up-far" dir="auto" style={{
                ...cardStyle(false), animationDelay: `${0.6 + i * 0.1}s`,
                padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <span className="fs-display" style={{ fontSize: cfg === 'emoji' ? 20 : 14, fontWeight: 800, color: '#4A0E4E', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {x.label}
                </span>
                <span className="fs-mono" style={{ fontSize: 12, fontWeight: 700, color: c.accent }}>
                  {x.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SlideShell>
  );
});

export default SlideMonthFact;
