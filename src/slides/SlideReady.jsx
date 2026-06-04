import React from 'react';
import SlideShell from './SlideShell.jsx';

const PREVIEWS = [
  { icon: '📊', label: 'Stats' },
  { icon: '🏆', label: 'Awards' },
  { icon: '🎭', label: 'Drama' },
  { icon: '📸', label: 'Photos' },
];

const SlideReady = React.memo(function SlideReady() {
  return (
    <SlideShell bg="#0A0806" accent="#f9c74f">
      {/* Cinematic dark base */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(170deg, #120F08 0%, #080604 100%)',
        pointerEvents: 'none',
      }} />

      {/* Hero spotlight — warm gold overhead glow */}
      <div style={{
        position: 'absolute', top: '-5%', left: '50%', transform: 'translateX(-50%)',
        width: 420, height: 360,
        background: 'radial-gradient(ellipse, rgba(249,199,79,0.18) 0%, transparent 68%)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />

      {/* Floor glow — subtle warmth at the bottom */}
      <div style={{
        position: 'absolute', bottom: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 200,
        background: 'radial-gradient(ellipse, rgba(249,199,79,0.07) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '56px 28px 64px', gap: 28,
      }}>

        {/* Eyebrow */}
        <div className="a-fade-up" style={{
          fontSize: 11, fontWeight: 800,
          letterSpacing: '0.26em', textTransform: 'uppercase',
          color: 'rgba(249,199,79,0.6)',
        }}>
          Your Year Recap
        </div>

        {/* Giant headline — spring entrance */}
        <div className="a-spring" style={{ animationDelay: '0.18s', textAlign: 'center' }}>
          <div className="fs-display" style={{
            fontSize: 100, fontWeight: 900, lineHeight: 0.88,
            letterSpacing: '-0.06em', color: '#FBFAF6',
            textShadow: '0 0 80px rgba(249,199,79,0.28), 0 6px 0 rgba(0,0,0,0.5)',
          }}>
            Ready?
          </div>
        </div>

        {/* What's inside — 4 preview chips */}
        <div className="a-fade-up" style={{
          animationDelay: '0.46s',
          display: 'flex', gap: 10,
        }}>
          {PREVIEWS.map((item, i) => (
            <div key={item.label} className="a-fade-up" style={{
              animationDelay: `${0.56 + i * 0.09}s`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '10px 13px',
              background: 'rgba(255,255,255,0.045)',
              borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)',
              minWidth: 52,
            }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span className="fs-sans" style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(251,250,246,0.38)',
              }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Navigation hint zones */}
        <div className="a-fade-up" style={{
          animationDelay: '0.88s',
          display: 'flex', width: '100%', gap: 8,
        }}>

          {/* Left / back zone */}
          <div style={{
            flex: 1, position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '28px 12px',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: 20,
              background: 'rgba(251,250,246,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }} />
            <div style={{
              position: 'absolute',
              width: 130, height: 130, borderRadius: '50%',
              background: 'rgba(251,250,246,0.06)',
              filter: 'blur(32px)',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }} />
            <span className="fs-sans" style={{
              position: 'relative', zIndex: 1,
              fontSize: 11, fontWeight: 800, letterSpacing: '0.13em',
              textTransform: 'uppercase', color: 'rgba(251,250,246,0.32)',
              textAlign: 'center', lineHeight: 1.5,
            }}>
              press here
            </span>
            <span className="fs-sans" style={{
              position: 'relative', zIndex: 1,
              fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
              color: 'rgba(251,250,246,0.2)',
              textAlign: 'center', marginTop: 3,
            }}>
              to go back
            </span>
          </div>

          {/* Right / forward zone */}
          <div style={{
            flex: 1, position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '28px 12px',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: 20,
              background: 'rgba(249,199,79,0.07)',
              border: '1px solid rgba(249,199,79,0.15)',
            }} />
            <div style={{
              position: 'absolute',
              width: 160, height: 160, borderRadius: '50%',
              background: 'rgba(249,199,79,0.22)',
              filter: 'blur(36px)',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }} />
            <span className="a-cta-bob fs-sans" style={{
              position: 'relative', zIndex: 1,
              fontSize: 11, fontWeight: 800, letterSpacing: '0.13em',
              textTransform: 'uppercase', color: 'rgba(249,199,79,0.9)',
              textAlign: 'center', lineHeight: 1.5,
            }}>
              press here
            </span>
            <span className="fs-sans" style={{
              position: 'relative', zIndex: 1,
              fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
              color: 'rgba(249,199,79,0.55)',
              textAlign: 'center', marginTop: 3,
            }}>
              to move forward
            </span>
          </div>

        </div>
      </div>
    </SlideShell>
  );
});

export default SlideReady;
