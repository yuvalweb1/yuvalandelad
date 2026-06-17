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
  // English
  /^.+ joined using this group/i, /^.+ was added/i, /^.+ added .+/i,
  /^.+ left$/i, /^.+ was removed/i, /^.+ removed .+/i,
  /^.+ changed the subject/i, /^.+ changed this group/i,
  /^.+ changed the group description/i, /changed the group's icon/i,
  /^.+ created group/i, /^.+ created this group/i,
  /^Messages and calls are end-to-end encrypted/i,
  /^Missed (voice|video) call$/i,
];

export const MEDIA_PATTERNS = [
  /<המדיה הושמטה>/, /<מדיה הושמטה>/,
  // Hebrew "<type> omitted" notices (iOS export). The per-type word varies
  // (תמונה/סרטון/מדבקה/קובץ/GIF…) but the tail is always הושמט / הושמטה.
  // Anchored + length-capped so it only matches a short standalone notice,
  // never a long real sentence that happens to end in הושמט.
  /^.{0,18}הושמטה?>?\s*$/,
  // Android Hebrew variant ("media not included")
  /<מדיה לא נכללה>/, /<המדיה לא נכללה>/,
  // Android "with media" exports reference the file: "IMG-….jpg (file attached)"
  /\(file attached\)\s*$/i, /\(קובץ מצורף\)\s*$/,
  /<Media omitted>/i, /image omitted/i, /video omitted/i,
  /sticker omitted/i, /GIF omitted/i, /document omitted/i,
  /<מצורף:/, /<attached:/i,
];

export const VOICE_PATTERNS = [
  /הודעה קולית הושמטה/, /audio omitted/i, /voice message omitted/i,
  /PTT-.*\.opus/, /\.opus/,
];

// Poll-vote messages — WhatsApp exports poll votes/options as plain messages
// starting with the localized word for "option" (with or without a leading
// definite article, e.g. Hebrew "אפשרות"/"האפשרות"). Not real conversation
// content; excluded from word-frequency only (still counted as a
// message/interaction).
export const POLL_PATTERNS = [
  /^ה?אפשרות(?:\s|:|$)/,  // Hebrew: "אפשרות 1", "האפשרות: כן"
  /^option(?:\s|:|$)/i,   // English/French/German: "Option 1", "Option: Yes"
  /^opci[óo]n(?:\s|:|$)/i, // Spanish: "Opción 1"
  /^op[çc][ãa]o(?:\s|:|$)/i, // Portuguese: "Opção 1"
  /^opzione(?:\s|:|$)/i,  // Italian: "Opzione 1"
  /^вариант(?:\s|:|$)/i,  // Russian: "Вариант 1"
  /^seçenek(?:\s|:|$)/i,  // Turkish: "Seçenek 1"
  /^خيار(?:\s|:|$)/,      // Arabic: "خيار 1"
  /^विकल्प(?:\s|:|$)/,     // Hindi: "विकल्प 1"
  /^選択肢/,               // Japanese: "選択肢1"
  /^옵션(?:\s|:|$)/,       // Korean: "옵션 1"
  /^选项/,                 // Chinese (simplified): "选项1"
];

// Deleted-message notices — many phrasings, so kept broad (unanchored,
// tolerant of trailing punctuation). These messages are excluded from all
// analytics (counted only as `deletedMessages` in diagnostics). Covers every
// locale this app ships UI for, since the export's language depends on the
// exporting phone's locale, not this app's display language.
export const DELETED_PATTERNS = [
  // Hebrew: ה/הודעה · זו/זאת/הזו/הזאת · "נמחקה" (incl. "ההודעה נמחקה")
  /הודעה\s*(?:הזו|הזאת|זו|זאת)?\s*נמחקה/,
  /מחקת\s*(?:את\s*)?(?:ה)?הודעה/,
  // English (tolerant of a trailing period/space/marker)
  /this message was deleted/i,
  /you deleted this message/i,
  // Spanish
  /se elimin[óo] este mensaje/i,
  /eliminaste este mensaje/i,
  // Portuguese (BR + PT)
  /esta mensagem foi apagada/i,
  /(?:você apagou|apagaste) esta mensagem/i,
  // French
  /ce message a été supprimé/i,
  /vous avez supprimé ce message/i,
  // German
  /diese nachricht wurde gelöscht/i,
  /du hast diese nachricht gelöscht/i,
  // Italian
  /questo messaggio è stato eliminato/i,
  /hai eliminato questo messaggio/i,
  // Russian
  /это сообщение (?:было )?удалено/i,
  /вы удалили это сообщение/i,
  // Turkish
  /bu mesaj[ıi] sildiniz/i,
  /bu mesaj silindi/i,
  // Arabic
  /تم حذف هذه الرسالة/,
  /حذفت هذه الرسالة/,
  // Hindi (spelling of "message" varies between मैसेज/मेसेज)
  /यह (?:मैसेज|मेसेज) डिलीट कर दिया/,
  /आपने यह (?:मैसेज|मेसेज) डिलीट कर दिया/,
  // Japanese
  /このメッセージは削除されました/,
  /このメッセージを削除しました/,
  // Korean
  /이 메시지(?:는|가|를)?\s*삭제(?:되었습니다|했습니다)/,
  // Chinese (simplified)
  /此消息已删除/,
  /你已删除(?:这条|此)消息/,
];

// Pseudo-authors WhatsApp puts on the exporter's OWN system actions
// (never real contact names): the gender-neutral Hebrew pronoun "את/ה"
// and the English "You". Excluded so they don't appear as a participant.
// "Unknown" covers WhatsApp's placeholder for unattributable notifications
// (most commonly a missed group call) — shows up as a "participant" with
// exactly 1 message in groups where one of those occurred.
export const SYSTEM_AUTHOR_NAMES = new Set([
  'את/ה', 'את\\ה',
  'You', '~You',
  'Unknown',
]);

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

// Emoji matcher. We match whole emoji *grapheme clusters* so a ZWJ
// sequence like 🤷‍♂️ stays one token instead of leaking a bare "♂"
// (which renders as tofu and used to pollute "signature emoji"):
//   - a flag = two regional indicators
//   - or a pictographic base + optional skin-tone modifier + optional
//     variation selector, then any number of ZWJ-joined continuations.
// `\p{Extended_Pictographic}` is the correct emoji set; bare text-default
// symbols that slip through (e.g. a lone ♂ ♀ ☑) are filtered by
// isStandaloneEmoji() below so they never count on their own.
export const EMOJI_RE = /\p{RI}\p{RI}|\p{Extended_Pictographic}[\u{1F3FB}-\u{1F3FF}\u{FE0F}]?(?:\u{200D}\p{Extended_Pictographic}[\u{1F3FB}-\u{1F3FF}\u{FE0F}]?)*/gu;

// Lone code points that ARE Extended_Pictographic but render as plain
// text glyphs (tofu / thin symbols) when they appear by themselves
// rather than inside a ZWJ sequence. We drop these so they never become
// someone's "top emoji". Gender/zodiac/misc dingbats are the usual
// offenders seen in real chats (the trailing ♂ of 🤷‍♂️, etc.).
const TEXT_DEFAULT_SYMBOLS = new Set([
  '♂', '♀', '⚥', '⚧', '☉', '☿', '♁', '♃', '♄', '♅', '♆', '♇',
  '⚕', '⚖', '⚗', '⚙', '⚛', '⚜', '☑', '☒', '✓', '✔', '✗', '✘',
  '‼', '⁉', '™', '℠', '©', '®', '°', '·',
]);

// True if `s` is a real, self-contained emoji worth counting. A single
// bare text-default symbol (no VS16, no ZWJ partner) is rejected.
export function isStandaloneEmoji(s) {
  if (!s) return false;
  // Multi-codepoint tokens (ZWJ sequences, flags, modified emoji) are fine.
  if ([...s].length > 1) return true;
  return !TEXT_DEFAULT_SYMBOLS.has(s);
}

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
