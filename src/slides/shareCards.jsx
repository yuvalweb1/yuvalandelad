// shareCards.jsx — the four "Final Recap Card" share-card directions, ported
// from the Claude Design handoff (recap-dirA/C/D/E.jsx + recap-shared.jsx).
//
// The prototype read everything from a hardcoded `G` mock. Here each card is a
// pure component taking real recap data via the `data` prop. `buildCardData`
// maps the analytics object → that shape, so the cards stay deterministic and
// reuse the existing computeAll output (no metrics computed in here).
//
// Each card renders at full container size and is designed for a 9:16 / 540×960
// "story" artboard — SSlideShare's StoryPreview scales them into the picker.

import React from 'react';
import { typedCopy } from '../i18n';

const LOGO = '/icon-377.png';

// nice grouped number e.g. 12,847
export const nf = (n) => (n ?? 0).toLocaleString('en-US');

// Scale the hero number font down so it never overflows the card's content box.
// Bricolage Grotesque 800-weight numerals: actual char width ≈ 0.82em (measured, wide weight).
// `available` = content width in px at the card's native 540px scale.
// `extraLetterSpacingEm` = letterSpacing value applied to the element (e.g. 0.04 for Y2K Chrome).
function heroNumSize(numStr, available, base, extraLetterSpacingEm = 0) {
  const charWidthFactor = 0.82 + extraLetterSpacingEm;
  const needed = numStr.length * base * charWidthFactor;
  if (needed <= available) return base;
  return Math.max(Math.round(base * 0.50), Math.floor(base * available / needed));
}

// relationship → group label + emoji for the card header
const GROUP_EMOJI = { friends: '🔥', family: '🏠', work: '💼', couple: '❤️', other: '💬' };

// Map the analytics object to the card data shape (the old `G`).
export function buildCardData(a, profile, t) {
  const type = profile?.relationship || 'other';
  const top = a?.yapper || a?.users?.[0] || null;
  const topWord = a?.topWordsGroup?.[0] || null;
  const topEmoji = a?.topEmojisGroup?.[0] || null;
  let year;
  try { year = new Date(a?.end).getFullYear(); } catch { year = null; }
  return {
    brand: 'reccaped',
    year: year || '',
    group: typedCopy(t, 'card_group', type),
    groupEmoji: GROUP_EMOJI[type] || GROUP_EMOJI.other,
    totalMessages: a?.totalMessages || 0,
    daysActive: a?.durationDays || 0,
    people: a?.totalParticipants || 0,
    topChatter: top?.author || '—',
    topChatterCount: top?.messageCount || 0,
    topChatterPct: Math.round(top?.sharePct || 0),
    topEmoji: topEmoji?.emoji || '🙂',
    topEmojiCount: topEmoji?.count || 0,
    topWord: topWord?.word || '—',
    topWordCount: topWord?.count || 0,
    roast: a?.groupPersonality || '',
  };
}

// ---- shared atoms (ported from recap-shared.jsx) ----------------------

function Logomark({ size = 36, ring }) {
  return (
    <img
      src={LOGO}
      alt="reccaped logo"
      style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', flexShrink: 0,
        border: ring ? `2px solid ${ring}` : 'none',
        boxShadow: '0 2px 6px rgba(42,6,69,0.18)',
      }}
    />
  );
}

function Wordmark({ color = '#4A0E4E', size = 22, dot = '#FF8C00', mark, markRing }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: mark ? 9 : 2 }}>
      {mark && <Logomark size={size * 1.55} ring={markRing} />}
      <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
        <span className="fs-display" style={{ fontSize: size, fontWeight: 800, letterSpacing: '-0.04em', color }}>reccaped</span>
        <span style={{
          display: 'inline-block', width: size * 0.16, height: size * 0.62,
          background: dot, borderRadius: 2, transform: 'translateY(2px)',
        }} />
      </div>
    </div>
  );
}

function Chip({ children, bg = '#4A0E4E', color = '#FFD700', style }) {
  return (
    <span className="fs-mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg, color, borderRadius: 999,
      padding: '7px 14px', fontSize: 12, fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase', ...style,
    }}>{children}</span>
  );
}

function Footer({ dark, accent = '#FF8C00' }) {
  const ink = dark ? 'rgba(255,255,255,0.85)' : '#4A0E4E';
  const mute = dark ? 'rgba(255,255,255,0.45)' : 'rgba(74,14,78,0.5)';
  const line = dark ? 'rgba(255,255,255,0.14)' : 'rgba(74,14,78,0.15)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 14, borderTop: `1.5px solid ${line}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Logomark size={22} />
        <span className="fs-display" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.04em', color: ink }}>reccaped</span>
        <span style={{ width: 5, height: 5, borderRadius: 1, background: accent, display: 'inline-block' }} />
      </div>
      <span className="fs-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: mute }}>
        get yours · reccaped.app
      </span>
    </div>
  );
}

// =======================================================================
// Direction A — "BANANA DROP"
// =======================================================================
const A_INK = '#4A0E4E';
const BANANA = '#FFD700';
// Dot texture as a tiled SVG data-URI rather than a CSS radial-gradient:
// html2canvas can't rasterize repeating radial-gradients (the dots vanished in
// the exported PNG), but it renders url() image backgrounds fine. Same look,
// export-safe.
const DOT_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15'%3E%3Ccircle cx='1.5' cy='1.5' r='1.4' fill='%234A0E4E' fill-opacity='0.13'/%3E%3C/svg%3E\")";
const dotTexture = {
  backgroundImage: DOT_TILE,
  backgroundSize: '15px 15px',
};

function ACell({ value, label, sub, accent = A_INK, tilt = 0, big, flair }) {
  return (
    <div style={{
      background: '#FFFDF5', border: `3px solid ${A_INK}`, borderRadius: 16,
      boxShadow: `5px 6px 0 ${A_INK}`, transform: `rotate(${tilt}deg)`,
      padding: big ? '18px 20px' : '16px 18px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden',
    }}>
      {flair && <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 22, lineHeight: 1 }}>{flair}</div>}
      <div className="fs-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent, marginBottom: 6 }}>{label}</div>
      <div className="fs-display" style={{ fontSize: big ? 40 : 30, fontWeight: 800, lineHeight: 0.95, color: A_INK, whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div className="fs-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(74,14,78,0.55)', marginTop: 4, lineHeight: 1.5, whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}

export const CardBananaDrop = React.memo(function CardBananaDrop({ format = 'story', data }) {
  const G = data; const story = format === 'story';
  const heroStr = nf(G.totalMessages);
  // content width at native 540px: 540 - 34*2 = 472px
  const heroSize = heroNumSize(heroStr, 472, story ? 142 : 92);
  return (
    // boxSizing explicit (not inherited from `.cw-frame *`): html2canvas's clone
    // doesn't reliably carry that ancestor rule, so without it the padding adds
    // 72px on top of the 960px height — the card overflows and the export crops
    // its bottom (rounded corners + footer padding). All four card roots set it.
    <div style={{
      boxSizing: 'border-box',
      width: '100%', height: '100%', background: BANANA, color: A_INK,
      position: 'relative', overflow: 'hidden',
      padding: story ? '38px 34px 34px' : '30px 30px 28px',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ position: 'absolute', inset: 0, ...dotTexture, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -40, right: -36, width: 150, height: 150, borderRadius: '50%', background: '#FF8C00', opacity: 0.9, border: `3px solid ${A_INK}`, boxShadow: `5px 6px 0 ${A_INK}` }} />
      <div style={{ position: 'absolute', top: -22, right: 8, fontSize: 40, transform: 'rotate(12deg)' }}>✦</div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark color={A_INK} size={story ? 24 : 22} dot="#FF69B4" mark />
          <Chip bg={A_INK} color={BANANA} style={{ boxShadow: `3px 4px 0 rgba(74,14,78,0.35)` }}>★ {G.year} wrapped</Chip>
        </div>

        <div style={{ marginTop: story ? 20 : 18, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div className="fs-display" style={{ fontSize: story ? 38 : 32, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {G.group} <span style={{ filter: 'saturate(1.1)' }}>{G.groupEmoji}</span>
          </div>
        </div>

        <div style={{ flex: story ? 1 : '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, marginTop: story ? 0 : 16, marginBottom: story ? 0 : 14 }}>
          <div data-hero-num className="fs-display" style={{ fontSize: heroSize, fontWeight: 800, lineHeight: 0.84, color: A_INK, fontVariantNumeric: 'tabular-nums', textShadow: `4px 5px 0 #FF8C00`, whiteSpace: 'nowrap' }}>{heroStr}</div>
          <div className="fs-mono" style={{ marginTop: story ? 14 : 8, fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>messages sent this year</div>
        </div>

        {/* Two flex rows instead of a 2×2 CSS grid: html2canvas mis-sizes grid
            cells (clipping the 3-line "carried the chat" cell on export), but
            handles flexbox stretch reliably. align-items:stretch keeps each
            row's two cells equal height. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 20 : 14 }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: story ? 20 : 14 }}>
            <ACell label="Days active" value={G.daysActive} accent="#277da1" tilt={-1} />
            <ACell label="Carried the chat" value={G.topChatter} sub={`${G.topChatterPct}% of all messages`} accent="#f3722c" tilt={1} />
          </div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: story ? 20 : 14 }}>
            <ACell label="Most used word" value={`“${G.topWord}”`} accent="#8338ec" tilt={1} />
            <ACell label="Top emoji" value={`×${nf(G.topEmojiCount)}`} accent="#f94144" tilt={-1} flair={G.topEmoji} />
          </div>
        </div>

        <div style={{
          marginTop: story ? 18 : 13, background: A_INK, color: '#FFF', borderRadius: 16,
          border: '3px solid #2a0645', boxShadow: `5px 6px 0 rgba(74,14,78,0.4)`,
          padding: story ? '16px 20px' : '13px 18px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: story ? 30 : 26 }}>🔥</span>
          <div>
            <div className="fs-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FFD700', marginBottom: 4 }}>The verdict</div>
            <div className="fs-display" style={{ fontSize: story ? 21 : 18, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05, fontStyle: 'italic' }}>{G.roast}</div>
          </div>
        </div>

        {story && <div style={{ marginTop: 16 }}><Footer accent="#FF8C00" /></div>}
      </div>
    </div>
  );
});

// =======================================================================
// Direction C — "STICKER ZINE"
// =======================================================================
const C_INK = '#2a0645';

function Tape({ style }) {
  return <div style={{ position: 'absolute', width: 58, height: 20, background: 'rgba(255,217,114,0.6)', border: '1px solid rgba(74,14,78,0.12)', boxShadow: '0 1px 3px rgba(74,14,78,0.15)', ...style }} />;
}

function Sticker({ children, bg = '#fff', tilt = 0, pad = '17px 18px', tape, style }) {
  return (
    <div style={{ position: 'relative', background: bg, borderRadius: 14, border: `2.5px solid ${C_INK}`, boxShadow: `4px 5px 0 ${C_INK}`, transform: `rotate(${tilt}deg)`, padding: pad, minWidth: 0, ...style }}>
      {tape && <Tape style={{ top: -10, left: '50%', marginLeft: -29, transform: 'rotate(-3deg)' }} />}
      {children}
    </div>
  );
}

function CStat({ value, label, sub, accent, valueSize = 30 }) {
  return (
    <>
      <div className="fs-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: accent, marginBottom: 5 }}>{label}</div>
      <div className="fs-display" style={{ fontSize: valueSize, fontWeight: 800, lineHeight: 0.95, color: C_INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div className="fs-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(42,6,69,0.50)', marginTop: 4, lineHeight: 1.5, whiteSpace: 'nowrap' }}>{sub}</div>}
    </>
  );
}

export const CardStickerZine = React.memo(function CardStickerZine({ format = 'story', data }) {
  const G = data; const story = format === 'story';
  const heroStr = nf(G.totalMessages);
  // Sticker pad 22px each side inside card pad 30px each side → 540-60-44=436px available
  const heroSize = heroNumSize(heroStr, 436, story ? 116 : 58);
  return (
    <div style={{
      boxSizing: 'border-box',
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: '#FBF3E4', color: C_INK,
      padding: story ? '36px 30px 40px' : '24px 26px 28px',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ position: 'absolute', top: -50, right: -40, width: 200, height: 200, borderRadius: '50%', background: '#FFD972', opacity: 0.55, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -50, width: 200, height: 200, borderRadius: '50%', background: '#FF69B4', opacity: 0.28, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', top: '40%', left: '60%', width: 160, height: 160, borderRadius: '50%', background: '#00BFFF', opacity: 0.18, filter: 'blur(55px)' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark color={C_INK} size={story ? 23 : 21} dot="#FF69B4" mark />
          <div style={{ position: 'relative', background: C_INK, color: '#FFD700', borderRadius: 999, padding: '7px 14px', transform: 'rotate(3deg)', boxShadow: `3px 3px 0 rgba(42,6,69,0.3)` }}>
            <span className="fs-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>’{String(G.year).slice(2)} WRAP</span>
          </div>
        </div>

        <div style={{ flex: story ? 1 : '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: story ? 18 : 24, marginTop: story ? 0 : 22 }}>
          <div style={{ alignSelf: 'flex-start' }}>
            <Sticker bg="#FF69B4" tilt={-2} pad={story ? '10px 18px' : '6px 12px'} style={{ boxShadow: `4px 5px 0 ${C_INK}` }}>
              <span className="fs-display" style={{ fontSize: story ? 30 : 22, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>{G.group} {G.groupEmoji}</span>
            </Sticker>
          </div>

          <Sticker bg="#FFFFFF" tilt={1} tape={story} pad={story ? '20px 22px 18px' : '11px 14px'}>
            {story && <div className="fs-serif" style={{ fontSize: 18, fontStyle: 'italic', color: '#f06449', marginBottom: 2 }}>we sent a casual…</div>}
            <div data-hero-num className="fs-display" style={{ fontSize: heroSize, fontWeight: 800, lineHeight: 0.85, color: C_INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{heroStr}</div>
            <div className="fs-mono" style={{ marginTop: story ? 8 : 5, fontSize: story ? 13 : 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(42,6,69,0.6)' }}>messages · {G.daysActive} days</div>
          </Sticker>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: story ? 20 : 10, marginTop: story ? 22 : 10 }}>
          <Sticker bg="#CDEBFF" tilt={-1.5} pad={story ? '17px 18px' : '10px 12px'}><CStat label="Carried the chat" value={G.topChatter} sub={`${G.topChatterPct}% of messages`} accent="#277da1" valueSize={story ? 28 : 19} /></Sticker>
          <Sticker bg="#FFFFFF" tilt={1.5} pad={story ? '17px 18px' : '10px 12px'}><CStat label="Most used word" value={`“${G.topWord}”`} accent="#8338ec" valueSize={story ? 28 : 19} /></Sticker>
          <Sticker bg="#FFE8A3" tilt={1} pad={story ? '17px 18px' : '10px 12px'}>
            <div className="fs-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#f3722c', marginBottom: 4 }}>Top emoji</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: story ? 34 : 24, lineHeight: 1 }}>{G.topEmoji}</span>
              <span className="fs-display" style={{ fontSize: story ? 26 : 19, fontWeight: 800, color: C_INK }}>×{nf(G.topEmojiCount)}</span>
            </div>
          </Sticker>
          <Sticker bg="#FFFFFF" tilt={-1} pad={story ? '17px 18px' : '10px 12px'}><CStat label="People involved" value={`${G.people} souls`} accent="#f94144" valueSize={story ? 28 : 19} /></Sticker>
        </div>

        <div style={{ marginTop: story ? 22 : 12 }}>
          <div className="fs-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(42,6,69,0.45)', marginBottom: 8, paddingLeft: 2 }}>official diagnosis</div>
          <div className="fs-display" style={{ position: 'relative', display: 'inline', fontSize: story ? 26 : 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.5, color: C_INK }}>
            <span style={{ background: 'linear-gradient(180deg, transparent 55%, #FFD972 55%)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '0 2px' }}>{G.roast}</span>
          </div>
        </div>

        {story && <div style={{ marginTop: 24 }}><Footer accent="#FF69B4" /></div>}
      </div>
    </div>
  );
});

// =======================================================================
// Direction D — "THE RECEIPT"
// =======================================================================
const D_INK = '#2a0645';
const PAPER = '#FBF7EE';

function Dash() { return <div style={{ borderTop: `2px dashed rgba(42,6,69,0.35)`, margin: 0 }} />; }

function Row({ k, v, big, tight }) {
  const pad = big ? '7px 0' : (tight ? '3px 0' : '5px 0');
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: pad, minWidth: 0 }}>
      <span className="fs-mono" style={{ fontSize: big ? 15 : 13, fontWeight: 600, letterSpacing: '0.02em', color: 'rgba(42,6,69,0.78)', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>{k}</span>
      <span aria-hidden style={{ flex: 1, minWidth: 8, borderBottom: '1.5px dotted rgba(42,6,69,0.28)', transform: 'translateY(-4px)' }} />
      <span className="fs-display" style={{ fontSize: big ? 22 : 18, fontWeight: 800, color: D_INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '52%', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
}

function Barcode({ width = '100%', height = 46 }) {
  const bars = '3121132113122131121133121131221312113213211231'.split('');
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, height, width }}>
      {bars.map((w, i) => <div key={i} style={{ width: Number(w) * 1.6, background: i % 7 === 0 ? 'transparent' : D_INK }} />)}
    </div>
  );
}

export const CardReceipt = React.memo(function CardReceipt({ format = 'story', data }) {
  const G = data; const story = format === 'story';
  const heroStr = nf(G.totalMessages);
  // receipt content width: paper maxWidth 420 - 60px padding = 360; "TOTAL MSGS" label ~130px + 12px gap → ~218px for number
  const receiptTotalSize = heroNumSize(heroStr, 218, story ? 46 : 34);
  return (
    <div style={{
      boxSizing: 'border-box',
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: '#E8E2D4', padding: story ? '34px 30px' : '18px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ position: 'absolute', top: -60, left: -40, width: 220, height: 220, borderRadius: '50%', background: '#ffd972', opacity: 0.5, filter: 'blur(70px)' }} />
      <div style={{ position: 'absolute', bottom: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: '#FF69B4', opacity: 0.28, filter: 'blur(70px)' }} />

      <div style={{
        position: 'relative', width: '100%', maxWidth: story ? 420 : 460, background: PAPER,
        boxShadow: '0 18px 40px -10px rgba(42,6,78,0.4)', padding: story ? '30px 30px 22px' : '20px 26px 16px',
        display: 'flex', flexDirection: 'column',
        WebkitMaskImage: 'radial-gradient(circle at 7px 0, transparent 0 6px, #000 6.5px) repeat-x top/16px 16px, radial-gradient(circle at 7px 16px, transparent 0 6px, #000 6.5px) repeat-x bottom/16px 16px, linear-gradient(#000,#000)',
        WebkitMaskComposite: 'source-over',
        maskImage: 'radial-gradient(circle at 7px 0, transparent 0 6px, #000 6.5px) repeat-x top/16px 16px, radial-gradient(circle at 7px 16px, transparent 0 6px, #000 6.5px) repeat-x bottom/16px 16px, linear-gradient(#000,#000)',
      }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Logomark size={story ? 52 : 36} />
          <div className="fs-display" style={{ marginTop: story ? 8 : 6, fontSize: story ? 26 : 20, fontWeight: 800, letterSpacing: '-0.04em', color: D_INK }}>
            reccaped<span style={{ color: '#f06449' }}>*</span>
          </div>
          {story && <div className="fs-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(42,6,69,0.55)', marginTop: 6 }}>GROUP CHAT RECEIPT · {G.year}</div>}
          <div className="fs-mono" style={{ fontSize: story ? 10.5 : 9.5, letterSpacing: '0.1em', color: 'rgba(42,6,69,0.45)', marginTop: story ? 3 : 5 }}>
            {String(G.group).toUpperCase()} {G.groupEmoji} · {G.people} CUSTOMERS · {G.daysActive} DAYS
          </div>
        </div>

        <div style={{ margin: story ? '20px 0 14px' : '10px 0 6px' }}><Dash /></div>

        <Row k="Top yapper" v={`${G.topChatter} ${G.topChatterPct}%`} tight={!story} />
        <Row k="Most used word" v={`"${G.topWord}"`} tight={!story} />
        <Row k="Times said" v={`${G.topWordCount}×`} tight={!story} />
        <Row k="Top emoji" v={`${G.topEmoji} ×${nf(G.topEmojiCount)}`} tight={!story} />
        <Row k="Days active" v={`${G.daysActive} days`} tight={!story} />

        <div style={{ margin: story ? '14px 0' : '8px 0' }}><Dash /></div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <span className="fs-display" style={{ fontSize: story ? 20 : 17, fontWeight: 800, letterSpacing: '-0.02em', color: D_INK }}>TOTAL MSGS</span>
          <span className="fs-display" style={{ fontSize: receiptTotalSize, fontWeight: 800, color: D_INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{heroStr}</span>
        </div>

        <div style={{ margin: story ? '14px 0' : '8px 0' }}><Dash /></div>

        <div style={{ textAlign: 'center', padding: story ? '6px 0 4px' : '2px 0' }}>
          <div className="fs-mono" style={{ fontSize: story ? 10 : 9, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(42,6,69,0.5)', marginBottom: story ? 8 : 6 }}>* DIAGNOSIS *</div>
          <div className="fs-display" style={{
            display: 'inline-block', fontSize: story ? 19 : 14, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15,
            color: '#f06449', border: '2.5px solid #f06449', borderRadius: 6, padding: story ? '8px 14px' : '6px 11px',
            transform: 'rotate(-3deg)', textTransform: 'uppercase',
          }}>{G.roast}</div>
        </div>

        <div style={{ paddingTop: story ? 22 : 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: story ? 8 : 5 }}>
          <Barcode width={story ? '78%' : '60%'} height={story ? 46 : 28} />
          <div className="fs-mono" style={{ fontSize: story ? 10.5 : 9.5, letterSpacing: '0.32em', color: 'rgba(42,6,69,0.6)' }}>RECCAPED.APP</div>
          {story && <div className="fs-mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(42,6,69,0.5)', marginTop: 2 }}>★ THANK YOU FOR YAPPING ★</div>}
        </div>
      </div>
    </div>
  );
});

// =======================================================================
// Direction E — "Y2K CHROME"
// =======================================================================
function Bubble({ children, style }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.16)', border: '1.5px solid rgba(255,255,255,0.5)',
      borderRadius: 22, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 8px 22px -8px rgba(74,14,78,0.4)',
      padding: '14px 16px', minWidth: 0, position: 'relative', overflow: 'hidden', ...style,
    }}>{children}</div>
  );
}

function ECell({ label, value, sub, emojiIcon }) {
  return (
    <Bubble>
      <div className="fs-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', marginBottom: 7 }}>{label}</div>
      {emojiIcon
        ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 36, lineHeight: 1 }}>{emojiIcon}</span>
            <span className="fs-display" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: '#fff', textShadow: '0 1px 6px rgba(74,14,78,0.4)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
          </div>
        : <div className="fs-display" style={{ fontSize: 28, fontWeight: 800, lineHeight: 0.95, color: '#fff', textShadow: '0 1px 6px rgba(74,14,78,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>}
      {sub && <div className="fs-mono" style={{ marginTop: 5, fontSize: 10.5, color: 'rgba(255,255,255,0.78)' }}>{sub}</div>}
    </Bubble>
  );
}

function Star({ style }) {
  return <div style={{ position: 'absolute', color: '#fff', textShadow: '0 0 10px rgba(255,255,255,0.9)', ...style }}>✦</div>;
}

export const CardY2KChrome = React.memo(function CardY2KChrome({ format = 'story', data }) {
  const G = data; const story = format === 'story';
  const heroStr = nf(G.totalMessages);
  // card pad 30px each side → 540-60=480px available; pass 0.04 for letterSpacing on the hero div
  const heroSize = heroNumSize(heroStr, 480, story ? 132 : 92, 0.04);
  return (
    <div style={{
      boxSizing: 'border-box',
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(160deg, #00BFFF 0%, #7A5CFF 38%, #FF69B4 68%, #FF8C00 100%)',
      color: '#fff', padding: story ? '36px 30px 30px' : '28px 28px 24px',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: 260, height: 260, borderRadius: '50%', background: '#FFD700', opacity: 0.55, filter: 'blur(70px)' }} />
      <div style={{ position: 'absolute', bottom: '-12%', right: '-8%', width: 260, height: 260, borderRadius: '50%', background: '#00FFD1', opacity: 0.4, filter: 'blur(75px)' }} />
      <div style={{ position: 'absolute', top: '38%', right: '-14%', width: 200, height: 200, borderRadius: '50%', background: '#fff', opacity: 0.22, filter: 'blur(60px)' }} />
      <Star style={{ top: 92, right: 40, fontSize: 26 }} />
      <Star style={{ top: 150, left: 36, fontSize: 16, opacity: 0.8 }} />
      <Star style={{ bottom: 130, right: 60, fontSize: 20, opacity: 0.9 }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark color="#fff" size={story ? 24 : 22} dot="#FFD700" mark markRing="rgba(255,255,255,0.85)" />
          <span className="fs-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 999, padding: '6px 12px' }}>{G.year} ✦ wrapped</span>
        </div>

        <div style={{ marginTop: story ? 'auto' : 16 }}>
          <div className="fs-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)', marginBottom: 12, textAlign: 'center' }}>
            {G.group} {G.groupEmoji} · {G.people} people · {G.daysActive} days
          </div>

          <div style={{ textAlign: 'center' }}>
            <div data-hero-num className="fs-display" style={{
              fontSize: heroSize, fontWeight: 800, letterSpacing: '0.04em', lineHeight: 0.82, fontVariantNumeric: 'tabular-nums',
              background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 38%, #FFE08A 56%, #FF9CE0 88%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              WebkitTextStroke: '1px rgba(255,255,255,0.6)', filter: 'drop-shadow(0 6px 14px rgba(74,14,78,0.45))',
              whiteSpace: 'nowrap',
            }}>{heroStr}</div>
            <div className="fs-mono" style={{ marginTop: 12, fontSize: 13, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 8px rgba(74,14,78,0.4)' }}>messages this year</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: story ? 13 : 11, marginTop: story ? 'auto' : 16 }}>
          <ECell label="Carried it" value={G.topChatter} sub={`${G.topChatterPct}% of messages`} />
          <ECell label="Fave word" value={`“${G.topWord}”`} sub={`${G.topWordCount}× used`} />
          <ECell label="Top emoji" emojiIcon={G.topEmoji} value={`×${nf(G.topEmojiCount)}`} />
          <ECell label="Days active" value={G.daysActive} sub="no days off" />
        </div>

        <Bubble style={{ marginTop: story ? 16 : 13, background: 'rgba(255,255,255,0.92)', border: '1.5px solid #fff', textAlign: 'center' }}>
          <div className="fs-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7A5CFF', marginBottom: 6 }}>the vibe ✦</div>
          <div className="fs-display" style={{ fontSize: story ? 21 : 18, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#4A0E4E', fontStyle: 'italic' }}>{G.roast}</div>
        </Bubble>

        {story && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <span className="fs-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>get yours · reccaped.app</span>
          </div>
        )}
      </div>
    </div>
  );
});
