import React, { useState } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { typedCopy } from '../i18n';

const MAX_ROWS = 9;

const SlideLeaderboard = React.memo(function SlideLeaderboard({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const users = a.users || [];
  if (users.length === 0) return null;
  const max = users[0].messageCount || 1;
  const medals = ['🥇', '🥈', '🥉'];
  const DEEP = '#C25516';

  const [expanded, setExpanded] = useState(false);
  const overflow = users.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const topUsers = showOverflow ? users.slice(0, MAX_ROWS - 1) : users;
  const quietest = users.length > 1 ? users[users.length - 1] : null;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);

  const renderRow = (usr, displayRank, opts = {}) => {
    const { isLast = false, key } = opts;
    const pct = Math.max(6, Math.round((usr.messageCount / max) * 100));
    const rankIdx = displayRank - 1;
    const isWinner = rankIdx === 0;
    return (
      <div key={key || usr.author} dir="auto" className="a-slide-up-far" style={{
        position: 'relative', padding: '13px 16px',
        background: isWinner ? '#FFF8E0' : '#fff',
        borderRadius: 20,
        border: `2px solid ${isWinner ? '#FFD700' : 'rgba(255,255,255,0.85)'}`,
        boxShadow: `0 6px 0 ${DEEP}22, 0 14px 24px -8px ${DEEP}55`,
        overflow: 'hidden',
        animationDelay: `${0.4 + (displayRank - 1) * 0.08}s`,
      }}>
        {/* bar fill (over the white card) */}
        <div className="a-slide-right" style={{
          position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
          background: `linear-gradient(90deg, ${isWinner ? 'rgba(255,215,0,0.28)' : 'rgba(243,114,44,0.16)'} 0%, rgba(243,114,44,0.02) 100%)`,
          width: `${pct}%`, animationDelay: `${0.6 + (displayRank - 1) * 0.08}s`, pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="fs-display" style={{
            width: 30, flexShrink: 0,
            fontSize: rankIdx < 3 ? 22 : 15, textAlign: 'center',
            color: rankIdx < 3 ? '#4A0E4E' : 'rgba(74,14,78,0.5)',
            fontWeight: 800,
          }}>
            {rankIdx < 3 ? medals[rankIdx] : displayRank}
          </div>
          <div className="fs-sans" style={{
            flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, color: '#4A0E4E',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {usr.author}{isLast && <span style={{ fontSize: 11, color: '#577590', fontWeight: 600 }}> · {t.lb_least}</span>}
          </div>
          <div className="fs-mono" style={{ flexShrink: 0, fontSize: 15, fontWeight: 800, color: '#f3722c' }}>
            {usr.messageCount.toLocaleString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <SlideShell bg="#f3722c" accent="#f3722c">
      <ListSlideDecor emojis={['🏆', '🥇', '🎉', '💬', '🔥', '✨']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 13, color: '#f3722c', letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          🏆 {typedCopy(t, 'lb_eyebrow', type)}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 38, lineHeight: 1.08, letterSpacing: '-0.04em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 20,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
        }}>
          {typedCopy(t, 'lb_title', type)}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
          {topUsers.map((usr, i) => renderRow(usr, i + 1, { isLast: !showOverflow && i === users.length - 1 && users.length > 1 }))}
          {showOverflow && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: '#f3722c',
              fontWeight: 700, letterSpacing: '0.12em', padding: '6px 0',
              width: '100%', animationDelay: `${0.4 + (MAX_ROWS - 1) * 0.08}s`,
            }}>
              {moreLabel} ↓
            </button>
          )}
          {showOverflow && quietest && renderRow(quietest, users.length, { isLast: true, key: 'quietest' })}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideLeaderboard;
