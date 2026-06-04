import React from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { interp, typedCopy } from '../i18n';

const SlideGroupTop = React.memo(function SlideGroupTop({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const word = (a.topWordsGroup && a.topWordsGroup[0]) || null;
  const emoji = (a.topEmojisGroup && a.topEmojisGroup[0]) || null;
  if (!word && !emoji) return null;
  return (
    <SlideShell bg="#f9c74f" accent="#FFD700">
      <ListSlideDecor emojis={['💬', '🗨️', '✨', '💭', '🎉', '⭐']} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        textAlign: 'center', padding: '72px 24px 0', gap: 8,
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 13, color: '#f3722c', letterSpacing: '0.2em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          💬 {typedCopy(t, 'gt_eyebrow', type)}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.1s',
          fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0,
          color: '#2a0645',
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
        }}>
          {t.gt_title || 'Most Used'}
        </div>

        {emoji && (
          <div className="a-spring" style={{ animationDelay: '0.25s', marginTop: 40 }}>
            {/* big emoji in a tilted white sticker badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 130, height: 130, borderRadius: 32,
              background: '#fff',
              border: '3px solid rgba(255,255,255,0.9)',
              boxShadow: '0 8px 0 rgba(224,168,0,0.30), 0 18px 32px -8px rgba(74,14,78,0.35)',
              transform: 'rotate(-3deg)',
              fontSize: 84, lineHeight: 1,
            }}>{emoji.emoji}</div>
            <div className="fs-mono" style={{ marginTop: 10, fontSize: 13, color: 'rgba(74,14,78,0.7)', fontWeight: 700 }}>
              {interp(t.gt_emoji, { n: emoji.count.toLocaleString() })}
            </div>
          </div>
        )}

        {word && (
          <div className="a-fade-up" style={{ animationDelay: '0.7s', marginTop: 24 }}>
            {/* word in a sticker quote card */}
            <div dir="auto" style={{
              display: 'inline-block',
              padding: '14px 22px',
              background: '#fff', borderRadius: 22,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: '0 6px 0 rgba(102,36,176,0.22), 0 14px 26px -8px rgba(102,36,176,0.45)',
              transform: 'rotate(2deg)',
              maxWidth: '92%',
            }}>
              <div className="fs-display" style={{
                fontSize: word.word.length > 10 ? 32 : 44,
                fontStyle: 'italic', fontWeight: 800, color: '#8338ec',
                letterSpacing: '-0.03em', lineHeight: 1.05, wordBreak: 'break-word',
              }}>
                "{word.word}"
              </div>
            </div>
            <div className="fs-mono" style={{ marginTop: 10, fontSize: 13, color: 'rgba(74,14,78,0.7)', fontWeight: 700 }}>
              {interp(t.gt_word, { n: word.count.toLocaleString() })}
            </div>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

export default SlideGroupTop;
