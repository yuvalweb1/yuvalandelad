// ============================================================
// ListSlideDecor — Ultra-Pop background layer for list-style slides.
// Mirrors the home screen's vibe (gradient blobs + floating emoji
// stickers) so participant-list slides feel as alive as the landing.
// Stickers are concentrated above the title and below the last card so
// they actually show through (the white sticker rows otherwise hide
// anything behind them).
// ============================================================

// Positions chosen to sit in the empty bands around the card column
// (top header area + bottom margin), not behind the cards.
const POSITIONS = [
  // top cluster — around the eyebrow/title
  { top: 42,  insetInlineStart: 14, rot: -18, size: 38, delay: '0s'   },
  { top: 70,  insetInlineEnd:   18, rot:  14, size: 32, delay: '0.6s' },
  { top: 118, insetInlineStart: '24%', rot: -8, size: 26, delay: '1.0s' },
  { top: 140, insetInlineEnd:   '22%', rot: 10, size: 28, delay: '0.4s' },
  // bottom cluster — below the last visible card
  { bottom: 16, insetInlineStart: 22, rot:  6,  size: 36, delay: '1.4s' },
  { bottom: 38, insetInlineEnd:   28, rot: -12, size: 32, delay: '0.3s' },
  { bottom: 80, insetInlineStart: '38%', rot: 8, size: 28, delay: '0.9s' },
  { bottom: 60, insetInlineEnd:   '8%',  rot: -6, size: 24, delay: '1.7s' },
  { bottom: 130, insetInlineStart: 16, rot: 12, size: 22, delay: '0.7s' },
];

export default function ListSlideDecor({ emojis = ['✨', '🎉', '💬', '🔥'] }) {
  // Cycle the provided list to fill all positions — gives variety with a
  // small per-slide emoji set.
  const stickers = POSITIONS.map((p, i) => ({ ...p, e: emojis[i % emojis.length] }));

  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', zIndex: 0,
    }}>
      {/* gradient blobs — Ultra-Pop palette */}
      <div style={{ position: 'absolute', top: -70, insetInlineStart: -80, width: 240, height: 240, borderRadius: '50%', background: '#FFD700', opacity: 0.5,  filter: 'blur(72px)' }} />
      <div style={{ position: 'absolute', top: 40,  insetInlineEnd:   -70, width: 200, height: 200, borderRadius: '50%', background: '#FF69B4', opacity: 0.38, filter: 'blur(70px)' }} />
      <div style={{ position: 'absolute', bottom: -50, insetInlineEnd:   -50, width: 220, height: 220, borderRadius: '50%', background: '#00BFFF', opacity: 0.42, filter: 'blur(68px)' }} />
      <div style={{ position: 'absolute', bottom: 80,  insetInlineStart: -60, width: 190, height: 190, borderRadius: '50%', background: '#FF8C00', opacity: 0.34, filter: 'blur(62px)' }} />

      {/* floating chat bubble */}
      <div className="a-float" style={{
        position: 'absolute', top: 96, insetInlineEnd: 14,
        width: 50, height: 32, background: '#fff',
        borderRadius: '16px 16px 4px 16px', boxShadow: '0 8px 18px rgba(74,14,78,0.16)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        animationDelay: '0.5s',
      }}>
        {[0, 1, 2].map(d => <span key={d} style={{ width: 5, height: 5, borderRadius: 999, background: '#FF69B4' }} />)}
      </div>

      {/* emoji stickers — concentrated above & below the card column */}
      {stickers.map((p, i) => (
        <span key={i} className="a-float" style={{
          position: 'absolute',
          top: p.top, bottom: p.bottom,
          insetInlineStart: p.insetInlineStart, insetInlineEnd: p.insetInlineEnd,
          fontSize: p.size, transform: `rotate(${p.rot}deg)`,
          filter: 'drop-shadow(0 4px 6px rgba(74,14,78,0.32))',
          animationDelay: p.delay,
        }}>{p.e}</span>
      ))}
    </div>
  );
}
