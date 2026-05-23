import React from 'react';
import SlideShell from './SlideShell.jsx';
import { interp } from '../i18n';

const SlideGroupTop = React.memo(function SlideGroupTop({ a, t }) {
  const word = (a.topWordsGroup && a.topWordsGroup[0]) || null;
  const emoji = (a.topEmojisGroup && a.topEmojisGroup[0]) || null;
  if (!word && !emoji) return null;
  return (
    <SlideShell bg="#f9c74f" accent="#f9c74f">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', padding: '0 24px', gap: 8 }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f3722c', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.gt_eyebrow}</div>
        {emoji && (
          <div className="a-spring" style={{ animationDelay: '0.2s', marginTop: 16 }}>
            <div style={{ fontSize: 84, lineHeight: 1 }}>{emoji.emoji}</div>
            <div className="fs-mono" style={{ marginTop: 4, fontSize: 13, color: 'rgba(42,6,69,0.6)' }}>{interp(t.gt_emoji, { n: emoji.count.toLocaleString() })}</div>
          </div>
        )}
        {word && (
          <div className="a-fade-up" style={{ animationDelay: '0.7s', marginTop: 24 }}>
            <div className="fs-display" dir="auto" style={{ fontSize: word.word.length > 10 ? 34 : 46, fontStyle: 'italic', fontWeight: 800, color: '#2a0645', letterSpacing: '-0.03em', lineHeight: 1.05, wordBreak: 'break-word' }}>"{word.word}"</div>
            <div className="fs-mono" style={{ marginTop: 8, fontSize: 13, color: 'rgba(42,6,69,0.6)' }}>{interp(t.gt_word, { n: word.count.toLocaleString() })}</div>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

export default SlideGroupTop;
