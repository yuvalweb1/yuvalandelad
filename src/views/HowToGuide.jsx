import { useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import BottomSheet from '../components/BottomSheet.jsx';

// Native (Android) plugin defined in OpenAppPlugin.java — opens WhatsApp via the
// OS launcher intent, like tapping its icon. iOS uses the whatsapp:// scheme.
const OpenApp = registerPlugin('OpenApp');

// Languages list — same set used in Landing/Settings. Keep in sync.
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

// ── mini WhatsApp phone mockups ──────────────────────────────────────────────

// Design dims of the mock; the whole thing is uniformly scaled up so every
// child (bubbles, hand pointer, share sheet) grows together and stays aligned.
const PHONE_W = 160, PHONE_H = 250, PHONE_SCALE = 1.5;

function MiniPhone({ children }) {
  return (
    <div style={{
      width: PHONE_W * PHONE_SCALE, height: PHONE_H * PHONE_SCALE,
      flexShrink: 1, minHeight: PHONE_H * PHONE_SCALE * 0.75, position: 'relative',
    }}>
      <div style={{
        width: PHONE_W, height: PHONE_H, borderRadius: 22, background: '#ECE5DD',
        border: '5px solid #15151d', overflow: 'hidden',
        position: 'absolute', top: 0, left: 0,
        transformOrigin: 'top left', transform: `scale(${PHONE_SCALE})`,
        boxShadow: '0 16px 40px -10px rgba(74,14,78,0.45)',
      }}>{children}</div>
    </div>
  );
}

function HandPointer({ style }) {
  return (
    <div className="a-float" style={{
      position: 'absolute', fontSize: 26,
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
      pointerEvents: 'none', ...style,
    }}>👆</div>
  );
}

const HL = { background: '#FFD700', color: '#15151d', borderRadius: 4, boxShadow: '0 0 0 2px #FF69B4' };

function WaHeader({ name, highlightName, highlightDots }) {
  return (
    <div style={{ height: 36, background: '#075E54', display: 'flex', alignItems: 'center', gap: 6, padding: '0 9px', color: '#fff' }}>
      <span style={{ fontSize: 14 }}>‹</span>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#25D366', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', padding: highlightName ? '1px 3px' : 0,
          ...(highlightName ? HL : {}),
        }}>{name}</div>
        <div style={{ fontSize: 8, opacity: 0.8 }}>online</div>
      </div>
      <span style={{ fontSize: 17, lineHeight: 1, padding: highlightDots ? '0 3px' : 0, ...(highlightDots ? HL : {}) }}>⋮</span>
    </div>
  );
}

function ChatBody({ t }) {
  const bubble = (txt, mine) => (
    <div style={{
      alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%',
      background: mine ? '#DCF8C6' : '#fff', borderRadius: 8,
      padding: '5px 7px', fontSize: 9, color: '#222',
      boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
    }} dir="auto">{txt}</div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
      {bubble(t.howto_mock_msg1, false)}
      {bubble(t.howto_mock_msg2, true)}
      {bubble(t.howto_mock_msg3, false)}
    </div>
  );
}

function WaMock({ kind, t }) {
  if (kind === 'chat') return (
    <MiniPhone><WaHeader name={t.howto_mock_group} /><ChatBody t={t} /></MiniPhone>
  );
  if (kind === 'name') return (
    <MiniPhone>
      <WaHeader name={t.howto_mock_group} highlightName />
      <ChatBody t={t} />
      <HandPointer style={{ top: 26, insetInlineStart: 46 }} />
    </MiniPhone>
  );
  if (kind === 'dots') return (
    <MiniPhone>
      <WaHeader name={t.howto_mock_group} highlightDots />
      <ChatBody t={t} />
      <HandPointer style={{ top: 26, insetInlineEnd: 4 }} />
    </MiniPhone>
  );
  // Android: ⋮ dropdown is open — tap "More" to reveal the export option
  if (kind === 'more') {
    const rows = [
      { label: t.howto_mock_row_media, hl: false },
      { label: t.howto_mock_row_search, hl: false },
      { label: t.howto_mock_row_mute, hl: false },
      { label: t.howto_mock_more, hl: true },
    ];
    return (
      <MiniPhone>
        <WaHeader name={t.howto_mock_group} highlightDots />
        <ChatBody t={t} />
        {/* dropdown anchored under the ⋮ */}
        <div style={{
          position: 'absolute', top: 34, insetInlineEnd: 6,
          width: 108, background: '#fff', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,0.28)', overflow: 'hidden',
        }}>
          {rows.map((r, i) => (
            <div key={i} dir="auto" style={{
              fontSize: 9.5, padding: '8px 10px',
              color: r.hl ? '#15151d' : '#444', fontWeight: r.hl ? 800 : 500,
              ...(r.hl ? { background: '#FFD700', boxShadow: 'inset 0 0 0 2px #FF69B4' } : {}),
            }}>{r.label}</div>
          ))}
        </div>
        <HandPointer style={{ top: 92, insetInlineEnd: 14 }} />
      </MiniPhone>
    );
  }
  if (kind === 'export') {
    const rows = [
      { label: t.howto_mock_row_media, hl: false },
      { label: t.howto_mock_row_mute, hl: false },
      { label: t.howto_mock_export, hl: true },
      { label: t.howto_mock_row_clear, hl: false },
    ];
    return (
      <MiniPhone>
        <div style={{ height: 32, background: '#075E54' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => (
            <div key={i} dir="auto" style={{
              fontSize: 10, padding: '10px 10px', borderBottom: '1px solid #eee',
              color: r.hl ? '#15151d' : '#444', fontWeight: r.hl ? 800 : 500,
              ...(r.hl ? { background: '#FFD700', boxShadow: 'inset 0 0 0 2px #FF69B4' } : { background: '#fff' }),
            }}>{r.label}</div>
          ))}
        </div>
        <HandPointer style={{ top: 94, insetInlineEnd: 10 }} />
      </MiniPhone>
    );
  }
  if (kind === 'media') {
    return (
      <MiniPhone>
        <div style={{ height: '100%', background: 'rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            <div dir="auto" style={{ fontSize: 9.5, color: '#666', marginBottom: 8 }}>{t.howto_mock_export}?</div>
            <div dir="auto" style={{ fontSize: 11, fontWeight: 800, color: '#15151d', padding: 8, borderRadius: 8, background: '#FFD700', boxShadow: '0 0 0 2px #FF69B4', textAlign: 'center', marginBottom: 6 }}>📸 {t.howto_mock_media}</div>
            <div dir="auto" style={{ fontSize: 11, fontWeight: 600, color: '#444', padding: 8, borderRadius: 8, background: '#f0f0f0', textAlign: 'center' }}>{t.howto_mock_nomedia}</div>
          </div>
        </div>
        <HandPointer style={{ top: 84, insetInlineStart: 32 }} />
      </MiniPhone>
    );
  }
  // share sheet — final step for Android (tap Recapped)
  if (kind === 'share') {
    return (
      <MiniPhone>
        <div style={{ height: '100%', background: '#ECE5DD', display: 'flex', flexDirection: 'column' }}>
          <WaHeader name={t.howto_mock_group} />
          <ChatBody t={t} />
          {/* bottom share sheet */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: '#fff', borderRadius: '16px 16px 0 0',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.18)', padding: '10px 8px 14px',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#888', marginBottom: 8, textAlign: 'center' }}>Share via…</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {/* Recapped icon — highlighted (real app icon, zoomed to fill the square) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 3px #FFD700, 0 0 0 5px #FF69B4',
                }}>
                  <img src="/icon-377.png" alt="Recapped" style={{
                    width: 62, height: 62, flexShrink: 0, display: 'block', objectFit: 'cover',
                    transform: 'translateY(4px)',
                  }} />
                </div>
                <div style={{ fontSize: 7.5, fontWeight: 800, color: '#4A0E4E' }}>Recapped</div>
              </div>
              {/* other app icons (greyed out) */}
              {['📧', '📁'].map((ic, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.35 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{ic}</div>
                  <div style={{ fontSize: 7.5, color: '#aaa' }}>App</div>
                </div>
              ))}
            </div>
          </div>
          <HandPointer style={{ bottom: 56, insetInlineStart: 26 }} />
        </div>
      </MiniPhone>
    );
  }
  // iOS final step — save to Files, then upload
  if (kind === 'savefiles') {
    return (
      <MiniPhone>
        <div style={{ height: '100%', background: '#ECE5DD', display: 'flex', flexDirection: 'column' }}>
          <WaHeader name={t.howto_mock_group} />
          <ChatBody t={t} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: '#fff', borderRadius: '16px 16px 0 0',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.18)', padding: '10px 8px 14px',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#888', marginBottom: 8, textAlign: 'center' }}>Share via…</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {/* Save to Files — highlighted */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: '#1C7FD6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 3px #FFD700, 0 0 0 5px #FF69B4', fontSize: 22,
                }}>📁</div>
                <div style={{ fontSize: 7, fontWeight: 800, color: '#1C7FD6', textAlign: 'center', lineHeight: 1.1 }}>Save to{'\n'}Files</div>
              </div>
              {/* other icons (greyed out) */}
              {['📧', '💬', '✈️'].map((ic, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.3 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{ic}</div>
                  <div style={{ fontSize: 7.5, color: '#aaa' }}>App</div>
                </div>
              ))}
            </div>
          </div>
          <HandPointer style={{ bottom: 56, insetInlineStart: 26 }} />
        </div>
      </MiniPhone>
    );
  }
  return null;
}

// ── step definitions ─────────────────────────────────────────────────────────

function getSteps(platform, t) {
  if (platform === 'ios') return [
    { k: 'chat',      label: t.howto_ios_1 },
    { k: 'name',      label: t.howto_ios_2 },
    { k: 'export',    label: t.howto_ios_3 },
    { k: 'media',     label: t.howto_ios_4 },
    { k: 'share',     label: t.howto_ios_5 },
  ];
  return [
    { k: 'chat',   label: t.howto_and_1 },
    { k: 'dots',   label: t.howto_and_2 },
    { k: 'more',   label: t.howto_and_3 },
    { k: 'export', label: t.howto_and_4 },
    { k: 'media',  label: t.howto_and_5 },
    { k: 'share',  label: t.howto_and_6 },
  ];
}

// ── main component ────────────────────────────────────────────────────────────

export default function HowToGuide({ t, onStart, onHome, lang, setLang, hasChat }) {
  const [platform, setPlatform] = useState('android');
  const [stepIdx, setStepIdx] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
  const isRTL = lang === 'he' || lang === 'ar';

  const steps = getSteps(platform, t);
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  const advance = async () => {
    if (isLast) {
      // Native: hand the scheme straight to the OS so the WhatsApp APP opens
      // (browser sandboxing blocks this, which is why the web attempts failed).
      // On web (dev in a browser) AppLauncher no-ops and we just continue.
      if (Capacitor.isNativePlatform()) {
        try {
          if (Capacitor.getPlatform() === 'android') {
            await OpenApp.openWhatsApp();
          } else {
            await AppLauncher.openUrl({ url: 'whatsapp://' });
          }
          console.log('[deeplink] open ok', Capacitor.getPlatform());
        } catch (e) { console.error('[deeplink] error', e); }
      }
      onStart();
    } else {
      setStepIdx(i => i + 1);
    }
  };

  // Back steps through the guide; from the first step it leaves to home.
  const goBack = () => {
    if (stepIdx > 0) setStepIdx(i => i - 1);
    else onHome && onHome();
  };

  const switchPlatform = (id) => { setPlatform(id); setStepIdx(0); };

  return (
    <div style={{
      position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, #FFF6D6 0%, #FFF0E2 50%, #FDE6F1 100%)',
      overflow: 'hidden',
    }}>
      {/* decorative blobs */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: '#FFD700', opacity: 0.45, filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: '#FF69B4', opacity: 0.28, filter: 'blur(70px)' }} />
      </div>

      {/* ── top bar: eyebrow + lang picker + platform toggle ── */}
      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, padding: '44px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={goBack}
              className="press"
              aria-label={t.howto_back || 'Back'}
              style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#FFF6E8', border: '1.5px solid rgba(255,255,255,0.9)',
                color: '#4A0E4E', cursor: 'pointer', fontSize: 19, lineHeight: 1,
                boxShadow: '0 3px 0 rgba(74,14,78,0.18), 0 8px 14px -6px rgba(74,14,78,0.25)',
              }}>
              <span aria-hidden="true">{isRTL ? '›' : '‹'}</span>
            </button>
            {onHome && (
              <button
                onClick={onHome}
                className="press"
                aria-label={t.howto_home || 'Home'}
                style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#FFF6E8', border: '1.5px solid rgba(255,255,255,0.9)',
                  color: '#4A0E4E', cursor: 'pointer', fontSize: 17, lineHeight: 1,
                  boxShadow: '0 3px 0 rgba(74,14,78,0.18), 0 8px 14px -6px rgba(74,14,78,0.25)',
                }}>
                🏠
              </button>
            )}
          </div>
          {setLang && (
            <button
              onClick={() => setLangOpen(true)}
              className="press"
              aria-label={t.a11y_change_language || `Change language. Current: ${currentLang.name}`}
              style={{
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '0 10px', height: 28, borderRadius: 999,
                background: '#FFF6E8', border: '1.5px solid rgba(255,255,255,0.9)',
                color: '#4A0E4E', cursor: 'pointer',
                boxShadow: '0 3px 0 rgba(74,14,78,0.18), 0 8px 14px -6px rgba(74,14,78,0.25)',
                font: 'inherit',
              }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{currentLang.flag}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
                {currentLang.name}
              </span>
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(74,14,78,0.07)', borderRadius: 16 }}>
          {[{ id: 'ios', label: `🍏 ${t.howto_ios}` }, { id: 'android', label: `🤖 ${t.howto_android}` }].map(({ id, label }) => (
            <button key={id} onClick={() => switchPlatform(id)} className="press" style={{
              flex: 1, padding: '9px', borderRadius: 13, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 800,
              background: platform === id ? '#4A0E4E' : 'transparent',
              color: platform === id ? '#fff' : 'rgba(74,14,78,0.55)',
              transition: 'background 0.15s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── step area (fills available space) ── */}
      <div key={`${platform}-${stepIdx}`} className="a-fade-up" style={{
        position: 'relative', zIndex: 10,
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '16px 20px',
        gap: 16,
        overflowY: 'auto',
      }}>
        {/* illustration */}
        <WaMock kind={step.k} t={t} />

        {/* step label */}
        <div style={{ width: '100%', textAlign: 'center' }}>
          <div className="fs-display" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 42, height: 42, borderRadius: 999,
            background: '#FFD700', color: '#4A0E4E',
            fontSize: 21, fontWeight: 800,
            boxShadow: '0 3px 0 #E0A800',
            margin: '0 auto 8px',
          }}>{stepIdx + 1}</div>
          <div className="fs-sans" dir="auto" style={{
            fontSize: 21, lineHeight: 1.35, fontWeight: 700, color: '#4A0E4E',
          }}>{step.label}</div>
        </div>
      </div>

      {/* ── bottom: progress dots + button ── */}
      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, padding: '0 20px 28px' }}>
        {/* dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 16 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === stepIdx ? 22 : 7, height: 7, borderRadius: 999,
              background: i === stepIdx ? '#4A0E4E' : 'rgba(74,14,78,0.22)',
              transition: 'all 0.25s ease',
            }} />
          ))}
        </div>

        <button onClick={advance} className="press a-gradient-shift" style={{
          width: '100%', position: 'relative', overflow: 'hidden',
          padding: '18px', color: '#4A0E4E',
          background: 'linear-gradient(135deg, #FFE45C 0%, #FFD700 50%, #FFB800 100%)',
          backgroundSize: '200% 200%', border: '2px solid rgba(255,255,255,0.7)',
          borderRadius: 22, fontSize: 19, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 8px 0 #E0A800, 0 18px 34px -6px rgba(224,168,0,0.6)',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <span className="fs-display" style={{ position: 'relative' }}>
            {isLast ? (hasChat ? t.howto_cta : t.howto_cta_import) : t.howto_next}
          </span>
        </button>
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
              fontSize: 23, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="cw-flag" style={{ fontSize: 22 }}>{l.flag}</span>
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
