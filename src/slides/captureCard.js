// captureCard.js — rasterize a 540×960 share card DOM node into a PNG blob.
//
// Uses html-to-image (SVG <foreignObject> → <img> → canvas.drawImage) rather
// than html2canvas, and the difference is the whole point: html2canvas does
// not screenshot the browser's render, it re-derives it twice. It lays the
// clone out in its own off-screen iframe (a second, independent layout pass —
// flex-grow and justify-content get resolved from scratch), then paints text
// with hand-rolled baseline math (a probe element plus a literal `+ 2` fudge
// factor, per family and size). That is why the exported PNG drifted from the
// pixel-perfect live preview, and why the drift changed shape with the data —
// digit count, Hebrew vs Latin names — while every attempt to compensate in
// the card's own CSS just moved the problem around.
//
// foreignObject hands the markup back to the browser's real layout and text
// engine, so the export matches the preview by construction.
//
// The tradeoff: the SVG is loaded as an <img>, so its document is isolated and
// cannot fetch anything. Every external resource has to be inlined first.
// html-to-image inlines <img> sources itself (the logo); fonts come from
// getFontEmbedCSS() below.

import { toBlob, getFontEmbedCSS } from 'html-to-image';

const CARD_W = 540;
const CARD_H = 960;
const PIXEL_RATIO = 2; // → 1080×1920, retina-sharp at story dimensions

let fontCssPromise = null;

// Resolving the card's webfonts means refetching every @font-face and
// base64-ing it, which is far too slow to redo on each capture — but the
// fonts are identical for all four cards, so do it once per session and
// share the result.
//
// Failure is deliberately non-fatal. Without embedded fonts the card falls
// back to a system face, but the browser still lays it out itself, so the
// result is "wrong typeface, correct layout" rather than the overlapping text
// html2canvas produced. Resolving to '' (not null) matters: html-to-image
// treats a non-null fontEmbedCSS as final and skips its own network-dependent
// embedding pass, so a failure here can't stall the capture behind a retry.
export function warmCardFonts(node) {
  if (!fontCssPromise && node) {
    fontCssPromise = getFontEmbedCSS(node).catch(() => '');
  }
  return fontCssPromise;
}

export async function captureCardBlob(node) {
  if (!node) return null;
  const fontEmbedCSS = await warmCardFonts(node);
  return toBlob(node, {
    width: CARD_W,
    height: CARD_H,
    pixelRatio: PIXEL_RATIO,
    fontEmbedCSS,
    // The cards paint their own full-bleed backgrounds; leaving this unset
    // keeps the canvas transparent behind them, matching the old capture.
    cacheBust: false,
  });
}
