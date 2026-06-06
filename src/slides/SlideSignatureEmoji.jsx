import React, { useState } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { typedCopy } from '../i18n';

const MAX_ROWS = 5;

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

  const medals = ['🥇', '🥈', '🥉'];
  const DEEP = '#C25516';

  const renderRow = (u, i, opts = {}) => {
    const isWinner = i === 0;
    return (
      <div key={u.author} dir="auto" className="a-slide-up-far" style={{
        position: 'relative', padding: '14px 16px',
        background: isWinner ? '#FFF8E0' : '#fff',
        borderRadius: 18,
        border: `2px solid ${isWinner ? '#FFD700' : 'rgba(255,255,255,0.85)'}`,
        boxShadow: `0 6px 0 ${DEEP}22, 0 14px 24px -8px ${DEEP}55`,
        overflow: 'hidden', flexShrink: 0,
        animationDelay: `${0.4 + i * 0.08}s`,
      }}>
        <div className="a-slide-right" style={{
          position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
          background: `linear-gradient(90deg, ${isWinner ? 'rgba(255,215,0,0.28)' : 'rgba(249,65,68,0.16)'} 0%, rgba(249,65,68,0.02) 100%)`,
          width: `${Math.max(8, Math.round((u.topEmojiCount / (allRows[0]?.topEmojiCount || 1)) * 100))}%`,
          animationDelay: `${0.6 + i * 0.08}s`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          {/* Count on left */}
          <div className="fs-display" style={{
            flexShrink: 0,
            fontSize: 28,
            fontWeight: 800,
            color: '#f94144',
            minWidth: 40,
            textAlign: 'center',
          }}>
            {u.topEmojiCount.toLocaleString()}
          </div>

          {/* Name in middle */}
          <div className="fs-sans" style={{
            flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#4A0E4E',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            paddingRight: 8,
          }}>
            {u.author}
          </div>

          {/* Emoji on right */}
          <div style={{
            flexShrink: 0,
            fontSize: 28,
            lineHeight: 1,
            textAlign: 'center',
            minWidth: 32,
          }}>
            {u.topEmoji}
          </div>
        </div>
      </div>
    );
  };

  return (
    <SlideShell bg="#f94144" accent="#f94144">
      <ListSlideDecor emojis={['😊', '🎉', '💎', '✨', '🌟']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 13, color: '#f94144', letterSpacing: '0.18em',
          fontWeight: 800, textTransform: 'uppercase',
        }}>
          😊 {eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 36, lineHeight: 1.08, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 16,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
        }}>
          {title}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
          {rows.map((u, i) => renderRow(u, i))}
          {showOverflow && !expanded && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: '#f94144',
              fontWeight: 700, letterSpacing: '0.12em', padding: '6px 0', width: '100%',
              animationDelay: `${0.4 + MAX_ROWS * 0.08}s`,
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
