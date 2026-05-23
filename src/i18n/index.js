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

export const I18N = { en, he, es, fr, de, pt, it, ru, ar, tr };

export const RTL_LANGS = new Set(['he', 'ar']);

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

// Translate a user's title from their stored key + vars
export function resolveTitle(u, t) {
  if (!u || !u.titleKey) return '';
  return t[u.titleKey] || u.titleKey;
}

export function resolveTitleEvidence(u, t) {
  if (!u || !u.titleEvidenceKey) return '';
  return interp(t[u.titleEvidenceKey] || '', u.titleVars || {});
}
