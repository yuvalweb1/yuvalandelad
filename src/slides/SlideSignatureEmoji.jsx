import React, { useState } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { typedCopy, isRtlText } from '../i18n';

const MAX_ROWS = 5;
const ACCENT = '#f94144';

const SlideSignatureEmoji = React.memo(function SlideSignatureEmoji({ a, t, profile, lang }) {
  // Only people with a real signature emoji. Users whose only "emoji" was
  // a lone symbol (now filtered out in the parser) have topEmoji === null,
  // and showing them rendered an empty/tofu box, so drop them here.
  const allRows = (a.users || []).filter(u => u.topEmoji && u.topEmojiCount > 0);
  if (allRows.length === 0) return null;
  const maxTopEmojiCount = Math.max(1, ...allRows.map(u => u.topEmojiCount || 0));
  const [expanded, setExpanded] = useState(false);
  const overflow = allRows.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const rows = showOverflow ? allRows.slice(0, MAX_ROWS) : allRows;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);

  const type = profile?.relationship || 'other';
  const eyebrow = typedCopy(t, 'se_eyebrow', type);
  const title = typedCopy(t, 'se_title', type);
  const DEEP = '#C25516';

  const renderRow = (u, i) => {
    const isWinner = i === 0;
    // Layout is driven by the *name's* direction only — the app locale is
    // irrelevant. LTR name → name on the left, count + emoji on the right.
    // RTL name → name on the right, count + emoji on the left.
    const nameLtr = !isRtlText(u.author);

    const valueEl = (
      <div className="fs-display" style={{ flexShrink: 0, fontSize: 28, fontWeight: 800, color: ACCENT }}>
        {u.topEmojiCount.toLocaleString()}
      </div>
    );

    const emojiEl = (
      <div style={{ flexShrink: 0, fontSize: 30, lineHeight: 1, minWidth: 36, textAlign: 'center' }}>
        {u.topEmoji}
      </div>
    );

    // count + emoji kept together; emoji sits on the card's outer edge.
    // direction:'ltr' forces row/row-reverse to be physical (left↔right),
    // unaffected by the ambient RTL UI direction in Hebrew/Arabic decks.
    const endGroup = (
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
        direction: 'ltr',
        flexDirection: nameLtr ? 'row' : 'row-reverse',
      }}>
        {valueEl}
        {emojiEl}
      </div>
    );

    const name = (
      <div className="fs-sans" dir={nameLtr ? 'ltr' : 'rtl'} style={{
        flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#4A0E4E',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: nameLtr ? 'left' : 'right',
        paddingInline: 10,
      }}>
        {u.author}
      </div>
    );

    return (
      <div key={u.author} className="a-slide-up-far" style={{
        position: 'relative', padding: '12px 16px',
        background: isWinner ? '#FFF8E0' : '#fff',
        borderRadius: 18,
        border: `2px solid ${isWinner ? '#FFD700' : 'rgba(255,255,255,0.85)'}`,
        boxShadow: `0 6px 0 ${DEEP}22, 0 14px 24px -8px ${DEEP}55`,
        overflow: 'hidden', flexShrink: 0,
        animationDelay: `${0.4 + i * 0.08}s`,
      }}>
        {/* bar fill anchored to the count/emoji side of the card */}
        <div className="a-slide-right" style={{
          position: 'absolute', top: 0, bottom: 0,
          [nameLtr ? 'right' : 'left']: 0,
          background: isWinner ? 'rgba(255,215,0,0.28)' : 'rgba(249,65,68,0.16)',
          width: `${Math.max(8, Math.round((u.topEmojiCount / maxTopEmojiCount) * 100))}%`,
          animationDelay: `${0.6 + i * 0.08}s`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          direction: 'ltr',
          flexDirection: nameLtr ? 'row' : 'row-reverse',
        }}>
          {name}
          {endGroup}
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
