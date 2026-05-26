import React from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { interp } from '../i18n';

const SlideAwards = React.memo(function SlideAwards({ a, t }) {
  // Only include awards with valid winners
  const awards = [
    a.fastestResponder && { trophy: '⚡', label: t.awards_fastest, winner: a.fastestResponder.author,
      sub: interp(t.awards_fastest_sub, { m: a.fastestResponder.avgRespMin.toFixed(1) }), color: '#00BFFF', deep: '#0089C4' },
    a.yapper && { trophy: '🎤', label: t.awards_yapper, winner: a.yapper.author,
      sub: interp(t.awards_yapper_sub, { n: a.yapper.messageCount.toLocaleString() }), color: '#FF8C00', deep: '#D17000' },
    a.nightOwl && a.nightOwl.nightPct > 5 && { trophy: '🌙', label: t.awards_nightowl,
      winner: a.nightOwl.author, sub: interp(t.awards_nightowl_sub, { pct: a.nightOwl.nightPct.toFixed(0) }), color: '#8338EC', deep: '#6624B0' },
    a.ghost && a.ghost.longestAbsenceDays >= 7 && { trophy: '👻', label: t.awards_ghost,
      winner: a.ghost.author, sub: interp(t.awards_ghost_sub, { n: a.ghost.longestAbsenceDays }), color: '#4A0E4E', deep: '#2A0645' },
    a.killer && a.killer.conversationsKilled >= 3 && { trophy: '💀', label: t.awards_killer,
      winner: a.killer.author, sub: interp(t.awards_killer_sub, { n: a.killer.conversationsKilled }), color: '#FF69B4', deep: '#D63384' },
    a.reviver && a.reviver.conversationsRevived >= 3 && { trophy: '✨', label: t.awards_defib,
      winner: a.reviver.author, sub: interp(t.awards_defib_sub, { n: a.reviver.conversationsRevived }), color: '#FFB800', deep: '#C28800' },
  ].filter(Boolean).slice(0, 6);

  return (
    <SlideShell bg="#577590" accent="#FFD700">
      <ListSlideDecor emojis={['🏆', '🥇', '🎉', '⭐', '✨', '🥈']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 13, color: '#f3722c', letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          🏆 {t.awards_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 44, lineHeight: 1.04, letterSpacing: '-0.04em', fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 18,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
        }}>
          {t.awards_title}<br/>
          <span style={{ fontStyle: 'italic', color: '#FF69B4' }}>{t.awards_are}</span>
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {awards.map((aw, i) => (
            <div key={aw.label} className="a-slide-up-far" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 14px',
              background: '#fff',
              borderRadius: 22,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: `0 6px 0 ${aw.deep}33, 0 14px 24px -8px ${aw.deep}55`,
              animationDelay: `${0.45 + i * 0.12}s`,
            }}>
              {/* trophy in a tilted white sticker badge */}
              <div style={{
                flexShrink: 0, width: 44, height: 44, borderRadius: 13,
                background: `${aw.color}1f`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, boxShadow: `0 3px 0 ${aw.deep}22`, transform: 'rotate(-4deg)',
              }}>
                {aw.trophy}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fs-sans" style={{
                  fontSize: 11, color: aw.deep, letterSpacing: '0.14em',
                  fontWeight: 800, textTransform: 'uppercase',
                }}>
                  {aw.label}
                </div>
                <div className="fs-sans" style={{
                  fontSize: 17, fontWeight: 800, marginTop: 2, lineHeight: 1.15, color: '#4A0E4E',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {aw.winner}
                </div>
              </div>
              <div className="fs-mono" style={{
                fontSize: 12, color: 'rgba(74,14,78,0.65)', textAlign: 'end',
                flexShrink: 0, lineHeight: 1.4, fontWeight: 600,
              }}>
                {aw.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideAwards;
