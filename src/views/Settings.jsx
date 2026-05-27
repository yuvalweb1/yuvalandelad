import { useState } from 'react';
import BottomSheet from '../components/BottomSheet.jsx';
import { RTL_LANGS } from '../i18n';

// Ultra-Pop palette — same vocabulary as the slides + PostMenu.
const BANANA   = '#FFD700';
const MANGO    = '#FF8C00';
const EGGPLANT = '#4A0E4E';
const SKY      = '#00BFFF';
const PINK     = '#FF69B4';
const MINT     = '#43AA8B';
const ROSE     = '#F94144';
const CREAM    = '#fff5f7';

const popShadow = (hex) => `0 6px 0 ${hex}22, 0 14px 24px -8px ${hex}55`;

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
];

export default function Settings({
  t, lang, setLang,
  includeMedia, setIncludeMedia,
  isPremium, setPremium,
  history = [], onClearHistory,
  onBack,
}) {
  const [langOpen, setLangOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', position: 'relative',
      background: CREAM,
    }}>
      {/* Fixed gradient blobs — same family as PostMenu / slides. */}
      <div aria-hidden="true" style={{
        position: 'fixed', top: -70, insetInlineStart: -80, width: 240, height: 240,
        borderRadius: '50%', background: BANANA, opacity: 0.5, filter: 'blur(72px)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden="true" style={{
        position: 'fixed', top: 40, insetInlineEnd: -70, width: 200, height: 200,
        borderRadius: '50%', background: PINK, opacity: 0.38, filter: 'blur(70px)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden="true" style={{
        position: 'fixed', bottom: -50, insetInlineEnd: -50, width: 220, height: 220,
        borderRadius: '50%', background: SKY, opacity: 0.42, filter: 'blur(68px)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden="true" style={{
        position: 'fixed', bottom: 120, insetInlineStart: -60, width: 190, height: 190,
        borderRadius: '50%', background: MANGO, opacity: 0.34, filter: 'blur(62px)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{
        padding: '22px 20px 36px', position: 'relative', zIndex: 1,
        minHeight: '100%',
      }}>
        {/* Header — back button + slide-style title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <button onClick={onBack} className="press" aria-label={t.settings_back || 'Back'} style={{
            width: 40, height: 40, borderRadius: 999, background: '#fff',
            border: `2px solid ${MANGO}33`, color: EGGPLANT, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: popShadow(MANGO), flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="fs-display" style={{
            fontSize: 28, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.03em',
            textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          }}>
            {t.settings_title || 'Settings'}
          </div>
        </div>

        {/* Premium — first so it's the most prominent. Phase 1 is a UI stub:
            no real payment yet, just a button that flips the localStorage flag
            so the ad-free experience can be tested. */}
        <div style={{ marginBottom: 20 }}>
          <div className="fs-sans a-fade-up" style={{
            fontSize: 12, color: isPremium ? MINT : MANGO, letterSpacing: '0.20em',
            marginBottom: 9, fontWeight: 800, textTransform: 'uppercase',
            paddingInlineStart: 4,
          }}>
            💎 {isPremium ? (t.settings_premium_active || 'Premium active') : (t.settings_premium || 'Premium')}
          </div>

          {isPremium ? (
            <div className="a-fade-up" style={{
              background: '#fff', border: `2px solid ${MINT}66`,
              borderRadius: 18, padding: '16px 16px 14px',
              boxShadow: popShadow(MINT),
              animationDelay: '0.05s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: `${MINT}22`, border: `2px solid ${MINT}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>✓</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fs-display" style={{
                    fontSize: 19, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.02em',
                  }}>
                    {t.settings_premium_thanks || 'You\'re ad-free'}
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 11, color: 'rgba(74,14,78,0.55)', marginTop: 2, fontWeight: 600,
                  }}>
                    {t.settings_premium_subscribed || '₪15 / month · all video & banner ads removed'}
                  </div>
                </div>
              </div>
              <button onClick={() => setPremium(false)} className="press" style={{
                width: '100%', padding: '10px 14px', marginTop: 6,
                background: 'rgba(74,14,78,0.06)', border: 'none', borderRadius: 10,
                color: EGGPLANT, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}>
                {t.settings_premium_cancel_stub || 'Cancel (testing mode)'}
              </button>
            </div>
          ) : (
            <button onClick={() => setPremium(true)} className="press lift a-fade-up" style={{
              width: '100%', position: 'relative', overflow: 'hidden', textAlign: 'start',
              background: `linear-gradient(135deg, ${BANANA} 0%, ${MANGO} 100%)`,
              border: '2px solid rgba(255,255,255,0.85)',
              borderRadius: 18, padding: '16px 18px', cursor: 'pointer', color: EGGPLANT,
              boxShadow: `0 8px 0 ${MANGO}33, 0 18px 30px -8px ${MANGO}66`,
              animationDelay: '0.05s',
            }}>
              <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
              <div aria-hidden="true" className="fs-display" style={{
                position: 'absolute', insetInlineEnd: -8, top: -14, fontSize: 80,
                opacity: 0.20, lineHeight: 1, fontStyle: 'italic', pointerEvents: 'none',
              }}>💎</div>
              <div className="fs-sans" style={{
                fontSize: 10, letterSpacing: '0.22em', opacity: 0.78, fontWeight: 800,
                textTransform: 'uppercase',
              }}>
                {t.settings_premium_upsell_eyebrow || 'Remove ads'}
              </div>
              <div dir="auto" className="fs-display" style={{
                fontSize: 24, lineHeight: 1.05, letterSpacing: '-0.03em', marginTop: 4,
                fontWeight: 800, position: 'relative',
              }}>
                {t.settings_premium_upsell_title || 'Skip every ad · ₪15/mo'}
              </div>
              <div className="fs-mono" style={{
                fontSize: 11, color: 'rgba(74,14,78,0.65)', marginTop: 8, fontWeight: 600,
                position: 'relative',
              }}>
                {t.settings_premium_upsell_hint || 'Testing mode — payment not connected yet'}
              </div>
            </button>
          )}
        </div>

        {/* Language */}
        <Section icon="🌐" title={t.settings_language || 'Language'} accent={SKY}>
          <button onClick={() => setLangOpen(true)} className="press" style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', background: 'transparent', border: 'none',
            cursor: 'pointer', textAlign: 'start',
          }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>{currentLang.flag}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fs-sans" style={{
                fontSize: 16, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.01em',
              }}>{currentLang.name}</div>
              <div className="fs-mono" style={{
                fontSize: 10, color: 'rgba(74,14,78,0.55)', letterSpacing: '0.14em',
                fontWeight: 700, marginTop: 2, textTransform: 'uppercase',
              }}>
                {RTL_LANGS.has(lang) ? 'RTL' : 'LTR'} · {currentLang.code}
              </div>
            </div>
            <span className="fs-mono" style={{
              fontSize: 12, color: SKY, fontWeight: 800, flexShrink: 0,
              letterSpacing: '0.08em',
            }}>{t.settings_change || 'Change'} →</span>
          </button>
        </Section>

        {/* Analysis */}
        <Section icon="🔬" title={t.settings_analysis || 'Analysis'} accent={PINK}>
          <Toggle
            label={t.landing_media_title || 'Include media'}
            hint={includeMedia ? (t.settings_media_on || 'Photos · voice · stickers · videos') : (t.settings_media_off || 'Text only — faster')}
            checked={includeMedia}
            onChange={setIncludeMedia}
            accent={PINK}
          />
        </Section>

        {/* Data */}
        <Section icon="🗂️" title={t.settings_data || 'Data'} accent={MANGO}>
          {history && history.length > 0 ? (
            confirmClear ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 6 }}>
                <div className="fs-sans" style={{
                  fontSize: 13, color: EGGPLANT, fontWeight: 700, padding: '0 6px 4px',
                }}>
                  {t.settings_clear_confirm || 'Delete all saved recaps? This cannot be undone.'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { onClearHistory && onClearHistory(); setConfirmClear(false); }}
                    className="press" style={{
                      flex: 1, padding: '10px 14px',
                      background: ROSE, border: 'none', borderRadius: 12,
                      color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      letterSpacing: '-0.01em',
                      boxShadow: `0 4px 0 #B33136, 0 8px 20px -4px ${ROSE}88`,
                    }}>
                    {t.settings_clear_yes || 'Yes, clear all'}
                  </button>
                  <button onClick={() => setConfirmClear(false)} className="press" style={{
                    flex: 1, padding: '10px 14px',
                    background: 'rgba(74,14,78,0.08)', border: 'none', borderRadius: 12,
                    color: EGGPLANT, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    letterSpacing: '-0.01em',
                  }}>
                    {t.settings_cancel || 'Cancel'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="press" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'start',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                  background: `${ROSE}1f`, border: `2px solid ${ROSE}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>🗑️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fs-sans" style={{
                    fontSize: 15, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.01em',
                  }}>
                    {t.settings_clear_history || 'Clear saved recaps'}
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 11, color: 'rgba(74,14,78,0.55)', marginTop: 3, fontWeight: 600,
                  }}>
                    {history.length} {history.length === 1 ? (t.settings_recap_one || 'recap saved') : (t.settings_recap_many || 'recaps saved')}
                  </div>
                </div>
                <span className="fs-mono" style={{
                  fontSize: 12, color: ROSE, fontWeight: 800, flexShrink: 0,
                }}>→</span>
              </button>
            )
          ) : (
            <div style={{
              padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>📭</div>
              <div className="fs-mono" style={{
                fontSize: 12, color: 'rgba(74,14,78,0.55)', fontWeight: 600,
                fontStyle: 'italic',
              }}>
                {t.settings_data_empty || 'No saved recaps yet'}
              </div>
            </div>
          )}
        </Section>

        {/* About */}
        <Section icon="💎" title={t.settings_about || 'About'} accent={EGGPLANT}>
          <div style={{ padding: '14px 14px 12px' }}>
            <div dir="ltr" className="fs-display" style={{
              fontSize: 26, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.03em',
              lineHeight: 1,
            }}>
              chat<span style={{ color: MANGO, fontStyle: 'italic' }}>wrapped</span>
            </div>
            <div className="fs-mono" style={{
              fontSize: 10, color: 'rgba(74,14,78,0.55)', letterSpacing: '0.16em',
              fontWeight: 700, marginTop: 6, textTransform: 'uppercase',
            }}>
              v1.0
            </div>
            <div className="fs-sans" style={{
              fontSize: 13, color: 'rgba(74,14,78,0.75)', marginTop: 12,
              lineHeight: 1.5, fontWeight: 500,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ flexShrink: 0, color: MINT, fontSize: 16, lineHeight: 1.2 }}>🛡️</span>
              <span>
                {t.settings_privacy_claim || '100% local. Nothing leaves your device. No analytics, no LLM, no remote calls.'}
              </span>
            </div>
            {/* Privacy Policy link — required by app stores. Opens static page
                served alongside the app, with HE/EN language toggle. */}
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="press"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 14, padding: '8px 12px',
                background: `${EGGPLANT}0d`, border: `1.5px solid ${EGGPLANT}22`,
                borderRadius: 999, color: EGGPLANT, textDecoration: 'none',
                fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
              }}
            >
              <span aria-hidden="true">📄</span>
              <span>{t.settings_privacy_policy || 'Privacy Policy'}</span>
              <span aria-hidden="true" style={{ opacity: 0.55 }}>↗</span>
            </a>
          </div>
        </Section>
      </div>

      {langOpen && (
        <BottomSheet onClose={() => setLangOpen(false)} title={t.settings_language || 'Language'}>
          {LANGUAGES.map(l => (
            <button key={l.code} className="press" onClick={() => {
              setLang(l.code);
              setLangOpen(false);
            }} style={{
              width: '100%', padding: '16px 8px', minHeight: 56, background: 'transparent',
              border: 'none', borderBottom: '1px solid #2a2a36', color: '#f4f4f8',
              fontSize: 23, fontWeight: 500, textAlign: 'start', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{l.flag}</span>
                <span style={{ fontSize: 23, fontWeight: 600 }}>{l.name}</span>
              </div>
              {l.code === lang && (
                <span style={{ color: '#f9c74f', fontSize: 18 }}>✓</span>
              )}
            </button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}

function Section({ icon, title, accent, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="fs-sans a-fade-up" style={{
        fontSize: 12, color: accent, letterSpacing: '0.20em', marginBottom: 9,
        fontWeight: 800, textTransform: 'uppercase', paddingInlineStart: 4,
      }}>
        {icon} {title}
      </div>
      <div className="a-fade-up" style={{
        background: '#fff', border: '2px solid rgba(255,255,255,0.85)',
        borderRadius: 18, padding: 4,
        boxShadow: popShadow(accent),
        animationDelay: '0.05s',
      }}>
        {children}
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, accent }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="press"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'start', font: 'inherit',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fs-sans" style={{
          fontSize: 15, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>{label}</div>
        {hint && (
          <div className="fs-mono" style={{
            fontSize: 11, color: 'rgba(74,14,78,0.55)', marginTop: 4, fontWeight: 600,
          }}>{hint}</div>
        )}
      </div>
      {/* iOS-style switch */}
      <div style={{
        flexShrink: 0, width: 44, height: 26, borderRadius: 999,
        background: checked ? accent : 'rgba(74,14,78,0.18)',
        position: 'relative', transition: 'background 0.18s',
      }}>
        <div style={{
          position: 'absolute', top: 2, insetInlineStart: checked ? 20 : 2,
          width: 22, height: 22, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'inset-inline-start 0.18s',
        }} />
      </div>
    </button>
  );
}
