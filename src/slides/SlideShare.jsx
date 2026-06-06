import React, { useState } from 'react';
import { typedCopy } from '../i18n';
import { CardBananaDrop, CardStickerZine, CardReceipt, CardY2KChrome, buildCardData } from './shareCards.jsx';

// SlideShare — the final slide. "Send it to the squad": pick one of four share
// card styles, then fire a share/save action.
//
// Each option's `Comp` renders a 9:16 / 540×960 story card (in shareCards.jsx);
// StoryPreview scales it into the hero + thumbnails. The PlaceholderCard is a
// graceful fallback only used if card data can't be built.

const INK_PLUM = '#2a0645';
const INK_DEEP = '#4A0E4E';
const CORAL    = '#f06449';
const GOLD     = '#FFD700';
const ORANGE   = '#FF8C00';
const CREAM    = '#FFF6D6';
const PINK     = '#FDE6F1';

// which styles render in the picker, in display order. `Comp` stays null until
// the real card components arrive.
const OPTIONS = [
  { id: 'A', nameKey: 'share_style_a', glyph: '🍌', grad: ['#FFE259', '#FFA751'], ink: INK_PLUM, Comp: CardBananaDrop },
  { id: 'B', nameKey: 'share_style_b', glyph: '✿',  grad: ['#FFF3E0', '#FDE6F1'], ink: INK_DEEP, Comp: CardStickerZine },
  { id: 'C', nameKey: 'share_style_c', glyph: '🧾', grad: ['#FBF7EE', '#E8DFcf'], ink: INK_PLUM, Comp: CardReceipt },
  { id: 'D', nameKey: 'share_style_d', glyph: '💿', grad: ['#A6D8FF', '#C9B6E8'], ink: INK_DEEP, Comp: CardY2KChrome },
];

const nf = (n) => (n ?? 0).toLocaleString();

// A stand-in for a real share card: a 9:16 mini "story" showing the headline
// group stat over the style's tint. Sized off `w` so it reads at any scale.
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

// Scaled preview of a story card at 9:16. Renders the real `opt.Comp` (scaled
// from its native 540×960) with live data, else the PlaceholderCard.
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
        <div style={{ width: SRC_W, height: SRC_H, transform: `scale(${width / SRC_W})`, transformOrigin: 'top left' }}>
          <Comp format="story" data={data} />
        </div>
      ) : (
        <PlaceholderCard opt={opt} headline={headline} label={label} w={width} />
      )}
    </div>
  );
}

// drifting blob background, matching the picker's "chrome" vibe.
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

// reccaped wordmark + winking cursor block.
function Wordmark() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
      <span className="fs-display" style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.04em', color: INK_DEEP }}>reccaped</span>
      <span style={{ display: 'inline-block', width: 3, height: 11, background: ORANGE, borderRadius: 2, transform: 'translateY(1px)' }} />
    </div>
  );
}

// Derive the actual chat name from diagnostics (same logic as history.deriveChatName).
function getChatName(diagnostics) {
  const detected = diagnostics?.detectedGroupName;
  if (detected) {
    const parts = detected.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return null;
}

// Scale the highlight font to fit on one row inside ~200px available width.
// Instrument Serif italic is ~15px wide per char at 34px.
function highlightFontSize(name) {
  const len = name.length;
  if (len <= 10) return 34;
  if (len <= 14) return 28;
  if (len <= 18) return 23;
  if (len <= 24) return 18;
  return 15;
}

const SlideShare = React.memo(function SlideShare({ a, t, profile, diagnostics }) {
  const type = profile?.relationship || 'other';
  const [pickedId, setPickedId] = useState('A');
  const picked = OPTIONS.find(o => o.id === pickedId) || OPTIONS[0];

  // real data driving the share cards (deterministic — pure map of analytics)
  const cardData = buildCardData(a, profile, t);

  // headline stat used only by the placeholder fallback
  const headline = nf(a?.totalMessages);
  const headLabel = t.go_messages || 'messages';

  const pickedName = t[picked.nameKey] || picked.id;
  // real chat name takes precedence over the generic relationship-based copy
  const chatName = getChatName(diagnostics) || typedCopy(t, 'share_highlight', type);
  const highlightSize = highlightFontSize(chatName);

  // Buttons are wired but the real share/save flow (image generation, deep
  // links) lands later — keep these honest stubs for now.
  const onShareWhatsApp = () => {/* TODO: generate card image + WhatsApp share */};
  const onSaveImage     = () => {/* TODO: render selected card to PNG + download */};
  const onShareElse     = () => {/* TODO: navigator.share with the generated card */};

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: `linear-gradient(180deg, ${CREAM} 0%, #FFF0E2 46%, ${PINK} 100%)`,
      color: INK_PLUM,
      display: 'flex', flexDirection: 'column',
      paddingTop: 'calc(var(--safe-top, 0px) + 42px)',
      paddingBottom: 'calc(var(--safe-bottom, 0px) + 18px)',
    }}>
      <ChromeBg />

      {/* brand */}
      <div className="a-fade-up" style={{ position: 'relative', padding: '0 20px' }}>
        <Wordmark />
      </div>

      {/* eyebrow + title */}
      <div className="a-fade-up" style={{ position: 'relative', padding: '12px 24px 0', animationDelay: '0.05s' }}>
        <div className="fs-mono" style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: CORAL, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}>
          <span style={{ color: ORANGE }}>✦</span> {t.share_eyebrow}
        </div>
        <div className="fs-display" style={{
          fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em',
          lineHeight: 1.1, color: INK_PLUM,
          display: 'flex', alignItems: 'baseline', flexWrap: 'nowrap', gap: 6, whiteSpace: 'nowrap',
        }}>
          {t.share_title_lead}
          <span className="fs-serif" style={{
            fontStyle: 'italic', fontWeight: 400, color: CORAL,
            fontSize: highlightSize,
            whiteSpace: 'nowrap', display: 'inline-block',
          }}>{chatName}.</span>
        </div>
      </div>

      {/* hero preview — the selected card, big */}
      <div className="a-pop-in" style={{ position: 'relative', marginTop: 34, display: 'flex', justifyContent: 'center', animationDelay: '0.1s' }}>
        <div style={{ position: 'relative' }}>
          {/* offset block shadow behind */}
          <div style={{
            position: 'absolute', inset: 0, background: INK_DEEP, borderRadius: 16,
            transform: 'translate(6px, 8px)', opacity: 0.18, filter: 'blur(2px)',
          }} />
          <StoryPreview
            opt={picked}
            data={cardData}
            width={166}
            radius={16}
            border={`2.5px solid ${INK_DEEP}`}
            shadow={`0 18px 36px -10px rgba(42,6,69,0.45), 0 2px 0 rgba(255,255,255,0.6) inset`}
            headline={headline}
            label={headLabel}
          />
          {/* selected-style label tag */}
          <div className="fs-mono" style={{
            position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
            background: INK_DEEP, color: GOLD, borderRadius: 999, padding: '5px 11px',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
            boxShadow: `2px 3px 0 rgba(42,6,69,0.25)`, whiteSpace: 'nowrap',
          }}>
            {picked.id} · {pickedName}
          </div>
        </div>
      </div>

      {/* thumb strip */}
      <div style={{ position: 'relative', marginTop: 34, padding: '0 20px' }}>
        <div className="fs-mono" style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'rgba(42,6,69,0.40)', marginBottom: 9, textAlign: 'center',
        }}>{t.share_tap_to_swap}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {OPTIONS.map(opt => {
            const isActive = opt.id === pickedId;
            return (
              <button
                key={opt.id}
                onClick={() => setPickedId(opt.id)}
                aria-pressed={isActive}
                aria-label={t[opt.nameKey] || opt.id}
                className="press"
                style={{
                  appearance: 'none', border: 'none', background: 'transparent',
                  cursor: 'pointer', padding: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                <div style={{
                  position: 'relative', padding: isActive ? 3 : 0,
                  background: isActive ? INK_DEEP : 'transparent',
                  borderRadius: isActive ? 12 : 9, transition: 'all 0.15s',
                }}>
                  <StoryPreview
                    opt={opt}
                    data={cardData}
                    width={isActive ? 58 : 54}
                    radius={isActive ? 8 : 6}
                    border={isActive ? `1.5px solid ${GOLD}` : `1.5px solid rgba(42,6,69,0.12)`}
                    shadow={isActive ? `0 6px 14px -4px rgba(42,6,69,0.35)` : `0 2px 5px rgba(42,6,69,0.08)`}
                    headline={headline}
                    label={headLabel}
                  />
                </div>
                <div className="fs-mono" style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: isActive ? INK_DEEP : 'rgba(42,6,69,0.45)', textAlign: 'center', lineHeight: 1,
                }}>{opt.id}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* spacer pushes CTAs down */}
      <div style={{ flex: 1, minHeight: 16 }} />

      {/* CTA stack */}
      <div style={{ position: 'relative', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={onShareWhatsApp} style={{
          appearance: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: '15px 20px',
          background: INK_DEEP, color: '#fff', borderRadius: 999,
          fontFamily: 'inherit', fontWeight: 800, fontSize: 15.5, letterSpacing: '-0.01em',
          boxShadow: `0 6px 0 #1a0030, 0 14px 26px -8px rgba(42,6,69,0.5)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, whiteSpace: 'nowrap',
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M10 1.5C5.306 1.5 1.5 5.306 1.5 10c0 1.49.39 2.89 1.072 4.1L1.5 18.5l4.516-1.055A8.46 8.46 0 0010 18.5c4.694 0 8.5-3.806 8.5-8.5S14.694 1.5 10 1.5zm0 1.5a6.993 6.993 0 016.5 9.686l.012.034-.876 3.24-3.322-.777-.034.019A6.993 6.993 0 1110 3z" fill="currentColor"/>
            <path d="M7.5 6.5c-.2-.5-.4-.51-.6-.52l-.51-.01c-.18 0-.46.07-.7.33-.24.27-.92.9-.92 2.18 0 1.29.94 2.53 1.07 2.7.13.18 1.82 2.88 4.46 3.92 2.2.87 2.65.7 3.13.65.48-.04 1.54-.63 1.76-1.24.22-.61.22-1.13.15-1.24-.07-.1-.25-.17-.52-.3-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.61.13-.18.27-.7.88-.85 1.06-.16.18-.31.2-.58.07-.27-.13-1.14-.42-2.17-1.34-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.31.4-.47.14-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.06-.13-.58-1.42-.8-1.93z" fill="currentColor"/>
          </svg>
          {t.share_cta_whatsapp}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={onSaveImage} style={{
            appearance: 'none', cursor: 'pointer', padding: '12px 14px',
            background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)',
            border: `1.5px solid rgba(42,6,69,0.14)`, borderRadius: 999, color: INK_DEEP,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            boxShadow: `0 3px 0 rgba(42,6,69,0.10)`,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V9M7 9L3.5 5.5M7 9L10.5 5.5M2 11V12.5C2 12.776 2.224 13 2.5 13H11.5C11.776 13 12 12.776 12 12.5V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t.share_cta_save}
          </button>
          <button onClick={onShareElse} style={{
            appearance: 'none', cursor: 'pointer', padding: '12px 14px',
            background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)',
            border: `1.5px solid rgba(42,6,69,0.14)`, borderRadius: 999, color: INK_DEEP,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M16.5 1.5L8 10M16.5 1.5L11 16.5L8 10M16.5 1.5L1.5 7L8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t.share_cta_elsewhere}
          </button>
        </div>
      </div>
    </div>
  );
});

export default SlideShare;
