import React from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';

const ACCENT = '#f9c74f';
const DEEP = '#b87a00';

const PREVIEWS = [
  { icon: '📊', label: 'Stats' },
  { icon: '🏆', label: 'Awards' },
  { icon: '🎭', label: 'Drama' },
  { icon: '📸', label: 'Photos' },
];

const SlideReady = React.memo(function SlideReady() {
  return (
    <SlideShell bg={ACCENT} accent={ACCENT}>
      <ListSlideDecor emojis={['🎉', '✨', '📊', '🏆', '🎭', '📸']} />

      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '36px 20px 28px',
      }}>

        {/* Top content */}
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 13, color: DEEP,
          letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          🎉 Your Group Recap
        </div>

        <div className="fs-display a-spring" style={{
          textAlign: 'center', animationDelay: '0.18s',
          fontSize: 84, lineHeight: 0.92, letterSpacing: '-0.05em',
          fontWeight: 900, color: '#4A0E4E',
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          margin: '10px 0 20px',
        }}>
          Ready?
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {PREVIEWS.map((item, i) => (
            <div key={item.label} className="a-slide-up-far" style={{
              animationDelay: `${0.38 + i * 0.09}s`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '10px 12px',
              background: '#fff',
              borderRadius: 16,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: `0 6px 0 ${DEEP}22, 0 12px 22px -6px ${DEEP}44`,
              minWidth: 52,
            }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span className="fs-sans" style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(74,14,78,0.5)',
              }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Tap zones — fill remaining height */}
        <div className="a-fade-up" style={{
          animationDelay: '0.72s',
          display: 'flex', gap: 10, flex: 1, minHeight: 0,
        }}>

          {/* Back zone */}
          <div style={{
            flex: 1, position: 'relative',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <div style={{
              position: 'absolute',
              width: '85%', height: '55%',
              left: '-10%',
              background: 'rgba(80,140,210,0.55)',
              filter: 'blur(36px)',
              borderRadius: 20,
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transform: 'translateX(-28%)' }}>
              <span className="fs-sans" style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: 'rgba(74,14,78,0.75)',
              }}>press here</span>
              <span className="fs-sans" style={{
                fontSize: 9, fontWeight: 500,
                color: 'rgba(74,14,78,0.55)',
              }}>to go back</span>
            </div>
          </div>

          {/* Forward zone */}
          <div style={{
            flex: 1, position: 'relative',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <div style={{
              position: 'absolute',
              width: '85%', height: '55%',
              right: '-10%',
              background: `${ACCENT}aa`,
              filter: 'blur(36px)',
              borderRadius: 20,
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transform: 'translateX(28%)' }}>
              <span className="fs-sans" style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: `${DEEP}cc`,
              }}>press here</span>
              <span className="fs-sans" style={{
                fontSize: 9, fontWeight: 600,
                color: `${DEEP}99`,
              }}>to move forward</span>
            </div>
          </div>

        </div>
      </div>
    </SlideShell>
  );
});

export default SlideReady;
