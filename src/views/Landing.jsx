import { useRef, useState, useCallback, useMemo } from 'react';
import BottomSheet from '../components/BottomSheet.jsx';
import { relativeTime } from '../lib/history.js';

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

export default function Landing({
  onFile, onDemo, parseError, t, lang, setLang, onHowTo,
  includeMedia = true, setIncludeMedia,
  history = [], onLoadRecap, onDeleteRecap, onClearHistory,
}) {
  const fileInputRef = useRef(null);
  const [langOpen, setLangOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [howToPulse, setHowToPulse] = useState(false);
  const emojiRots = useMemo(() => [10, -13, 16, -9, 12].map(base => {
    const jitter = ((Math.random() * 12) | 0) - 6;
    return base + jitter;
  }), []);
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  const handleCtaClick = useCallback(() => {
    setShaking(true);
    setHowToPulse(true);
    setTimeout(() => { setShaking(false); setHowToPulse(false); }, 520);
  }, []);

  return (
    <>
    <style>{`
      @keyframes shake-no {
        0%,100% { transform: translateX(0); }
        15%      { transform: translateX(-7px); }
        30%      { transform: translateX(7px); }
        45%      { transform: translateX(-5px); }
        60%      { transform: translateX(5px); }
        75%      { transform: translateX(-3px); }
        90%      { transform: translateX(3px); }
      }
      @keyframes pulse-guide {
        0%,100% { box-shadow: 0 6px 0 rgba(74,14,78,0.14), 0 16px 28px -8px rgba(74,14,78,0.22); outline: 2px solid transparent; }
        25%     { box-shadow: 0 6px 0 rgba(74,14,78,0.14), 0 16px 28px -8px rgba(74,14,78,0.30), 0 0 0 3px rgba(255,215,0,0.6); outline: 2px solid rgba(255,215,0,0.6); }
        55%     { box-shadow: 0 6px 0 rgba(74,14,78,0.14), 0 16px 28px -8px rgba(74,14,78,0.26), 0 0 0 2px rgba(255,215,0,0.35); outline: 2px solid rgba(255,215,0,0.35); }
      }
      .cta-shake { animation: shake-no 0.48s ease-in-out; }
      .guide-pulse { animation: pulse-guide 0.5s ease-in-out; }
      .recap-row { transition: background-color 0.18s ease-out; }
      .recap-row:hover { background: rgba(74,14,78,0.06); }
      .recap-row:active { background: rgba(74,14,78,0.12); }
      .recap-row:focus-visible { outline: 2px solid rgba(74,14,78,0.4); outline-offset: -2px; }
    `}</style>
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      padding: '44px 20px 80px', height: '100%',
      background: 'linear-gradient(180deg, #FFF6D6 0%, #FFF0E2 46%, #FDE6F1 100%)',
      overflow: 'hidden',
    }}>
      {/* ===== Decorative energy layer (gradient blobs + chat bubbles + emoji stickers) ===== */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* gradient blobs — contained above the CTA zone */}
        <div style={{ position: 'absolute', top: -70, right: -70, width: 240, height: 240, borderRadius: '50%', background: '#FFD700', opacity: 0.55, filter: 'blur(72px)' }} />
        <div style={{ position: 'absolute', top: 90, left: -90, width: 210, height: 210, borderRadius: '50%', background: '#FF69B4', opacity: 0.35, filter: 'blur(74px)' }} />
        <div style={{ position: 'absolute', top: 260, right: -60, width: 210, height: 210, borderRadius: '50%', background: '#00BFFF', opacity: 0.28, filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', top: 300, left: -50, width: 190, height: 190, borderRadius: '50%', background: '#FF8C00', opacity: 0.24, filter: 'blur(64px)' }} />

        {/* floating chat bubbles */}
        <div className="a-float" style={{ position: 'absolute', top: 150, left: 16, width: 58, height: 38, background: '#fff', borderRadius: '18px 18px 18px 4px', boxShadow: '0 8px 20px rgba(74,14,78,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, animationDelay: '0.2s' }}>
          {[0, 1, 2].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: 999, background: '#FF69B4' }} />)}
        </div>
        <div className="a-float" style={{ position: 'absolute', top: 232, right: 14, width: 46, height: 32, background: '#4A0E4E', borderRadius: '16px 16px 4px 16px', boxShadow: '0 8px 18px rgba(74,14,78,0.22)', animationDelay: '1.1s' }} />

        {/* paper sticker cards — emoji on a small white note */}
        {[
          { e: '😂', top: 108, right: 22, size: 28, delay: '0s' },
          { e: '🔥', top: 196, left: 18, size: 26, delay: '0.7s' },
          { e: '👀', top: 262, right: 26, size: 24, delay: '1.4s' },
          { e: '💀', top: 310, left: 26, size: 24, delay: '0.4s' },
          { e: '✨', top: 82, left: 90, size: 22, delay: '1.8s' },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', top: s.top, left: s.left, right: s.right,
            transform: `rotate(${emojiRots[i]}deg)`,
            width: s.size + 22, height: s.size + 22,
          }}>
            <div className="a-float" style={{
              width: '100%', height: '100%',
              animationDelay: s.delay,
              background: 'rgba(255,255,255,0.92)',
              borderRadius: 10,
              boxShadow: '0 4px 14px rgba(74,14,78,0.18), 0 1px 3px rgba(74,14,78,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: s.size, lineHeight: 1 }}>{s.e}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Top row: eyebrow + language picker */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div className="a-fade-up" dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', color: '#4A0E4E' }}>re</span>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', color: '#f06449' }}>capped</span>
        </div>
        <button onClick={() => setLangOpen(true)} className="press" aria-label={t.a11y_change_language || `Change language. Current: ${currentLang.name}`} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 10px', height: 34, borderRadius: 999,
          background: '#FFF6E8', border: '1.5px solid rgba(255,255,255,0.85)',
          color: '#573280', cursor: 'pointer',
          boxShadow: '0 4px 0 rgba(87,50,128,0.28), 0 10px 18px -6px rgba(87,50,128,0.35)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.01em' }}>{currentLang.name}</span>
        </button>
      </div>

      {/* Middle — hero. Keeps the CTA pinned & always visible. */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Hero — emotional promise + subtitle */}
      <div className="a-fade-up" style={{
        position: 'relative', zIndex: 10,
        marginTop: 48,
        animationDelay: '0.12s',
        textAlign: 'center',
      }}>
        <h1 className="fs-display" style={{
          fontSize: 'clamp(34px, 10vw, 52px)', lineHeight: 0.96, letterSpacing: '-0.045em',
          fontWeight: 800, margin: 0, color: '#4A0E4E',
          textShadow: '0 1px 0 rgba(255,255,255,0.8), 0 3px 0 rgba(74,14,78,0.18), 0 6px 0 rgba(74,14,78,0.10), 0 12px 18px rgba(74,14,78,0.20)',
          overflowWrap: 'break-word', wordBreak: 'break-word', hyphens: 'auto',
        }}>
          {t.landing_h1_a}{' '}
          <span style={{
            display: 'inline-block',
            maxWidth: '100%',
            background: '#FF1867',
            color: '#fff',
            padding: '2px 12px 5px',
            borderRadius: 999,
            transform: 'rotate(-2.5deg)',
            verticalAlign: 'middle',
            boxShadow: '0 6px 0 #B3003F, 0 14px 24px -6px rgba(180,0,60,0.55)',
            textShadow: '0 1px 0 rgba(0,0,0,0.18)',
            overflowWrap: 'break-word', wordBreak: 'break-word',
          }}>{t.landing_h1_b}</span>{' '}
          {t.landing_h1_c}<br/>
          <span>{t.landing_h1_d}</span>
          {t.landing_h1_e ? <> {t.landing_h1_e}</> : null}
        </h1>
      </div>

      {parseError && (
        <div role="alert" className="a-scale-in" style={{
          position: 'relative', zIndex: 10,
          display: 'flex', gap: 10, marginTop: 12,
          background: 'rgba(240,100,73,0.10)', border: '1px solid rgba(240,100,73,0.35)',
          borderRadius: 14, padding: 14,
        }}>
          <div style={{ flexShrink: 0, marginTop: 2, color: '#f06449' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: '#2a0645' }}>{parseError}</div>
        </div>
      )}
      </div>

      <div className="a-fade-up" style={{
        position: 'relative', zIndex: 10, flexShrink: 0,
        marginTop: 12,
        background: 'rgba(255,255,255,0.82)',
        border: '1.5px solid rgba(255,255,255,0.95)',
        borderRadius: 18,
        padding: '11px 12px',
        boxShadow: '0 6px 0 rgba(74,14,78,0.14), 0 16px 28px -8px rgba(74,14,78,0.22)',
        animationDelay: '0.30s',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: 18, padding: '0 4px 6px',
        }}>
          <span className="fs-sans" style={{
            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: 'rgba(74,14,78,0.55)',
          }}>{t.past_recaps}</span>
          {history.length > 0 && (
            <button onClick={onClearHistory} className="press fs-sans" style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '2px 4px', fontSize: 11.5, fontWeight: 700,
              color: '#d04848', letterSpacing: '-0.01em',
            }}>{t.past_recaps_clear}</button>
          )}
        </div>

        {history.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '18px 8px 14px', textAlign: 'center',
          }}>
            <div aria-hidden="true" style={{
              width: 36, height: 36, borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#fff',
              border: '1.5px solid rgba(255,255,255,0.9)',
              fontSize: 18, lineHeight: 1,
              boxShadow: '0 4px 0 rgba(74,14,78,0.18), 0 10px 18px -4px rgba(74,14,78,0.22)',
            }}>👀</div>
            <div className="fs-sans" style={{
              fontSize: 13, fontWeight: 600, color: 'rgba(74,14,78,0.5)',
              letterSpacing: '-0.005em',
            }}>{t.past_recaps_empty}</div>
          </div>
        ) : (
          <div role="list">
            {history.map((r, i) => {
              const isLast = i === history.length - 1;
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  className="recap-row"
                  onClick={() => onLoadRecap(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onLoadRecap(r.id);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 6px',
                    borderBottom: isLast ? 'none' : '1px solid rgba(74,14,78,0.09)',
                    cursor: 'pointer',
                    borderRadius: 6,
                  }}
                >
                  <span dir="auto" style={{
                    flex: 1, minWidth: 0,
                    fontSize: 14, fontWeight: 600, color: '#2a0645',
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.chatName}</span>
                  <span className="fs-sans" style={{
                    flexShrink: 0, fontSize: 11.5, fontWeight: 500,
                    color: 'rgba(74,14,78,0.5)', letterSpacing: '-0.005em',
                  }}>{relativeTime(r.date, lang)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteRecap(r.id); }}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={t.past_recaps_remove}
                    className="press"
                    style={{
                      flexShrink: 0, width: 22, height: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'rgba(74,14,78,0.4)', fontSize: 14, lineHeight: 1,
                      borderRadius: 999, padding: 0,
                    }}
                  >✕</button>
                  <span aria-hidden="true" style={{
                    flexShrink: 0, fontSize: 16, color: 'rgba(74,14,78,0.55)',
                    fontWeight: 700, lineHeight: 1,
                  }}>→</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="a-fade-up" style={{ position: 'relative', zIndex: 10, flexShrink: 0, paddingTop: 16, animationDelay: '0.45s' }}>
        <input ref={fileInputRef} type="file" accept=".txt,.zip,application/zip,text/plain"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />

        {/* Prereq card — shows the 2-step flow so the upload CTA has context */}
        {onHowTo && (
          <div className={howToPulse ? 'guide-pulse' : ''} style={{
            marginBottom: 10,
            background: 'rgba(255,255,255,0.82)',
            border: '1.5px solid rgba(255,255,255,0.95)',
            borderRadius: 18,
            padding: '11px 12px',
            boxShadow: '0 6px 0 rgba(74,14,78,0.14), 0 16px 28px -8px rgba(74,14,78,0.22)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: 999,
                background: '#4A0E4E', color: '#FFD700',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
              }}>1</div>
              <div className="fs-sans" dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#2a0645', lineHeight: 1.25, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {t.landing_step1}
              </div>
              <button onClick={onHowTo} className="press fs-sans" style={{
                flexShrink: 0, padding: '5px 10px',
                background: '#4A0E4E', border: 'none', borderRadius: 9,
                color: '#FFD700', fontSize: 11.5, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '-0.01em',
              }}>
                {t.howto_link}
              </button>
            </div>
            <div style={{ height: 1, background: 'rgba(74,14,78,0.09)', margin: '9px 0' }} />
            <button onClick={() => fileInputRef.current?.click()} className="press fs-sans" style={{
              display: 'flex', alignItems: 'center', gap: 9,
              width: '100%', background: 'transparent', border: 'none',
              padding: 0, cursor: 'pointer', textAlign: 'start',
            }}>
              <div style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: 999,
                background: '#4A0E4E', color: '#FFD700',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
              }}>2</div>
              <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#2a0645', lineHeight: 1.25, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {t.landing_step2}
              </div>
              <div dir="ltr" style={{
                flexShrink: 0, padding: '5px 10px',
                background: '#FFF6E8', border: '1px solid rgba(74,14,78,0.10)',
                borderRadius: 9, color: '#4A0E4E', fontSize: 11.5, fontWeight: 700,
                whiteSpace: 'nowrap', letterSpacing: '-0.01em',
              }}>
                Upload ↑
              </div>
            </button>
          </div>
        )}

        {/* Main CTA — big, exciting, the obvious next action */}
        <button onClick={handleCtaClick} className={`press a-gradient-shift${shaking ? ' cta-shake' : ''}`} style={{
          width: '100%', position: 'relative', overflow: 'hidden',
          padding: '20px 18px', color: '#4A0E4E',
          background: 'linear-gradient(135deg, #FFE45C 0%, #FFD700 50%, #FFB800 100%)',
          backgroundSize: '200% 200%',
          border: '2px solid rgba(255,255,255,0.7)', borderRadius: 22,
          fontSize: 20, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.01em',
          boxShadow: '0 5px 0 #E0A800, 0 12px 22px -8px rgba(224,168,0,0.45)',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <span className="fs-display" style={{ position: 'relative' }}>{t.landing_cta}</span>
        </button>

        {/* Media toggle — turns on/off photos, voice, sticker, video analysis */}
        {setIncludeMedia && (
          <button
            type="button"
            onClick={() => setIncludeMedia(!includeMedia)}
            aria-pressed={includeMedia}
            className="press"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', marginTop: 10, padding: '11px 14px',
              background: includeMedia ? 'rgba(0,191,255,0.14)' : 'rgba(74,14,78,0.05)',
              border: `2px solid ${includeMedia ? 'rgba(0,191,255,0.45)' : 'rgba(74,14,78,0.12)'}`,
              borderRadius: 16, cursor: 'pointer', font: 'inherit', textAlign: 'start',
            }}>
            <div style={{ fontSize: 22, flexShrink: 0 }}>{includeMedia ? '📸' : '📝'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fs-sans" style={{ fontSize: 14, fontWeight: 800, color: '#4A0E4E', lineHeight: 1.15 }}>
                {t.landing_media_title}
              </div>
              <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(74,14,78,0.6)', marginTop: 2 }}>
                {includeMedia ? t.landing_media_on : t.landing_media_off}
              </div>
            </div>
            {/* iOS-style switch */}
            <div style={{
              flexShrink: 0, width: 40, height: 24, borderRadius: 999,
              background: includeMedia ? '#00BFFF' : 'rgba(74,14,78,0.18)',
              position: 'relative', transition: 'background 0.18s',
            }}>
              <div style={{
                position: 'absolute', top: 2, insetInlineStart: includeMedia ? 18 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.18)', transition: 'inset-inline-start 0.18s',
              }} />
            </div>
          </button>
        )}

        {/* Secondary: demo only — how-to is now surfaced in the prereq card above */}
        {onDemo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            <button onClick={onDemo} className="press fs-sans" style={{
              padding: '8px 4px', background: 'transparent', border: 'none',
              color: 'rgba(74,14,78,0.55)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
              {t.landing_demo_soft}
            </button>
          </div>
        )}
      </div>

      {/* Trust footer — pinned to bottom of container */}
      <div className="fs-sans" style={{
        position: 'absolute', bottom: 20, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        textAlign: 'center',
        fontSize: 11.5, color: 'rgba(74,14,78,0.45)', lineHeight: 1.4,
        pointerEvents: 'none',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        {t.landing_trust}
      </div>

    {langOpen && (
        <BottomSheet onClose={() => setLangOpen(false)} title="Language">
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
    </>
  );
}
