// ============================================================
// VideoAdSlot — full-screen video ad placement (pre-roll style).
// ------------------------------------------------------------
// Used between major stages (pre_wrapped: before slides start;
// pre_menu: after slides, before PostMenu). Privacy-safe by default:
// renders a black "Your video ad here" placeholder unless ADS.render
// returns a real <video>. The skip button activates after the slot's
// configured countdown (see ADS.skipAfter in src/lib/ads.js).
//
//   <VideoAdSlot slot="pre_wrapped" t={t} onComplete={() => setStage('wrapped')} />
//
// Only mount when `adEnabled(slot)` is true — the component does not
// short-circuit when the slot is off, so the parent must gate it.
// ============================================================
import { useState, useEffect } from 'react';
import { ADS } from '../lib/ads.js';
import { interp } from '../i18n';
import SampleVideoAd from './SampleVideoAd.jsx';

export default function VideoAdSlot({ slot, t, onComplete }) {
  const duration = (ADS.skipAfter && ADS.skipAfter[slot]) ?? 5;
  const [remaining, setRemaining] = useState(duration);

  // Countdown — ticks once per second until 0.
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  // Real ad (a <video> element from ADS.render) wins; otherwise placeholder.
  // We pass an `onEnded` hook through props so a real ad can call onComplete
  // when its video finishes — but the renderer can also ignore it.
  const real = typeof ADS.render === 'function'
    ? ADS.render({ slot, format: 'video', onEnded: onComplete })
    : null;

  const canSkip = remaining <= 0;

  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#000',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Ad label badge — top-start corner */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 14, insetInlineStart: 14, zIndex: 3,
        background: 'rgba(255,255,255,0.92)', color: '#000',
        padding: '4px 10px', borderRadius: 6,
        fontSize: 10, letterSpacing: '0.18em',
        fontWeight: 800, textTransform: 'uppercase',
        fontFamily: '"DM Mono", ui-monospace, monospace',
      }}>
        {(t && t.ad_label) || 'Ad'}
      </div>

      {/* Skip / countdown — top-end corner */}
      <button
        onClick={canSkip ? onComplete : undefined}
        disabled={!canSkip}
        aria-label={canSkip ? (t && t.ad_skip) || 'Skip ad' : undefined}
        style={{
          position: 'absolute', top: 14, insetInlineEnd: 14, zIndex: 3,
          background: canSkip ? '#fff' : 'rgba(255,255,255,0.18)',
          color: canSkip ? '#000' : 'rgba(255,255,255,0.85)',
          padding: '8px 14px', borderRadius: 999,
          border: 'none', fontSize: 12, fontWeight: 800,
          cursor: canSkip ? 'pointer' : 'default',
          letterSpacing: '0.04em',
          fontFamily: '"DM Mono", ui-monospace, monospace',
          minWidth: 96, textAlign: 'center',
          transition: 'background 0.18s ease, color 0.18s ease',
        }}
      >
        {canSkip
          ? `${(t && t.ad_skip) || 'Skip ad'} →`
          : interp((t && t.ad_skip_in) || 'Skip in {s}s', { s: remaining })}
      </button>

      {/* Content — real ad if provider returned one, otherwise the bundled
          SampleVideoAd demo. The host SampleVideoAd will auto-call onComplete
          after its simulated playback finishes. */}
      <div style={{ flex: 1, position: 'relative' }}>
        {real || <SampleVideoAd onEnded={onComplete} />}
      </div>
    </div>
  );
}
