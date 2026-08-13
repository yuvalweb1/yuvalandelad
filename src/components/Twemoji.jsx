import React, { useState } from 'react';
import { EMOJI_RE } from '../parser/index.js';

// Render emoji as self-hosted Twemoji SVGs instead of trusting the device's
// emoji font. Some devices (older Samsung One UI, etc.) lack glyphs for newer
// emoji and render an empty "tofu" box — this guarantees the same picture
// everywhere. Assets live in public/twemoji/svg (populated by
// scripts/copy-twemoji.mjs); this is purely a render concern — parsing,
// counts, and the deterministic social layer are untouched.
//
//   <Twemoji>{user.topEmoji}</Twemoji>     // single emoji, sized to font-size
//   <Twemoji>{row.displayValue}</Twemoji>  // mixed text — non-emoji passes through
//
// base:'./' in vite.config.js → BASE_URL is './', so the path resolves relative
// to the document (works for the web build and the Capacitor bundle alike).
const SVG_BASE = `${import.meta.env.BASE_URL}twemoji/svg/`;

const ZWJ = String.fromCharCode(0x200d);   // zero-width joiner
const VS16 = new RegExp(String.fromCharCode(0xfe0f), 'g'); // emoji variation selector

// Twemoji's exact codepoint algorithm: walk surrogate pairs, emit hex code
// points joined by '-'. Produces the filenames shipped in the asset pack
// (e.g. '1f600', '1f1fa-1f1f8' for flags, '1f937-200d-2642-fe0f' man-shrugging).
function toCodePoint(str) {
  const out = [];
  let pending = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (pending) {
      out.push((0x10000 + ((pending - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      pending = 0;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      pending = c;
    } else {
      out.push(c.toString(16));
    }
  }
  return out.join('-');
}

// Twemoji's grabTheRightIcon rule: strip the VS16 emoji-presentation selector
// (U+FE0F) unless the sequence contains a ZWJ, then map to the SVG filename.
function emojiToFilename(emoji) {
  const normalized = emoji.indexOf(ZWJ) < 0 ? emoji.replace(VS16, '') : emoji;
  return toCodePoint(normalized);
}

// One emoji → <img>. If the SVG is missing/fails to load, fall back to the raw
// character so we degrade to the old behaviour rather than showing nothing.
function EmojiImg({ emoji, imgStyle }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{emoji}</>;
  return (
    <img
      src={`${SVG_BASE}${emojiToFilename(emoji)}.svg`}
      alt={emoji}
      draggable={false}
      onError={() => setFailed(true)}
      style={{
        height: '1em',
        width: '1em',
        verticalAlign: '-0.125em',
        display: 'inline-block',
        objectFit: 'contain',
        ...imgStyle,
      }}
    />
  );
}

// Split a string into emoji / plain-text segments and swap each emoji for an
// <img>. A fresh regex avoids mutating the shared parser EMOJI_RE's lastIndex.
const Twemoji = React.memo(function Twemoji({ children, imgStyle, ...rest }) {
  const text = typeof children === 'string'
    ? children
    : Array.isArray(children) ? children.join('') : '';
  if (!text) return null;

  const re = new RegExp(EMOJI_RE.source, EMOJI_RE.flags);
  const parts = [];
  let last = 0;
  let key = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<EmojiImg key={key++} emoji={m[0]} imgStyle={imgStyle} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <span {...rest}>{parts}</span>;
});

export default Twemoji;
