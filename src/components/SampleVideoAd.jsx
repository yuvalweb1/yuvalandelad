// ============================================================
// SampleVideoAd — a fake "PizzaPop!" promo used as the demo ad
// when no real ad provider is wired into ADS.render. 100% local
// (CSS animation, no network call) so it respects the privacy claim.
// Marked "SAMPLE AD" in the corner so devs/users see it's a stand-in.
//
// onEnded: optional. Called after a simulated playback duration so
// the host VideoAdSlot can auto-advance to the next stage.
// ============================================================
import { useEffect } from 'react';

const AD_DURATION_MS = 10000; // simulated "video" length

export default function SampleVideoAd({ onEnded }) {
  // Simulate a video that ends after AD_DURATION_MS. Real renderers would
  // listen to the actual <video> onended event instead.
  useEffect(() => {
    if (!onEnded) return;
    const id = setTimeout(() => onEnded(), AD_DURATION_MS);
    return () => clearTimeout(id);
  }, [onEnded]);

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: 'linear-gradient(135deg, #FF6B35 0%, #F7C548 45%, #FF1867 100%)',
      backgroundSize: '220% 220%',
      animation: 'sample-gradient 5s ease-in-out infinite',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 18, padding: '60px 30px 40px', textAlign: 'center',
    }}>
      <style>{`
        @keyframes sample-gradient { 0%,100% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } }
        @keyframes sample-spin   { 0%,100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
        @keyframes sample-bob    { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes sample-pulse  { 0%,100% { box-shadow: 0 8px 24px rgba(255,255,255,0.4), 0 0 0 0 rgba(255,255,255,0.5); } 50% { box-shadow: 0 12px 32px rgba(255,255,255,0.6), 0 0 0 12px rgba(255,255,255,0); } }
        @keyframes sample-float-a { 0%,100% { transform: translate(0,0) rotate(0); } 50% { transform: translate(8px,-10px) rotate(15deg); } }
        @keyframes sample-float-b { 0%,100% { transform: translate(0,0) rotate(0); } 50% { transform: translate(-10px,12px) rotate(-12deg); } }
        .sample-pizza { animation: sample-spin 3.4s ease-in-out infinite, sample-bob 2.1s ease-in-out infinite; }
        .sample-cta   { animation: sample-pulse 2s ease-in-out infinite; }
        .sample-deco-a { animation: sample-float-a 4s ease-in-out infinite; }
        .sample-deco-b { animation: sample-float-b 3.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sample-pizza, .sample-cta, .sample-deco-a, .sample-deco-b { animation: none !important; }
        }
      `}</style>

      {/* "SAMPLE AD" corner tag — makes it clear this is a placeholder/demo. */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 14, insetInlineStart: 14,
        background: 'rgba(0,0,0,0.55)', color: '#fff',
        padding: '4px 10px', borderRadius: 6,
        fontSize: 9, letterSpacing: '0.22em', fontWeight: 800,
        fontFamily: '"DM Mono", ui-monospace, monospace',
      }}>SAMPLE AD</div>

      {/* Floating decoration emojis */}
      <span aria-hidden="true" className="sample-deco-a" style={{
        position: 'absolute', top: 90, insetInlineStart: 28, fontSize: 36,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))',
      }}>🧀</span>
      <span aria-hidden="true" className="sample-deco-b" style={{
        position: 'absolute', top: 130, insetInlineEnd: 26, fontSize: 32,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))',
      }}>🍅</span>
      <span aria-hidden="true" className="sample-deco-a" style={{
        position: 'absolute', bottom: 110, insetInlineEnd: 32, fontSize: 30,
        animationDelay: '0.5s',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))',
      }}>🌶️</span>
      <span aria-hidden="true" className="sample-deco-b" style={{
        position: 'absolute', bottom: 140, insetInlineStart: 30, fontSize: 28,
        animationDelay: '0.8s',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))',
      }}>✨</span>

      {/* Giant pizza hero */}
      <div className="sample-pizza" aria-hidden="true" style={{
        fontSize: 130, lineHeight: 1,
        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.35))',
      }}>🍕</div>

      {/* Brand */}
      <div className="fs-display" style={{
        fontSize: 56, fontWeight: 900, color: '#fff', letterSpacing: '-0.045em',
        textShadow: '0 4px 0 rgba(0,0,0,0.22), 0 10px 28px rgba(0,0,0,0.35)',
        fontStyle: 'italic', lineHeight: 1,
      }}>PizzaPop!</div>

      {/* Tagline */}
      <div className="fs-sans" style={{
        fontSize: 17, fontWeight: 700, color: '#fff',
        letterSpacing: '0.01em', opacity: 0.96,
        textShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}>
        20% off your first order 🎉
      </div>

      {/* Decorative CTA — does nothing, the real action is the Skip button
          rendered by VideoAdSlot above this content. */}
      <div className="sample-cta" style={{
        marginTop: 8, padding: '14px 30px', borderRadius: 999,
        background: '#fff', color: '#FF1867',
        fontSize: 16, fontWeight: 900, letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}>
        Order Now →
      </div>
    </div>
  );
}
