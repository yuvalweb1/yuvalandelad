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
const DEEP_PINK = '#D63384';
const CREAM    = '#fff5f7';

const popShadow = (hex) =>
  `0 6px 0 ${hex}22, 0 14px 24px -8px ${hex}55`;

// Minimal hub: actions only. Group/eras/highlights/leaderboard/achievements
// are already shown as full slides, so we don't repeat them here.
export default function PostMenu({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, t, onReplay, onReset, onDebug, onRoastMode }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const u = analytics.userMap[selectedAuthor];
  if (!u) return null;

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', position: 'relative',
      background: CREAM,
    }}>
      {/* Ultra-Pop gradient blobs — fixed so they stay behind everything. */}
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

      <div style={{
        padding: '22px 22px 32px', position: 'relative', zIndex: 1,
        minHeight: '100%', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="fs-display" style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', color: EGGPLANT }}>
            chat<span style={{ color: MANGO, fontStyle: 'italic' }}>wrapped</span>
          </div>
          <button onClick={onReset} className="press" aria-label={t.a11y_start_over || 'Start over'} style={{
            background: '#fff', border: `2px solid ${MANGO}33`, color: EGGPLANT,
            width: 40, height: 40, borderRadius: 999, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: popShadow(MANGO),
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        {/* Hero CTAs — vertical stack, bigger so they own the screen. */}
        <button onClick={onReplay} className="a-scale-in press lift" style={{
          position: 'relative', overflow: 'hidden', textAlign: 'start',
          background: `linear-gradient(135deg, ${BANANA} 0%, ${MANGO} 100%)`,
          border: `2px solid rgba(255,255,255,0.85)`,
          borderRadius: 26, padding: '22px 22px', cursor: 'pointer',
          color: EGGPLANT, boxShadow: `0 10px 0 ${MANGO}33, 0 22px 36px -8px ${MANGO}66`,
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <div className="fs-display" style={{
            position: 'absolute', insetInlineEnd: -10, top: -16, fontSize: 110,
            opacity: 0.18, lineHeight: 1, fontStyle: 'italic',
          }}>✦</div>
          <div className="fs-sans" style={{
            fontSize: 11, letterSpacing: '0.22em', opacity: 0.75, fontWeight: 800,
            textTransform: 'uppercase',
          }}>
            {t.menu_replay}
          </div>
          <div className="fs-display" style={{
            fontSize: 30, lineHeight: 1.0, letterSpacing: '-0.03em', marginTop: 8,
            whiteSpace: 'pre-line', fontWeight: 800,
          }}>
            {t.menu_watch}
          </div>
        </button>

        <button onClick={onRoastMode} className="a-scale-in press lift" style={{
          marginTop: 12,
          position: 'relative', overflow: 'hidden', textAlign: 'start',
          background: `linear-gradient(135deg, ${PINK} 0%, ${ROSE} 100%)`,
          border: `2px solid rgba(255,255,255,0.85)`,
          borderRadius: 26, padding: '22px 22px', cursor: 'pointer',
          color: '#fff', boxShadow: `0 10px 0 ${DEEP_PINK}33, 0 22px 36px -8px ${ROSE}66`,
          animationDelay: '0.06s',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <div style={{
            position: 'absolute', insetInlineEnd: -6, top: -10, fontSize: 80,
            opacity: 0.22, lineHeight: 1,
          }}>🔥</div>
          <div className="fs-sans" style={{
            fontSize: 11, letterSpacing: '0.22em', opacity: 0.95, fontWeight: 800,
            textTransform: 'uppercase',
          }}>
            {t.menu_roast_mode}
          </div>
          <div className="fs-display" style={{
            fontSize: 30, lineHeight: 1.0, letterSpacing: '-0.03em', marginTop: 8,
            whiteSpace: 'pre-line', fontWeight: 800,
          }}>
            {t.menu_roast_everyone}
          </div>
        </button>

        {/* Ad banner slot (placeholder until filled — see src/lib/ads.js) */}
        <AdSlot slot="menu" format="banner" t={t} style={{ marginTop: 16 }} />

        {/* Person picker — primary secondary action: change whose wrapped this is. */}
        <button onClick={() => setPickerOpen(true)} className="a-fade-up press" style={{
          marginTop: 16,
          width: '100%', padding: '16px 18px',
          background: '#fff', border: `2px solid rgba(255,255,255,0.85)`,
          borderRadius: 22, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: popShadow(SKY),
          animationDelay: '0.15s',
        }}>
          <div style={{ textAlign: 'start', minWidth: 0, flex: 1 }}>
            <div className="fs-sans" style={{ fontSize: 11, color: SKY, letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
              👀 {t.menu_viewing_as}
            </div>
            <div className="fs-display" style={{
              fontSize: 22, fontWeight: 800, marginTop: 4, color: EGGPLANT, letterSpacing: '-0.02em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {selectedAuthor}
            </div>
          </div>
          <div className="fs-mono" style={{
            fontSize: 13, color: SKY, letterSpacing: '0.1em', fontWeight: 800, flexShrink: 0, marginInlineStart: 12,
          }}>
            {t.menu_switch} →
          </div>
        </button>

        {/* Push the verify link to the bottom — keep it visible but de-emphasised. */}
        <div style={{ flex: 1, minHeight: 24 }} />

        <button onClick={onDebug} className="press" style={{
          marginTop: 16,
          width: '100%', textAlign: 'center',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
        }}>
          <span className="fs-mono" style={{
            fontSize: 11, color: 'rgba(74,14,78,0.55)', letterSpacing: '0.18em',
            fontWeight: 700, textTransform: 'uppercase',
          }}>
            ✓ {interp(t.menu_verified, { n: diagnostics?.confidence ?? 0 })}
          </span>
          <span className="fs-mono" style={{ fontSize: 11, color: 'rgba(74,14,78,0.4)', fontWeight: 700 }}>·</span>
          <span className="fs-mono" style={{
            fontSize: 11, color: MANGO, letterSpacing: '0.12em',
            fontWeight: 800, textTransform: 'uppercase',
          }}>
            {t.menu_verify} →
          </span>
        </button>
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
                <div style={{
                  fontSize: 22, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{user.author}</div>
                <div className="fs-mono" style={{
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
