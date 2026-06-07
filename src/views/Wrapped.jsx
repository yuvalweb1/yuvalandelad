import { useMemo, useRef, useState } from 'react';
import SlidesBlobBackground from '../components/SlidesBlobBackground.jsx';
import { adEnabled } from '../lib/ads.js';
import { slideHasData } from '../slides';
import { RTL_LANGS } from '../i18n';

// Slides hosting playable audio/video — auto-advance pauses while the user
// listens, and the smart tap-to-advance is replaced with explicit chevron
// buttons so the audio/video controls own the slide area uncontested.
const MEDIA_SLIDES = new Set();

export default function Wrapped({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, slide, setSlide, profile, t, lang, onExit, onMenu, onRoastMode, slidesDef, slideComponents }) {
  const user = analytics.userMap[selectedAuthor];
  if (!user) return null;
  const userAchievements = analytics.achievementsByUser[selectedAuthor] || [];

  // Filter slides that lack data. slideHasData centralizes the rule so each
  // slide id has exactly one place where its "is there anything to show?"
  // check lives — including stickers/voice/videos (with-media exports only).
  const slides = useMemo(() => slidesDef.filter(s => {
    if (s === 'ad' && !adEnabled('interstitial')) return false;
    return slideHasData(s, analytics, user);
  }), [selectedAuthor, userAchievements.length, user, analytics, profile, slidesDef]);

  const total = slides.length;
  const current = slides[slide];
  const SlideComp = slideComponents[current];
  const isMediaSlide = MEDIA_SLIDES.has(current);

  const dirRef = useRef(1);
  const slideContainerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const next = () => { dirRef.current = 1;  setSlide(Math.min(slide + 1, total - 1)); };
  const prev = () => { dirRef.current = -1; setSlide(Math.max(slide - 1, 0)); };

  // Smart tap handler for non-media slides: clicks on interactive elements
  // (including native <audio>/<video> controls) pass through; bare-area clicks
  // advance the deck. Lives on the slide container, not an overlay, so the
  // slide's own scroll/touch behavior keeps working.
  const onSlideClick = (e) => {
    if (e.target.closest('button, a, input, textarea, label, audio, video, [role="button"]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isRTL = RTL_LANGS.has(lang);
    const tapLeft = x < rect.width * 0.3;
    if (isRTL ? !tapLeft : tapLeft) prev();
    else if (slide < total - 1) next();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff5f7' }}>
      {/* Background fills the full screen including the safe area */}
      <SlidesBlobBackground />

      {/* Slide covers the full screen so its background is flush with the
          status-bar safe zone — no color seam at the top. */}
      <div ref={slideContainerRef} key={`${current}-${selectedAuthor}`}
        onClick={isMediaSlide ? undefined : onSlideClick}
        className={dirRef.current >= 0 ? 'slide-in-right' : 'slide-in-left'}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 1 }}>
        {SlideComp && <SlideComp a={analytics} u={user} t={t} lang={lang} profile={profile} achievements={userAchievements} diagnostics={diagnostics} onExit={onExit} onMenu={onMenu} onRoastMode={onRoastMode} />}
      </div>

      {/* Controls overlay — pointer-events: none so taps pass through to the
          slide; interactive children restore their own pointer events. */}
      <div style={{ position: 'absolute', top: 'env(safe-area-inset-top, 0px)', left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 5 }}>

        {/* Progress bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', gap: 5, padding: '14px 14px 0' }}>
          {slides.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 8,
              background: i < slide ? 'rgba(255,255,255,0.6)' : i === slide ? '#fff' : 'rgba(255,255,255,0.25)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Menu trigger — replaces the old "Home" X. Tap opens a small sheet
            with Home / Roast Mode / Replay. insetInlineEnd keeps it on the
            trailing edge (top-right LTR, top-left RTL). */}
        <button onClick={() => setMenuOpen(true)} className="press" aria-label={t.a11y_menu || 'Menu'} style={{
          position: 'absolute', top: 34, insetInlineEnd: 16, pointerEvents: 'auto',
          background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)',
          color: '#fff', border: 'none', width: 40, height: 40,
          borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5"  r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {/* Media slides need explicit nav — the slide area belongs to audio/video. */}
        {isMediaSlide && slide > 0 && (
          <button onClick={prev} className="press" aria-label={t.a11y_previous || 'Previous'} style={{
            position: 'absolute', bottom: 18, insetInlineStart: 18, pointerEvents: 'auto',
            width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {isMediaSlide && slide < total - 1 && (
          <button onClick={next} className="press" aria-label={t.a11y_next || 'Next'} style={{
            position: 'absolute', bottom: 18, insetInlineEnd: 18, pointerEvents: 'auto',
            width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

      </div>{/* end controls overlay */}

      {/* Action sheet — Home / Roast / Replay. Replaces the old PostMenu as
          the in-deck exit point. Backdrop dismisses on tap. */}
      {menuOpen && (
        <>
          <style>{`
            @keyframes cw-fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes cw-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
          `}</style>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
              zIndex: 50, animation: 'cw-fade-in 0.18s ease-out',
            }}
          />
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 51,
            background: '#fff',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 'calc(env(safe-area-inset-bottom, 0px) + 14px) 16px 22px',
            boxShadow: '0 -12px 40px rgba(0,0,0,0.18)',
            animation: 'cw-sheet-up 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
          }}>
            {/* grabber */}
            <div style={{
              width: 40, height: 4, borderRadius: 3,
              background: 'rgba(74,14,78,0.18)', margin: '0 auto 14px',
            }} />
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H15v-5h-6v5H4a1 1 0 0 1-1-1V9.5z"/>
                  </svg>
                ),
                label: t.menu_action_home || 'Home',
                action: () => { setMenuOpen(false); onExit?.(); },
                color: '#4A0E4E',
              },
              {
                icon: <span style={{ fontSize: 22, lineHeight: 1 }}>🔥</span>,
                label: t.menu_action_roast || 'Roast Mode',
                action: () => { setMenuOpen(false); onRoastMode?.(); },
                color: '#f06449',
                emphasize: true,
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                ),
                label: t.menu_action_replay || 'Replay deck',
                action: () => { setMenuOpen(false); setSlide(0); },
                color: '#573280',
              },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="press"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  width: '100%', padding: '14px 14px',
                  background: item.emphasize ? 'rgba(240,100,73,0.08)' : 'transparent',
                  border: 'none', borderRadius: 14,
                  color: item.color, cursor: 'pointer',
                  fontSize: 17, fontWeight: 700, textAlign: 'start',
                  fontFamily: 'inherit',
                  marginBottom: 4,
                }}
              >
                <div style={{
                  flexShrink: 0, width: 38, height: 38, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: item.emphasize ? 'rgba(240,100,73,0.16)' : 'rgba(74,14,78,0.06)',
                  color: item.color,
                }}>
                  {item.icon}
                </div>
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
