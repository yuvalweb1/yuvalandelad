// ============================================================
// whatsapp-wrapped-parser — pattern tables
// ------------------------------------------------------------
// All locale/format-specific regexes live here so the parser
// itself reads as plain control flow. These are intentionally
// strict: we would rather mis-classify a system line as content
// than silently drop a real message.
//
// Supported UI languages for system-event detection: HE + EN.
// Header formats: iOS (bracketed) + Android (dash). DD/MM order.
// ============================================================

// System message patterns (HE + EN, common WhatsApp variants).
// Kept strict so we don't accidentally drop real content.
export const SYSTEM_PATTERNS = [
  // Hebrew
  /^הצטרפת לקבוצה/, /הצטרף\/ה? באמצעות הקישור/, /הצטרפ.{0,3} באמצעות/,
  /הוסיף\/ה? את/, /הסיר\/ה? את/, /יצא\/ה? מ?הקבוצה/, /יצאת מהקבוצה/,
  /שינה\/תה? את שם הקבוצה/, /שינה\/תה? את התיאור/, /שינה\/תה? את התמונה/,
  /נוצרה הקבוצה/, /יצרת קבוצה/, /יצר\/ה? את הקבוצה/,
  /^ההודעות והשיחות מוצפנות/, /הצפנה מקצה לקצה/,
  /ההודעה הזו נמחקה/, /מחקת את ההודעה הזו/,
  // English
  /^.+ joined using this group/i, /^.+ was added/i, /^.+ added .+/i,
  /^.+ left$/i, /^.+ was removed/i, /^.+ removed .+/i,
  /^.+ changed the subject/i, /^.+ changed this group/i,
  /^.+ changed the group description/i, /changed the group's icon/i,
  /^.+ created group/i, /^.+ created this group/i,
  /^Messages and calls are end-to-end encrypted/i,
  /^This message was deleted$/i, /^You deleted this message$/i,
  /^Missed (voice|video) call$/i,
];

export const MEDIA_PATTERNS = [
  /<המדיה הושמטה>/, /<מדיה הושמטה>/,
  /<Media omitted>/i, /image omitted/i, /video omitted/i,
  /sticker omitted/i, /GIF omitted/i, /document omitted/i,
  /<מצורף:/, /<attached:/i,
];

export const VOICE_PATTERNS = [
  /הודעה קולית הושמטה/, /audio omitted/i, /voice message omitted/i,
  /PTT-.*\.opus/, /\.opus/,
];

export const DELETED_PATTERNS = [
  /^ההודעה הזו נמחקה$/, /^מחקת את ההודעה הזו$/,
  /^This message was deleted$/, /^You deleted this message$/,
];

// Group-IDENTITY notices: the end-to-end-encryption notice is attributed by
// iOS exports to the group's own subject as the "sender" (e.g.
// `[date] My Group: Messages and calls are end-to-end encrypted…`). A real
// person never sends these, so the sender of such a line IS the group name —
// we use this to stop the group name being counted as a participant.
// Deliberately excludes deleted/media/member-action notices (those ARE
// attributed to real people) to avoid ever dropping a real participant.
export const GROUP_IDENTITY_PATTERNS = [
  /ההודעות והשיחות מוצפנות/, /הודעות והשיחות מוצפנות/, /מוצפנות מקצה לקצה/, /הצפנה מקצה לקצה/,
  /messages and calls are end-to-end encrypted/i,
  /messages (you send )?to this group are now secured/i,
  /your messages are secured with end-to-end encryption/i,
];

export const LINK_RE = /(https?:\/\/[^\s]+)/g;
export const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}\u{1F1E6}-\u{1F1FF}]/gu;

// Two header formats with all known variants.
// iOS:     [DD.MM.YYYY, HH:MM:SS] Sender: msg   (also DD/MM/YYYY, DD-MM-YYYY, with/without AM/PM)
// Android: DD/MM/YY, HH:MM - Sender: msg        (with/without AM/PM, ASCII or unicode dash)
export const HEADER_PATTERNS = [
  {
    name: 'ios_bracket',
    re: /^\[(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?([AaPp][Mm]))?\]\s*([^:]{1,80}?):\s?(.*)$/,
  },
  {
    name: 'android_dash',
    re: /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?([AaPp][Mm]))?\s+[-–—]\s+([^:]{1,80}?):\s?(.*)$/,
  },
];

// Date-only headers (no sender, no colon) — system events.
export const SYSTEM_HEADER_PATTERNS = [
  /^\[\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?\]\s*[^:]+$/,
  /^\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?\s+[-–—]\s+[^:]+$/,
];
