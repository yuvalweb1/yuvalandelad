import { useState } from 'react';
import { interp, resolveTitle } from '../i18n';

// ── Icons ──────────────────────────────────────────────────────────────────
const IconGear = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconCheck = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconPlay = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

// ── Circular chrome button ─────────────────────────────────────────────────
function IconBtn({ children, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label} className="press" style={{
      width: 38, height: 38, borderRadius: 999,
      background: 'rgba(255,255,255,0.72)',
      border: '1px solid rgba(87,50,128,0.12)',
      color: '#573280',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 2px 10px rgba(87,50,128,0.10)',
    }}>{children}</button>
  );
}

// ── Compact inline stat chip ───────────────────────────────────────────────
function StatChip({ value, label, color = '#2a0645' }) {
  return (
    <div style={{
      flex: 1,
      padding: '10px 8px 11px',
      background: '#ffffff',
      border: '1px solid rgba(87,50,128,0.10)',
      borderRadius: 14,
      textAlign: 'center',
      minWidth: 0,
      boxShadow: '0 4px 14px -2px rgba(42,6,69,0.10)',
    }}>
      <div className="fs-display" style={{
        fontSize: 19, fontWeight: 800, lineHeight: 1,
        color, letterSpacing: '-0.02em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</div>
      <div className="fs-mono" style={{
        fontSize: 9, color: '#573280', marginTop: 6,
        letterSpacing: '0.10em', fontWeight: 800, textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}

// ── Mode tile (Roast / Duo / Chaos) ───────────────────────────────────────
function ModeTile({ label, title, emoji, gradient, fg = '#fff', shadowColor = '#3a0a3d', onClick }) {
  return (
    <button onClick={onClick} className="press lift" style={{
      flex: 1, position: 'relative', overflow: 'hidden',
      textAlign: 'left',
      background: gradient,
      border: 'none',
      borderRadius: 18,
      padding: '12px 12px 14px',
      cursor: 'pointer',
      color: fg,
      minHeight: 108,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: `0 8px 22px -4px ${shadowColor}66`,
    }}>
      <div aria-hidden style={{
        position: 'absolute', right: -10, bottom: -14,
        fontSize: 50, lineHeight: 1, opacity: 0.65,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))',
        transform: 'rotate(-10deg)',
        pointerEvents: 'none',
      }}>{emoji}</div>
      <div className="fs-mono" style={{
        fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
        fontWeight: 800, opacity: 0.95, position: 'relative',
        textShadow: fg === '#fff' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
      }}>{label}</div>
      <div className="fs-display" style={{
        fontSize: 18, fontWeight: 800, lineHeight: 1.0,
        letterSpacing: '-0.03em', position: 'relative',
        textShadow: fg === '#fff' ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
      }}>{title} <span style={{ fontWeight: 700 }}>→</span></div>
    </button>
  );
}

// ── Slide-up person picker ─────────────────────────────────────────────────
function PersonSheet({ open, users, selected, onPick, onClose, t }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, zIndex: 80,
        background: open ? 'rgba(10,10,15,0.55)' : 'transparent',
        backdropFilter: open ? 'blur(2px)' : 'none',
        pointerEvents: open ? 'auto' : 'none',
        transition: 'background 250ms',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 90,
        background: '#faf6f0',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -20px 50px rgba(74,14,78,0.25)',
        padding: '12px 18px 22px',
        transform: open ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 320ms cubic-bezier(0.16,1,0.3,1)',
        maxHeight: '78%',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          width: 42, height: 5, background: 'rgba(87,50,128,0.25)',
          borderRadius: 999, margin: '4px auto 14px',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div className="fs-display" style={{ fontSize: 22, fontWeight: 800, color: '#2a0645', letterSpacing: '-0.02em' }}>
            Switch <span style={{ fontStyle: 'italic', color: '#f06449' }}>person</span>
          </div>
          <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'rgba(42,6,69,0.5)', fontWeight: 700, textTransform: 'uppercase' }}>
            {users.length} people
          </div>
        </div>
        <div className="no-sb" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {users.map((user, i) => {
            const isSelected = user.author === selected;
            const isFirst = i === 0;
            return (
              <button key={user.author} onClick={() => { onPick(user.author); onClose(); }} className="press" style={{
                padding: '11px 13px', textAlign: 'left',
                background: isSelected ? 'rgba(240,100,73,0.10)' : isFirst ? 'rgba(255,217,114,0.22)' : 'rgba(241,228,243,0.50)',
                border: `1.5px solid ${isSelected ? '#f06449' : isFirst ? 'rgba(255,217,114,0.40)' : 'rgba(87,50,128,0.08)'}`,
                borderRadius: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 11, width: '100%',
              }}>
                <div className="fs-mono" style={{
                  fontSize: 11, width: 22, color: isFirst ? '#f06449' : 'rgba(87,50,128,0.4)',
                  fontWeight: 800,
                }}>{isFirst ? '🥇' : String(i + 1).padStart(2, '0')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div dir="auto" style={{
                    fontSize: 14, fontWeight: 700, color: '#2a0645',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {user.author}
                    {isSelected && (
                      <span style={{
                        fontSize: 9, letterSpacing: '0.14em',
                        background: '#f06449', color: '#fff', padding: '2px 6px',
                        borderRadius: 6, fontWeight: 800,
                      }}>YOU</span>
                    )}
                  </div>
                  <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(42,6,69,0.5)', marginTop: 2, fontStyle: 'italic' }}>
                    {resolveTitle(user, t)}
                  </div>
                </div>
                <div className="fs-mono" style={{
                  fontSize: 12, color: isFirst ? '#f06449' : 'rgba(42,6,69,0.55)',
                  fontWeight: 700,
                }}>{user.messageCount.toLocaleString()}</div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PostMenu({
  analytics, diagnostics, selectedAuthor, setSelectedAuthor, t,
  onReplay, onReset, onDebug, onRoastMode, onDuo, onChaos, onProfile, onOpenSettings,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const u = analytics.userMap[selectedAuthor] || analytics.users[0];
  if (!u) return null;

  const rank = analytics.users.findIndex(x => x.author === u.author) + 1;
  const title = resolveTitle(u, t);
  const confidence = diagnostics?.confidence ?? null;
  const isRTL = /[֐-׿؀-ۿ]/.test(u.author);

  // Awards from analytics superlatives — same logic as SlideAwards.jsx
  const a = analytics;
  const allAwards = [
    a.fastestResponder && {
      trophy: '⚡', label: t.awards_fastest || 'Fastest',
      winner: a.fastestResponder.author,
      sub: interp(t.awards_fastest_sub || '{m}m avg reply', { m: a.fastestResponder.avgRespMin.toFixed(1) }),
    },
    a.yapper && {
      trophy: '🎤', label: t.awards_yapper || 'Yapper',
      winner: a.yapper.author,
      sub: interp(t.awards_yapper_sub || '{n} messages', { n: a.yapper.messageCount.toLocaleString() }),
    },
    a.nightOwl && a.nightOwl.nightPct > 5 && {
      trophy: '🌙', label: t.awards_nightowl || 'Night Owl',
      winner: a.nightOwl.author,
      sub: interp(t.awards_nightowl_sub || '{pct}% after midnight', { pct: a.nightOwl.nightPct.toFixed(0) }),
    },
    a.ghost && a.ghost.longestAbsenceDays >= 7 && {
      trophy: '👻', label: t.awards_ghost || 'Ghost',
      winner: a.ghost.author,
      sub: interp(t.awards_ghost_sub || '{n}d gone', { n: a.ghost.longestAbsenceDays }),
    },
    a.killer && a.killer.conversationsKilled >= 3 && {
      trophy: '💀', label: t.awards_killer || 'Killer',
      winner: a.killer.author,
      sub: interp(t.awards_killer_sub || '{n} dead-ends', { n: a.killer.conversationsKilled }),
    },
    a.reviver && a.reviver.conversationsRevived >= 3 && {
      trophy: '✨', label: t.awards_defib || 'Reviver',
      winner: a.reviver.author,
      sub: interp(t.awards_defib_sub || '{n} revivals', { n: a.reviver.conversationsRevived }),
    },
  ].filter(Boolean);

  const myAwards = allAwards.filter(aw => aw.winner === u.author).slice(0, 3);
  const awardsToShow = myAwards.length > 0 ? myAwards : allAwards.slice(0, 3);
  const accentColors = ['#f06449', '#FFD700', '#00BFFF'];

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #FFF6D6 0%, #FFF0E2 46%, #FDE6F1 100%)',
      display: 'flex', flexDirection: 'column',
      padding: '40px 16px 36px',
    }}>
      {/* Warm blob background */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: '#FFD700', opacity: 0.18, filter: 'blur(72px)', top: -80, left: -60 }} />
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: '#f06449', opacity: 0.14, filter: 'blur(60px)', top: '20%', right: -60 }} />
        <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: '#FF69B4', opacity: 0.12, filter: 'blur(72px)', bottom: -60, left: '10%' }} />
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: '#4A0E4E', opacity: 0.07, filter: 'blur(60px)', bottom: '15%', right: -40 }} />
      </div>

      {/* ── Top chrome ── */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <IconBtn label={t.settings_title || 'Settings'} onClick={onOpenSettings || (() => {})}>
          <IconGear />
        </IconBtn>
        <div className="fs-display" style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: '#2a0645' }}>
          chat<span style={{ color: '#f06449' }}>wrapped</span>
        </div>
        <IconBtn label={t.a11y_start_over || 'Start over'} onClick={onReset}>
          <IconRefresh />
        </IconBtn>
      </div>

      {/* ── Identity hero ── */}
      <div className="a-fade-up" style={{ position: 'relative', zIndex: 10, marginTop: 15, flexShrink: 0, textAlign: 'center' }}>
        <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.24em', color: '#f06449', fontWeight: 800, textTransform: 'uppercase' }}>
          ✦ {t.menu_highlights || 'Your wrapped'}
        </div>
        <div dir="auto" className="fs-display" style={{
          fontSize: isRTL ? 48 : 44, fontWeight: 800,
          color: '#f06449', letterSpacing: '-0.045em', lineHeight: 1.0,
          fontStyle: 'italic', marginTop: 6,
        }}>
          {u.author}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {title && (
            <div className="fs-display" style={{ fontSize: 14, color: '#2a0645', fontStyle: 'italic', fontWeight: 700 }}>
              "{title}"
            </div>
          )}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#4A0E4E', color: '#FFD700',
            padding: '3px 9px 4px', borderRadius: 999,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
            boxShadow: '0 2px 0 rgba(74,14,78,0.5)',
          }}>
            <span style={{ opacity: 0.7 }}>#</span>{rank}
            <span style={{ opacity: 0.55, fontWeight: 600 }}>/{analytics.users.length}</span>
          </div>
        </div>

        {/* 4 stat chips */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <StatChip
            value={u.messageCount.toLocaleString()}
            label={t.menu_hl_messages || 'messages'}
            color="#f06449"
          />
          <StatChip
            value={u.peakHour != null ? `${u.peakHour}:00` : '—'}
            label={t.menu_hl_peak_hour || 'peak hour'}
            color="#00BFFF"
          />
          <StatChip
            value={u.longestStreak > 0 ? `${u.longestStreak}d` : '—'}
            label={t.menu_hl_streak || 'day streak'}
            color="#1a8754"
          />
          <StatChip
            value={u.topEmoji || '—'}
            label={t.menu_hl_top_emoji || 'top emoji'}
          />
        </div>
      </div>

      {/* ── Play again CTA ── */}
      <button
        onClick={onReplay}
        className="press lift a-gradient-shift"
        style={{
          position: 'relative', zIndex: 10, marginTop: 17, flexShrink: 0,
          width: '100%', overflow: 'hidden',
          background: 'linear-gradient(135deg, #FFE45C 0%, #FFD700 50%, #FFB800 100%)',
          backgroundSize: '200% 200%',
          color: '#2a0645',
          border: 'none',
          borderRadius: 22,
          padding: '18px 20px',
          cursor: 'pointer',
          boxShadow: '0 10px 28px -4px rgba(224,168,0,0.55)',
          textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 16,
        }}
      >
        <div className="a-shine" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{
          width: 60, height: 60, borderRadius: 999,
          background: '#4A0E4E', color: '#FFD700',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, position: 'relative',
          boxShadow: '0 4px 0 rgba(46,8,50,0.6)',
        }}>
          <IconPlay size={28} />
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div className="fs-mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 800, opacity: 0.7 }}>
            {t.menu_replay || 'The main event'}
          </div>
          <div className="fs-display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.02, marginTop: 3 }}>
            Play <span style={{ fontStyle: 'italic' }}>again</span> →
          </div>
          <div className="fs-mono" style={{ fontSize: 10.5, marginTop: 5, opacity: 0.95, fontWeight: 700, color: '#4A0E4E' }}>
            23 slides · 90 seconds
          </div>
        </div>
      </button>

      {/* ── 3 mode tiles ── */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', gap: 11, marginTop: 13, flexShrink: 0 }}>
        {onRoastMode && (
          <ModeTile
            label={t.menu_roast_mode || 'Roast mode'}
            title={<>Roast<br />everyone</>}
            emoji="🔥"
            gradient="linear-gradient(135deg, #FF69B4 0%, #f06449 100%)"
            fg="#fff"
            shadowColor="#a8284c"
            onClick={onRoastMode}
          />
        )}
        {onDuo && (
          <ModeTile
            label={t.menu_duo_eyebrow || 'Duo mode'}
            title={<>Compare<br />two</>}
            emoji="👯"
            gradient="linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)"
            fg="#4A0E4E"
            shadowColor="#b56500"
            onClick={onDuo}
          />
        )}
        {onChaos && (
          <ModeTile
            label={t.menu_chaos_eyebrow || 'Chaos mode'}
            title={<>Chaos<br />timeline</>}
            emoji="🌀"
            gradient="linear-gradient(135deg, #00BFFF 0%, #573280 100%)"
            fg="#fff"
            shadowColor="#2e1856"
            onClick={onChaos}
          />
        )}
      </div>

      {/* ── Group personality strip ── */}
      <div style={{
        position: 'relative', zIndex: 10, marginTop: 13, flexShrink: 0,
        background: '#4A0E4E',
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 8px 22px -4px rgba(74,14,78,0.40)',
      }}>
        <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}>
          👨‍👩‍👧
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="fs-mono" style={{ fontSize: 9, letterSpacing: '0.20em', color: '#FFD700', fontWeight: 800, textTransform: 'uppercase' }}>
            ✦ This group is
          </div>
          <div className="fs-display" style={{
            fontSize: 14, fontStyle: 'italic', fontWeight: 800,
            color: '#fff', lineHeight: 1.15, marginTop: 1,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
          }}>
            {analytics.groupPersonality || '—'}
          </div>
        </div>
        <div className="fs-mono" style={{ fontSize: 11, color: '#FFD700', fontWeight: 800, flexShrink: 0, letterSpacing: '0.04em' }}>
          {analytics.totalMessages.toLocaleString()}
          <span style={{ opacity: 0.85, fontWeight: 600, marginLeft: 2 }}>msgs</span>
        </div>
      </div>

      {/* ── Awards strip ── */}
      {awardsToShow.length > 0 && (
        <div style={{ position: 'relative', zIndex: 10, marginTop: 11, flexShrink: 0, display: 'flex', gap: 10 }}>
          {awardsToShow.map((aw, i) => (
            <div key={i} style={{
              flex: 1, position: 'relative', overflow: 'hidden',
              background: '#ffffff',
              border: '1px solid rgba(87,50,128,0.10)',
              borderRadius: 14,
              padding: '9px 10px 10px',
              minWidth: 0,
              boxShadow: '0 4px 14px -2px rgba(42,6,69,0.10)',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            }}>
              <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accentColors[i % 3] }} />
              <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 5 }}>{aw.trophy}</div>
              <div className="fs-mono" style={{
                fontSize: 9, letterSpacing: '0.08em', color: '#573280',
                fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.1,
                maxWidth: '100%', whiteSpace: 'nowrap',
              }}>{aw.label}</div>
              <div className="fs-display" style={{
                fontSize: 11, color: '#2a0645', marginTop: 3,
                fontWeight: 700, fontStyle: 'italic', lineHeight: 1.15,
                maxWidth: '100%', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{aw.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer: switch person + verified ── */}
      <div style={{
        position: 'relative', zIndex: 10, flexShrink: 0,
        marginTop: 11,
        display: 'flex', gap: 8, alignItems: 'stretch',
      }}>
        <button
          onClick={() => setSheetOpen(true)}
          className="press"
          style={{
            flex: 1, padding: '10px 14px',
            background: '#fff',
            border: '1px solid rgba(87,50,128,0.10)',
            borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
            boxShadow: '0 4px 14px -2px rgba(42,6,69,0.10)',
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 999,
            background: 'linear-gradient(135deg, #FFD700, #f06449)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13, flexShrink: 0,
          }}>
            {u.author.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fs-mono" style={{ fontSize: 8.5, letterSpacing: '0.18em', color: '#573280', fontWeight: 800, textTransform: 'uppercase' }}>
              {t.menu_viewing_as || 'Viewing as'}
            </div>
            <div dir="auto" style={{ fontSize: 13, fontWeight: 800, color: '#2a0645', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.author}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f06449', fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Switch <IconChevronDown />
          </div>
        </button>

        {confidence != null && (
          <button
            onClick={onDebug}
            className="press"
            aria-label={t.menu_verify || 'Verify'}
            style={{
              padding: '8px 12px',
              background: 'rgba(26,135,84,0.10)',
              border: '1px solid rgba(26,135,84,0.28)',
              borderRadius: 14, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minWidth: 64,
              boxShadow: '0 4px 14px -2px rgba(26,135,84,0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#1a8754', fontWeight: 800, fontSize: 12 }}>
              <IconCheck />{confidence}%
            </div>
            <div className="fs-mono" style={{ fontSize: 8, color: 'rgba(26,135,84,0.85)', marginTop: 2, letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase' }}>
              Verified
            </div>
          </button>
        )}
      </div>

      {/* Person picker sheet */}
      <PersonSheet
        open={sheetOpen}
        users={analytics.users}
        selected={u.author}
        onPick={setSelectedAuthor}
        onClose={() => setSheetOpen(false)}
        t={t}
      />
    </div>
  );
}
