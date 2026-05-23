import React from 'react';
import SlideShell from './SlideShell.jsx';
import { interp } from '../i18n';

const SlidePerPerson = React.memo(function SlidePerPerson({ a, t }) {
  const users = a.users || [];
  if (users.length === 0) return null;
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.pp_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 14 }}>{t.pp_title}</div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((usr, i) => (
            <div key={usr.author} dir="auto" className="a-slide-up-far" style={{ padding: '12px 16px', background: 'rgba(42,6,69,0.06)', borderRadius: 14, animationDelay: `${0.4 + i * 0.08}s` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: '#2a0645', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.author}</div>
                <div className="fs-display" style={{ fontSize: 18, fontWeight: 800, color: '#277da1' }}>{usr.messageCount.toLocaleString()}</div>
                <div className="fs-mono" style={{ fontSize: 12, color: 'rgba(42,6,69,0.55)', width: 46, textAlign: 'right' }}>{usr.sharePct.toFixed(1)}%</div>
              </div>
              <div className="fs-mono" style={{ marginTop: 4, fontSize: 11, color: 'rgba(42,6,69,0.6)' }}>
                {interp(t.pp_row, { words: usr.wordCount.toLocaleString(), avg: usr.avgWordsPerMsg.toFixed(1) })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlidePerPerson;
