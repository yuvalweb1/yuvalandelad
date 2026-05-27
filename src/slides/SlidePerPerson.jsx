import React, { useState } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { interp, typedCopy } from '../i18n';

const MAX_ROWS = 6;

const SlidePerPerson = React.memo(function SlidePerPerson({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const allUsers = a.users || [];
  if (allUsers.length === 0) return null;
  const [expanded, setExpanded] = useState(false);
  const overflow = allUsers.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const users = showOverflow ? allUsers.slice(0, MAX_ROWS) : allUsers;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);
  const DEEP = '#0089C4';
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <ListSlideDecor emojis={['📊', '📈', '✨', '💬', '🎯', '🔢']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 13, color: '#277da1', letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          📊 {typedCopy(t, 'pp_eyebrow', type)}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 38, lineHeight: 1.08, letterSpacing: '-0.04em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 18,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
        }}>
          {typedCopy(t, 'pp_title', type)}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {users.map((usr, i) => (
            <div key={usr.author} dir="auto" className="a-slide-up-far" style={{
              padding: '13px 16px',
              background: '#fff',
              borderRadius: 20,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: `0 6px 0 ${DEEP}22, 0 14px 24px -8px ${DEEP}55`,
              flexShrink: 0,
              animationDelay: `${0.4 + i * 0.08}s`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, color: '#4A0E4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.author}</div>
                <div className="fs-display" style={{ fontSize: 19, fontWeight: 800, color: '#277da1' }}>{usr.messageCount.toLocaleString()}</div>
                <div className="fs-mono" style={{ fontSize: 12, color: 'rgba(74,14,78,0.55)', width: 46, textAlign: 'right', fontWeight: 600 }}>{usr.sharePct.toFixed(1)}%</div>
              </div>
              <div className="fs-mono" style={{ marginTop: 4, fontSize: 11, color: 'rgba(74,14,78,0.6)' }}>
                {interp(t.pp_row, { words: usr.wordCount.toLocaleString(), avg: usr.avgWordsPerMsg.toFixed(1) })}
              </div>
            </div>
          ))}
          {showOverflow && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: '#277da1',
              fontWeight: 700, letterSpacing: '0.12em', padding: '6px 0', width: '100%',
            }}>
              {moreLabel} ↓
            </button>
          )}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlidePerPerson;
