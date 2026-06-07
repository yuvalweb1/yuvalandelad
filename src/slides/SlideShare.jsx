import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { typedCopy } from '../i18n';
import { CardBananaDrop, CardStickerZine, CardReceipt, CardY2KChrome, buildCardData } from './shareCards.jsx';

// SlideShare — the final slide. Hero IS the carousel: active card centered large,
// adjacent cards peek in from sides. Swipe or tap peeks to switch styles.

const INK_PLUM = '#2a0645';
const INK_DEEP = '#4A0E4E';
const CORAL    = '#f06449';
const GOLD     = '#FFD700';
const ORANGE   = '#FF8C00';
const CREAM    = '#FFF6D6';
const PINK     = '#FDE6F1';

const OPTIONS = [
  { id: 'A', nameKey: 'share_style_a', glyph: '🍌', grad: ['#FFE259', '#FFA751'], ink: INK_PLUM, Comp: CardBananaDrop },
  { id: 'B', nameKey: 'share_style_b', glyph: '✿',  grad: ['#FFF3E0', '#FDE6F1'], ink: INK_DEEP, Comp: CardStickerZine },
  { id: 'C', nameKey: 'share_style_c', glyph: '🧾', grad: ['#FBF7EE', '#E8DFcf'], ink: INK_PLUM, Comp: CardReceipt },
  { id: 'D', nameKey: 'share_style_d', glyph: '💿', grad: ['#A6D8FF', '#C9B6E8'], ink: INK_DEEP, Comp: CardY2KChrome },
];

const nf = (n) => (n ?? 0).toLocaleString();

function PlaceholderCard({ opt, headline, label, w }) {
  const isThumb = w < 90;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(155deg, ${opt.grad[0]} 0%, ${opt.grad[1]} 100%)`,
      color: opt.ink,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: w * 0.08, gap: w * 0.04,
      textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontSize: w * (isThumb ? 0.34 : 0.2), lineHeight: 1 }}>{opt.glyph}</div>
      {!isThumb && (
        <>
          <div className="fs-display" style={{
            fontSize: w * 0.26, fontWeight: 800, letterSpacing: '-0.04em',
            lineHeight: 0.92, color: opt.ink,
          }}>{headline}</div>
          <div className="fs-mono" style={{
            fontSize: w * 0.062, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', opacity: 0.6,
          }}>{label}</div>
        </>
      )}
    </div>
  );
}

function StoryPreview({ opt, data, width, radius = 14, border, shadow, headline, label }) {
  const SRC_W = 540, SRC_H = 960;
  const height = Math.round(width * (SRC_H / SRC_W));
  const Comp = opt.Comp;
  return (
    <div style={{
      width, height, borderRadius: radius, overflow: 'hidden',
      position: 'relative', flexShrink: 0,
      border: border || `2px solid ${INK_DEEP}`,
      boxShadow: shadow, background: '#000',
    }}>
      {Comp && data ? (
        <div style={{ width: SRC_W, height: SRC_H, transform: `scale(${width / SRC_W})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>
          <Comp format="story" data={data} />
        </div>
      ) : (
        <PlaceholderCard opt={opt} headline={headline} label={label} w={width} />
      )}
    </div>
  );
}

function ChromeBg() {
  const blobs = [
    { top: -60, left: -50, size: 240, color: '#FFD972', op: 0.5 },
    { top: 110, right: -70, size: 200, color: PINK, op: 0.8 },
    { bottom: -40, left: -30, size: 260, color: '#FFCFC0', op: 0.6 },
    { bottom: 180, right: -40, size: 160, color: '#C9B6E8', op: 0.45 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {blobs.map((b, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: b.top, left: b.left, right: b.right, bottom: b.bottom,
          width: b.size, height: b.size, borderRadius: '50%',
          background: b.color, opacity: b.op, filter: 'blur(70px)',
        }} />
      ))}
    </div>
  );
}

function getChatName(diagnostics) {
  const detected = diagnostics?.detectedGroupName;
  if (detected) {
    const parts = detected.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return null;
}

function titleFontSize(lead, name) {
  const emojiBonus = (name?.match(/\p{Emoji}/gu) || []).length;
  const total = (lead?.length || 0) + (name?.length || 0) + emojiBonus + 2;
  if (total <= 18) return 28;
  if (total <= 22) return 24;
  if (total <= 28) return 20;
  if (total <= 35) return 16;
  return 13;
}

// Full-width hero carousel. Active card is centered; adjacent cards peek from sides.
// Swipe left/right or tap a peeking card to change selection.
// Uses overflow: visible so the slide's own overflow:hidden does the edge clipping,
// which lets the label pill + shadow render above/below without being cut.
function HeroCarousel({ options, pickedId, setPickedId, cardData, headline, headLabel, t }) {
  const currentIndex = options.findIndex(o => o.id === pickedId);
  const [touchStart, setTouchStart] = useState(null);
  const containerRef = useRef(null);
  const [cw, setCw] = useState(390);

  useEffect(() => {
    if (containerRef.current) setCw(containerRef.current.offsetWidth);
  }, []);

  const CARD_W = 257;
  const GAP    = 16;
  const SLOT   = CARD_W + GAP;

  // translateX so active card is horizontally centered in container
  const offset = Math.round(cw / 2 - CARD_W / 2 - currentIndex * SLOT);

  const prev = () => setPickedId(options[(currentIndex - 1 + options.length) % options.length].id);
  const next = () => setPickedId(options[(currentIndex + 1) % options.length].id);

  const onTouchStart = (e) => { e.stopPropagation(); setTouchStart(e.touches[0].clientX); };
  const onTouchEnd   = (e) => {
    e.stopPropagation();
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 28) diff > 0 ? next() : prev();
    setTouchStart(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {/* strip — overflow visible so slide edge does the clipping */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ width: '100%', overflow: 'visible', position: 'relative', paddingTop: 18, paddingBottom: 10 }}
      >
        <div style={{
          display: 'flex',
          gap: GAP,
          transform: `translateX(${offset}px)`,
          transition: 'transform 0.3s cubic-bezier(0.34, 1.1, 0.64, 1)',
          willChange: 'transform',
        }}>
          {options.map(opt => {
            const isActive = opt.id === pickedId;
            return (
              <div
                key={opt.id}
                onClick={() => { if (!isActive) setPickedId(opt.id); }}
                style={{
                  flexShrink: 0, position: 'relative',
                  cursor: isActive ? 'default' : 'pointer',
                  opacity: isActive ? 1 : 0.42,
                  transform: isActive ? 'scale(1)' : 'scale(0.87)',
                  transition: 'opacity 0.28s ease-out, transform 0.28s ease-out',
                  transformOrigin: 'center top',
                }}
              >
                {isActive && (
                  <>
                    {/* offset block shadow */}
                    <div style={{
                      position: 'absolute', inset: 0, background: INK_DEEP, borderRadius: 18,
                      transform: 'translate(7px, 9px)', opacity: 0.15, filter: 'blur(2px)',
                    }} />
                    {/* style label pill */}
                    <div className="fs-mono" style={{
                      position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                      background: INK_DEEP, color: GOLD, borderRadius: 999, padding: '4px 11px',
                      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                      boxShadow: `1px 2px 0 rgba(42,6,69,0.22)`, whiteSpace: 'nowrap', zIndex: 2,
                    }}>
                      {opt.id} · {t[opt.nameKey] || opt.id}
                    </div>
                  </>
                )}
                <StoryPreview
                  opt={opt}
                  data={cardData}
                  width={CARD_W}
                  radius={isActive ? 18 : 14}
                  border={isActive ? `2.5px solid ${INK_DEEP}` : `1.5px solid rgba(42,6,69,0.14)`}
                  shadow={isActive
                    ? `0 20px 40px -10px rgba(42,6,69,0.45), 0 2px 0 rgba(255,255,255,0.6) inset`
                    : `0 4px 12px rgba(42,6,69,0.07)`}
                  headline={headline}
                  label={headLabel}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* dot indicators */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {options.map((opt, i) => (
          <button
            key={opt.id}
            onClick={() => setPickedId(opt.id)}
            aria-label={t[opt.nameKey] || opt.id}
            style={{ appearance: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', background: 'transparent' }}
          >
            <div style={{
              height: 5, borderRadius: 3,
              width: i === currentIndex ? 20 : 5,
              background: i === currentIndex ? INK_DEEP : 'rgba(42,6,69,0.22)',
              transition: 'width 0.22s ease-out, background 0.22s ease-out',
            }} />
          </button>
        ))}
      </div>
    </div>
  );
}

const SlideShare = React.memo(function SlideShare({ a, t, profile, diagnostics, u, onRoastMode }) {
  const type = profile?.relationship || 'other';
  const [pickedId, setPickedId] = useState('A');
  const [busy, setBusy] = useState(null);

  const cardData = buildCardData(a, profile, t);
  const headline = nf(a?.totalMessages);
  const headLabel = t.go_messages || 'messages';

  const otherParticipant = u && a?.users?.find(x => x.author !== u.author)?.author;
  const chatName = getChatName(diagnostics) || otherParticipant || typedCopy(t, 'share_highlight', type);
  const titleSize = titleFontSize(t.share_title_lead, chatName);

  // Hidden full-size (540×960) render of the active card. html2canvas
  // captures THIS node — not the scaled-down preview — so the saved PNG
  // is sharp at story dimensions. Kept in the DOM at all times so the
  // capture is one synchronous step away when the user taps share.
  const captureRef = useRef(null);
  const activeOpt = OPTIONS.find(o => o.id === pickedId) || OPTIONS[0];
  const ActiveComp = activeOpt.Comp;

  async function captureBlob() {
    if (!captureRef.current) return null;
    const canvas = await html2canvas(captureRef.current, {
      backgroundColor: null,
      scale: 2,                       // 2× = retina-sharp 1080×1920
      useCORS: true,
      logging: false,
      width: 540,
      height: 960,
    });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
  }

  const shareText = `${headline} ${headLabel}. ${t.share_caught || 'on ChatWrapped'} → ${location.origin}`;

  const onShareWhatsApp = async () => {
    if (busy) return;
    setBusy('whatsapp');
    try {
      const blob = await captureBlob();
      if (blob && navigator.share && navigator.canShare?.({ files: [new File([blob], 'recapped.png', { type: 'image/png' })] })) {
        try {
          await navigator.share({
            files: [new File([blob], 'recapped.png', { type: 'image/png' })],
            text: shareText,
          });
          return;
        } catch (e) { if (e?.name === 'AbortError') return; /* fall through to wa.me */ }
      }
      // Fallback for desktop / browsers without file-share support: open
      // WhatsApp's universal link with a text-only payload. The user can
      // then attach the image manually if they saved it first.
      const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(url, '_blank', 'noopener');
    } finally { setBusy(null); }
  };

  const onSaveImage = async () => {
    if (busy) return;
    setBusy('save');
    try {
      const blob = await captureBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recapped-${(chatName || 'chat').replace(/[^a-z0-9\-]/gi, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally { setBusy(null); }
  };

  const onShareElse = async () => {
    if (busy) return;
    setBusy('else');
    try {
      const blob = await captureBlob();
      const file = blob && new File([blob], 'recapped.png', { type: 'image/png' });
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text: shareText }); return; }
        catch (e) { if (e?.name === 'AbortError') return; }
      }
      if (navigator.share) {
        try { await navigator.share({ text: shareText, url: location.origin }); return; }
        catch (e) { if (e?.name === 'AbortError') return; }
      }
      // No share sheet at all (older desktop browsers): copy link to clipboard.
      try { await navigator.clipboard.writeText(shareText); } catch {}
    } finally { setBusy(null); }
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: `linear-gradient(180deg, ${CREAM} 0%, #FFF0E2 46%, ${PINK} 100%)`,
      color: INK_PLUM,
      display: 'flex', flexDirection: 'column',
      paddingTop: 'calc(var(--safe-top, 0px) + 42px)',
      paddingBottom: 'calc(var(--safe-bottom, 0px) + 14px)',
    }}>
      <ChromeBg />

      {/* eyebrow + title */}
      <div className="a-fade-up" style={{ position: 'relative', padding: '8px 24px 0', animationDelay: '0.05s' }}>
        <div className="fs-mono" style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: CORAL, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}>
          <span style={{ color: ORANGE }}>✦</span> {t.share_eyebrow}
        </div>
        <div className="fs-display" style={{
          fontSize: titleSize, fontWeight: 800, letterSpacing: '-0.04em',
          lineHeight: 1.15, color: INK_PLUM,
          whiteSpace: 'nowrap', overflow: 'hidden',
        }}>
          {t.share_title_lead}{' '}
          <span className="fs-serif" style={{ fontStyle: 'italic', fontWeight: 400, color: CORAL }}>
            {chatName}.
          </span>
        </div>
      </div>

      {/* hero carousel */}
      <div className="a-pop-in" style={{ position: 'relative', marginTop: 16, animationDelay: '0.1s' }}>
        <HeroCarousel
          options={OPTIONS}
          pickedId={pickedId}
          setPickedId={setPickedId}
          cardData={cardData}
          headline={headline}
          headLabel={headLabel}
          t={t}
        />
      </div>

      {/* pushes CTAs to bottom */}
      <div style={{ flex: 1, minHeight: 8 }} />

      {/* Hidden full-size capture target — sits offscreen, always rendered
          so html2canvas can read the active card synchronously. aria-hidden
          and pointer-events:none keep it out of the user's way. */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: -99999, top: 0, width: 540, height: 960,
        pointerEvents: 'none',
      }}>
        <div ref={captureRef} style={{ width: 540, height: 960, overflow: 'hidden' }}>
          {ActiveComp && <ActiveComp format="story" data={cardData} />}
        </div>
      </div>

      {/* compact CTA stack */}
      <div style={{ position: 'relative', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <button onClick={onShareWhatsApp} disabled={!!busy} style={{
          appearance: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: '12px 18px',
          background: INK_DEEP, color: '#fff', borderRadius: 999,
          fontFamily: 'inherit', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em',
          boxShadow: `0 5px 0 #1a0030, 0 12px 22px -8px rgba(42,6,69,0.48)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, whiteSpace: 'nowrap',
        }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M10 1.5C5.306 1.5 1.5 5.306 1.5 10c0 1.49.39 2.89 1.072 4.1L1.5 18.5l4.516-1.055A8.46 8.46 0 0010 18.5c4.694 0 8.5-3.806 8.5-8.5S14.694 1.5 10 1.5zm0 1.5a6.993 6.993 0 016.5 9.686l.012.034-.876 3.24-3.322-.777-.034.019A6.993 6.993 0 1110 3z" fill="currentColor"/>
            <path d="M7.5 6.5c-.2-.5-.4-.51-.6-.52l-.51-.01c-.18 0-.46.07-.7.33-.24.27-.92.9-.92 2.18 0 1.29.94 2.53 1.07 2.7.13.18 1.82 2.88 4.46 3.92 2.2.87 2.65.7 3.13.65.48-.04 1.54-.63 1.76-1.24.22-.61.22-1.13.15-1.24-.07-.1-.25-.17-.52-.3-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.61.13-.18.27-.7.88-.85 1.06-.16.18-.31.2-.58.07-.27-.13-1.14-.42-2.17-1.34-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.31.4-.47.14-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.06-.13-.58-1.42-.8-1.93z" fill="currentColor"/>
          </svg>
          {t.share_cta_whatsapp}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button onClick={onSaveImage} disabled={!!busy} style={{
            appearance: 'none', cursor: 'pointer', padding: '10px 12px',
            background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)',
            border: `1.5px solid rgba(42,6,69,0.14)`, borderRadius: 999, color: INK_DEEP,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: `0 2px 0 rgba(42,6,69,0.09)`,
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V9M7 9L3.5 5.5M7 9L10.5 5.5M2 11V12.5C2 12.776 2.224 13 2.5 13H11.5C11.776 13 12 12.776 12 12.5V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t.share_cta_save}
          </button>
          <button onClick={onShareElse} disabled={!!busy} style={{
            appearance: 'none', cursor: 'pointer', padding: '10px 12px',
            background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)',
            border: `1.5px solid rgba(42,6,69,0.14)`, borderRadius: 999, color: INK_DEEP,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: `0 2px 0 rgba(42,6,69,0.09)`,
          }}>
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
              <path d="M16.5 1.5L8 10M16.5 1.5L11 16.5L8 10M16.5 1.5L1.5 7L8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t.share_cta_elsewhere}
          </button>
        </div>
        {/* Roast Mode entry — secondary nav back to the roast view. Lives on
            the share slide because PostMenu was retired; users need a way
            to reach the full roast list from the deck. */}
        {onRoastMode && (
          <button onClick={onRoastMode} style={{
            appearance: 'none', cursor: 'pointer', marginTop: 2, padding: '8px 12px',
            background: 'transparent', border: 'none', color: CORAL,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            letterSpacing: '-0.01em',
          }}>
            🔥 {t.menu_roast_title || t.menu_roast_everyone || 'Roast everyone →'}
          </button>
        )}
      </div>
    </div>
  );
});

export default SlideShare;
