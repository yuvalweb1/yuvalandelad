import React from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { interp } from '../i18n';

// Top stickers used in the chat — already deduped & ranked by repeat count
// (see readZipBundle → sticker hash-dedup).
const SlideStickers = React.memo(function SlideStickers({ a, t }) {
  const all = a.stickers || [];
  if (all.length === 0) return null;
  const tilts = [-4, 3, -2, 4, -3, 2, -4, 3, -1, 2, -3, 4];
  const totalUses = all.reduce((s, x) => s + (x.count || 1), 0);
  return (
    <SlideShell bg="#577590" accent="#FF69B4">
      <ListSlideDecor emojis={['🤪', '😎', '🥹', '✨', '💫', '🎉']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 13, color: '#FF69B4', letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          🤪 {t.stk_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 44, lineHeight: 1.04, letterSpacing: '-0.04em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 4,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
        }}>
          {interp(t.stk_title, { n: totalUses.toLocaleString() })}
        </div>
        <div className="fs-mono a-fade-up" style={{ textAlign: 'center', animationDelay: '0.22s', fontSize: 12, color: 'rgba(74,14,78,0.6)', marginBottom: 14, fontWeight: 600 }}>
          {t.stk_sub}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, paddingBottom: 12 }}>
            {all.map((s, i) => (
              <div key={s.url} className="a-spring" style={{
                position: 'relative', aspectRatio: '1 / 1', borderRadius: 14, overflow: 'visible',
                background: '#fff', padding: 6, transform: `rotate(${tilts[i % tilts.length]}deg)`,
                boxShadow: '0 5px 0 rgba(214,51,132,0.22), 0 12px 22px -6px rgba(214,51,132,0.4)',
                border: '2px solid rgba(255,255,255,0.85)',
                animationDelay: `${0.3 + Math.min(i, 11) * 0.06}s`,
              }}>
                <img src={s.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                {(s.count || 1) > 1 && (
                  <div style={{
                    position: 'absolute', top: -6, insetInlineEnd: -6,
                    minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999,
                    background: '#FF69B4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, boxShadow: '0 2px 0 #D63384',
                  }}>×{s.count}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideStickers;
