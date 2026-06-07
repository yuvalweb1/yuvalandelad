// MedalCoin — minted-medallion visual: conic-gradient gold ring around a
// radial-gradient face (tinted by `accent`), the badge emoji centered, and a
// diagonal shine sweep. Shared by SlideAwards (grid of 6) and SlideDramaRole
// (single hero medal) so both "hardware, earned" moments feel like one family.
export default function MedalCoin({ accent, emoji, size = 92, emojiSize = 38, shineDur = 4, shineDelay = 0 }) {
  return (
    <div style={{
      position: 'relative', width: size, height: size, borderRadius: '50%',
      background: 'conic-gradient(from 135deg, #fbe08a, #f6b938, #fff0bf, #e8a417, #fbe08a)',
      padding: 5, flexShrink: 0,
      boxShadow: '0 10px 0 rgba(74,14,78,0.14), 0 18px 30px -8px rgba(224,168,0,0.5)',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: `radial-gradient(circle at 50% 38%, ${accent}26, ${accent}10 60%, #fff7e6)`,
        border: '2px solid rgba(255,255,255,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <span style={{ fontSize: emojiSize, lineHeight: 1, filter: 'drop-shadow(0 2px 3px rgba(74,14,78,0.18))' }}>
          {emoji}
        </span>
        <div className="a-coin-shine" aria-hidden="true" style={{
          position: 'absolute', top: 0, left: 0, width: size * 0.28, height: '160%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)',
          animationDuration: `${shineDur}s`, animationDelay: `${shineDelay}s`,
        }} />
      </div>
    </div>
  );
}
