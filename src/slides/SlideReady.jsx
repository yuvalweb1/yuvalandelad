import React from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { RTL_LANGS } from '../i18n/index.js';

const ACCENT = '#f9c74f';
const DEEP = '#b87a00';

// A looping "tap here" hint: concentric rings ripple outward from a dot that
// presses on a loop, mimicking a tap response. One per side of the slide.
function TapHint({ color, glow, glowSide, label }) {
  return (
    <div style={{
      flex: 1, position: 'relative',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      {/* soft ambient glow behind the dot */}
      <div style={{
        position: 'absolute',
        width: '85%', height: '55%',
        [glowSide]: '-10%',
        background: glow,
        filter: 'blur(36px)',
        borderRadius: 20,
        pointerEvents: 'none',
      }} />

      {/* tap target: rippling rings + a pressing dot */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: 76, height: 76,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {[0, 1].map(i => (
          <div key={i} className="a-tap-ripple" style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `2.5px solid ${color}`,
            animationDelay: `${i}s`,
          }} />
        ))}
        <div className="a-tap-press" style={{
          width: 54, height: 54, borderRadius: '50%',
          background: color,
          boxShadow: `0 6px 18px ${color}77`,
        }} />
      </div>

      <span className="fs-sans" dir="auto" style={{
        position: 'relative', zIndex: 1,
        fontSize: 12, fontWeight: 800, letterSpacing: '0.04em',
        textAlign: 'center', color, maxWidth: 120, lineHeight: 1.3,
      }}>{label}</span>
    </div>
  );
}

const SlideReady = React.memo(function SlideReady({ t = {}, lang = 'en' }) {
  const isRTL = RTL_LANGS.has(lang);

  const previews = [
    { icon: '📊', label: t.ready_stats || 'Stats' },
    { icon: '🏆', label: t.ready_awards || 'Awards' },
    { icon: '🎭', label: t.ready_drama || 'Drama' },
    { icon: '📸', label: t.ready_photos || 'Photos' },
  ];

  // Tap navigation (see Wrapped.jsx): LTR → back is the left edge, forward the
  // right; RTL flips it. Order the two hints so each sits on its real side.
  const backHint = (
    <TapHint
      color="#4f86c6"
      glow="rgba(80,140,210,0.55)"
      glowSide={isRTL ? 'right' : 'left'}
      label={t.ready_tap_back || 'Always tap here to go back'}
    />
  );
  const forwardHint = (
    <TapHint
      color={DEEP}
      glow={`${ACCENT}aa`}
      glowSide={isRTL ? 'left' : 'right'}
      label={t.ready_tap_forward || 'Always tap here to go forward'}
    />
  );

  return (
    <SlideShell bg={ACCENT} accent={ACCENT}>
      <ListSlideDecor emojis={['🎉', '✨', '📊', '🏆', '🎭', '📸']} />

      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '36px 20px 28px',
      }}>

        {/* Top content */}
        <div className="fs-sans a-fade-up" dir="auto" style={{
          textAlign: 'center', fontSize: 13, color: DEEP,
          letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          🎉 {t.ready_eyebrow || 'Your Group Recap'}
        </div>

        <div className="fs-display a-spring" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.18s',
          fontSize: 84, lineHeight: 0.92, letterSpacing: '-0.05em',
          fontWeight: 900, color: '#4A0E4E',
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          margin: '10px 0 20px',
        }}>
          {t.ready_title || 'Ready?'}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {previews.map((item, i) => (
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
              <span className="fs-sans" dir="auto" style={{
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
          {<>{backHint}{forwardHint}</>}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideReady;
