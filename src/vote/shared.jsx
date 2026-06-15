// ============================================================
// Shared screens for Group Court & Hot Takes: jury setup,
// pass-the-phone interstitial, and the final scoreboard.
// Themed via a `theme` object so each mode keeps its own palette
// while sharing layout/behaviour.
//
// theme = {
//   bg, surface, surfaceAlt, ink, inkMuted, accent, accentInk,
//   shadow (rgba string for box-shadow tints)
// }
// ============================================================
import { useState } from 'react';

export function fill(str, vars) {
  return String(str ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`));
}

// Always-present close button, top corner.
export function CloseButton({ onBack, t, theme }) {
  return (
    <button onClick={onBack} className="press" aria-label={t.a11y_close || 'Close'} style={{
      position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', insetInlineEnd: 14, zIndex: 10,
      background: theme.closeBg || 'rgba(0,0,0,0.18)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      color: theme.closeFg || '#fff', border: 'none', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

// Initial-circle avatar, deterministic colour by name.
const AVATAR_COLORS = ['#f9c74f', '#f3722c', '#90be6d', '#43aa8b', '#577590', '#f94144', '#c084fc', '#5eead4'];
export function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
export function Avatar({ name, size = 44 }) {
  const bg = avatarColor(name);
  return (
    <div aria-hidden className="fs-display" style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `radial-gradient(circle at 30% 25%, ${bg} 0%, ${bg}bb 75%)`,
      color: '#1B1813', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800,
      boxShadow: `0 4px 14px ${bg}55`,
    }}>{(name || '?')[0]?.toUpperCase()}</div>
  );
}

// ── Setup screen ─────────────────────────────────────────────────
// Players enter their names (2-8), or pick "Just me" for solo/predict
// mode. Defaults pre-fill from the chat's own participants.
export function SetupScreen({ t, theme, title, subtitle, icon, ctaLabel, defaultNames, savedJurors, onStart, onSolo }) {
  const initial = (savedJurors && savedJurors.length >= 2) ? savedJurors : (defaultNames || []).slice(0, 4);
  const [names, setNames] = useState(initial.length ? initial : ['', '']);

  const setName = (i, val) => setNames(prev => prev.map((n, idx) => idx === i ? val : n));
  const addPlayer = () => setNames(prev => prev.length < 8 ? [...prev, ''] : prev);
  const removePlayer = (i) => setNames(prev => prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev);

  const validNames = names.map(n => n.trim()).filter(Boolean);
  const canStart = validNames.length >= 2;

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden auto', background: theme.bg, color: theme.ink,
      display: 'flex', flexDirection: 'column',
      padding: 'calc(env(safe-area-inset-top, 0px) + 64px) 22px calc(env(safe-area-inset-bottom, 0px) + 24px)',
    }}>
      <div aria-hidden style={{ fontSize: 40, textAlign: 'center', marginBottom: 8, display: 'flex', justifyContent: 'center', lineHeight: 1 }}>{icon}</div>
      <div className="fs-display a-fade-up" style={{ fontSize: 24, fontWeight: 800, textAlign: 'center', letterSpacing: '-0.02em' }}>
        {title}
      </div>
      <div className="fs-sans a-fade-up" style={{ fontSize: 14, lineHeight: 1.5, textAlign: 'center', marginTop: 8, color: theme.inkMuted, animationDelay: '0.06s' }}>
        {subtitle}
      </div>

      <div className="a-fade-up" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10, animationDelay: '0.12s' }}>
        {names.map((name, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              value={name}
              onChange={e => setName(i, e.target.value)}
              placeholder={fill(t.vote_player_placeholder || 'Player {n}', { n: i + 1 })}
              maxLength={20}
              dir="auto"
              style={{
                flex: 1, padding: '13px 16px', borderRadius: 14, fontSize: 15, fontWeight: 600,
                border: `1.5px solid ${theme.inputBorder || 'rgba(0,0,0,0.12)'}`,
                background: theme.inputBg || 'rgba(255,255,255,0.6)', color: theme.ink,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {names.length > 2 && (
              <button onClick={() => removePlayer(i)} className="press" aria-label={t.vote_remove_player || 'Remove'} style={{
                width: 38, height: 38, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: theme.surfaceAlt, color: theme.inkMuted, fontSize: 16, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            )}
          </div>
        ))}
        {names.length < 8 && (
          <button onClick={addPlayer} className="press" style={{
            padding: '12px', borderRadius: 14, border: `1.5px dashed ${theme.inputBorder || 'rgba(0,0,0,0.18)'}`,
            background: 'transparent', color: theme.inkMuted, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}>+ {t.vote_add_player || 'Add player'}</button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 24 }} />

      <button onClick={() => canStart && onStart(validNames)} disabled={!canStart} className="press a-fade-up" style={{
        width: '100%', padding: '17px', borderRadius: 999, border: 'none', cursor: canStart ? 'pointer' : 'default',
        background: theme.accent, color: theme.accentInk, fontWeight: 800, fontSize: 17, fontFamily: 'inherit',
        opacity: canStart ? 1 : 0.45,
        boxShadow: `0 10px 26px -8px ${theme.shadow}`,
        animationDelay: '0.18s',
      }}>{ctaLabel}</button>

      <button onClick={onSolo} className="press a-fade-up" style={{
        marginTop: 10, width: '100%', padding: '14px', borderRadius: 999, cursor: 'pointer',
        background: 'transparent', color: theme.inkMuted, border: `1.5px solid ${theme.inputBorder || 'rgba(0,0,0,0.14)'}`,
        fontWeight: 700, fontSize: 14, fontFamily: 'inherit', animationDelay: '0.24s',
      }}>{t.vote_solo_cta || 'Just me — predict & compare'}</button>
    </div>
  );
}

// ── Pass-the-phone interstitial ─────────────────────────────────
// Full-bleed cover so the previous voter can't see the next prompt.
export function PassPhoneScreen({ t, theme, name, onReady }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden', background: theme.bg, color: theme.ink,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', gap: 14, textAlign: 'center',
    }}>
      <div aria-hidden className="a-pop-in" style={{ fontSize: 56 }}>📱</div>
      <div className="fs-mono a-fade-up" style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: theme.inkMuted, fontWeight: 800 }}>
        {t.vote_pass_eyebrow || 'PASS THE PHONE TO'}
      </div>
      <div dir="auto" className="fs-display a-fade-up" style={{ fontSize: 'clamp(32px, 10vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', animationDelay: '0.06s' }}>
        {name}
      </div>
      <div className="fs-sans a-fade-up" style={{ fontSize: 14, color: theme.inkMuted, maxWidth: 280, animationDelay: '0.12s' }}>
        {t.vote_pass_body || "Everyone else look away — your vote is secret."}
      </div>
      <button onClick={onReady} className="press a-fade-up" style={{
        marginTop: 12, padding: '16px 32px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: theme.accent, color: theme.accentInk, fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
        boxShadow: `0 10px 26px -8px ${theme.shadow}`, animationDelay: '0.18s',
      }}>{fill(t.vote_pass_cta || "I'm {name} — let's go", { name })}</button>
    </div>
  );
}

// ── Final leaderboard ───────────────────────────────────────────
export function ScoreboardScreen({ t, theme, leaderboard, isSolo, knowsBestLabel, soloLabel, extraCards, onReplay, onBack }) {
  if (isSolo) {
    const me = leaderboard[0];
    const pct = me.total ? Math.round((me.score / me.total) * 100) : 0;
    return (
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden auto', background: theme.bg, color: theme.ink,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '24px', gap: 10,
      }}>
        <div aria-hidden style={{ fontSize: 48 }}>🎯</div>
        <div className="fs-mono a-fade-up" style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: theme.inkMuted, fontWeight: 800 }}>
          {soloLabel}
        </div>
        <div className="fs-display a-spring" style={{ fontSize: 'clamp(64px, 22vw, 96px)', fontWeight: 800, letterSpacing: '-0.04em' }}>
          {me.score}/{me.total}
        </div>
        <div className="fs-sans a-fade-up" style={{ fontSize: 15, color: theme.inkMuted }}>
          {fill(t.vote_solo_pct || "You matched the data {pct}% of the time", { pct })}
        </div>
        {extraCards}
        <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 16 }}>
          <button onClick={onReplay} className="press" style={{
            flex: 1, padding: '15px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: theme.accent, color: theme.accentInk, fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
            boxShadow: `0 10px 26px -8px ${theme.shadow}`,
          }}>{t.vote_replay || 'Play again'}</button>
          <button onClick={onBack} className="press" style={{
            flex: 1, padding: '15px', borderRadius: 999, cursor: 'pointer',
            background: theme.surfaceAlt, color: theme.ink, border: `1.5px solid ${theme.inputBorder || 'rgba(0,0,0,0.12)'}`,
            fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
          }}>{t.vote_done || 'Done'}</button>
        </div>
      </div>
    );
  }

  const winner = leaderboard[0];
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden auto', background: theme.bg, color: theme.ink,
      display: 'flex', flexDirection: 'column',
      padding: 'calc(env(safe-area-inset-top, 0px) + 56px) 22px calc(env(safe-area-inset-bottom, 0px) + 24px)',
    }}>
      <div aria-hidden style={{ fontSize: 48, textAlign: 'center' }}>🏆</div>
      <div className="fs-display a-fade-up" style={{ fontSize: 'clamp(24px, 7vw, 32px)', fontWeight: 800, textAlign: 'center', letterSpacing: '-0.02em', marginTop: 8 }}>
        {fill(knowsBestLabel, { name: winner?.name || '' })}
      </div>

      <div className="a-fade-up" style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8, animationDelay: '0.08s' }}>
        {leaderboard.map((row, i) => (
          <div key={row.name} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16,
            background: i === 0 ? theme.accent : theme.surfaceAlt,
            color: i === 0 ? theme.accentInk : theme.ink,
            boxShadow: i === 0 ? `0 8px 22px -8px ${theme.shadow}` : 'none',
          }}>
            <div style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{medals[i] || `#${i + 1}`}</div>
            <Avatar name={row.name} size={36} />
            <div dir="auto" className="fs-sans" style={{ flex: 1, fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
            <div className="fs-mono" style={{ fontWeight: 800, fontSize: 14 }}>{row.score}/{row.total}</div>
          </div>
        ))}
      </div>

      {extraCards}

      <div style={{ flex: 1, minHeight: 16 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onReplay} className="press" style={{
          flex: 1, padding: '16px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: theme.accent, color: theme.accentInk, fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
          boxShadow: `0 10px 26px -8px ${theme.shadow}`,
        }}>{t.vote_replay || 'Play again'}</button>
        <button onClick={onBack} className="press" style={{
          flex: 1, padding: '16px', borderRadius: 999, cursor: 'pointer',
          background: theme.surfaceAlt, color: theme.ink, border: `1.5px solid ${theme.inputBorder || 'rgba(0,0,0,0.12)'}`,
          fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
        }}>{t.vote_done || 'Done'}</button>
      </div>
    </div>
  );
}

// ── Empty / locked state (shared shape with GuessWho's) ─────────
export function VoteEmpty({ t, onBack, theme, icon, title, body }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: theme.bg, color: theme.ink,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', gap: 12, textAlign: 'center',
    }}>
      <div aria-hidden style={{ fontSize: 64 }}>{icon}</div>
      <div className="fs-display" style={{ fontSize: 24, fontWeight: 800 }}>{title}</div>
      <div className="fs-sans" style={{ fontSize: 14, color: theme.inkMuted, maxWidth: 300 }}>{body}</div>
      <button onClick={onBack} className="press" style={{
        marginTop: 12, padding: '12px 22px', borderRadius: 999,
        background: theme.accent, color: theme.accentInk,
        border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
      }}>{t.rm_back || 'Back'}</button>
    </div>
  );
}
