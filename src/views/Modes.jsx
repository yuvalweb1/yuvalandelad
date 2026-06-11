import { useState } from 'react';

// ── Mode tile — flex-grows inside the tile container, which is capped at
//    ~50vh, so the three tiles together fill half the viewport.
function ModeTile({ label, title, emoji, gradient, fg = '#fff', shadowColor = '#3a0a3d', onClick }) {
  return (
    <button onClick={onClick} className="press lift" style={{
      flex: 1, minHeight: 0,
      width: '100%', position: 'relative', overflow: 'hidden',
      textAlign: 'start',
      background: gradient,
      border: 'none',
      borderRadius: 22,
      padding: '18px 20px',
      cursor: 'pointer',
      color: fg,
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: `0 7px 0 ${shadowColor}44, 0 18px 32px -10px ${shadowColor}88`,
    }}>
      <div aria-hidden style={{
        fontSize: 46, lineHeight: 1, flexShrink: 0,
        filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.20))',
      }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fs-mono" style={{
          fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
          fontWeight: 800, opacity: 0.92,
          textShadow: fg === '#fff' ? '0 1px 2px rgba(0,0,0,0.16)' : 'none',
        }}>{label}</div>
        <div className="fs-display" style={{
          fontSize: 26, fontWeight: 800, lineHeight: 1.05, marginTop: 3,
          letterSpacing: '-0.035em',
          textShadow: fg === '#fff' ? '0 1px 3px rgba(0,0,0,0.20)' : 'none',
        }}>{title}</div>
      </div>
      <div aria-hidden style={{ fontSize: 20, opacity: 0.75, flexShrink: 0 }}>→</div>
    </button>
  );
}

// ── Locked / empty state shown before any chat is uploaded ─────────────────
function LockedState({ t, onUpload }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      gap: 14, padding: '0 12px',
    }}>
      <div aria-hidden style={{
        width: 84, height: 84, borderRadius: 999,
        background: 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(255,255,255,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 38,
        boxShadow: '0 4px 0 rgba(74,14,78,0.10), 0 12px 24px -6px rgba(74,14,78,0.18)',
      }}>🔒</div>
      <div className="fs-display" style={{
        fontSize: 24, fontWeight: 800, color: '#2a0645', letterSpacing: '-0.03em',
      }}>
        {t.modes_locked_title || 'Unlock your modes'}
      </div>
      <div className="fs-sans" style={{
        fontSize: 14, lineHeight: 1.5, color: 'rgba(74,14,78,0.6)', maxWidth: 260,
      }}>
        {t.modes_locked_body || 'Upload a chat to access Roast, Duo & Chaos'}
      </div>
      <button onClick={onUpload} className="press" style={{
        marginTop: 6, padding: '14px 26px',
        background: 'linear-gradient(135deg, #FFD700 0%, #FFC200 100%)',
        color: '#4A0E4E', border: '2px solid rgba(255,255,255,0.80)',
        borderRadius: 18, fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
        cursor: 'pointer',
        boxShadow: '0 6px 0 rgba(74,14,78,0.25), 0 14px 24px -6px rgba(74,14,78,0.30)',
      }}>
        {t.modes_locked_cta || 'Upload a chat →'}
      </button>
    </div>
  );
}

export default function Modes({ analytics, history = [], t, onUpload, onRoastMode, onDuo, onChaos }) {
  // A chat the user already imported or picked from history counts as
  // "available" even before it's loaded into the active session — don't make
  // them feel locked out of something they just brought in.
  const unlocked = !!analytics || history.length > 0;

  // Duo + Chaos are placeholders right now; intercept their taps with a
  // "Coming soon" modal instead of routing to the empty stub views.
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const showComingSoon = () => setComingSoonOpen(true);

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #FFF6D6 0%, #FFF0E2 46%, #FDE6F1 100%)',
      display: 'flex', flexDirection: 'column',
      padding: '44px 20px 92px',
    }}>
      {/* Warm blob background — matches PostMenu / Landing */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: '#FFD700', opacity: 0.18, filter: 'blur(72px)', top: -80, left: -60 }} />
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: '#f06449', opacity: 0.14, filter: 'blur(60px)', top: '20%', right: -60 }} />
        <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: '#FF69B4', opacity: 0.12, filter: 'blur(72px)', bottom: -60, left: '10%' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', flexShrink: 0 }}>
        <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.24em', color: '#f06449', fontWeight: 800, textTransform: 'uppercase' }}>
          ✦ {t.menu_choose_mode || 'Choose your mode'}
        </div>
        <div className="fs-display" style={{
          fontSize: 28, fontWeight: 800, color: '#2a0645', letterSpacing: '-0.03em',
          marginTop: 4,
        }}>
          {t.nav_modes || 'Modes'}
        </div>
      </div>

      {unlocked ? (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24,
          // 50vh keeps the three tiles to roughly half the screen; each
          // tile is flex:1 inside so they split that height evenly.
          height: '50vh',
        }}>
          <ModeTile
            label={t.menu_roast_mode || 'Roast mode'}
            title={t.menu_roast_title || 'Roast everyone'}
            emoji="🔥"
            gradient="linear-gradient(135deg, #FF69B4 0%, #f06449 100%)"
            fg="#fff"
            shadowColor="#a8284c"
            onClick={onRoastMode}
          />
          <ModeTile
            label={t.menu_duo_eyebrow || 'Duo mode'}
            title={t.menu_duo_title || 'Compare two'}
            emoji="👯"
            gradient="linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)"
            fg="#4A0E4E"
            shadowColor="#b56500"
            onClick={showComingSoon}
          />
          <ModeTile
            label={t.menu_chaos_eyebrow || 'Chaos mode'}
            title={t.menu_chaos_title || 'Chaos timeline'}
            emoji="🌀"
            gradient="linear-gradient(135deg, #00BFFF 0%, #573280 100%)"
            fg="#fff"
            shadowColor="#2e1856"
            onClick={onChaos}
          />
        </div>
      ) : (
        <LockedState t={t} onUpload={onUpload} />
      )}

      {/* Coming-soon modal for Duo + Chaos placeholder modes. Backdrop +
          centered card; tap backdrop or CTA to dismiss. */}
      {comingSoonOpen && (
        <>
          <style>{`
            @keyframes cw-cs-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes cw-cs-pop  {
              from { opacity: 0; transform: scale(0.92) translateY(8px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
          <div
            onClick={() => setComingSoonOpen(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 90,
              background: 'rgba(42,6,69,0.45)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px',
              animation: 'cw-cs-fade 0.18s ease-out',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog" aria-modal="true"
              style={{
                width: '100%', maxWidth: 320,
                background: '#fff', borderRadius: 24,
                padding: '28px 24px 20px',
                textAlign: 'center',
                boxShadow: '0 24px 48px -12px rgba(42,6,69,0.45)',
                animation: 'cw-cs-pop 0.22s cubic-bezier(0.34, 1.5, 0.64, 1)',
              }}
            >
              <div aria-hidden style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>🚧</div>
              <div className="fs-display" style={{
                fontSize: 24, fontWeight: 800, color: '#2a0645',
                letterSpacing: '-0.03em', marginBottom: 8,
              }}>
                {t.coming_soon_title || 'Coming soon'}
              </div>
              <div className="fs-sans" style={{
                fontSize: 14, lineHeight: 1.5, color: 'rgba(74,14,78,0.62)',
                marginBottom: 20, padding: '0 4px',
              }}>
                {t.coming_soon_body || "We're cooking this one. Hang tight — it'll land in a future update."}
              </div>
              <button
                onClick={() => setComingSoonOpen(false)}
                className="press"
                style={{
                  width: '100%', padding: '14px 18px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFC200 100%)',
                  color: '#4A0E4E', border: '2px solid rgba(255,255,255,0.80)',
                  borderRadius: 16, cursor: 'pointer',
                  fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em',
                  fontFamily: 'inherit',
                  boxShadow: '0 5px 0 rgba(74,14,78,0.22), 0 10px 18px -6px rgba(74,14,78,0.26)',
                }}
              >
                {t.coming_soon_ok || 'Got it'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
