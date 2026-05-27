import { useState } from 'react';
import { interp, resolveTitle } from '../i18n';
import BottomSheet from '../components/BottomSheet.jsx';
import AdSlot from '../components/AdSlot.jsx';

// Ultra-Pop palette — matches the slide deck so the post-menu doesn't feel
// like a different app.
const BANANA   = '#FFD700';
const MANGO    = '#FF8C00';
const EGGPLANT = '#4A0E4E';
const SKY      = '#00BFFF';
const PINK     = '#FF69B4';
const ROSE     = '#F94144';
const MINT     = '#43AA8B';
const PURPLE   = '#8338EC';
const DEEP_PINK = '#D63384';
const CREAM    = '#fff5f7';

// Reusable shadow pattern (chunky "pop" drop + soft glow), parameterized by
// the section accent so every card reads as part of the same family.
const popShadow = (hex) =>
  `0 6px 0 ${hex}22, 0 14px 24px -8px ${hex}55`;

// Floating emoji stickers — fixed positioned so they stay put while the page
// scrolls. Same vibe as ListSlideDecor (used on the data slides) so PostMenu
// reads as a member of the same family.
const STICKER_POSITIONS = [
  { top: 70,  insetInlineStart: 14, rot: -14, size: 34, delay: '0s'   },
  { top: 110, insetInlineEnd:   18, rot:  12, size: 28, delay: '0.6s' },
  { top: 168, insetInlineStart: '24%', rot: -6, size: 22, delay: '1.0s' },
  { bottom: 80, insetInlineStart: 22, rot:  8,  size: 30, delay: '1.4s' },
  { bottom: 140, insetInlineEnd: 28, rot: -10, size: 28, delay: '0.3s' },
  { bottom: 220, insetInlineStart: '38%', rot: 6, size: 24, delay: '0.9s' },
];
const STICKER_EMOJIS = ['✨', '🎬', '🎉', '💫', '⭐', '🎯'];

export default function PostMenu({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, t, onReplay, onReset, onDebug, onRoastMode, onDuo, onChaos, onOpenSettings }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const u = analytics.userMap[selectedAuthor];
  if (!u) return null;

  // Highlights grid — only render cards whose value actually exists. The
  // current user's "wrapped at a glance" — same numbers the slides celebrate.
  const rank = analytics.users.findIndex(x => x.author === selectedAuthor) + 1;
  const fmtReply = u.avgRespMin != null
    ? (u.avgRespMin < 60 ? `${u.avgRespMin.toFixed(1)}m` : `${(u.avgRespMin / 60).toFixed(1)}h`)
    : null;
  const highlights = [
    { value: u.messageCount.toLocaleString(), label: t.menu_hl_messages, accent: MANGO },
    rank > 0 && { value: `#${rank}`, label: interp(t.menu_hl_of, { n: analytics.users.length }), accent: PINK },
    u.peakHour != null && { value: `${u.peakHour}:00`, label: t.menu_hl_peak_hour, accent: SKY },
    u.nightPct != null && { value: `${Math.round(u.nightPct)}%`, label: t.menu_hl_at_night, accent: PURPLE },
    u.longestStreak > 0 && { value: `${u.longestStreak}d`, label: t.menu_hl_streak, accent: MINT },
    u.topEmoji && { value: u.topEmoji, label: t.menu_hl_top_emoji, accent: BANANA },
    fmtReply && { value: fmtReply, label: t.menu_hl_avg_reply, accent: ROSE },
  ].filter(Boolean).slice(0, 6);

  const persona = resolveTitle(u, t);

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', position: 'relative',
      background: CREAM,
    }}>
      {/* Idle breath + icon drift animations — purely decorative, looped. */}
      <style>{`
        @keyframes breathe-soft {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-3px) scale(1.012); }
        }
        @keyframes icon-drift {
          0%, 100% { transform: translate(0, 0) rotate(-4deg); }
          50%      { transform: translate(-6px, 4px) rotate(2deg); }
        }
        .cta-breathe   { animation: breathe-soft 4.2s ease-in-out 0.6s infinite; }
        .cta-breathe-2 { animation: breathe-soft 4.2s ease-in-out -1.5s infinite; }
        .cta-icon-drift { animation: icon-drift 5.5s ease-in-out infinite; }
      `}</style>

      {/* ===== Decoration layer ===== */}
      {/* Gradient blobs — fixed so they stay behind everything during scroll. */}
      <div aria-hidden="true" style={{
        position: 'fixed', top: -70, insetInlineStart: -80, width: 240, height: 240,
        borderRadius: '50%', background: BANANA, opacity: 0.5, filter: 'blur(72px)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden="true" style={{
        position: 'fixed', top: 40, insetInlineEnd: -70, width: 200, height: 200,
        borderRadius: '50%', background: PINK, opacity: 0.38, filter: 'blur(70px)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden="true" style={{
        position: 'fixed', bottom: -50, insetInlineEnd: -50, width: 220, height: 220,
        borderRadius: '50%', background: SKY, opacity: 0.42, filter: 'blur(68px)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden="true" style={{
        position: 'fixed', bottom: 120, insetInlineStart: -60, width: 190, height: 190,
        borderRadius: '50%', background: MANGO, opacity: 0.34, filter: 'blur(62px)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Floating emoji stickers — same vibe as ListSlideDecor on data slides. */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
      }}>
        {STICKER_POSITIONS.map((p, i) => (
          <span key={i} className="a-float" style={{
            position: 'absolute',
            top: p.top, bottom: p.bottom,
            insetInlineStart: p.insetInlineStart, insetInlineEnd: p.insetInlineEnd,
            fontSize: p.size, transform: `rotate(${p.rot}deg)`,
            filter: 'drop-shadow(0 4px 6px rgba(74,14,78,0.32))',
            animationDelay: p.delay,
          }}>{STICKER_EMOJIS[i % STICKER_EMOJIS.length]}</span>
        ))}
      </div>

      <div style={{
        padding: '24px 20px 28px', position: 'relative', zIndex: 1,
        minHeight: '100%', display: 'flex', flexDirection: 'column',
      }}>
        {/* Top-right chrome — settings + reset. Settings first (start), reset last
            so the destructive action sits in the most discoverable corner. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          {onOpenSettings ? (
            <button onClick={onOpenSettings} className="press" aria-label={t.settings_title || 'Settings'} style={{
              background: '#fff', border: `2px solid ${SKY}33`, color: EGGPLANT,
              width: 38, height: 38, borderRadius: 999, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: popShadow(SKY),
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          ) : <div />}
          <button onClick={onReset} className="press" aria-label={t.a11y_start_over || 'Start over'} style={{
            background: '#fff', border: `2px solid ${MANGO}33`, color: EGGPLANT,
            width: 38, height: 38, borderRadius: 999, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: popShadow(MANGO),
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        {/* Slide-style header: eyebrow + display title + persona subtitle.
            Mirrors SlideAwards / SlideLeaderboard / SlidePerPerson typography
            so the post-menu reads as a slide, not a separate page. */}
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 13, color: MANGO,
          letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          ✨ {t.menu_highlights}
        </div>
        <div dir="auto" className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: selectedAuthor.length > 12 ? 36 : 44,
          lineHeight: 1.04, letterSpacing: '-0.04em',
          fontWeight: 800, color: EGGPLANT,
          marginTop: 8, marginBottom: persona ? 2 : 18,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
        }}>
          <span style={{ fontStyle: 'italic', color: MANGO }}>{selectedAuthor}</span>
        </div>
        {persona && (
          <div dir="auto" className="fs-mono a-fade-up" style={{
            textAlign: 'center', animationDelay: '0.22s',
            fontSize: 13, color: 'rgba(74,14,78,0.6)',
            marginBottom: 22, fontWeight: 600, fontStyle: 'italic',
            overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 12px',
          }}>
            "{persona}"
          </div>
        )}

        {/* Hero CTAs — five primary actions, all sharing the same chunky-pop
            treatment. Replay first (return to deck), then the four "warm-up"
            destinations from SlideTeaser (full roast / duo / profile / chaos).
            Colors match the teaser palette so the menu feels continuous. */}
        {(() => {
          const ctas = [
            { onClick: onReplay,    eyebrow: t.menu_replay,         action: t.menu_watch,           icon: '✦',  bg: `linear-gradient(135deg, ${BANANA} 0%, ${MANGO} 100%)`,    shadow: MANGO,    deep: MANGO,     ink: EGGPLANT, italic: true,  cls: 'cta-breathe'   },
            { onClick: onRoastMode, eyebrow: t.menu_roast_mode,     action: t.menu_roast_everyone,  icon: '🔥', bg: `linear-gradient(135deg, ${PINK} 0%, ${ROSE} 100%)`,       shadow: DEEP_PINK, deep: ROSE,     ink: '#fff',   italic: false, cls: 'cta-breathe-2' },
            { onClick: onDuo,       eyebrow: t.menu_duo_eyebrow,    action: t.menu_duo_action,      icon: '👯', bg: `linear-gradient(135deg, #FFD580 0%, #FF8C00 100%)`,       shadow: '#D17000', deep: '#D17000', ink: EGGPLANT, italic: false, cls: 'cta-breathe'   },
            { onClick: () => setPickerOpen(true), eyebrow: t.menu_profile_eyebrow, action: t.menu_profile_action, icon: '👤', bg: `linear-gradient(135deg, #7FDBFF 0%, ${SKY} 100%)`, shadow: '#0089C4', deep: '#0089C4', ink: EGGPLANT, italic: false, cls: 'cta-breathe-2' },
            { onClick: onChaos,     eyebrow: t.menu_chaos_eyebrow,  action: t.menu_chaos_action,    icon: '🌪️', bg: `linear-gradient(135deg, #B388FF 0%, ${PURPLE} 100%)`,    shadow: '#6624B0', deep: '#6624B0', ink: '#fff',   italic: false, cls: 'cta-breathe'   },
          ];
          return ctas.map((c, i) => c.onClick && (
            <button key={i} onClick={c.onClick} className={`a-fade-up press lift ${c.cls}`} style={{
              marginTop: i === 0 ? 0 : 12,
              position: 'relative', overflow: 'hidden', textAlign: 'start',
              background: c.bg,
              border: `3px solid rgba(255,255,255,0.9)`,
              borderRadius: 26, padding: '24px 22px', cursor: 'pointer',
              color: c.ink, boxShadow: `0 10px 0 ${c.shadow}33, 0 22px 36px -8px ${c.deep}66`,
              animationDelay: `${0.3 + i * 0.08}s`,
            }}>
              <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
              <div aria-hidden="true" className={c.italic ? 'fs-display cta-icon-drift' : 'cta-icon-drift'} style={{
                position: 'absolute', insetInlineEnd: -10, top: -18, fontSize: c.italic ? 120 : 86,
                opacity: c.italic ? 0.2 : 0.28, lineHeight: 1,
                fontStyle: c.italic ? 'italic' : 'normal',
                pointerEvents: 'none',
              }}>{c.icon}</div>
              <div className="fs-sans" style={{
                fontSize: 11, letterSpacing: '0.24em', opacity: c.ink === '#fff' ? 0.95 : 0.78,
                fontWeight: 800, textTransform: 'uppercase',
              }}>
                {c.eyebrow}
              </div>
              <div dir="auto" className="fs-display" style={{
                fontSize: 30, lineHeight: 1.0, letterSpacing: '-0.035em', marginTop: 8,
                whiteSpace: 'pre-line', fontWeight: 800,
                overflowWrap: 'break-word', wordBreak: 'break-word',
                textShadow: c.ink === '#fff'
                  ? '0 2px 0 rgba(0,0,0,0.15)'
                  : '0 2px 0 rgba(255,255,255,0.35)',
              }}>
                {c.action}
              </div>
            </button>
          ));
        })()}

        {/* Highlights grid — each card on a white "sticker" with a colored
            pop shadow, exactly like the data cards on every other slide. */}
        {highlights.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {highlights.map((h, i) => (
                <div key={i} className="a-fade-up" style={{
                  background: '#fff', border: `2px solid rgba(255,255,255,0.85)`,
                  borderRadius: 16, padding: '12px 14px', minHeight: 76,
                  boxShadow: popShadow(h.accent),
                  animationDelay: `${0.5 + i * 0.05}s`,
                }}>
                  <div dir="auto" className="fs-display" style={{
                    fontSize: 22, letterSpacing: '-0.03em', lineHeight: 1,
                    color: h.accent, fontWeight: 800,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textShadow: '0 1px 0 rgba(255,255,255,0.65)',
                  }}>{h.value}</div>
                  <div className="fs-mono" style={{
                    fontSize: 9.5, color: 'rgba(74,14,78,0.55)', letterSpacing: '0.14em',
                    marginTop: 6, textTransform: 'uppercase', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{h.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ad slot — bottom of content so highlights/CTAs lead. */}
        <AdSlot slot="menu" format="banner" t={t} style={{ marginTop: 18 }} />

        {/* Push the tertiary actions to the bottom — single thin row. */}
        <div style={{ flex: 1, minHeight: 14 }} />

        <div className="a-fade-up" style={{
          marginTop: 14, display: 'flex', alignItems: 'stretch', gap: 8,
          animationDelay: '0.7s',
        }}>
          <button onClick={() => setPickerOpen(true)} className="press" style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            background: '#fff', border: `2px solid rgba(255,255,255,0.85)`,
            borderRadius: 14, cursor: 'pointer', textAlign: 'start',
            boxShadow: popShadow(SKY),
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>👀</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="fs-mono" style={{
                fontSize: 9, color: 'rgba(74,14,78,0.55)', letterSpacing: '0.16em',
                fontWeight: 800, textTransform: 'uppercase', lineHeight: 1,
              }}>
                {t.menu_switch}
              </div>
              <div dir="auto" className="fs-sans" style={{
                fontSize: 13, fontWeight: 800, color: EGGPLANT, marginTop: 2,
                letterSpacing: '-0.01em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {selectedAuthor}
              </div>
            </div>
            <span className="fs-mono" style={{
              fontSize: 11, color: SKY, fontWeight: 800, flexShrink: 0,
            }}>→</span>
          </button>

          <button onClick={onDebug} className="press" aria-label={t.menu_verify} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 14px',
            background: '#FFF8E0', border: `2px solid ${BANANA}88`,
            borderRadius: 14, cursor: 'pointer', flexShrink: 0,
            boxShadow: popShadow(BANANA),
          }}>
            <span className="fs-mono" style={{
              fontSize: 12, fontWeight: 800, color: '#B8860B',
              letterSpacing: '0.05em',
            }}>
              ✓ {diagnostics?.confidence ?? 0}%
            </span>
          </button>
        </div>
      </div>

      {pickerOpen && (
        <BottomSheet onClose={() => setPickerOpen(false)} title={t.rm_switch_person}>
          {analytics.users.map(user => (
            <button key={user.author} className="press" onClick={() => {
              setSelectedAuthor(user.author);
              setPickerOpen(false);
            }} style={{
              width: '100%', padding: '16px 8px', minHeight: 56, background: 'transparent',
              border: 'none', borderBottom: '1px solid #2a2a36', color: '#f4f4f8',
              fontSize: 23, fontWeight: 500, textAlign: 'start', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div dir="auto" style={{
                  fontSize: 22, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{user.author}</div>
                <div dir="auto" className="fs-mono" style={{
                  fontSize: 20, color: '#f9c74f', marginTop: 2, fontStyle: 'italic',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>"{resolveTitle(user, t)}"</div>
              </div>
              <span className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', flexShrink: 0, marginInlineStart: 8 }}>
                {user.messageCount.toLocaleString()}
              </span>
            </button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}
