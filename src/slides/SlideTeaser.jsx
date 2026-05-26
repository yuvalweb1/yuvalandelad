import React from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';

// Final slide of the Wrapped — four shortcut cards into the deeper features
// (roast / duo / personal profile / chaos timeline). No padlocks: nothing's
// behind a paywall, each card jumps straight to the relevant view.
const SlideTeaser = React.memo(function SlideTeaser({ t, onMenu, onExit, onRoastMode }) {
  const go = onMenu || onExit;
  const cards = [
    { icon: '🔥',  label: t.tz_roast,   bg: '#FFE1EE', accent: '#FF69B4', deep: '#D63384', onClick: onRoastMode || go },
    { icon: '👯',  label: t.tz_duo,     bg: '#FFEFC2', accent: '#FFB800', deep: '#D17000', onClick: go },
    { icon: '👤',  label: t.tz_profile, bg: '#DAF3FF', accent: '#00BFFF', deep: '#0089C4', onClick: go },
    { icon: '🌪️', label: t.tz_chaos,   bg: '#EDE3FF', accent: '#8338EC', deep: '#6624B0', onClick: go },
  ];
  const [titleHead, ...titleRest] = (t.tz_title || '').split(' ');
  const titleTail = titleRest.join(' ');

  return (
    <SlideShell bg="#577590" accent="#FF69B4">
      <ListSlideDecor emojis={['✨', '🎉', '💫', '⭐', '🎯', '🔥']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 13, color: '#FF69B4', letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          ✨ {t.tz_eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 44, lineHeight: 1.04, letterSpacing: '-0.04em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 18,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
        }}>
          <span style={{ fontStyle: 'italic', color: '#FF69B4' }}>{titleHead}</span>
          {titleTail && ' ' + titleTail}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {cards.map((c, i) => (
            <button key={i} type="button" onClick={c.onClick}
              aria-label={c.label}
              className="a-slide-up-far press lift" style={{
                width: '100%', textAlign: 'start', font: 'inherit', appearance: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                background: c.bg, borderRadius: 22,
                border: '2px solid rgba(255,255,255,0.85)',
                boxShadow: `0 6px 0 ${c.deep}33, 0 14px 26px -8px ${c.deep}55`,
                animationDelay: `${0.4 + i * 0.1}s`,
              }}>
              {/* icon sticker badge */}
              <div style={{
                flexShrink: 0, width: 48, height: 48, borderRadius: 14,
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, boxShadow: `0 4px 0 ${c.deep}22`, transform: 'rotate(-4deg)',
              }}>{c.icon}</div>
              <div className="fs-sans" dir="auto" style={{
                flex: 1, fontSize: 17, fontWeight: 800, color: '#4A0E4E', letterSpacing: '-0.01em',
                overflowWrap: 'break-word', wordBreak: 'break-word', lineHeight: 1.25,
              }}>{c.label}</div>
              <div style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: 999,
                background: c.accent, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 800, boxShadow: `0 3px 0 ${c.deep}55`,
              }}>←</div>
            </button>
          ))}
        </div>

        <button onClick={go} className="press a-gradient-shift" style={{
          marginTop: 14, width: '100%', position: 'relative', overflow: 'hidden',
          padding: '17px', color: '#4A0E4E',
          background: 'linear-gradient(135deg, #FFE45C 0%, #FFD700 50%, #FFB800 100%)',
          backgroundSize: '200% 200%', border: '2px solid rgba(255,255,255,0.7)', borderRadius: 22,
          fontSize: 18, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 8px 0 #E0A800, 0 16px 32px -6px rgba(224,168,0,0.55)',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <span className="fs-display" style={{ position: 'relative' }}>{t.tz_cta}</span>
        </button>
      </div>
    </SlideShell>
  );
})

export default SlideTeaser;
