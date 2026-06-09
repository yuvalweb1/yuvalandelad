// ============================================================
// Country list for the Welcome questionnaire's "where are you from?"
// picker. We keep the ISO 3166-1 alpha-2 codes here and derive names
// + flag emojis at render time, so the displayed names automatically
// follow whatever locale the UI is currently in (via Intl.DisplayNames).
//
// Flag emojis are built from regional indicator pairs — on modern
// iOS/Android/Mac they render as actual flags. On Windows desktop
// they may fall back to "US"/"IL" letters; that's a platform limit.
// ============================================================

const A = 0x1F1E6; // 🇦 — first regional indicator
const A_CODE = 'A'.charCodeAt(0);

/** Convert "US" → 🇺🇸. */
export function flagEmoji(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(c => A + c.charCodeAt(0) - A_CODE),
  );
}

// Comprehensive ISO 3166-1 alpha-2 list. Hand-curated; excludes a
// handful of disputed/microstate codes to keep the picker reasonable.
export const COUNTRY_CODES = [
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ',
  'BS','BH','BD','BB','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','BN','BG','BF','BI',
  'KH','CM','CA','CV','CF','TD','CL','CN','CO','KM','CG','CD','CR','CI','HR','CU','CY','CZ',
  'DK','DJ','DM','DO',
  'EC','EG','SV','GQ','ER','EE','SZ','ET',
  'FJ','FI','FR',
  'GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY',
  'HT','HN','HK','HU',
  'IS','IN','ID','IR','IQ','IE','IL','IT',
  'JM','JP','JO',
  'KZ','KE','KI','KP','KR','KW','KG',
  'LA','LV','LB','LS','LR','LY','LI','LT','LU',
  'MO','MG','MW','MY','MV','ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM',
  'NA','NR','NP','NL','NZ','NI','NE','NG','MK','NO',
  'OM',
  'PK','PW','PS','PA','PG','PY','PE','PH','PL','PT','PR',
  'QA',
  'RO','RU','RW',
  'KN','LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB','SO','ZA','SS','ES','LK','SD','SR','SE','CH','SY',
  'TW','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM','TV',
  'UG','UA','AE','GB','US','UY','UZ',
  'VU','VA','VE','VN',
  'YE',
  'ZM','ZW',
];

// ── Country → UI language inference ─────────────────────────────────────
// Only maps to locales we actually ship in src/i18n/. Multilingual
// countries pick the most-likely default (e.g. CH → de, CA → en) — the
// user can still flip the language manually in Settings afterwards.
export const COUNTRY_TO_LANG = {
  // Hebrew
  IL: 'he',
  // Arabic
  SA: 'ar', AE: 'ar', EG: 'ar', JO: 'ar', IQ: 'ar', LB: 'ar', KW: 'ar',
  QA: 'ar', OM: 'ar', BH: 'ar', YE: 'ar', SY: 'ar', LY: 'ar', TN: 'ar',
  DZ: 'ar', MA: 'ar', SD: 'ar', SO: 'ar', DJ: 'ar', PS: 'ar',
  // Spanish
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
  EC: 'es', GT: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es',
  NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es', CU: 'es', GQ: 'es',
  // French
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', CM: 'fr',
  BF: 'fr', ML: 'fr', NE: 'fr', TG: 'fr', BJ: 'fr', GA: 'fr', CG: 'fr',
  CD: 'fr', MG: 'fr', BI: 'fr', RW: 'fr', HT: 'fr',
  // German
  DE: 'de', AT: 'de', LI: 'de', CH: 'de',
  // Portuguese
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',
  // Italian
  IT: 'it', SM: 'it', VA: 'it',
  // Russian
  RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru',
  // Turkish
  TR: 'tr',
  // Hindi
  IN: 'hi', NP: 'hi',
  // Chinese
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh', SG: 'zh',
  // Japanese
  JP: 'ja',
  // Korean
  KR: 'ko', KP: 'ko',
};

/** Look up a UI locale for a country code; returns 'en' when no
    confident mapping is available (anglosphere + everywhere else). */
export function langForCountry(code) {
  if (!code) return null;
  return COUNTRY_TO_LANG[code.toUpperCase()] || 'en';
}

/**
 * Build a [{ code, name, flag }] list sorted alphabetically by the
 * localized name. Uses `Intl.DisplayNames` so the picker reads in the
 * user's current UI language. Falls back to English when the runtime
 * can't resolve a region name.
 */
export function getCountries(lang = 'en') {
  let displayNames;
  try {
    displayNames = new Intl.DisplayNames([lang, 'en'], { type: 'region' });
  } catch {
    displayNames = null;
  }
  const fallback = (() => {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; }
  })();

  const list = COUNTRY_CODES
    .map(code => {
      const name = displayNames?.of(code) || fallback?.of(code) || code;
      return { code, name, flag: flagEmoji(code) };
    })
    .filter(c => c.name && c.name !== c.code);

  // localeCompare with the active language gives correct Hebrew /
  // Cyrillic / CJK sort order, not just ASCII.
  list.sort((a, b) => a.name.localeCompare(b.name, lang, { sensitivity: 'base' }));
  return list;
}
