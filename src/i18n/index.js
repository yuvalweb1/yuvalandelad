import en from './en.js';
import he from './he.js';
import es from './es.js';
import fr from './fr.js';
import de from './de.js';
import pt from './pt.js';
import it from './it.js';
import ru from './ru.js';
import ar from './ar.js';
import tr from './tr.js';
import hi from './hi.js';
import zh from './zh.js';
import ja from './ja.js';
import ko from './ko.js';

export const I18N = { en, he, es, fr, de, pt, it, ru, ar, tr, hi, zh, ja, ko };

export const RTL_LANGS = new Set(['he', 'ar']);

// Detect whether a string reads right-to-left by looking for the first strong
// directional character (Hebrew, Arabic, Syriac, Thaana, NKo, etc.). Used to
// orient per-row layout off the *name itself*, independent of the app locale —
// a Hebrew name in an English deck still wants RTL alignment.
const RTL_CHAR = /[֐-׿؀-ۿ܀-ݏݐ-ݿހ-޿߀-߿ࢠ-ࣿיִ-﷿ﹰ-﻿]/;
export function isRtlText(s) {
  return typeof s === 'string' && RTL_CHAR.test(s);
}

export function detectLang() {
  if (typeof navigator === 'undefined') return 'en';
  const browserLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return I18N[browserLang] ? browserLang : 'en';
}

// Build a translation object that falls back to English for any missing key
export function buildT(lang) {
  return { ...I18N.en, ...(I18N[lang] || {}) };
}

// Simple {placeholder} interpolation.
// Wraps each substituted value in FSI/PDI (U+2068/U+2069) so that LTR content
// (dates, numbers) embedded in RTL strings doesn't disrupt the BiDi algorithm.
export function interp(str, vars) {
  if (!str || !vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? `⁨${vars[k]}⁩` : `{${k}}`);
}

// Type-aware copy lookup. Returns `t[key_type]` if present, else falls back to `t[key]`.
// Lets slides keep one set of generic markup while swapping eyebrow/title/sub
// per chat type (friends/family/work/couple/other).
export function typedCopy(t, key, type) {
  if (!type || type === 'other') return t[key];
  return t[`${key}_${type}`] || t[key];
}

// Period-aware copy lookup. Returns `t[key_period]` if present, else `t[key]`.
// Mirrors `typedCopy`, but keyed by the trailing-window type so a slide can keep
// its all-time wording as the base key and override just the headlines that bake
// in a "this year" assumption for the shorter windows.
//   period 'all' / 'year'  → base key (a year of data; the existing copy is fine)
//   period 'season'        → `${key}_season` if it exists, else base
//   period 'month'         → `${key}_month`  if it exists, else base
export function periodCopy(t, key, period) {
  if (!period || period === 'all' || period === 'year') return t[key];
  return t[`${key}_${period}`] || t[key];
}

// Combined relationship + period lookup for the few deck titles that are BOTH
// relationship-aware (via typedCopy) and bake in a "this year" assumption.
// For the full-chat / year windows we keep the existing relationship wording.
// For the shorter windows we prefer a generic period variant (`${key}_season`
// / `${key}_month`) over the relationship base, so the period stays accurate
// even though we don't author the full relationship×window matrix.
//   lookup order (season/month): key_type_period → key_period → typedCopy(key,type)
export function typedPeriodCopy(t, key, type, period) {
  if (!period || period === 'all' || period === 'year') return typedCopy(t, key, type);
  return t[`${key}_${type}_${period}`] || t[`${key}_${period}`] || typedCopy(t, key, type);
}

// Translate a user's title from their stored key + vars
export function resolveTitle(u, t) {
  if (!u || !u.titleKey) return '';
  return t[u.titleKey] || u.titleKey;
}

export function resolveTitleEvidence(u, t) {
  if (!u || !u.titleEvidenceKey) return '';
  return interp(t[u.titleEvidenceKey] || '', u.titleVars || {});
}
