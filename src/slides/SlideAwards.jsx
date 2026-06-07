import React, { useState, useRef, useCallback } from 'react';
import SlideShell from './SlideShell.jsx';
import MedalCoin from '../components/MedalCoin.jsx';
import { interp, typedCopy } from '../i18n';

const BADGE_META = {
  fastest:  { accent: '#277da1' },
  yapper:   { accent: '#f3722c' },
  nightowl: { accent: '#8338ec' },
  ghost:    { accent: '#573280' },
  killer:   { accent: '#f06449' },
  defib:    { accent: '#277da1' },
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
    <SlideShell accent="#f9c74f">
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        padding: '20px 20px 14px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div className="fs-display a-fade-up" style={{
            fontSize: 28, lineHeight: 1.04,
            fontWeight: 800, letterSpacing: '-0.03em', color: '#2a0645',
          }}>
            {typedCopy(t, 'awards_title', type)}{' '}
            <span className="fs-serif" style={{ fontStyle: 'italic', color: '#f06449', fontWeight: 400 }}>
              {typedCopy(t, 'awards_are', type)}
            </span>
          </div>
        </div>

        {/* Medal grid */}
        <div style={{
          marginTop: 16, flex: 1, alignContent: 'center',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {awards.map((aw, i) => (
            <div
              key={aw.label}
              className="a-pop-in"
              style={{
                animationDelay: `${0.32 + i * 0.06}s`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              }}
            >
              <MedalCoin accent={aw.accent} emoji={aw.trophy} size={78} emojiSize={32} shineDur={4 + i * 0.4} shineDelay={i * 0.5} />
              <div className="fs-mono" style={{
                fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                fontWeight: 700, color: aw.accent, marginTop: 10, lineHeight: 1.35,
                overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 4px',
              }}>
                {aw.label}
              </div>
              <div className="fs-display" dir="auto" style={{
                fontSize: 15, marginTop: 2, color: '#2a0645', maxWidth: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {aw.winner}
              </div>
              <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(42,6,69,0.5)', marginTop: 1 }}>
                {aw.sub}
              </div>
              <button
                className="press"
                onClick={() => shareBadge(aw.label, aw.winner, aw.sub)}
                aria-label={`Share ${aw.label}`}
                style={{
                  marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 13px', borderRadius: 999,
                  border: '1.5px solid rgba(42,6,69,0.16)', color: '#2a0645',
                  fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.4)',
                }}
              >
                <ShareIcon size={12} /> {t.share_title || 'Share'}
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
