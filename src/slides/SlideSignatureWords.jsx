import React from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { typedCopy } from '../i18n';

const SlideSignatureWords = React.memo(function SlideSignatureWords({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const rows = (a.users || []).filter(usr => usr.topWord);
  if (rows.length === 0) return null;
  const DEEP = '#6624B0';
  return (
    <SlideShell bg="#577590" accent="#8338ec">
      <ListSlideDecor emojis={['💭', '✏️', '🗨️', '✨', '📝', '🔤']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 13, color: '#8338ec', letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          💭 {typedCopy(t, 'sw_eyebrow', type)}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 38, lineHeight: 1.08, letterSpacing: '-0.04em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 20,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
        }}>
          {typedCopy(t, 'sw_title', type)}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((usr, i) => (
            <div key={usr.author} dir="auto" className="a-slide-up-far" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px',
              background: '#fff',
              borderRadius: 22,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: `0 6px 0 ${DEEP}22, 0 14px 24px -8px ${DEEP}55`,
              animationDelay: `${0.4 + i * 0.1}s`,
            }}>
              <div className="fs-sans" style={{ width: '34%', flexShrink: 0, fontSize: 14, fontWeight: 700, color: 'rgba(74,14,78,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.author}</div>
              <div className="fs-display" style={{ flex: 1, minWidth: 0, fontSize: usr.topWord.length > 10 ? 18 : 24, fontStyle: 'italic', fontWeight: 800, color: '#8338ec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{usr.topWord}"</div>
              <div className="fs-mono" style={{ flexShrink: 0, fontSize: 12, color: 'rgba(74,14,78,0.55)', fontWeight: 600 }}>{usr.topWordCount}×</div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideSignatureWords;
