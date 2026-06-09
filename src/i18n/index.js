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

// Simple {placeholder} interpolation
export function interp(str, vars) {
  if (!str || !vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? vars[k] : `{${k}}`);
}

// Type-aware copy lookup. Returns `t[key_type]` if present, else falls back to `t[key]`.
// Lets slides keep one set of generic markup while swapping eyebrow/title/sub
// per chat type (friends/family/work/couple/other).
export function typedCopy(t, key, type) {
  if (!type || type === 'other') return t[key];
  return t[`${key}_${type}`] || t[key];
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
