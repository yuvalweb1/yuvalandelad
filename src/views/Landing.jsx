import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import BottomSheet from '../components/BottomSheet.jsx';
import { relativeTime } from '../lib/history.js';
import { interp } from '../i18n';

// Per-period accent colors so each time window reads as its own thing at a
// glance. `solid` = active pill background (white text); `tint` = inactive
// background; `text` = inactive label color. All chosen for ≥4.5:1 contrast.
const PERIOD_COLORS = {
  all:    { solid: '#4A0E4E', tint: 'rgba(74,14,78,0.08)',   text: '#4A0E4E' }, // brand deep purple
  year:   { solid: '#1E40AF', tint: 'rgba(30,64,175,0.09)',  text: '#1E40AF' }, // indigo
  season: { solid: '#047857', tint: 'rgba(4,120,87,0.10)',   text: '#047857' }, // emerald
  month:  { solid: '#B45309', tint: 'rgba(180,83,9,0.10)',   text: '#B45309' }, // amber
};

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

export default function Landing({
  onFile, onDemo, parseError, t, lang, setLang, onHowTo, onModes, onOpenSettings,
  includeMedia = true, setIncludeMedia,
  history = [], onLoadRecap, onDeleteRecap, onClearHistory,
  selectedRecapId = null, onSelectRecap,
  period = 'all', setPeriod, periodChoices = ['all'], previewStats = null,
  autoOpenPicker = false, onAutoOpenPickerHandled,
}) {
  const fileInputRef = useRef(null);
  const [langOpen, setLangOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [howToPulse, setHowToPulse] = useState(false);
  const [loading, setLoading] = useState(false);
  const isRTL = lang === 'he' || lang === 'ar';
  const emojiRots = useMemo(() => [10, -13, 16, -9, 12].map(base => {
    const jitter = ((Math.random() * 12) | 0) - 6;
    return base + jitter;
  }), []);

  // Coming back from the how-to guide with no chat imported yet — open the
  // file picker immediately so the guide reads as a call to action.
  useEffect(() => {
    if (!autoOpenPicker) return;
    fileInputRef.current?.click();
    onAutoOpenPickerHandled?.();
  }, [autoOpenPicker, onAutoOpenPickerHandled]);

  // Selection is controlled by App (so it can hold the chat's messages in
  // memory for the live per-window preview). A fresh upload parses on select
  // and comes back as the most-recent history entry, already selected.
  const selectedHistoryItem = selectedRecapId ? history.find(r => r.id === selectedRecapId) : null;
  const hasSelection = selectedHistoryItem != null;
  // Nothing imported yet — the card has no chat to point at, so it reads as a
  // dimmed, inert placeholder rather than an actionable selection.
  const noImport = history.length === 0;

  const handleCtaMain = useCallback(async () => {
    if (!selectedHistoryItem) {
      setShaking(true);
      setHowToPulse(true);
      setTimeout(() => { setShaking(false); setHowToPulse(false); }, 520);
      return;
    }
    if (loading) return;
    // Big chats: onLoadRecap runs a synchronous computeAll() that blocks the
    // main thread for ~1s with no feedback (messages are already in memory, so
    // there's no await to yield on). Flip on the loading state and wait two
    // frames so the spinner actually paints before the freeze begins. The
    // spinner is transform-based, so the compositor keeps it turning even while
    // JS is blocked.
    setLoading(true);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    try {
      await onLoadRecap(selectedHistoryItem.id);
      // Success unmounts Landing (stage change), so no need to reset loading.
    } catch {
      setLoading(false);
    }
  }, [selectedHistoryItem, onLoadRecap, loading]);

  // Parse-on-select: picking a file starts parsing immediately (full-screen
  // Parsing stage), then returns here with the chat selected + stats populated.
  const handleFileChange = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = '';
  }, [onFile]);

  const handleSwitchClick = useCallback(() => {
    if (history.length > 0) {
      setHistoryOpen(true);
    } else {
      setHowToPulse(true);
      setTimeout(() => setHowToPulse(false), 520);
    }
  }, [history.length]);

  const handleSelectHistory = useCallback((id) => {
    onSelectRecap?.(id);
    setHistoryOpen(false);
  }, [onSelectRecap]);

  const handleDemo = useCallback(async () => {
    const res = await fetch('demo_chat.txt');
    const text = await res.text();
    const file = new File([text], 'WhatsApp Chat with The Squad.txt', { type: 'text/plain' });
    onFile(file);
  }, [onFile]);

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
      @keyframes cta-ring {
        0%   { box-shadow: 0 4px 0 rgba(30,0,40,0.30), 0 0 0 0px rgba(255,215,0,0.55); }
        60%  { box-shadow: 0 4px 0 rgba(30,0,40,0.30), 0 0 0 7px rgba(255,215,0,0); }
        100% { box-shadow: 0 4px 0 rgba(30,0,40,0.30), 0 0 0 0px rgba(255,215,0,0); }
      }
      @keyframes card-swap-in {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      /* Soft content swap inside the persistent shared card slot (tutorial ⇄ modes). */
      .card-swap-in { animation: card-swap-in 0.18s ease-out both; }
      @media (prefers-reduced-motion: reduce) {
        .card-swap-in { animation-duration: 0.001ms !important; }
      }
      .cta-card-ring { animation: cta-ring 2s ease-out infinite; }
      .cta-shake { animation: shake-no 0.48s ease-in-out; }
      .guide-pulse { animation: pulse-guide 0.5s ease-in-out; }
      .recap-row { transition: background-color 0.18s ease-out; }
      .recap-row:hover { background: rgba(74,14,78,0.06); }
      .recap-row:active { background: rgba(74,14,78,0.12); }
      .recap-row:focus-visible { outline: 2px solid rgba(74,14,78,0.4); outline-offset: -2px; }
    `}</style>
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      padding: '44px 20px calc(92px + var(--safe-bottom, 0px))', height: '100%',
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

      {/* Top row: eyebrow + language picker — dir="ltr" keeps the brand and the
          settings button from swapping sides under RTL languages. */}
      <div dir="ltr" style={{
        position: 'relative', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div className="a-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <img src="/icon-377.png" alt="" style={{
            width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
            boxShadow: '0 2px 6px rgba(42,6,69,0.18)',
          }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span className="fs-display" style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.04em', color: '#4A0E4E' }}>reccaped</span>
          </div>
        </div>
        {onOpenSettings && (
          <button onClick={onOpenSettings} className="press" aria-label={t.settings_title || 'Settings'} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 999,
            background: '#FFF6E8', border: '1.5px solid rgba(255,255,255,0.85)',
            color: '#573280', cursor: 'pointer',
            boxShadow: '0 4px 0 rgba(87,50,128,0.28), 0 10px 18px -6px rgba(87,50,128,0.35)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
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

      {/* ===== NOW SELECTED card ===== */}
      <div className="a-fade-up" style={{
        position: 'relative', zIndex: 10, flexShrink: 0,
        marginTop: 10, animationDelay: '0.28s',
      }}>
        <div style={{
          background: noImport ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.82)',
          border: '1.5px solid rgba(255,255,255,0.95)',
          borderRadius: 14,
          padding: '8px 9px',
          boxShadow: noImport
            ? '0 2px 0 rgba(74,14,78,0.06), 0 6px 12px -6px rgba(74,14,78,0.10)'
            : '0 4px 0 rgba(74,14,78,0.12), 0 10px 18px -6px rgba(74,14,78,0.18)',
          opacity: noImport ? 0.6 : 1,
          transition: 'opacity 0.25s, background 0.25s, box-shadow 0.25s',
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasSelection ? 6 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span aria-hidden="true" style={{ color: '#FF1867', fontSize: 9, lineHeight: 1 }}>★</span>
              <span className="fs-mono" style={{
                fontSize: 8, fontWeight: 700, letterSpacing: '0.13em',
                color: 'rgba(74,14,78,0.55)', textTransform: 'uppercase',
              }}>
                {hasSelection ? (t.landing_now_selected || 'NOW SELECTED') : (t.landing_no_chat_selected || 'NO CHAT SELECTED')}
              </span>
            </div>
            <button
              onClick={handleSwitchClick}
              className="press fs-sans"
              aria-disabled={noImport}
              style={{
                padding: '6px 10px',
                background: 'rgba(74,14,78,0.08)',
                border: 'none', borderRadius: 8,
                fontSize: 10, fontWeight: 700, color: '#573280',
                cursor: noImport ? 'not-allowed' : 'pointer', letterSpacing: '-0.01em',
                opacity: noImport ? 0.45 : 1,
              }}>
              SWITCH ↓
            </button>
          </div>

          {hasSelection && (
            <>
              {/* Chat identity row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  flexShrink: 0, width: 26, height: 26, borderRadius: 999,
                  background: '#FF69B4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13,
                }}>
                  💬
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div dir="auto" style={{
                    fontSize: 14, fontWeight: 800, color: '#2a0645',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}>
                    {selectedHistoryItem?.chatName}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(74,14,78,0.50)', marginTop: 1, lineHeight: 1.3 }}>
                    {selectedHistoryItem
                      ? interp(t.landing_history_viewed || 'Last watched {rel}', {
                          rel: relativeTime(selectedHistoryItem.date, lang),
                        })
                      : ''}
                  </div>
                </div>
              </div>

              {/* Stats row — live values for the selected trailing window */}
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 7 }}>
                {[
                  {
                    label: t.landing_stat_messages || 'MESSAGES',
                    value: previewStats?.totalMessages != null
                      ? previewStats.totalMessages.toLocaleString() : '—',
                  },
                  {
                    label: t.landing_stat_people || 'PEOPLE',
                    value: previewStats?.totalParticipants ?? '—',
                  },
                ].map((stat) => (
                  <div key={stat.label} style={{
                    flex: 1, textAlign: 'center',
                    padding: '0 4px',
                  }}>
                    <div className="fs-sans" style={{
                      fontSize: 13, fontWeight: 800, lineHeight: 1, color: '#2a0645',
                    }}>
                      {stat.value}
                    </div>
                    <div className="fs-mono" style={{
                      fontSize: 7.5, fontWeight: 700, letterSpacing: '0.10em',
                      color: 'rgba(74,14,78,0.45)', textTransform: 'uppercase', marginTop: 1,
                    }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time-period picker — trailing windows ending at the last message.
                  Only shown when more than one window is meaningful for this chat. */}
              {setPeriod && periodChoices.length > 1 && (
                <div role="group" aria-label={t.period_all || 'Time period'} style={{ display: 'flex', gap: 5, marginTop: 7 }}>
                  {periodChoices.map(p => {
                    const active = period === p;
                    const c = PERIOD_COLORS[p] || PERIOD_COLORS.all;
                    return (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        aria-pressed={active}
                        className="press fs-sans"
                        style={{
                          flex: 1, padding: '6px 4px', borderRadius: 999,
                          border: 'none', cursor: 'pointer',
                          fontSize: 10.5, fontWeight: 700, letterSpacing: '-0.01em',
                          background: active ? c.solid : c.tint,
                          color: active ? '#fff' : c.text,
                          transition: 'background 0.18s ease-out, color 0.18s ease-out',
                        }}>
                        {t[`period_${p}`] || p}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>


      <div className="a-fade-up" style={{ position: 'relative', zIndex: 10, flexShrink: 0, paddingTop: hasSelection ? 8 : 16, animationDelay: '0.45s' }}>
        <input ref={fileInputRef} type="file" accept=".txt,.zip,application/zip,text/plain"
          style={{ display: 'none' }}
          onChange={handleFileChange} />

        {/* Shared card slot — ONE persistent container; its children swap by
            import state. Empty → full "How to export" tutorial; populated →
            Modes entry. Never unmount the slot; the keyed children crossfade. */}
        <div style={{ marginBottom: 14 }}>
          {!hasSelection ? (
            /* Empty state — illustrated, dummy-proof export tutorial. */
            <div
              key="tutorial"
              className={`card-swap-in${howToPulse ? ' guide-pulse' : ''}`}
              style={{
                background: 'rgba(255,255,255,0.82)',
                border: '1.5px solid rgba(255,255,255,0.95)',
                borderRadius: 18,
                padding: '13px 14px 14px',
                boxShadow: '0 6px 0 rgba(74,14,78,0.14), 0 16px 28px -8px rgba(74,14,78,0.22)',
              }}>
              {/* eyebrow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 11 }}>
                <span aria-hidden="true" style={{ color: '#FF1867', fontSize: 9, lineHeight: 1 }}>★</span>
                <span className="fs-mono" style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.13em',
                  color: 'rgba(74,14,78,0.55)', textTransform: 'uppercase',
                }}>
                  {t.landing_howto_eyebrow || 'STEP 1 · EXPORT YOUR CHAT'}
                </span>
              </div>

              {/* full step-by-step guide */}
              {onHowTo && (
                <button onClick={onHowTo} className="press cta-card-ring" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%',
                  background: 'linear-gradient(135deg, #4A0E4E 0%, #6B1A72 100%)',
                  border: '1.5px solid rgba(255,215,0,0.25)', borderRadius: 13,
                  padding: '12px 16px', cursor: 'pointer',
                  color: '#FFD700', fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em',
                }}>
                  <span className="fs-sans">{t.howto_link || 'How to export'}</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: isRTL ? 'scaleX(-1)' : undefined }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              )}
            </div>
          ) : (
            /* Populated state — Modes entry, matching the primary CTA's shape &
               weight but in the brand purple so the yellow recap CTA stays the
               single primary action below it. */
            <button
              key="modes"
              onClick={onModes}
              className="card-swap-in press"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                width: '100%', padding: '22px 20px',
                background: 'linear-gradient(135deg, #4A0E4E 0%, #6B1A72 100%)',
                border: '2px solid rgba(255,255,255,0.18)', borderRadius: 24,
                color: '#FFD700', fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em',
                cursor: 'pointer',
                boxShadow: '0 8px 0 rgba(30,0,40,0.40), 0 18px 32px -8px rgba(74,14,78,0.42)',
              }}>
              <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" />
                  <path d="M5 16.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1L2 19.5l2.1-.9z" />
                </svg>
              </span>
              <span className="fs-display">{t.landing_modes_cta || 'Explore modes'}</span>
            </button>
          )}
        </div>

        {/* Main CTA — primary action, gets the strongest visual weight */}
        <button
          onClick={handleCtaMain}
          aria-busy={loading}
          disabled={loading}
          className={`press${shaking && !hasSelection ? ' cta-shake' : ''}`}
          style={{
            width: '100%', position: 'relative', overflow: 'hidden',
            padding: '22px 20px',
            color: hasSelection ? '#2a0645' : 'rgba(74,14,78,0.58)',
            background: hasSelection
              ? 'linear-gradient(135deg, #FFD700 0%, #FFC200 100%)'
              : 'linear-gradient(135deg, rgba(235,215,200,0.78) 0%, rgba(218,205,188,0.72) 100%)',
            border: hasSelection ? '2px solid rgba(255,255,255,0.80)' : '2px solid rgba(255,255,255,0.72)',
            borderRadius: 24,
            fontSize: 21, fontWeight: 800,
            cursor: loading ? 'progress' : (hasSelection ? 'pointer' : 'not-allowed'),
            letterSpacing: '-0.01em',
            boxShadow: hasSelection
              ? '0 8px 0 rgba(74,14,78,0.28), 0 18px 32px -8px rgba(74,14,78,0.32)'
              : '0 4px 0 rgba(74,14,78,0.13), 0 10px 20px -6px rgba(74,14,78,0.14)',
            opacity: hasSelection ? 1 : 0.50,
            transition: 'background 0.25s, color 0.25s, box-shadow 0.25s, opacity 0.25s',
          }}>
          <span className="fs-display" style={{
            position: 'relative',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            {loading && (
              // Transform-based spin keeps turning on the compositor thread even
              // while the synchronous analytics pass blocks the main thread.
              <span className="a-spin" aria-hidden="true" style={{
                width: 22, height: 22, flexShrink: 0,
                border: '3px solid rgba(74,14,78,0.25)',
                borderTopColor: '#2a0645',
                borderRadius: '50%',
              }} />
            )}
            {loading ? (t.landing_cta_loading || 'Exposing…') : t.landing_cta}
          </span>
        </button>

        {/* Secondary: demo only — upload-existing-file moved to Settings */}
        {onDemo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            <button onClick={handleDemo} className="press fs-sans" style={{
              padding: '8px 4px', background: 'transparent', border: 'none',
              color: 'rgba(74,14,78,0.55)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
              {t.landing_demo_soft}
            </button>
          </div>
        )}
      </div>

    {langOpen && (
        <BottomSheet light onClose={() => setLangOpen(false)} title="Language">
          {LANGUAGES.map(l => (
            <button key={l.code} className="press" onClick={() => {
              setLang(l.code);
              setLangOpen(false);
            }} style={{
              width: '100%', padding: '16px 8px', minHeight: 56, background: 'transparent',
              border: 'none', borderBottom: '1px solid rgba(74,14,78,0.09)', color: '#2a0645',
              fontSize: 23, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="cw-flag" style={{ fontSize: 22 }}>{l.flag}</span>
                <span style={{ fontSize: 23, fontWeight: 600 }}>{l.name}</span>
              </div>
              {l.code === lang && (
                <span style={{ color: '#4A0E4E', fontSize: 18 }}>✓</span>
              )}
            </button>
          ))}
        </BottomSheet>
      )}

      {historyOpen && (
        <BottomSheet light onClose={() => setHistoryOpen(false)} title={t.past_recaps}>
          {history.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 8px', minHeight: 56,
              borderBottom: '1px solid rgba(74,14,78,0.09)',
            }}>
              <button
                onClick={() => handleSelectHistory(r.id)}
                className="press recap-row"
                style={{
                  flex: 1, minWidth: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
                  background: r.id === selectedRecapId ? 'rgba(74,14,78,0.06)' : 'transparent',
                  border: 'none', color: '#2a0645',
                  textAlign: 'start', cursor: 'pointer', padding: '4px 6px',
                  borderRadius: 10,
                }}>
                <div dir="auto" style={{
                  fontSize: 18, fontWeight: 600, color: '#2a0645',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  width: '100%',
                }}>{r.chatName}</div>
                <div className="fs-mono" style={{
                  fontSize: 12, color: 'rgba(74,14,78,0.50)', letterSpacing: '0.04em',
                }}>{relativeTime(r.date, lang)}</div>
              </button>
              {r.id === selectedRecapId && (
                <span style={{ fontSize: 16, color: '#FF1867', flexShrink: 0 }}>✓</span>
              )}
              <button
                onClick={() => onDeleteRecap(r.id)}
                aria-label={t.past_recaps_remove}
                className="press"
                style={{
                  flexShrink: 0, width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(74,14,78,0.07)', border: 'none', cursor: 'pointer',
                  color: 'rgba(74,14,78,0.50)', fontSize: 15,
                  borderRadius: 999,
                }}
              >✕</button>
            </div>
          ))}
          {/* Safety net — export help, exactly when a returning user is
              adding/switching a chat. Low-emphasis link, not a primary action. */}
          {onHowTo && (
            <button
              onClick={() => { setHistoryOpen(false); onHowTo(); }}
              className="press fs-sans"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', marginTop: 6, padding: '14px 8px', minHeight: 48,
                background: 'transparent', border: 'none',
                color: 'rgba(74,14,78,0.60)', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
              }}>
              <span aria-hidden="true">📖</span>
              <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {t.howto_link || 'How to export'}
              </span>
            </button>
          )}
        </BottomSheet>
      )}
    </div>
    </>
  );
}
