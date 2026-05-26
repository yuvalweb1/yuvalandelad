import React from 'react';
import SlideShell from './SlideShell.jsx';

const MAX_ROWS = 9;

const SlideLeaderboard = React.memo(function SlideLeaderboard({ a, t }) {
  const users = a.users || [];
  if (users.length === 0) return null;
  const max = users[0].messageCount || 1;
  const medals = ['🥇', '🥈', '🥉'];

  const overflow = users.length - MAX_ROWS;
  const showOverflow = overflow > 0;
  const topUsers = showOverflow ? users.slice(0, MAX_ROWS - 1) : users;
  const quietest = users.length > 1 ? users[users.length - 1] : null;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);

  const renderRow = (usr, displayRank, opts = {}) => {
    const { isLast = false, key } = opts;
    const pct = Math.max(6, Math.round((usr.messageCount / max) * 100));
    const rankIdx = displayRank - 1;
    return (
      <div key={key || usr.author} dir="auto" className="a-slide-up-far" style={{ position: 'relative', padding: '10px 14px', background: isLast ? 'rgba(87,117,144,0.12)' : 'rgba(243,114,44,0.08)', borderRadius: 14, overflow: 'hidden', animationDelay: `${0.4 + (displayRank - 1) * 0.06}s` }}>
        <div className="a-slide-right" style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, background: 'linear-gradient(90deg, rgba(243,114,44,0.16) 0%, rgba(243,114,44,0.02) 100%)', width: `${pct}%`, animationDelay: `${0.6 + (displayRank - 1) * 0.06}s`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="fs-display" style={{ width: 26, flexShrink: 0, fontSize: rankIdx < 3 ? 20 : 14, textAlign: 'center', color: 'rgba(42,6,69,0.5)' }}>{rankIdx < 3 ? medals[rankIdx] : displayRank}</div>
          <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#2a0645', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {usr.author}{isLast && <span style={{ fontSize: 11, color: '#577590', fontWeight: 600 }}> · {t.lb_least}</span>}
          </div>
          <div className="fs-mono" style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, color: '#f3722c' }}>{usr.messageCount.toLocaleString()}</div>
        </div>
      </div>
    );
  };

  return (
    <SlideShell bg="#f3722c" accent="#f3722c">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#f3722c', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.lb_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16 }}>{t.lb_title}</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
          {topUsers.map((usr, i) => renderRow(usr, i + 1, { isLast: !showOverflow && i === users.length - 1 && users.length > 1 }))}
          {showOverflow && (
            <div className="a-fade-up" style={{ textAlign: 'center', fontSize: 11, color: 'rgba(42,6,69,0.45)', fontWeight: 600, letterSpacing: '0.08em', padding: '4px 0', animationDelay: `${0.4 + (MAX_ROWS - 1) * 0.06}s` }}>
              {moreLabel}
            </div>
          )}
          {showOverflow && quietest && renderRow(quietest, users.length, { isLast: true, key: 'quietest' })}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideLeaderboard;
