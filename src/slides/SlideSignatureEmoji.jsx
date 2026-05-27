import React, { useState } from 'react';
import SlideShell from './SlideShell.jsx';
import { typedCopy } from '../i18n';

const MAX_ROWS = 7;

const SlideSignatureEmoji = React.memo(function SlideSignatureEmoji({ a, t, profile }) {
  const allRows = (a.users || []).filter(u => u.topEmoji);
  if (allRows.length === 0) return null;
  const [expanded, setExpanded] = useState(false);
  const overflow = allRows.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const rows = showOverflow ? allRows.slice(0, MAX_ROWS) : allRows;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);

  const type = profile?.relationship || 'other';
  const eyebrow = typedCopy(t, 'se_eyebrow', type);
  const title = typedCopy(t, 'se_title', type);

  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#f94144', letterSpacing: '0.15em',
          fontWeight: 500, textTransform: 'uppercase',
        }}>
          {eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16,
          padding: '0 8px',
        }}>
          {title}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((u, i) => (
            <div key={u.author} dir="auto" className="a-slide-up-far" style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 16px',
              background: i === 0 ? 'rgba(249,65,68,0.12)' : 'rgba(42,6,69,0.06)',
              borderRadius: 16,
              flexShrink: 0,
              animationDelay: `${0.4 + i * 0.08}s`,
            }}>
              <div className="fs-sans" style={{
                flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#2a0645',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {u.author}
              </div>
              <div style={{
                fontSize: 36, lineHeight: 1, flexShrink: 0,
              }}>
                {u.topEmoji}
              </div>
              <div className="fs-mono" style={{
                flexShrink: 0, fontSize: 13, fontWeight: 700,
                color: 'rgba(42,6,69,0.55)', minWidth: 44, textAlign: 'right',
              }}>
                {u.topEmojiCount.toLocaleString()}×
              </div>
            </div>
          ))}
          {showOverflow && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: '#f94144',
              fontWeight: 700, letterSpacing: '0.12em', padding: '6px 0', width: '100%',
            }}>
              {moreLabel} ↓
            </button>
          )}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideSignatureEmoji;
