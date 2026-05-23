import React from 'react';
import SlideShell from './SlideShell.jsx';
import AdSlot from '../components/AdSlot.jsx';

// Interstitial ad slide — only appears in the deck when ADS.slots.interstitial
// is on (Wrapped filters it out otherwise). Shows the real ad if configured,
// else a labelled placeholder.
const SlideAd = React.memo(function SlideAd({ t }) {
  return (
    <SlideShell bg="#577590" accent="#FFD700">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '24px',
      }}>
        <div className="fs-mono" style={{
          textAlign: 'center', fontSize: 11, color: 'rgba(74,14,78,0.5)',
          letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12,
        }}>
          {t.ad_label || 'Advertisement'}
        </div>
        <AdSlot slot="interstitial" format="rect" t={t} style={{ minHeight: 320 }} />
      </div>
    </SlideShell>
  );
})

export default SlideAd;
