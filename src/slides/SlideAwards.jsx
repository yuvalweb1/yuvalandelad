import React from 'react';
import SlideShell from './SlideShell.jsx';
import { interp } from '../i18n';

const SlideAwards = React.memo(function SlideAwards({ a, t }) {
  // Only include awards with valid winners
  const awards = [
    a.fastestResponder && { trophy: '🏆', label: t.awards_fastest, winner: a.fastestResponder.author,
      sub: interp(t.awards_fastest_sub, { m: a.fastestResponder.avgRespMin.toFixed(1) }), color: '#277da1' },
    a.yapper && { trophy: '🎤', label: t.awards_yapper, winner: a.yapper.author,
      sub: interp(t.awards_yapper_sub, { n: a.yapper.messageCount.toLocaleString() }), color: '#f3722c' },
    a.nightOwl && a.nightOwl.nightPct > 5 && { trophy: '🌙', label: t.awards_nightowl,
      winner: a.nightOwl.author, sub: interp(t.awards_nightowl_sub, { pct: a.nightOwl.nightPct.toFixed(0) }), color: '#277da1' },
    a.ghost && a.ghost.longestAbsenceDays >= 7 && { trophy: '👻', label: t.awards_ghost,
      winner: a.ghost.author, sub: interp(t.awards_ghost_sub, { n: a.ghost.longestAbsenceDays }), color: '#2a0645' },
    a.killer && a.killer.conversationsKilled >= 3 && { trophy: '💀', label: t.awards_killer,
      winner: a.killer.author, sub: interp(t.awards_killer_sub, { n: a.killer.conversationsKilled }), color: '#f3722c' },
    a.reviver && a.reviver.conversationsRevived >= 3 && { trophy: '✨', label: t.awards_defib,
      winner: a.reviver.author, sub: interp(t.awards_defib_sub, { n: a.reviver.conversationsRevived }), color: '#277da1' },
  ].filter(Boolean).slice(0, 6);

  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.awards_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#2a0645',
          marginTop: 10, marginBottom: 18,
        }}>
          {t.awards_title}<br/><span style={{ fontStyle: 'italic', color: '#f94144' }}>{t.awards_are}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {awards.map((aw, i) => (
            <div key={aw.label} className="a-slide-up-far" style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px',
              background: 'rgba(42,6,69,0.06)',
              borderRadius: 18,
              animationDelay: `${0.5 + i * 0.15}s`,
            }}>
              <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{aw.trophy}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fs-sans" style={{
                  fontSize: 11, color: aw.color, letterSpacing: '0.1em',
                  fontWeight: 500, textTransform: 'uppercase', lineHeight: 1.25,
                  overflowWrap: 'break-word', wordBreak: 'break-word', hyphens: 'auto',
                }}>
                  {aw.label}
                </div>
                <div className="fs-sans" dir="auto" style={{
                  fontSize: 16, fontWeight: 700, marginTop: 3, lineHeight: 1.2, color: '#2a0645',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {aw.winner}
                </div>
              </div>
              <div className="fs-mono" style={{
                fontSize: 12, color: 'rgba(42,6,69,0.72)', textAlign: 'right', flexShrink: 0, lineHeight: 1.4,
                maxWidth: 90, overflowWrap: 'break-word',
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
