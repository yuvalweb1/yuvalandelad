import React from 'react';
import SlideShell from './SlideShell.jsx';
import { typedCopy } from '../i18n';

const SlideSignatureWords = React.memo(function SlideSignatureWords({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const rows = (a.users || []).filter(usr => usr.topWord);
  if (rows.length === 0) return null;
  return (
    <SlideShell bg="#577590" accent="#8338ec">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#8338ec', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{typedCopy(t, 'sw_eyebrow', type)}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16 }}>{typedCopy(t, 'sw_title', type)}</div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((usr, i) => (
            <div key={usr.author} dir="auto" className="a-slide-up-far" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(131,56,236,0.07)', borderRadius: 16, animationDelay: `${0.4 + i * 0.1}s` }}>
              <div className="fs-sans" style={{ width: '34%', flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'rgba(42,6,69,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.author}</div>
              <div className="fs-display" style={{ flex: 1, minWidth: 0, fontSize: usr.topWord.length > 10 ? 18 : 24, fontStyle: 'italic', fontWeight: 700, color: '#8338ec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{usr.topWord}"</div>
              <div className="fs-mono" style={{ flexShrink: 0, fontSize: 12, color: 'rgba(42,6,69,0.5)' }}>{usr.topWordCount}×</div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideSignatureWords;
