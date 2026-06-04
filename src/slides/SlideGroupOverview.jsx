import React, { useState } from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { typedCopy } from '../i18n';

function RevealTile({ question, icon, color, numValue, strValue, label, sub, delay }) {
  const [flipped, setFlipped] = useState(false);
  const animated = useAnimatedNumber(flipped && numValue != null ? numValue : 0, 1400, [flipped]);
  const display = strValue != null ? strValue : animated.toLocaleString();
  const numLen = String(strValue ?? numValue ?? '').length;

  const face = {
    position: 'absolute', inset: 0,
    borderRadius: 20,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  };

  return (
    <div className="a-slide-up-far" style={{ animationDelay: delay, position: 'relative', perspective: '900px' }}>
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        minHeight: 130,
      }}>

        {/* FRONT — question */}
        <div
          className="press"
          role="button"
          tabIndex={0}
          onClick={() => setFlipped(true)}
          onKeyDown={e => e.key === 'Enter' && setFlipped(true)}
          style={{
            ...face,
            background: '#fff',
            border: '2px solid rgba(255,255,255,0.85)',
            boxShadow: `0 6px 0 ${color}28, 0 14px 26px -8px ${color}44`,
            cursor: 'pointer',
            padding: '14px 10px',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
          <div className="fs-sans" style={{
            fontSize: 12, color: 'rgba(42,6,69,0.6)', fontWeight: 700,
            textAlign: 'center', padding: '0 8px', lineHeight: 1.3,
          }}>
            {question}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 24,
            background: color,
            boxShadow: `0 4px 12px ${color}55`,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="fs-sans" style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#fff',
            }}>Reveal</span>
          </div>
        </div>

        {/* BACK — answer */}
        <div style={{
          ...face,
          transform: 'rotateY(180deg)',
          background: '#fff',
          border: `2px solid ${color}35`,
          boxShadow: `0 6px 0 ${color}28, 0 14px 26px -8px ${color}44`,
          padding: '14px 10px',
          gap: 5,
        }}>
          <div style={{ fontSize: 24, lineHeight: 1 }}>{icon}</div>
          <div className="fs-display" style={{
            fontSize: numLen > 5 ? 32 : numLen > 3 ? 40 : 48,
            fontWeight: 900, color, letterSpacing: '-0.04em', lineHeight: 1,
            textShadow: `0 2px 0 rgba(255,255,255,0.7), 0 1px 10px ${color}25`,
          }}>
            {display}
          </div>
          <div className="fs-sans" style={{
            fontSize: 10, color: 'rgba(42,6,69,0.45)',
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
          }}>
            {label}
          </div>
          {sub && (
            <div className="fs-mono" style={{ fontSize: 9, color: 'rgba(42,6,69,0.32)', marginTop: -2 }}>
              {sub}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const SlideGroupOverview = React.memo(function SlideGroupOverview({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const peakHour = (a.groupHourly?.length)
    ? a.groupHourly.indexOf(Math.max(...a.groupHourly)) : null;
  const peakHourStr = peakHour != null ? `${String(peakHour).padStart(2, '0')}:00` : '—';
  const fmt = (d) => { try { return new Date(d).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); } catch { return ''; } };
  const range = `${fmt(a.start)} – ${fmt(a.end)}`;

  const tiles = [
    { question: t.go_q_messages, numValue: a.totalMessages, label: t.go_messages, icon: '💬', color: '#8338ec', delay: '0.3s' },
    { question: t.go_q_people, numValue: a.totalParticipants, label: t.go_people, icon: '👥', color: '#f3722c', delay: '0.45s' },
    { question: t.go_q_days, numValue: a.durationDays, label: t.go_days, sub: range, icon: '📅', color: '#277da1', delay: '0.6s' },
    { question: t.go_q_peakhour, strValue: peakHourStr, label: t.go_peakhour, icon: '⏰', color: '#e05c8a', delay: '0.75s' },
  ];

  return (
    <SlideShell bg="#8338ec" accent="#8338ec">
      <ListSlideDecor emojis={['💬', '📅', '⏰', '👥', '✨', '🔥']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '36px 20px calc(var(--safe-bottom) + 56px)' }}>

        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#573280',
          letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          {typedCopy(t, 'go_eyebrow', type)}
        </div>

        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(42,6,69,0.1)',
          padding: '0 8px',
        }}>
          {typedCopy(t, 'go_title', type)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1 }}>
          {tiles.map((tile, i) => <RevealTile key={i} {...tile} />)}
        </div>

      </div>
    </SlideShell>
  );
});

export default SlideGroupOverview;
