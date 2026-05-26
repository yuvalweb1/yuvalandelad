import React from 'react';
import SlideShell from './SlideShell.jsx';

const SlideTeaser = React.memo(function SlideTeaser({ t, onMenu, onExit }) {
  const cards = [
    { icon: '🔥', label: t.tz_roast },
    { icon: '👯', label: t.tz_duo },
    { icon: '👤', label: t.tz_profile },
    { icon: '🌪️', label: t.tz_chaos },
  ];
  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.tz_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16 }}>{t.tz_title}</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.map((c, i) => (
            <div key={i} className="a-slide-up-far" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'rgba(42,6,69,0.06)', borderRadius: 16, animationDelay: `${0.4 + i * 0.12}s` }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{c.icon}</div>
              <div className="fs-sans" dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: '#2a0645', lineHeight: 1.25, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{c.label}</div>
              <div style={{ flexShrink: 0, fontSize: 16, opacity: 0.55 }}>🔒</div>
            </div>
          ))}
        </div>
        <button onClick={onMenu || onExit} className="press fs-sans" style={{ marginTop: 16, padding: '15px', background: '#f94144', color: '#fff', border: 'none', borderRadius: 999, fontSize: 17, fontWeight: 800, cursor: 'pointer', width: '100%' }}>
          {t.tz_cta}
        </button>
      </div>
    </SlideShell>
  );
})

export default SlideTeaser;
