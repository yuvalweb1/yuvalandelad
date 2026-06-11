// ============================================================
// Welcome — first-run language picker. Lets the user pick their
// UI language once; persists to localStorage so we don't ask
// again on the next visit.
//
// Either way we set cw_seen_welcome so the user doesn't hit the
// questionnaire again.
// ============================================================
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
        {/* hero */}
        <div className="a-fade-up" style={{ flexShrink: 0 }}>
          <div aria-hidden style={{ fontSize: 56, lineHeight: 1, marginBottom: 10 }}>🌍</div>
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
            {t.welcome_lang_subtitle || 'Pick your language to get started.'}
          </div>
        </div>

        {/* language list */}
        <div className="a-fade-up" style={{
          marginTop: 24, flex: 1, minHeight: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 8,
          paddingBottom: 8, animationDelay: '0.08s',
        }}>
          {LANGUAGES.map(l => {
            const selected = lang === l.code;
            return (
              <button
                key={l.code}
                onClick={() => onComplete({ lang: l.code })}
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
      </div>
    </div>
  );
}
