import React, { useState, useRef, useCallback } from 'react';
import SlideShell from './SlideShell.jsx';
import { interp, typedCopy } from '../i18n';

const BADGE_META = {
  fastest:  { accent: '#277da1', rarity: 'RARE',      rarityColor: '#00BFFF' },
  yapper:   { accent: '#f3722c', rarity: 'LEGENDARY', rarityColor: '#f9c74f' },
  nightowl: { accent: '#8338ec', rarity: 'RARE',      rarityColor: '#00BFFF' },
  ghost:    { accent: '#573280', rarity: 'EPIC',       rarityColor: '#FF69B4' },
  killer:   { accent: '#f06449', rarity: 'EPIC',       rarityColor: '#FF69B4' },
  defib:    { accent: '#277da1', rarity: 'LEGENDARY', rarityColor: '#f9c74f' },
};

function ShareIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M12 14.5V3.5" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12.5v6a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-6" />
    </svg>
  );
}

function Toast({ msg }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 32,
      transform: `translateX(-50%) translateY(${msg ? 0 : 14}px)`,
      background: '#2a0645', color: '#fff',
      fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
      padding: '11px 18px', borderRadius: 999,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 12px 30px -6px rgba(42,6,69,0.5)',
      opacity: msg ? 1 : 0, pointerEvents: 'none',
      transition: 'opacity 0.25s, transform 0.25s',
      zIndex: 40, whiteSpace: 'nowrap',
      textShadow: 'none',
    }}>
      <ShareIcon size={13} />
      <span>{msg}</span>
    </div>
  );
}

const SlideAwards = React.memo(function SlideAwards({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);

  const fireToast = useCallback((text) => {
    setToastMsg(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 1700);
  }, []);

  async function shareBadge(label, winner, sub) {
    const text = `🏆 ${label}\n${winner} — ${sub}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: label, text });
        fireToast(`${label} → shared`);
        return;
      }
      await navigator.clipboard.writeText(text);
      fireToast(`${label} → copied`);
    } catch { /* user cancelled */ }
  }

  const awards = [
    a.fastestResponder && {
      key: 'fastest', trophy: '⚡', label: t.awards_fastest,
      winner: a.fastestResponder.author,
      sub: interp(t.awards_fastest_sub, { m: a.fastestResponder.avgRespMin.toFixed(1) }),
    },
    a.yapper && {
      key: 'yapper', trophy: '🎤', label: t.awards_yapper,
      winner: a.yapper.author,
      sub: interp(t.awards_yapper_sub, { n: a.yapper.messageCount.toLocaleString() }),
    },
    a.nightOwl && a.nightOwl.nightPct > 5 && {
      key: 'nightowl', trophy: '🌙', label: t.awards_nightowl,
      winner: a.nightOwl.author,
      sub: interp(t.awards_nightowl_sub, { pct: a.nightOwl.nightPct.toFixed(0) }),
    },
    a.ghost && a.ghost.longestAbsenceDays >= 7 && {
      key: 'ghost', trophy: '👻', label: t.awards_ghost,
      winner: a.ghost.author,
      sub: interp(t.awards_ghost_sub, { n: a.ghost.longestAbsenceDays }),
    },
    a.killer && a.killer.conversationsKilled >= 3 && {
      key: 'killer', trophy: '💀', label: t.awards_killer,
      winner: a.killer.author,
      sub: interp(t.awards_killer_sub, { n: a.killer.conversationsKilled }),
    },
    a.reviver && a.reviver.conversationsRevived >= 3 && {
      key: 'defib', trophy: '✨', label: t.awards_defib,
      winner: a.reviver.author,
      sub: interp(t.awards_defib_sub, { n: a.reviver.conversationsRevived }),
    },
  ].filter(Boolean).slice(0, 6).map(aw => ({ ...aw, ...BADGE_META[aw.key] }));

  return (
    <SlideShell accent="#f3722c">
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        padding: '20px 20px 24px',
      }}>
        {/* Header */}
        <div style={{ flexShrink: 0, marginBottom: 14 }}>
          <div className="fs-mono" style={{
            fontSize: 11, color: '#f3722c', letterSpacing: '0.22em',
            textTransform: 'uppercase', fontWeight: 700,
          }}>
            {typedCopy(t, 'awards_eyebrow', type)}
          </div>
          <div className="fs-display a-fade-up" style={{
            fontSize: 32, lineHeight: 1.02, marginTop: 8,
            fontWeight: 800, letterSpacing: '-0.03em', color: '#2a0645',
          }}>
            {typedCopy(t, 'awards_title', type)}{' '}
            <span className="fs-serif" style={{ fontStyle: 'italic', color: '#f3722c', fontWeight: 400 }}>
              {typedCopy(t, 'awards_are', type)}
            </span>
          </div>
        </div>

        {/* Badge cards */}
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
          gap: 10, paddingBottom: 4,
        }}>
          {awards.map((aw, i) => (
            <div
              key={aw.label}
              className="a-slide-up-far"
              style={{
                animationDelay: `${0.35 + i * 0.08}s`,
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#4A0E4E', borderRadius: 20,
                padding: '12px 12px 12px 12px',
                border: '2px solid rgba(255,255,255,0.07)',
                boxShadow: '0 8px 0 rgba(74,14,78,0.22), 0 18px 36px -10px rgba(74,14,78,0.50)',
                textShadow: 'none',
              }}
            >
              {/* Emblem */}
              <div style={{
                flexShrink: 0, width: 52, height: 52, borderRadius: 15,
                background: `radial-gradient(circle at 50% 35%, ${aw.accent}, ${aw.accent}99)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 5px 14px -4px ${aw.accent}cc, inset 0 1px 0 rgba(255,255,255,0.30)`,
                border: '1.5px solid rgba(255,255,255,0.22)',
              }}>
                <span style={{ fontSize: 25, lineHeight: 1, filter: 'none' }}>{aw.trophy}</span>
              </div>

              {/* Text block */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span className="fs-mono" style={{
                    fontSize: 8.5, fontWeight: 800, letterSpacing: '0.12em',
                    color: '#0A192F', background: aw.rarityColor,
                    padding: '2px 6px', borderRadius: 5,
                    textShadow: 'none',
                  }}>
                    {aw.rarity}
                  </span>
                  <span className="fs-mono" style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: '0.16em',
                    color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase',
                    textShadow: 'none',
                  }}>
                    UNLOCKED
                  </span>
                </div>
                <div className="fs-display" style={{
                  fontSize: 15.5, color: '#fff', lineHeight: 1.06,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  letterSpacing: '-0.02em', textShadow: 'none',
                }}>
                  {aw.label}
                </div>
                <div className="fs-mono" dir="auto" style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.58)', marginTop: 3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  textShadow: 'none',
                }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{aw.winner}</span>
                  {' · '}{aw.sub}
                </div>
              </div>

              {/* Gold share disc */}
              <button
                className="press"
                onClick={() => shareBadge(aw.label, aw.winner, aw.sub)}
                aria-label={`Share ${aw.label}`}
                style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #FFE45C, #FFD700 55%, #FFB800)',
                  color: '#4A0E4E',
                  boxShadow: '0 4px 0 #C28800, 0 8px 18px -4px rgba(224,168,0,0.65)',
                  border: 'none', cursor: 'pointer',
                  textShadow: 'none',
                }}
              >
                <ShareIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <Toast msg={toastMsg} />
    </SlideShell>
  );
});

export default SlideAwards;
