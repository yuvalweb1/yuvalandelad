// ============================================================
// Welcome — first-run questionnaire. Asks name + location once,
// persists to localStorage so we can personalize copy on the
// Landing screen and beyond.
//
// Skipping is allowed (the rest of the app works fine without
// these fields). Either way we set cw_seen_welcome so the user
// doesn't hit the questionnaire again on the next visit.
// ============================================================
import { useState } from 'react';

const CREAM     = '#FFF6D6';
const PINK      = '#FDE6F1';
const EGGPLANT  = '#4A0E4E';
const PLUM      = '#2a0645';
const CORAL     = '#f06449';
const GOLD      = '#FFD700';
const MANGO     = '#FFC200';
const MUTED     = 'rgba(74,14,78,0.55)';
const BORDER    = 'rgba(74,14,78,0.12)';

export default function Welcome({ t, onComplete }) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');

  const submit = (skipped) => {
    onComplete({
      name: skipped ? '' : name.trim(),
      country: skipped ? '' : country.trim(),
      skipped,
    });
  };

  const canContinue = name.trim().length > 0;

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'hidden',
      background: `linear-gradient(180deg, ${CREAM} 0%, #FFF0E2 46%, ${PINK} 100%)`,
      display: 'flex', flexDirection: 'column',
      padding: 'calc(env(safe-area-inset-top, 0px) + 40px) 22px calc(env(safe-area-inset-bottom, 0px) + 24px)',
    }}>
      {/* warm blob background */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: GOLD, opacity: 0.20, filter: 'blur(72px)', top: -80, left: -60 }} />
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: CORAL, opacity: 0.14, filter: 'blur(60px)', top: '24%', right: -60 }} />
        <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', background: '#FF69B4', opacity: 0.12, filter: 'blur(72px)', bottom: -60, left: '12%' }} />
      </div>

      <div style={{
        position: 'relative', zIndex: 2,
        flex: 1, display: 'flex', flexDirection: 'column',
      }}>
        {/* hero */}
        <div className="a-fade-up">
          <div aria-hidden style={{ fontSize: 56, lineHeight: 1, marginBottom: 10 }}>👋</div>
          <div className="fs-display" style={{
            fontSize: 38, fontWeight: 800, color: PLUM,
            letterSpacing: '-0.04em', lineHeight: 1.02,
          }}>
            {t.welcome_title || 'Welcome'}
          </div>
          <div className="fs-sans" dir="auto" style={{
            marginTop: 8, fontSize: 15, lineHeight: 1.5,
            color: MUTED, fontWeight: 600,
          }}>
            {t.welcome_subtitle || "Two quick questions — then we're rolling."}
          </div>
        </div>

        {/* form */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 18,
          marginTop: 32, flexShrink: 0,
        }}>
          <label className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 7, animationDelay: '0.08s' }}>
            <span className="fs-mono" style={{
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: CORAL, fontWeight: 800,
            }}>
              {t.welcome_name_label || "What's your name?"}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.welcome_name_placeholder || 'Type your name'}
              autoFocus
              autoComplete="given-name"
              style={{
                appearance: 'none', width: '100%', padding: '14px 16px',
                background: '#fff', border: `2px solid ${BORDER}`,
                borderRadius: 14, color: EGGPLANT,
                fontSize: 17, fontFamily: 'inherit', fontWeight: 600,
                outline: 'none',
                boxShadow: '0 3px 0 rgba(74,14,78,0.06)',
              }}
              onFocus={(e) => { e.target.style.borderColor = CORAL; }}
              onBlur={(e)  => { e.target.style.borderColor = BORDER; }}
            />
          </label>

          <label className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 7, animationDelay: '0.16s' }}>
            <span className="fs-mono" style={{
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: CORAL, fontWeight: 800,
            }}>
              {t.welcome_country_label || 'Where are you from?'}
            </span>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={t.welcome_country_placeholder || 'Country / City'}
              autoComplete="country-name"
              style={{
                appearance: 'none', width: '100%', padding: '14px 16px',
                background: '#fff', border: `2px solid ${BORDER}`,
                borderRadius: 14, color: EGGPLANT,
                fontSize: 17, fontFamily: 'inherit', fontWeight: 600,
                outline: 'none',
                boxShadow: '0 3px 0 rgba(74,14,78,0.06)',
              }}
              onFocus={(e) => { e.target.style.borderColor = CORAL; }}
              onBlur={(e)  => { e.target.style.borderColor = BORDER; }}
            />
          </label>
        </div>

        {/* spacer pushes CTA to bottom on tall screens */}
        <div style={{ flex: 1, minHeight: 24 }} />

        {/* CTA stack */}
        <div className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 10, animationDelay: '0.28s' }}>
          <button
            onClick={() => submit(false)}
            disabled={!canContinue}
            className="press"
            style={{
              width: '100%', padding: '17px 18px',
              background: canContinue
                ? `linear-gradient(135deg, ${GOLD} 0%, ${MANGO} 100%)`
                : 'rgba(74,14,78,0.10)',
              color: canContinue ? EGGPLANT : 'rgba(74,14,78,0.40)',
              border: `2px solid ${canContinue ? 'rgba(255,255,255,0.85)' : 'transparent'}`,
              borderRadius: 18, cursor: canContinue ? 'pointer' : 'default',
              fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em',
              fontFamily: 'inherit',
              boxShadow: canContinue
                ? '0 6px 0 rgba(74,14,78,0.25), 0 14px 24px -6px rgba(74,14,78,0.30)'
                : 'none',
              transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
            }}
          >
            {t.welcome_continue || 'Continue →'}
          </button>
          <button
            onClick={() => submit(true)}
            type="button"
            className="press"
            style={{
              width: '100%', padding: '11px 18px',
              background: 'transparent', border: 'none',
              color: MUTED, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            {t.welcome_skip || 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
}
