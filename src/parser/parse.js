// ============================================================
// whatsapp-wrapped-parser — core parser
// ------------------------------------------------------------
// Pure, deterministic, framework-agnostic. Same input -> same
// output. No network, no randomness, no Date.now(). The whole
// privacy story of the app rests on this file doing its work
// entirely in memory.
//
// parseWhatsApp(rawText) -> { messages, diagnostics }
//   messages    : ParsedMessage[]  (non-deleted, chronological as in file)
//   diagnostics : honest counters surfaced to the user (the trust layer)
// ============================================================

import {
  SYSTEM_PATTERNS,
  MEDIA_PATTERNS,
  VOICE_PATTERNS,
  DELETED_PATTERNS,
  HEADER_PATTERNS,
  SYSTEM_HEADER_PATTERNS,
  LINK_RE,
  EMOJI_RE,
} from './patterns.js';

/**
 * Strip bidirectional control characters. WhatsApp's Hebrew/Arabic exports
 * pepper lines with LRM/RLM/isolates that otherwise corrupt header matching
 * and word counts.
 * @param {string} s
 * @returns {string}
 */
export function stripDirectional(s) {
  // U+200E, U+200F LRM/RLM; U+202A-U+202E directional; U+2066-U+2069 isolates
  return s.replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069]/g, '');
}

/**
 * Build a local-time Date from the captured header fields.
 * Assumes DD/MM order (WhatsApp uses the device locale; IL and most regions
 * are day-first). Returns null for impossible dates so callers can count them
 * as unparseable rather than crash.
 */
export function parseDate(d, mo, y, h, mi, ampm) {
  let year = parseInt(y, 10);
  if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
  let hour = parseInt(h, 10);
  if (ampm) {
    const isPM = ampm.toLowerCase() === 'pm';
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
  }
  // Note: WhatsApp uses local day/month order (DD/MM in most regions including IL).
  // We assume DD/MM. If first number > 12 we know that's the day.
  const day = parseInt(d, 10);
  const month = parseInt(mo, 10);
  if (day < 1 || day > 31 || month < 1 || month > 12 || hour < 0 || hour > 23) return null;
  const date = new Date(year, month - 1, day, hour, parseInt(mi, 10));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * @typedef {Object} ParsedMessage
 * @property {Date}    timestamp
 * @property {string}  author
 * @property {string}  content        full text incl. continuation lines
 * @property {number}  contentLength  characters (used by "The Novelist")
 * @property {boolean} isDeleted
 * @property {boolean} hasMedia
 * @property {boolean} isVoice
 * @property {boolean} hasLink
 * @property {number}  linkCount
 * @property {string[]} emojis
 * @property {number}  wordCount
 * @property {boolean} isQuestion
 * @property {number}  hour          0-23 (used by "The Night Owl")
 * @property {number}  weekday       0-6 (Sun..Sat)
 * @property {string}  dayKey        YYYY-MM-DD
 */

/**
 * Parse a raw WhatsApp .txt export.
 * @param {string} rawText
 * @returns {{ messages: ParsedMessage[], diagnostics: object }}
 */
export function parseWhatsApp(rawText) {
  const diagnostics = {
    rawLineCount: 0,
    nonEmptyLines: 0,
    parsedMessages: 0,
    continuationLines: 0,
    systemMessages: 0,
    deletedMessages: 0,
    mediaMessages: 0,
    voiceMessages: 0,
    skippedUnparseable: 0,
    warnings: [],
    sample: [],
    detectedFormat: null,
    perAuthorCount: {},
    perAuthorWordCount: {},
    perAuthorMediaCount: {},
    perAuthorVoiceCount: {},
    hadBOM: false,
    hadDirectionalMarks: false,
  };

  if (rawText.charCodeAt(0) === 0xFEFF) {
    diagnostics.hadBOM = true;
    rawText = rawText.slice(1);
  }
  if (/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(rawText)) {
    diagnostics.hadDirectionalMarks = true;
  }

  const lines = rawText.split(/\r?\n/);
  diagnostics.rawLineCount = lines.length;

  const messages = [];
  const authorNameEmojis = new Set();
  let current = null;

  for (let rawLineIdx = 0; rawLineIdx < lines.length; rawLineIdx++) {
    const line = stripDirectional(lines[rawLineIdx]);
    if (!line.trim()) continue;
    diagnostics.nonEmptyLines++;

    let matched = null;
    for (const pat of HEADER_PATTERNS) {
      const m = line.match(pat.re);
      if (m) { matched = { pat, m }; break; }
    }

    if (matched) {
      if (!diagnostics.detectedFormat) diagnostics.detectedFormat = matched.pat.name;

      const [, d, mo, y, h, mi, , ampm, author, content] = matched.m;
      const date = parseDate(d, mo, y, h, mi, ampm);
      if (!date) {
        diagnostics.skippedUnparseable++;
        continue;
      }

      // Check if this header is actually a system-event header (sender contains a system pattern)
      const cleanAuthor = author.trim();
      const isSystemEvent = SYSTEM_PATTERNS.some(p => p.test(cleanAuthor)) ||
                            SYSTEM_PATTERNS.some(p => p.test(content));

      if (current) {
        messages.push(current);
        current = null;
      }

      if (isSystemEvent) {
        diagnostics.systemMessages++;
        continue;
      }

      // Track emojis in author names (we'll exclude these from emoji counts later)
      (cleanAuthor.match(EMOJI_RE) || []).forEach(e => authorNameEmojis.add(e));

      const isDeleted = DELETED_PATTERNS.some(p => p.test(content));
      const hasMedia = MEDIA_PATTERNS.some(p => p.test(content));
      const isVoice = VOICE_PATTERNS.some(p => p.test(content));
      const linkMatches = content.match(LINK_RE) || [];
      const emojis = (content.match(EMOJI_RE) || []);
      let cleanContent = linkMatches.length > 0 ? content.replace(LINK_RE, '') : content;
      if (emojis.length > 0) cleanContent = cleanContent.replace(EMOJI_RE, '');
      cleanContent = cleanContent.trim();
      const wordCount = cleanContent.length > 0 ? cleanContent.split(/\s+/).filter(Boolean).length : 0;
      const isQuestion = /[?؟]/.test(content);

      current = {
        rawLineIdx,
        rawLine: line,
        timestamp: date,
        author: cleanAuthor,
        content,
        contentLength: content.length,
        isDeleted, hasMedia, isVoice, hasLink: linkMatches.length > 0,
        linkCount: linkMatches.length,
        emojis, wordCount, isQuestion,
        hour: date.getHours(),
        weekday: date.getDay(),
        dayKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      };
    } else if (SYSTEM_HEADER_PATTERNS.some(p => p.test(line))) {
      // A header with no sender — system message
      if (current) { messages.push(current); current = null; }
      diagnostics.systemMessages++;
    } else if (current) {
      // Continuation of previous message (user pressed Enter mid-message)
      current.content += '\n' + line;
      current.contentLength += line.length + 1;
      const newWords = line.split(/\s+/).filter(Boolean).length;
      current.wordCount += newWords;
      diagnostics.continuationLines++;
    } else {
      // Unparseable orphan line (no current message to attach to).
      // Typically the first lines of a malformed export.
      diagnostics.skippedUnparseable++;
    }
  }
  if (current) messages.push(current);

  // Single pass: tally flags (all messages), strip author-name emojis, build realMessages,
  // and accumulate per-author counts — all in one loop to avoid re-iterating the array.
  const realMessages = [];
  for (const msg of messages) {
    if (msg.isDeleted) diagnostics.deletedMessages++;
    // media/voice tallied from all messages (deleted msgs may still carry flags)
    if (msg.hasMedia) diagnostics.mediaMessages++;
    if (msg.isVoice) diagnostics.voiceMessages++;
    if (msg.emojis.length > 0 && authorNameEmojis.size > 0) {
      msg.emojis = msg.emojis.filter(e => !authorNameEmojis.has(e));
    }
    if (!msg.isDeleted) {
      // Per-author counts only for real (non-deleted) messages — fully traceable
      diagnostics.perAuthorCount[msg.author] = (diagnostics.perAuthorCount[msg.author] || 0) + 1;
      diagnostics.perAuthorWordCount[msg.author] = (diagnostics.perAuthorWordCount[msg.author] || 0) + msg.wordCount;
      if (msg.hasMedia) diagnostics.perAuthorMediaCount[msg.author] = (diagnostics.perAuthorMediaCount[msg.author] || 0) + 1;
      if (msg.isVoice) diagnostics.perAuthorVoiceCount[msg.author] = (diagnostics.perAuthorVoiceCount[msg.author] || 0) + 1;
      realMessages.push(msg);
    }
  }
  diagnostics.parsedMessages = realMessages.length;

  // Sample first 20 messages for the debug/verify screen
  diagnostics.sample = messages.slice(0, 20).map(m => ({
    rawLineIdx: m.rawLineIdx,
    rawLine: m.rawLine.length > 140 ? m.rawLine.slice(0, 140) + '…' : m.rawLine,
    timestamp: m.timestamp.toISOString(),
    author: m.author,
    contentPreview: m.content.length > 80 ? m.content.slice(0, 80) + '…' : m.content,
    flags: [
      m.isDeleted && 'DELETED',
      m.hasMedia && 'MEDIA',
      m.isVoice && 'VOICE',
      m.hasLink && 'LINK',
      m.isQuestion && 'QUESTION',
    ].filter(Boolean).join(','),
  }));

  // Warnings
  const totalLines = diagnostics.rawLineCount;
  const skipRatio = totalLines > 0 ? diagnostics.skippedUnparseable / totalLines : 0;
  if (skipRatio > 0.05) {
    diagnostics.warnings.push(`${(skipRatio * 100).toFixed(1)}% of lines could not be parsed. Format may be unusual.`);
  }
  if (diagnostics.parsedMessages < 20) {
    diagnostics.warnings.push(`Only ${diagnostics.parsedMessages} messages parsed. Some metrics will be unreliable.`);
  }
  if (Object.keys(diagnostics.perAuthorCount).length === 1) {
    diagnostics.warnings.push(`Only one participant detected. This may be a 1-on-1 chat or a parsing issue.`);
  }
  if (!diagnostics.detectedFormat) {
    diagnostics.warnings.push(`No standard WhatsApp header format was detected.`);
  }

  // Confidence score
  let confidence = 100;
  if (skipRatio > 0.02) confidence -= Math.min(40, skipRatio * 400);
  if (diagnostics.parsedMessages < 50) confidence -= 20;
  if (diagnostics.parsedMessages < 10) confidence -= 30;
  if (!diagnostics.detectedFormat) confidence -= 50;
  diagnostics.confidence = Math.max(0, Math.round(confidence));

  return { messages: realMessages, diagnostics };
}
