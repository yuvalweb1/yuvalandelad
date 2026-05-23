// ============================================================
// AdSlot — a reusable, privacy-safe ad placement.
// ------------------------------------------------------------
// Renders the real ad if one is provided (via `children` or ADS.render),
// otherwise a clearly-labelled placeholder so you can see where ads go.
// Renders nothing when the slot/master switch is off. No network by itself.
//
//   <AdSlot slot="menu" format="banner" t={t} />
//   <AdSlot slot="menu" t={t}><a href="…"><img src="…" /></a></AdSlot>
// ============================================================
import { ADS, adEnabled } from '../lib/ads.js';

const MIN_HEIGHT = { banner: 64, large: 110, rect: 250 };

export default function AdSlot({ slot = 'generic', format = 'banner', t, children, style }) {
  if (!adEnabled(slot)) return null;

  // Real ad: explicit children win, else the config render hook.
  const real = children != null
    ? children
    : (typeof ADS.render === 'function' ? ADS.render({ slot, format }) : null);

  if (real) {
    return <div data-ad-slot={slot} style={{ width: '100%', ...style }}>{real}</div>;
  }

  // Placeholder — shows where the ad will appear, no network call.
  return (
    <div
      data-ad-slot={slot}
      role="complementary"
      aria-label={(t && t.ad_label) || 'Advertisement'}
      style={{
        width: '100%', minHeight: MIN_HEIGHT[format] || MIN_HEIGHT.banner,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
        borderRadius: 14, border: '1.5px dashed rgba(74,14,78,0.28)',
        background: 'repeating-linear-gradient(45deg, rgba(74,14,78,0.03) 0 10px, rgba(74,14,78,0.06) 10px 20px)',
        color: 'rgba(74,14,78,0.55)', textAlign: 'center', padding: 12,
        ...style,
      }}
    >
      <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase' }}>
        {(t && t.ad_label) || 'Ad'}
      </div>
      <div className="fs-sans" style={{ fontSize: 12, opacity: 0.85 }}>
        {(t && t.ad_placeholder) || 'Your ad here'}
      </div>
    </div>
  );
}
