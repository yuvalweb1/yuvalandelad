// ============================================================
// PremiumPromo — entry-time upsell modal. Shows on every app load for
// non-premium users (per product call: reminder, not cooldown). Within
// the same React session, dismissing keeps it closed; a refresh brings
// it back.
// ============================================================
import { useEffect } from 'react';
import { formatPrice } from '../lib/pricing.js';
import { interp } from '../i18n';

const BANANA   = '#FFD700';
const MANGO    = '#FF8C00';
const EGGPLANT = '#4A0E4E';
const MINT     = '#43AA8B';
const PINK     = '#FF69B4';
const ROSE     = '#F94144';
const DEEP_PINK = '#D63384';

/** Whether the entry promo should render for this user right now. */
export function shouldShowPromo(isPremium) {
  return !isPremium;
}

/** No-op kept for API parity with callers. The promo no longer persists
    a dismissal — we deliberately show it every entry. */
export function markPromoDismissed() {}

export default function PremiumPromo({ t, lang = 'en', onUpgrade, onDismiss }) {
  const priceLabel = formatPrice(lang);
  // ESC closes — keyboard parity with the X button.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const benefits = [
    t.promo_benefit_1 || 'No video ads, ever',
    t.promo_benefit_2 || 'No banner ads',
    t.promo_benefit_3 || 'Support the dev',
  ];

  return (
    <>
      {/* Backdrop — click outside dismisses */}
      <div
        onClick={onDismiss}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 70,
          animation: 'fadeIn 0.25s ease-out both',
        }}
      />

      {/* Modal — centered, animated entry */}
      <div role="dialog" aria-modal="true" aria-labelledby="promo-title"
        style={{
          position: 'absolute', insetInlineStart: 16, insetInlineEnd: 16,
          top: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 71, pointerEvents: 'none',
        }}>
        <div className="a-spring" style={{
          pointerEvents: 'auto',
          position: 'relative', overflow: 'hidden',
          width: '100%', maxWidth: 340,
          background: '#fff', borderRadius: 28,
          border: '3px solid rgba(255,255,255,0.95)',
          boxShadow: '0 24px 60px -8px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.30) inset',
        }}>
          {/* Close X */}
          <button
            onClick={onDismiss}
            aria-label={t.promo_close || 'Close'}
            style={{
              position: 'absolute', top: 12, insetInlineEnd: 12, zIndex: 2,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(74,14,78,0.10)', border: 'none',
              color: EGGPLANT, fontSize: 18, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: 0,
            }}>
            ×
          </button>

          {/* Gradient header with the diamond + title */}
          <div style={{
            background: `linear-gradient(135deg, ${BANANA} 0%, ${MANGO} 100%)`,
            padding: '32px 24px 24px', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
            <div aria-hidden="true" style={{
              fontSize: 68, lineHeight: 1, marginBottom: 6,
              filter: 'drop-shadow(0 8px 14px rgba(74,14,78,0.35))',
            }}>💎</div>
            <div id="promo-title" dir="auto" className="fs-display" style={{
              fontSize: 30, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.035em',
              textShadow: '0 2px 0 rgba(255,255,255,0.50)',
              lineHeight: 1.0,
            }}>
              {t.promo_title || 'Go Premium'}
            </div>
            <div dir="auto" className="fs-sans" style={{
              fontSize: 13, fontWeight: 700, color: EGGPLANT, marginTop: 6,
              opacity: 0.82, letterSpacing: '-0.01em',
            }}>
              {t.promo_subtitle || 'Skip every single ad'}
            </div>
          </div>

          {/* Benefits + CTAs */}
          <div style={{ padding: '20px 24px 22px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {benefits.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div aria-hidden="true" style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: `${MINT}1f`, border: `1.5px solid ${MINT}66`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: MINT, fontWeight: 800, flexShrink: 0,
                  }}>✓</div>
                  <div dir="auto" className="fs-sans" style={{
                    fontSize: 14, fontWeight: 700, color: EGGPLANT, letterSpacing: '-0.01em',
                  }}>{b}</div>
                </div>
              ))}
            </div>

            {/* Primary CTA */}
            <button onClick={onUpgrade} className="press lift" style={{
              width: '100%', padding: '15px 20px',
              background: `linear-gradient(135deg, ${PINK} 0%, ${ROSE} 100%)`,
              border: '2px solid rgba(255,255,255,0.85)',
              borderRadius: 16, cursor: 'pointer', color: '#fff',
              boxShadow: `0 6px 0 ${DEEP_PINK}55, 0 14px 26px -6px ${ROSE}77`,
            }}>
              <div className="fs-display" style={{
                fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em',
              }}>
                {interp(t.promo_cta || 'Upgrade · {price}', { price: priceLabel })} →
              </div>
            </button>

            {/* Stub-mode hint */}
            <div className="fs-mono" style={{
              marginTop: 8, textAlign: 'center',
              fontSize: 10, color: 'rgba(74,14,78,0.45)', letterSpacing: '0.06em',
            }}>
              {t.promo_stub_hint || 'Testing mode — payment not connected yet'}
            </div>

            {/* Secondary */}
            <button onClick={onDismiss} className="press" style={{
              width: '100%', marginTop: 8, padding: '10px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(74,14,78,0.55)', fontSize: 13, fontWeight: 600,
              letterSpacing: '-0.01em',
            }}>
              {t.promo_dismiss || 'Maybe later'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
