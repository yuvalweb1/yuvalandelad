// ============================================================
// Welcome — first-run flow. Two short steps:
//   1) Pick the UI language
//   2) Type your name (optional — used to auto-pick "who you are"
//      in Onboarding so we don't ask twice)
// onComplete fires with { lang, name }. App.jsx persists both to
// localStorage so we never run this again.
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

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'he', name: 'עברית', flag: '🇮🇱' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

export default function Welcome({ t, lang = 'en', onComplete }) {
  // Local two-step flow. step 0 = language, step 1 = name.
  // We keep the lang choice in component state until step 2 commits
  // so the user can change their mind without firing onComplete early.
  const [step, setStep] = useState(0);
  const [pickedLang, setPickedLang] = useState(lang);
  const [name, setName] = useState('');

  // Translation map for the chosen language so step 2 reads in that
  // language even before App.jsx swaps it. Fallback to the prop `t`
  // if we haven't picked yet.
  const t2 = t;

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
        flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        {step === 0 ? (
          <>
            {/* ─── Step 1: Language ─────────────────────────── */}
            <div className="a-fade-up" style={{ flexShrink: 0 }}>
              <div aria-hidden style={{ fontSize: 56, lineHeight: 1, marginBottom: 10 }}>🌍</div>
              <div className="fs-display" style={{
                fontSize: 38, fontWeight: 800, color: PLUM,
                letterSpacing: '-0.04em', lineHeight: 1.02,
              }}>
                {t2.welcome_title || 'Welcome'}
              </div>
              <div className="fs-sans" dir="auto" style={{
                marginTop: 8, fontSize: 15, lineHeight: 1.5,
                color: MUTED, fontWeight: 600,
              }}>
                {t2.welcome_lang_subtitle || 'Pick your language to get started.'}
              </div>
            </div>

            <div className="a-fade-up" style={{
              marginTop: 24, flex: 1, minHeight: 0, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 8,
              paddingBottom: 8, animationDelay: '0.08s',
            }}>
              {LANGUAGES.map(l => {
                const selected = pickedLang === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => { setPickedLang(l.code); setStep(1); }}
                    className="press"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '14px 16px',
                      background: selected ? 'rgba(240,100,73,0.10)' : '#fff',
                      border: `2px solid ${selected ? CORAL : BORDER}`,
                      borderRadius: 14, color: EGGPLANT, cursor: 'pointer',
                      fontSize: 17, fontFamily: 'inherit', fontWeight: 600,
                      textAlign: 'start',
                      boxShadow: '0 3px 0 rgba(74,14,78,0.06)',
                    }}
                  >
                    <span className="cw-flag" style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{l.flag}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                    {selected && (
                      <span aria-hidden style={{ color: CORAL, fontSize: 18, flexShrink: 0 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* ─── Step 2: Name ──────────────────────────────── */}
            <div className="a-fade-up" style={{ flexShrink: 0 }}>
              <div aria-hidden style={{ fontSize: 56, lineHeight: 1, marginBottom: 10 }}>👋</div>
              <div className="fs-display" dir="auto" style={{
                fontSize: 38, fontWeight: 800, color: PLUM,
                letterSpacing: '-0.04em', lineHeight: 1.02,
              }}>
                {t2.welcome_name_title || t2.welcome_name_label || "What's your name?"}
              </div>
              <div className="fs-sans" dir="auto" style={{
                marginTop: 8, fontSize: 15, lineHeight: 1.5,
                color: MUTED, fontWeight: 600,
              }}>
                {t2.welcome_name_help || "We use it to auto-pick you in your chat — so we don't ask twice."}
              </div>
            </div>

            <div className="a-fade-up" style={{ marginTop: 24, flexShrink: 0, animationDelay: '0.08s' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t2.welcome_name_placeholder || 'Type your name'}
                autoFocus
                autoComplete="given-name"
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onComplete({ lang: pickedLang, name: name.trim() }); }}
                style={{
                  appearance: 'none', width: '100%', padding: '16px 18px',
                  background: '#fff', border: `2px solid ${BORDER}`,
                  borderRadius: 16, color: EGGPLANT,
                  fontSize: 19, fontFamily: 'inherit', fontWeight: 600,
                  outline: 'none',
                  boxShadow: '0 3px 0 rgba(74,14,78,0.06)',
                }}
                onFocus={(e) => { e.target.style.borderColor = CORAL; }}
                onBlur={(e)  => { e.target.style.borderColor = BORDER; }}
              />
            </div>

            <div style={{ flex: 1, minHeight: 8 }} />

            <div className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, animationDelay: '0.18s' }}>
              <button
                onClick={() => onComplete({ lang: pickedLang, name: name.trim() })}
                disabled={!name.trim()}
                className="press"
                style={{
                  width: '100%', padding: '17px 18px',
                  background: name.trim()
                    ? `linear-gradient(135deg, ${GOLD} 0%, ${MANGO} 100%)`
                    : 'rgba(74,14,78,0.10)',
                  color: name.trim() ? EGGPLANT : 'rgba(74,14,78,0.40)',
                  border: `2px solid ${name.trim() ? 'rgba(255,255,255,0.85)' : 'transparent'}`,
                  borderRadius: 18, cursor: name.trim() ? 'pointer' : 'default',
                  fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em',
                  fontFamily: 'inherit',
                  boxShadow: name.trim()
                    ? '0 6px 0 rgba(74,14,78,0.25), 0 14px 24px -6px rgba(74,14,78,0.30)'
                    : 'none',
                  transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
                }}
              >
                {t2.welcome_continue || 'Continue'}
              </button>
              <button
                onClick={() => onComplete({ lang: pickedLang, name: '' })}
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
                {t2.welcome_skip || 'Skip'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
