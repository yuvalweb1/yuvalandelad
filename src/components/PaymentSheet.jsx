// ============================================================
// PaymentSheet — stub payment UI for the Premium upgrade flow.
//
//   IMPORTANT: This component does NOT process real payments. No
//   backend is wired, no PCI-compliant tokenizer is in place. The
//   "Pay" button just flips isPremium=true locally. Card details
//   live in component state only and are never transmitted.
//   Connecting a real provider (Lemon Squeezy / Stripe / Tranzila)
//   would replace `simulatePay()` and the form fields with the
//   provider's hosted checkout iframe.
//
// Surfaces three method tabs (Bit / Visa / generic credit card),
// a discount-code field (ELLA20 → 20% off), and the testing-mode
// notice. Visa and Credit card share the same form — the tab just
// changes the header copy.
// ============================================================
import { useState } from 'react';
import { interp } from '../i18n';

const EGGPLANT = '#4A0E4E';
const PLUM     = '#2a0645';
const CORAL    = '#f06449';
const GOLD     = '#FFD700';
const MUTED    = 'rgba(74,14,78,0.55)';
const BORDER   = 'rgba(74,14,78,0.12)';

// Hardcoded discount codes. When a real provider is wired this should
// move to a server-validated coupon lookup.
const DISCOUNT_CODES = {
  ELLA20: 20,
};

const BASE_PRICE_ILS = 15;

function formatPrice(amount) {
  // Always shows ₪ prefix — sign + price is parsed by the eye
  // regardless of UI direction. Drops the .00 for round numbers.
  const fixed = Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
  return `₪${fixed}`;
}

function Tab({ id, label, emoji, active, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="press"
      style={{
        flex: 1, padding: '11px 8px',
        background: active ? '#fff' : 'transparent',
        border: active ? `1.5px solid ${BORDER}` : '1.5px solid transparent',
        borderRadius: 14, cursor: 'pointer',
        color: active ? EGGPLANT : MUTED,
        fontWeight: 700, fontSize: 13,
        fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        boxShadow: active ? '0 2px 0 rgba(74,14,78,0.08)' : 'none',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
      {label}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', maxLength, inputMode, autoComplete }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span className="fs-mono" style={{
        fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: MUTED, fontWeight: 700,
      }}>{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{
          appearance: 'none', width: '100%', padding: '12px 14px',
          background: '#fff', border: `1.5px solid ${BORDER}`,
          borderRadius: 12, color: EGGPLANT,
          fontSize: 15, fontFamily: 'inherit', fontWeight: 600,
          outline: 'none',
        }}
        onFocus={(e) => { e.target.style.borderColor = CORAL; }}
        onBlur={(e)  => { e.target.style.borderColor = BORDER; }}
      />
    </label>
  );
}

export default function PaymentSheet({ t, onClose, onSuccess }) {
  const [method, setMethod] = useState('bit');
  const [code, setCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [codeError, setCodeError] = useState(false);
  const [phone, setPhone] = useState('');
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [success, setSuccess] = useState(false);

  const price = BASE_PRICE_ILS * (1 - appliedDiscount / 100);
  const priceLabel = formatPrice(price);

  const applyCode = () => {
    const normalized = code.trim().toUpperCase();
    const pct = DISCOUNT_CODES[normalized];
    if (pct) {
      setAppliedDiscount(pct);
      setCodeError(false);
    } else {
      setAppliedDiscount(0);
      setCodeError(true);
    }
  };

  const onPay = () => {
    // STUB. Real flow would tokenize via the provider's SDK and POST to
    // a backend that records the subscription. Here we just toggle the
    // local premium flag.
    setSuccess(true);
  };

  const finish = () => {
    setSuccess(false);
    onSuccess?.();
  };

  return (
    <>
      <style>{`
        @keyframes cw-ps-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cw-ps-up   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes cw-ps-pop  { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 80,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'cw-ps-fade 0.18s ease-out',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog" aria-modal="true"
          style={{
            width: '100%', maxWidth: 420,
            background: '#FFF8E8',
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 'calc(env(safe-area-inset-bottom, 0px) + 16px) 18px 24px',
            boxShadow: '0 -16px 48px rgba(42,6,69,0.32)',
            maxHeight: '92vh', overflowY: 'auto',
            animation: 'cw-ps-up 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {success ? (
            // Success state — fills the sheet, replaces the form
            <div style={{
              textAlign: 'center', padding: '32px 12px 8px',
              animation: 'cw-ps-pop 0.32s cubic-bezier(0.34, 1.5, 0.64, 1)',
            }}>
              <div aria-hidden style={{ fontSize: 72, lineHeight: 1, marginBottom: 8 }}>🎉</div>
              <div className="fs-display" style={{
                fontSize: 26, fontWeight: 800, color: PLUM, letterSpacing: '-0.03em',
                marginBottom: 8,
              }}>
                {t.pay_success_title || 'Welcome to Premium'}
              </div>
              <div className="fs-sans" style={{
                fontSize: 14, lineHeight: 1.5, color: MUTED,
                marginBottom: 22, padding: '0 16px',
              }}>
                {t.pay_success_body || "You're ad-free. Thanks for supporting the dev."}
              </div>
              <button
                onClick={finish}
                className="press"
                style={{
                  width: '100%', padding: '15px 18px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFC200 100%)',
                  color: EGGPLANT, border: '2px solid rgba(255,255,255,0.85)',
                  borderRadius: 16, cursor: 'pointer',
                  fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
                  fontFamily: 'inherit',
                  boxShadow: '0 5px 0 rgba(74,14,78,0.22), 0 12px 22px -6px rgba(74,14,78,0.30)',
                }}
              >
                {t.pay_success_cta || 'Continue'}
              </button>
            </div>
          ) : (
            <>
              {/* grabber */}
              <div style={{
                width: 44, height: 4, borderRadius: 3,
                background: 'rgba(74,14,78,0.18)', margin: '0 auto 14px',
              }} />

              {/* header */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div className="fs-display" style={{
                  fontSize: 22, fontWeight: 800, color: PLUM,
                  letterSpacing: '-0.03em',
                }}>
                  {t.pay_title || 'Choose payment method'}
                </div>
                <div className="fs-mono" style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                  color: CORAL, textTransform: 'uppercase', marginTop: 5,
                }}>
                  {interp(t.pay_subtitle || 'Premium · {price}/month', { price: priceLabel })}
                </div>
              </div>

              {/* method tabs */}
              <div style={{
                display: 'flex', gap: 6, padding: 4,
                background: 'rgba(74,14,78,0.06)', borderRadius: 16,
                marginBottom: 14,
              }}>
                <Tab id="bit"  emoji="⚡" label={t.pay_method_bit  || 'Bit'}         active={method === 'bit'}  onClick={() => setMethod('bit')} />
                <Tab id="visa" emoji="💳" label={t.pay_method_visa || 'Visa'}        active={method === 'visa'} onClick={() => setMethod('visa')} />
                <Tab id="card" emoji="🪪" label={t.pay_method_card || 'Credit card'} active={method === 'card'} onClick={() => setMethod('card')} />
              </div>

              {/* method form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                {method === 'bit' ? (
                  <Field
                    label={t.pay_phone || 'Phone number'}
                    placeholder="050-1234567"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={setPhone}
                    maxLength={15}
                  />
                ) : (
                  // Visa + generic credit card share the same form. The tab
                  // changes user expectation but field shape is identical.
                  <>
                    <Field
                      label={t.pay_card_num || 'Card number'}
                      placeholder="0000 0000 0000 0000"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={cardNum}
                      onChange={(v) => setCardNum(v.replace(/[^\d ]/g, '').slice(0, 19))}
                      maxLength={19}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Field
                        label={t.pay_card_exp || 'Expiry (MM/YY)'}
                        placeholder="MM/YY"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        value={cardExp}
                        onChange={(v) => setCardExp(v.replace(/[^\d/]/g, '').slice(0, 5))}
                        maxLength={5}
                      />
                      <Field
                        label={t.pay_card_cvv || 'CVV'}
                        placeholder="•••"
                        type="password"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        value={cardCvv}
                        onChange={(v) => setCardCvv(v.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                      />
                    </div>
                    <Field
                      label={t.pay_card_name || 'Cardholder name'}
                      placeholder="Name on card"
                      type="text"
                      autoComplete="cc-name"
                      value={cardName}
                      onChange={setCardName}
                    />
                  </>
                )}
              </div>

              {/* discount code */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setCodeError(false); }}
                    placeholder={t.pay_discount_placeholder || 'Discount code'}
                    style={{
                      flex: 1, appearance: 'none', padding: '11px 14px',
                      background: appliedDiscount > 0 ? 'rgba(67,170,139,0.10)' : '#fff',
                      border: `1.5px solid ${
                        codeError ? '#F94144'
                        : appliedDiscount > 0 ? 'rgba(67,170,139,0.45)'
                        : BORDER
                      }`,
                      borderRadius: 12, color: EGGPLANT,
                      fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={applyCode}
                    type="button"
                    className="press"
                    style={{
                      padding: '11px 18px',
                      background: '#fff', border: `1.5px solid ${BORDER}`,
                      borderRadius: 12, color: EGGPLANT,
                      cursor: 'pointer', fontSize: 13, fontWeight: 800,
                      fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    {t.pay_discount_apply || 'Apply'}
                  </button>
                </div>
                {appliedDiscount > 0 && (
                  <div className="fs-mono" style={{
                    marginTop: 6, fontSize: 11, fontWeight: 700,
                    color: '#43AA8B', letterSpacing: '0.04em',
                  }}>
                    {interp(t.pay_discount_applied || '✓ {pct}% off applied', { pct: appliedDiscount })}
                  </div>
                )}
                {codeError && (
                  <div className="fs-mono" style={{
                    marginTop: 6, fontSize: 11, fontWeight: 700,
                    color: '#F94144', letterSpacing: '0.04em',
                  }}>
                    {t.pay_invalid_code || 'Invalid code'}
                  </div>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={onPay}
                className="press"
                style={{
                  width: '100%', padding: '15px 18px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFC200 100%)',
                  color: EGGPLANT, border: '2px solid rgba(255,255,255,0.85)',
                  borderRadius: 16, cursor: 'pointer',
                  fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
                  fontFamily: 'inherit',
                  boxShadow: '0 6px 0 rgba(74,14,78,0.25), 0 14px 24px -6px rgba(74,14,78,0.30)',
                }}
              >
                {interp(t.pay_btn_pay || 'Pay {price}', { price: priceLabel })}
              </button>

              {/* testing-mode notice */}
              <div className="fs-mono" style={{
                marginTop: 12, padding: '9px 12px',
                background: 'rgba(74,14,78,0.06)', borderRadius: 10,
                fontSize: 10.5, lineHeight: 1.5, color: MUTED,
                fontWeight: 700, textAlign: 'center',
              }}>
                ⚠ {t.pay_stub_notice || 'Testing mode — no real charge happens.'}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
