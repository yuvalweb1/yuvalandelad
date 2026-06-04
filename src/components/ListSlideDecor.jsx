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
// Top cluster: 3 (was 4) — free to appear anywhere, just fewer of them.
const POSITIONS = [
  // Negative delays pre-phase each emoji mid-cycle so they're already floating on mount.
  // floatUp is 2.8s; visible window is ~0.6s–2.2s in → use delays -0.6s to -2.1s.
  { top: 46,  insetInlineStart: 14, rot: -20, size: 22, delay: '-0.7s' },
  { top: 80,  insetInlineEnd:   16, rot:  16, size: 18, delay: '-1.5s' },
  { top: 155, insetInlineStart: '26%', rot: -8, size: 18, delay: '-2.0s' },
  // bottom cluster
  { bottom: 16, insetInlineStart: 16, rot:  6,  size: 26, delay: '-1.1s' },
  { bottom: 42, insetInlineEnd:   22, rot: -14, size: 22, delay: '-0.8s' },
  { bottom: 84, insetInlineStart: '38%', rot: 8, size: 18, delay: '-1.8s' },
  { bottom: 60, insetInlineEnd:   '7%',  rot: -7, size: 16, delay: '-1.3s' },
  { bottom: 130, insetInlineStart: 12, rot: 14, size: 16, delay: '-0.6s' },
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
      <div style={{ position: 'absolute', top: -70, insetInlineStart: -80, width: 240, height: 240, borderRadius: '50%', background: '#FFD700', opacity: 0.38, filter: 'blur(72px)' }} />
      <div style={{ position: 'absolute', top: 40,  insetInlineEnd:   -70, width: 200, height: 200, borderRadius: '50%', background: '#FF69B4', opacity: 0.28, filter: 'blur(70px)' }} />
      <div style={{ position: 'absolute', bottom: -50, insetInlineEnd:   -50, width: 220, height: 220, borderRadius: '50%', background: '#00BFFF', opacity: 0.32, filter: 'blur(68px)' }} />
      <div style={{ position: 'absolute', bottom: 80,  insetInlineStart: -60, width: 190, height: 190, borderRadius: '50%', background: '#FF8C00', opacity: 0.25, filter: 'blur(62px)' }} />

      {/* floating decorations — capped at 0.6 opacity so they don't compete with content */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }}>
        {/* floating chat bubble */}
        <div className="a-float" style={{
          position: 'absolute', top: 96, insetInlineEnd: 14,
          width: 44, height: 28, background: '#fff',
          borderRadius: '14px 14px 4px 14px', boxShadow: '0 6px 14px rgba(74,14,78,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          animationDelay: '-1.2s',
        }}>
          {[0, 1, 2].map(d => <span key={d} style={{ width: 4, height: 4, borderRadius: 999, background: '#FF69B4' }} />)}
        </div>

        {/* emoji stickers — rotation on outer div so the float animation can't override it */}
        {stickers.map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: p.top, bottom: p.bottom,
            insetInlineStart: p.insetInlineStart, insetInlineEnd: p.insetInlineEnd,
            fontSize: p.size, transform: `rotate(${p.rot}deg)`,
            filter: 'drop-shadow(0 3px 5px rgba(74,14,78,0.22))',
          }}>
            <span className="a-float" style={{ display: 'block', animationDelay: p.delay }}>{p.e}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
