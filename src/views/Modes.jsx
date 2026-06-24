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
        {t.modes_locked_body || 'Upload a chat to access Roast, Guess Who & Duo'}
      </div>
      <button onClick={onUpload} className="press" style={{
        marginTop: 6, padding: '14px 26px',
        background: 'linear-gradient(135deg, #FFD700 0%, #FFC200 100%)',
        color: '#4A0E4E', border: '2px solid rgba(255,255,255,0.80)',
        borderRadius: 18, fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
        cursor: 'pointer',
        boxShadow: '0 6px 0 rgba(74,14,78,0.25), 0 14px 24px -6px rgba(74,14,78,0.30)',
      }}>
        {t.modes_locked_cta || 'Upload a chat'}
      </button>
    </div>
  );
}

export default function Modes({ analytics, history = [], t, onUpload, onRoastMode, onDuo, onGuessWho, onTwoTruths, onCourt, onHotTakes }) {
  // A chat the user already imported or picked from history counts as
  // "available" even before it's loaded into the active session — don't make
  // them feel locked out of something they just brought in.
  const unlocked = !!analytics || history.length > 0;

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #FFF6D6 0%, #FFF0E2 46%, #FDE6F1 100%)',
      display: 'flex', flexDirection: 'column',
      padding: '44px 20px calc(92px + var(--safe-bottom, 0px))',
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
          // flex:1 lets the tile stack fill the space under the header (above
          // the bottom nav); each tile is flex:1 inside so they split it evenly.
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column', gap: 11, marginTop: 22,
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
            label={t.menu_guesswho_eyebrow || 'Who said this?'}
            title={t.menu_guesswho_title || 'Guess Who'}
            emoji="🎬"
            gradient="linear-gradient(135deg, #FFC83A 0%, #FF2D78 55%, #22D3EE 100%)"
            fg="#fff"
            shadowColor="#7a1240"
            onClick={onGuessWho}
          />
          <ModeTile
            label={t.menu_twotruths_eyebrow || 'Spot the lie'}
            title={t.menu_twotruths_title || 'Two Truths & a Lie'}
            emoji="🔎"
            gradient="linear-gradient(135deg, #2DD4BF 0%, #0E7C73 60%, #0A2A2A 100%)"
            fg="#fff"
            shadowColor="#063b38"
            onClick={onTwoTruths}
          />
          <ModeTile
            label={t.menu_duo_eyebrow || 'Duo game'}
            title={t.menu_duo_title || 'The Long Run'}
            emoji="🏃"
            gradient="linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)"
            fg="#4A0E4E"
            shadowColor="#b56500"
            onClick={onDuo}
          />
          <ModeTile
            label={t.menu_court_eyebrow || 'Pass & play'}
            title={t.menu_court_title || 'Group Court'}
            emoji="⚖️"
            gradient="linear-gradient(135deg, #E0A52E 0%, #B27E1E 46%, #2A1D14 100%)"
            fg="#fff"
            shadowColor="#2A1D14"
            onClick={onCourt}
          />
          <ModeTile
            label={t.menu_hottakes_eyebrow || 'Pass & play'}
            title={t.menu_hottakes_title || 'Hot Takes'}
            emoji="🥊"
            gradient="linear-gradient(135deg, #E23B4E 0%, #F2622E 48%, #141017 100%)"
            fg="#fff"
            shadowColor="#141017"
            onClick={onHotTakes}
          />
        </div>
      ) : (
        <LockedState t={t} onUpload={onUpload} />
      )}
    </div>
  );
}
