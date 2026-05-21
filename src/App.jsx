import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

// ============================================================
// PARSER — with full diagnostics
// ============================================================

// System message patterns (HE + EN, common WhatsApp variants)
// We keep these strict so we don't accidentally drop real content
const SYSTEM_PATTERNS = [
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

const MEDIA_PATTERNS = [
  /<המדיה הושמטה>/, /<מדיה הושמטה>/,
  /<Media omitted>/i, /image omitted/i, /video omitted/i,
  /sticker omitted/i, /GIF omitted/i, /document omitted/i,
  /<מצורף:/, /<attached:/i,
];

const VOICE_PATTERNS = [
  /הודעה קולית הושמטה/, /audio omitted/i, /voice message omitted/i,
  /PTT-.*\.opus/, /\.opus/,
];

const DELETED_PATTERNS = [
  /^ההודעה הזו נמחקה$/, /^מחקת את ההודעה הזו$/,
  /^This message was deleted$/, /^You deleted this message$/,
];

const LINK_RE = /(https?:\/\/[^\s]+)/g;
const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}\u{1F1E6}-\u{1F1FF}]/gu;

// Two header formats with all known variants
// iOS: [DD.MM.YYYY, HH:MM:SS] Sender: msg   (also DD/MM/YYYY, DD-MM-YYYY, with/without AM/PM)
// Android: DD/MM/YY, HH:MM - Sender: msg   (with/without AM/PM)
const HEADER_PATTERNS = [
  {
    name: 'ios_bracket',
    re: /^\[(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?([AaPp][Mm]))?\]\s*([^:]{1,80}?):\s?(.*)$/,
  },
  {
    name: 'android_dash',
    re: /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?([AaPp][Mm]))?\s+[-–—]\s+([^:]{1,80}?):\s?(.*)$/,
  },
];

// Date-only headers (no sender, no colon) — system events
const SYSTEM_HEADER_PATTERNS = [
  /^\[\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?\]\s*[^:]+$/,
  /^\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?\s+[-–—]\s+[^:]+$/,
];

function stripDirectional(s) {
  // U+200E, U+200F LRM/RLM; U+202A-U+202E directional; U+2066-U+2069 isolates
  return s.replace(/[\u200E\u200F\u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069]/g, '');
}

function parseDate(d, mo, y, h, mi, ampm) {
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

function parseWhatsApp(rawText) {
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
      const cleanContent = content.replace(LINK_RE, '').replace(EMOJI_RE, '').trim();
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
      // Continuation of previous message
      current.content += '\n' + line;
      current.contentLength += line.length + 1;
      const newWords = line.split(/\s+/).filter(Boolean).length;
      current.wordCount += newWords;
      diagnostics.continuationLines++;
    } else {
      // Unparseable orphan line (no current message to attach to)
      // This typically happens at the start of a file with malformed exports
      diagnostics.skippedUnparseable++;
    }
  }
  if (current) messages.push(current);

  // Now finalize: filter out deleted/system from author lists, but keep counts in diagnostics
  for (const msg of messages) {
    if (msg.isDeleted) diagnostics.deletedMessages++;
    if (msg.hasMedia) diagnostics.mediaMessages++;
    if (msg.isVoice) diagnostics.voiceMessages++;
    // Strip author-name emojis from emoji list
    if (msg.emojis.length > 0 && authorNameEmojis.size > 0) {
      msg.emojis = msg.emojis.filter(e => !authorNameEmojis.has(e));
    }
  }

  // Real messages = anything not deleted (deleted messages exist but have no content to analyze)
  // We include media/voice in counts since they are real signal
  const realMessages = messages.filter(m => !m.isDeleted);
  diagnostics.parsedMessages = realMessages.length;

  // Per-author counts (built directly from parsed messages — fully traceable)
  for (const msg of realMessages) {
    diagnostics.perAuthorCount[msg.author] = (diagnostics.perAuthorCount[msg.author] || 0) + 1;
    diagnostics.perAuthorWordCount[msg.author] = (diagnostics.perAuthorWordCount[msg.author] || 0) + msg.wordCount;
    if (msg.hasMedia) diagnostics.perAuthorMediaCount[msg.author] = (diagnostics.perAuthorMediaCount[msg.author] || 0) + 1;
    if (msg.isVoice) diagnostics.perAuthorVoiceCount[msg.author] = (diagnostics.perAuthorVoiceCount[msg.author] || 0) + 1;
  }

  // Sample first 20 messages for debug screen
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

// ============================================================
// ZIP DECODING — same as before, browser-native
// ============================================================

async function readZipText(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP file');
  const cdOffset = dv.getUint32(eocd + 16, true);
  const cdEntries = dv.getUint16(eocd + 10, true);
  const txtEntries = [];
  let p = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.slice(p + 46, p + 46 + nameLen));
    if (name.toLowerCase().endsWith('.txt') && !name.endsWith('/')) {
      txtEntries.push({ name, method, compSize, localOffset });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (txtEntries.length === 0) throw new Error('No .txt file inside ZIP');
  const entry = txtEntries.find(e => e.name.toLowerCase().endsWith('_chat.txt'))
             || txtEntries.find(e => e.name.toLowerCase().includes('chat'))
             || txtEntries[0];
  const lo = entry.localOffset;
  if (dv.getUint32(lo, true) !== 0x04034b50) throw new Error('Bad local header');
  const lNameLen = dv.getUint16(lo + 26, true);
  const lExtraLen = dv.getUint16(lo + 28, true);
  const dataStart = lo + 30 + lNameLen + lExtraLen;
  const raw = buf.slice(dataStart, dataStart + entry.compSize);
  let decompressed;
  if (entry.method === 0) {
    decompressed = raw;
  } else if (entry.method === 8) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([raw]).stream().pipeThrough(ds);
    decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error('Unsupported compression method ' + entry.method);
  }
  return new TextDecoder('utf-8').decode(decompressed);
}

// ============================================================
// ANALYTICS — every output derived strictly from parsed messages
// Each field has a "source" comment showing how it's computed.
// ============================================================

const STOPWORDS = new Set([
  // Hebrew
  'אני','אתה','את','הוא','היא','אנחנו','אתם','הם','הן','זה','זאת','של','על','אל','עם','לא','כן','אם','או','גם','רק','כל','יש','אין','היה','כי','אבל','מה','מי','איך','איפה','מתי','למה','כמה','איזה','עוד','כבר','אז','פה','שם','ככה','אוקיי','אוקי','אהה','נו','טוב','הי','היי','שלום','תודה','סבבה','באמת','בטח','אולי','כאילו','יותר','פחות','הכי','מאוד','ממש','די','קצת','הרבה','בכלל','אחרי','לפני','בין','בלי','עד','אמר','אומר','יודע','חושב','רוצה','עושה','בא','באה','שלי','שלך','שלו','שלה','הזה','הזאת','כן','לאן','משהו','כלום','אחד','אחת','כאשר','עכשיו',
  // English
  'the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','could','can','may','might','must','i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','this','that','these','those','and','or','but','if','then','so','for','of','at','by','with','from','to','in','on','as','no','yes','not','just','very','too','also','only','all','some','any','more','most','lol','omg','idk','tbh','btw','oh','ah','hmm','yeah','yep','ok','okay','like','one','two','get','got','going','gonna','wanna','what','when','where','why','how','who','which','because','about','out','up','down','here','there',
]);

// Returns the [key, count] entry with the highest count without sorting.
function maxEntry(freq) {
  let bestKey = null, bestVal = 0;
  for (const key in freq) {
    if (freq[key] > bestVal) { bestVal = freq[key]; bestKey = key; }
  }
  return bestKey === null ? undefined : [bestKey, bestVal];
}

// Returns the top-N [key, count] pairs from a freq map without a full sort.
// Maintains a size-N buffer; heap[0] is always the current minimum.
function topNEntries(freq, n) {
  const buf = []; // up to n entries; buf[0] = current min
  for (const key in freq) {
    const val = freq[key];
    if (buf.length < n) {
      buf.push([key, val]);
      // Keep buf[0] as the minimum so we can evict cheaply
      if (buf.length > 1 && val < buf[0][1]) {
        const tmp = buf[0]; buf[0] = buf[buf.length - 1]; buf[buf.length - 1] = tmp;
      }
    } else if (val > buf[0][1]) {
      buf[0] = [key, val];
      // Restore min-at-0 invariant with a linear scan (N=10, negligible cost)
      let minIdx = 0;
      for (let j = 1; j < n; j++) {
        if (buf[j][1] < buf[minIdx][1]) minIdx = j;
      }
      if (minIdx !== 0) {
        const tmp = buf[0]; buf[0] = buf[minIdx]; buf[minIdx] = tmp;
      }
    }
  }
  buf.sort((a, b) => b[1] - a[1]);
  return buf;
}

function argmax(arr, fn) {
  let best, bestVal = -Infinity;
  for (const item of arr) {
    const v = fn(item);
    if (v > bestVal) { bestVal = v; best = item; }
  }
  return best;
}

function computeAll(messages) {
  if (!messages || messages.length === 0) return null;

  // Note: deleted messages already filtered in parseWhatsApp
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const authors = Array.from(new Set(sorted.map(m => m.author)));

  const start = sorted[0].timestamp;
  const end = sorted[sorted.length - 1].timestamp;
  const durationDays = Math.max(1, Math.round((end - start) / 86400000) + 1);

  // Per-user accumulators
  const u = {};
  for (const a of authors) {
    u[a] = {
      author: a,
      messageCount: 0,           // SOURCE: count of msgs where m.author === a
      wordCount: 0,              // SOURCE: sum of m.wordCount
      emojiCount: 0,             // SOURCE: sum of m.emojis.length
      questionCount: 0,          // SOURCE: count where m.isQuestion === true
      mediaCount: 0,             // SOURCE: count where m.hasMedia === true
      voiceCount: 0,             // SOURCE: count where m.isVoice === true
      linkCount: 0,              // SOURCE: sum of m.linkCount
      nightMessages: 0,          // SOURCE: count where m.hour is in [0..5]
      morningMessages: 0,        // SOURCE: count where m.hour is in [5..11]
      hourCounts: new Array(24).fill(0),
      weekdayCounts: new Array(7).fill(0),
      dayKeys: new Set(),        // SOURCE: distinct m.dayKey
      wordFreq: {},              // SOURCE: tokenized & stopword-filtered from m.content
      emojiFreq: {},             // SOURCE: from m.emojis
      responseTimesMins: [],     // SOURCE: for replies under 120 min from another author
      currentBurst: 0,
      maxBurst: 0,
      longestAbsenceDays: 0,
      conversationsRevived: 0,
      conversationsKilled: 0,
      finalMessagesOfDay: 0,
      gotReplyWithin30: 0,
      gotNoReplyWithin30: 0,
    };
  }

  // Group accumulators
  const groupHourly = new Array(24).fill(0);
  const groupWeekly = new Array(7).fill(0);
  const dailyMap = {};
  const groupWordFreq = {};
  const groupEmojiFreq = {};
  const minuteBuckets = {};
  const replyMatrix = {}; // a -> b -> count (a replied to b)
  const lastMsgTs = {}; // author -> timestamp of their previous message (for absence tracking)

  let prevAuthor = null;
  let prevMsg = null;

  // Single pass through messages
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const acc = u[m.author];

    // Longest absence: gap between this message and the author's previous message
    if (lastMsgTs[m.author] !== undefined) {
      const gapDays = (m.timestamp - lastMsgTs[m.author]) / 86400000;
      if (gapDays > acc.longestAbsenceDays) acc.longestAbsenceDays = gapDays;
    }
    lastMsgTs[m.author] = m.timestamp;

    acc.messageCount++;
    acc.wordCount += m.wordCount;
    acc.emojiCount += m.emojis.length;
    if (m.isQuestion) acc.questionCount++;
    if (m.hasMedia) acc.mediaCount++;
    if (m.isVoice) acc.voiceCount++;
    acc.linkCount += m.linkCount;
    if (m.hour >= 0 && m.hour < 6) acc.nightMessages++;
    if (m.hour >= 5 && m.hour < 11) acc.morningMessages++;
    acc.hourCounts[m.hour]++;
    acc.weekdayCounts[m.weekday]++;
    acc.dayKeys.add(m.dayKey);

    groupHourly[m.hour]++;
    groupWeekly[m.weekday]++;
    dailyMap[m.dayKey] = (dailyMap[m.dayKey] || 0) + 1;

    // Burst tracking
    if (m.author === prevAuthor) {
      acc.currentBurst++;
    } else {
      acc.currentBurst = 1;
    }
    if (acc.currentBurst > acc.maxBurst) acc.maxBurst = acc.currentBurst;

    // Emojis
    for (const e of m.emojis) {
      acc.emojiFreq[e] = (acc.emojiFreq[e] || 0) + 1;
      groupEmojiFreq[e] = (groupEmojiFreq[e] || 0) + 1;
    }

    // Tokenize content for word freq
    if (!m.hasMedia && !m.isVoice && m.content.length > 0) {
      const tokens = m.content.replace(LINK_RE, '').replace(EMOJI_RE, '').toLowerCase()
        .split(/[\s\.,!\?;:()"'\[\]\{\}…—–\-_/\\]+/u);
      for (const t of tokens) {
        const clean = t.replace(/[^\p{L}\p{N}]/gu, '');
        if (clean.length >= 3 && !STOPWORDS.has(clean) && !/^\d+$/.test(clean)) {
          acc.wordFreq[clean] = (acc.wordFreq[clean] || 0) + 1;
          groupWordFreq[clean] = (groupWordFreq[clean] || 0) + 1;
        }
      }
    }

    // Minute buckets for chaos detection
    const minuteKey = Math.floor(m.timestamp.getTime() / 60000);
    if (!minuteBuckets[minuteKey]) minuteBuckets[minuteKey] = { count: 0, ts: m.timestamp, authors: new Set() };
    minuteBuckets[minuteKey].count++;
    minuteBuckets[minuteKey].authors.add(m.author);

    // Reply logic
    if (prevMsg && prevMsg.author !== m.author) {
      const diffMin = (m.timestamp - prevMsg.timestamp) / 60000;
      if (diffMin <= 120) {
        acc.responseTimesMins.push(diffMin);
        if (!replyMatrix[m.author]) replyMatrix[m.author] = {};
        replyMatrix[m.author][prevMsg.author] = (replyMatrix[m.author][prevMsg.author] || 0) + 1;
      }
      // Drama: prev got a reply within 30 min?
      if (diffMin <= 30) {
        u[prevMsg.author].gotReplyWithin30++;
      }
      // Conversation revived: gap > 12h before this msg, and this msg is from someone else
      if (diffMin >= 720) {
        acc.conversationsRevived++;
        u[prevMsg.author].conversationsKilled++;
        u[prevMsg.author].gotNoReplyWithin30++;
      }
    } else if (prevMsg && prevMsg.author === m.author) {
      const diffMin = (m.timestamp - prevMsg.timestamp) / 60000;
      // Same author follows up after long silence — they're talking to themselves; count for prevMsg
      if (diffMin >= 720) {
        // The prev silence was on them, but technically nobody else replied
      }
    }

    // Final message of day?
    const isLastInChat = i === sorted.length - 1;
    const nextHasDifferentDay = !isLastInChat && sorted[i + 1].dayKey !== m.dayKey;
    if (isLastInChat || nextHasDifferentDay) {
      acc.finalMessagesOfDay++;
    }

    prevAuthor = m.author;
    prevMsg = m;
  }

  // After pass: compute streak, longestAbsence, percentile-able fields
  const userList = authors.map(a => {
    const acc = u[a];
    const days = Array.from(acc.dayKeys).sort();
    let longestStreak = days.length > 0 ? 1 : 0;
    let curStreak = days.length > 0 ? 1 : 0;
    for (let i = 1; i < days.length; i++) {
      const diff = (new Date(days[i]) - new Date(days[i - 1])) / 86400000;
      if (Math.round(diff) === 1) {
        curStreak++;
        if (curStreak > longestStreak) longestStreak = curStreak;
      } else {
        curStreak = 1;
      }
    }

    const longestAbsenceDays = acc.longestAbsenceDays;

    const avgRespMin = acc.responseTimesMins.length > 0
      ? acc.responseTimesMins.reduce((s, t) => s + t, 0) / acc.responseTimesMins.length
      : null;

    const topWordEntry = maxEntry(acc.wordFreq);
    const topEmojiEntry = maxEntry(acc.emojiFreq);

    const peakHour = acc.hourCounts.indexOf(Math.max(...acc.hourCounts));
    const peakWeekday = acc.weekdayCounts.indexOf(Math.max(...acc.weekdayCounts));

    const nightPct = (acc.nightMessages / acc.messageCount) * 100;
    const sharePct = (acc.messageCount / sorted.length) * 100;
    const questionRate = acc.questionCount / acc.messageCount;
    const mediaRate = acc.mediaCount / acc.messageCount;
    const voiceRate = acc.voiceCount / acc.messageCount;
    const replyReceivedRate = acc.messageCount > 0
      ? acc.gotReplyWithin30 / acc.messageCount
      : 0;
    const ignoredRate = acc.messageCount > 0
      ? acc.gotNoReplyWithin30 / acc.messageCount
      : 0;

    return {
      author: a,
      messageCount: acc.messageCount,
      wordCount: acc.wordCount,
      emojiCount: acc.emojiCount,
      questionCount: acc.questionCount,
      mediaCount: acc.mediaCount,
      voiceCount: acc.voiceCount,
      linkCount: acc.linkCount,
      nightMessages: acc.nightMessages,
      hourCounts: acc.hourCounts,
      weekdayCounts: acc.weekdayCounts,
      activeDays: acc.dayKeys.size,
      longestStreak,
      longestAbsenceDays: Math.round(longestAbsenceDays),
      avgRespMin,
      respSampleSize: acc.responseTimesMins.length,
      topWord: topWordEntry ? topWordEntry[0] : null,
      topWordCount: topWordEntry ? topWordEntry[1] : 0,
      topEmoji: topEmojiEntry ? topEmojiEntry[0] : null,
      topEmojiCount: topEmojiEntry ? topEmojiEntry[1] : 0,
      peakHour, peakWeekday,
      nightPct, sharePct,
      questionRate, mediaRate, voiceRate,
      avgWordsPerMsg: acc.wordCount / acc.messageCount,
      maxBurst: acc.maxBurst,
      conversationsRevived: acc.conversationsRevived,
      conversationsKilled: acc.conversationsKilled,
      finalMessagesOfDay: acc.finalMessagesOfDay,
      gotReplyWithin30: acc.gotReplyWithin30,
      gotNoReplyWithin30: acc.gotNoReplyWithin30,
      replyReceivedRate,
      ignoredRate,
    };
  });

  userList.sort((a, b) => b.messageCount - a.messageCount);
  const userMap = Object.fromEntries(userList.map(u => [u.author, u]));

  // Percentiles
  // "You sent more than X% of the group" — strictly count OTHERS who scored worse.
  // We compare ourselves to the rest of the group (excluding ourselves once).
  // For a 5-person group where you're #1: you beat 4 others out of 4 = 100% — which is true but
  // the UI presents this as the share of *others* you outrank, not "all 5 incl you".
  function pctRank(arr, val, higherIsBetter) {
    if (arr.length <= 1) return null;
    // Remove ONE instance of val from arr (the user themselves)
    const others = [...arr];
    const selfIdx = others.indexOf(val);
    if (selfIdx >= 0) others.splice(selfIdx, 1);
    if (others.length === 0) return null;
    const countWorse = higherIsBetter
      ? others.filter(v => v < val).length
      : others.filter(v => v > val).length;
    return Math.round((countWorse / others.length) * 100);
  }
  for (const user of userList) {
    user.messagesPercentile = pctRank(userList.map(x => x.messageCount), user.messageCount, true);
    if (user.respSampleSize >= 5) {
      const speedSample = userList.filter(x => x.respSampleSize >= 5 && x.avgRespMin != null);
      user.speedPercentile = speedSample.length > 1
        ? pctRank(speedSample.map(x => x.avgRespMin), user.avgRespMin, false)
        : null;
    } else {
      user.speedPercentile = null;
    }
  }

  // Superlatives — eligibility checks to prevent fake winners
  const eligibleResponders = userList.filter(x => x.respSampleSize >= 10 && x.avgRespMin != null);
  const fastestResponder = eligibleResponders.length > 0
    ? argmax(eligibleResponders, u => -u.avgRespMin)
    : null;
  const yapper = userList[0];
  const lurker = userList[userList.length - 1];
  const nightOwl = userList[0].nightMessages > 0
    ? argmax(userList, u => u.nightPct)
    : null;
  const emojiKing = userList[0].emojiCount > 0
    ? argmax(userList, u => u.emojiCount)
    : null;
  const spammer = argmax(userList, u => u.maxBurst);
  const ghost = argmax(userList, u => u.longestAbsenceDays);
  const voiceNoteUser = userList.some(u => u.voiceCount > 0)
    ? argmax(userList, u => u.voiceCount)
    : null;
  const reviver = userList.some(u => u.conversationsRevived > 0)
    ? argmax(userList, u => u.conversationsRevived)
    : null;
  const killer = userList.some(u => u.conversationsKilled > 0)
    ? argmax(userList, u => u.conversationsKilled)
    : null;
  const finalWorder = argmax(userList, u => u.finalMessagesOfDay);

  // Peak day
  const peakDay = maxEntry(dailyMap) || null;

  // Longest silence
  const dayList = Object.keys(dailyMap).sort();
  let longestSilenceDays = 0;
  let silenceFromDate = null;
  for (let i = 1; i < dayList.length; i++) {
    const gap = (new Date(dayList[i]) - new Date(dayList[i - 1])) / 86400000 - 1;
    if (gap > longestSilenceDays) {
      longestSilenceDays = Math.round(gap);
      silenceFromDate = dayList[i - 1];
    }
  }

  // Peak minute (chaos)
  const minutesArr = Object.values(minuteBuckets);
  const peakMinute = minutesArr.length > 0
    ? argmax(minutesArr, m => m.count)
    : null;
  // Only "chaos" if multiple distinct authors in same minute and count is meaningfully above average
  const avgPerMinute = minutesArr.reduce((s, m) => s + m.count, 0) / Math.max(1, minutesArr.length);
  const chaosMinute = (peakMinute && peakMinute.count >= 5 && peakMinute.authors.size >= 2 && peakMinute.count >= avgPerMinute * 3)
    ? peakMinute
    : null;

  // Duos
  const duoPairs = {};
  for (const [a, partners] of Object.entries(replyMatrix)) {
    for (const [b, count] of Object.entries(partners)) {
      const key = a < b ? `${a}||${b}` : `${b}||${a}`;
      duoPairs[key] = (duoPairs[key] || 0) + count;
    }
  }
  const topDuoEntry = maxEntry(duoPairs);
  const topDuo = topDuoEntry ? {
    names: topDuoEntry[0].split('||'),
    count: topDuoEntry[1],
  } : null;
  const totalReplies = Object.values(duoPairs).reduce((s, c) => s + c, 0);
  const topDuoShare = topDuo && totalReplies > 0 ? (topDuo.count / totalReplies) * 100 : 0;

  // Group totals
  const totalGroupNight = groupHourly.slice(0, 6).reduce((s, c) => s + c, 0);
  const groupNightPct = (totalGroupNight / sorted.length) * 100;
  const totalGroupMedia = userList.reduce((s, u) => s + u.mediaCount, 0);
  const groupMediaPct = (totalGroupMedia / sorted.length) * 100;
  const totalGroupVoice = userList.reduce((s, u) => s + u.voiceCount, 0);
  const groupVoicePct = (totalGroupVoice / sorted.length) * 100;
  const totalGroupQuestions = userList.reduce((s, u) => s + u.questionCount, 0);
  const groupQuestionPct = (totalGroupQuestions / sorted.length) * 100;
  const top3Share = userList.slice(0, 3).reduce((s, u) => s + u.sharePct, 0);

  // Top words/emojis (group-level)
  const topWordsGroup = topNEntries(groupWordFreq, 10)
    .map(([word, count]) => ({ word, count }));
  const topEmojisGroup = topNEntries(groupEmojiFreq, 10)
    .map(([emoji, count]) => ({ emoji, count }));

  // Eras — split timeline into chunks of equal message count
  const eraCount = sorted.length >= 200 ? 4 : sorted.length >= 80 ? 3 : sorted.length >= 30 ? 2 : 1;
  const eras = [];
  const eraSize = Math.floor(sorted.length / eraCount);
  for (let i = 0; i < eraCount; i++) {
    const startIdx = i * eraSize;
    const endIdx = i === eraCount - 1 ? sorted.length - 1 : (i + 1) * eraSize - 1;
    const slice = sorted.slice(startIdx, endIdx + 1);
    if (slice.length === 0) continue;
    const eraStart = slice[0].timestamp;
    const eraEnd = slice[slice.length - 1].timestamp;
    const eraDays = Math.max(1, (eraEnd - eraStart) / 86400000);
    const eraNightPct = (slice.filter(m => m.hour < 6).length / slice.length) * 100;
    const eraMediaPct = (slice.filter(m => m.hasMedia).length / slice.length) * 100;
    const eraVoicePct = (slice.filter(m => m.isVoice).length / slice.length) * 100;
    const eraQuestionPct = (slice.filter(m => m.isQuestion).length / slice.length) * 100;
    const eraMsgPerDay = slice.length / eraDays;

    let name;
    if (eraNightPct > 25) name = 'The 3 AM Era';
    else if (eraVoicePct > 12) name = 'The Voice Note Saga';
    else if (eraMediaPct > 22) name = 'The Meme Dump Period';
    else if (eraQuestionPct > 28) name = 'The "Where Are You" Era';
    else if (eraMsgPerDay > avgPerMinute * 30 * 5) name = 'Peak Chaos';
    else if (eraMsgPerDay < 5) name = 'The Quiet Stretch';
    else {
      const generic = ['The Opening Chapter', 'The Build-Up', 'The Plot Thickens', 'The Final Act'];
      name = generic[i] || `Chapter ${i + 1}`;
    }

    eras.push({
      name,
      messageCount: slice.length,
      days: Math.round(eraDays) || 1,
      startDate: eraStart,
      endDate: eraEnd,
      msgPerDay: Math.round(eraMsgPerDay),
    });
  }

  // ============ Derived "AI" social layer — every output traceable ============

  function generateTitleFor(user) {
    // Returns {titleKey, evidenceKey, vars} — translation happens at render time
    const tests = [
      { cond: user.voiceCount >= 30 && user.voiceRate > 0.15,
        titleKey: 'st_title_voice_boss', evidenceKey: 'st_ev_voice_boss',
        vars: { n: user.voiceCount, pct: (user.voiceRate*100).toFixed(0) } },
      { cond: user.longestAbsenceDays >= 21 && user.messageCount >= 30,
        titleKey: 'st_title_last_seen', evidenceKey: 'st_ev_last_seen',
        vars: { n: user.longestAbsenceDays } },
      { cond: user.maxBurst >= 12,
        titleKey: 'st_title_spammer', evidenceKey: 'st_ev_spammer',
        vars: { n: user.maxBurst } },
      { cond: user.nightPct > 35,
        titleKey: 'st_title_2am', evidenceKey: 'st_ev_2am',
        vars: { pct: user.nightPct.toFixed(0) } },
      { cond: user.sharePct > 35,
        titleKey: 'st_title_main_char', evidenceKey: 'st_ev_main_char',
        vars: { pct: user.sharePct.toFixed(0) } },
      { cond: user.avgRespMin !== null && user.avgRespMin < 2 && user.respSampleSize >= 30,
        titleKey: 'st_title_available', evidenceKey: 'st_ev_available',
        vars: { m: user.avgRespMin.toFixed(1), n: user.respSampleSize } },
      { cond: user.questionRate > 0.30,
        titleKey: 'st_title_ceo_overthink', evidenceKey: 'st_ev_questions',
        vars: { pct: (user.questionRate*100).toFixed(0) } },
      { cond: user.questionRate > 0.20,
        titleKey: 'st_title_typing', evidenceKey: 'st_ev_questions',
        vars: { pct: (user.questionRate*100).toFixed(0) } },
      { cond: user.mediaRate > 0.25,
        titleKey: 'st_title_meme', evidenceKey: 'st_ev_media',
        vars: { pct: (user.mediaRate*100).toFixed(0) } },
      { cond: user.conversationsRevived >= 10,
        titleKey: 'st_title_defib', evidenceKey: 'st_ev_defib',
        vars: { n: user.conversationsRevived } },
      { cond: user.conversationsKilled >= 10,
        titleKey: 'st_title_killer', evidenceKey: 'st_ev_killer',
        vars: { n: user.conversationsKilled } },
      { cond: user.ignoredRate > 0.30 && user.messageCount >= 30,
        titleKey: 'st_title_emoffline', evidenceKey: 'st_ev_ignored',
        vars: { pct: (user.ignoredRate*100).toFixed(0) } },
      { cond: user.emojiCount >= 200 && user.emojiCount / user.messageCount > 1.5,
        titleKey: 'st_title_emoji_dipl', evidenceKey: 'st_ev_emoji',
        vars: { n: user.emojiCount } },
      { cond: user.sharePct < 3,
        titleKey: 'st_title_from_bed', evidenceKey: 'st_ev_share_low',
        vars: { pct: user.sharePct.toFixed(1) } },
      { cond: user.sharePct < 8,
        titleKey: 'st_title_watching', evidenceKey: 'st_ev_share_low',
        vars: { pct: user.sharePct.toFixed(1) } },
      { cond: user.longestStreak >= 30,
        titleKey: 'st_title_attached', evidenceKey: 'st_ev_streak',
        vars: { n: user.longestStreak } },
      { cond: user.avgWordsPerMsg > 25,
        titleKey: 'st_title_essay', evidenceKey: 'st_ev_essay',
        vars: { n: user.avgWordsPerMsg.toFixed(0) } },
      { cond: user.peakHour >= 5 && user.peakHour < 9,
        titleKey: 'st_title_morning', evidenceKey: 'st_ev_peak',
        vars: { h: String(user.peakHour).padStart(2,'0') } },
    ];
    const match = tests.find(t => t.cond);
    return match || { titleKey: 'st_title_anchor', evidenceKey: 'st_ev_anchor', vars: {} };
  }

  for (const user of userList) {
    const r = generateTitleFor(user);
    user.titleKey = r.titleKey;
    user.titleEvidenceKey = r.evidenceKey;
    user.titleVars = r.vars;
  }

  // Achievements — each with explicit evidence
  function achievementsFor(user) {
    const acks = [];
    if (user.nightPct > 30) acks.push({ labelKey: 'st_ach_night', evidenceKey: 'st_ach_ev_night', vars: { pct: user.nightPct.toFixed(0) }, color: '#a78bfa' });
    if (user.maxBurst >= 12) acks.push({ labelKey: 'st_ach_sprint', evidenceKey: 'st_ach_ev_sprint', vars: { n: user.maxBurst }, color: '#f472b6' });
    if (user.voiceCount >= 30) acks.push({ labelKey: 'st_ach_voice', evidenceKey: 'st_ach_ev_voice', vars: { n: user.voiceCount }, color: '#fbbf24' });
    if (user.longestAbsenceDays >= 21) acks.push({ labelKey: 'st_ach_ghost', evidenceKey: 'st_ach_ev_ghost', vars: { n: user.longestAbsenceDays }, color: '#94a3b8' });
    if (user.longestStreak >= 30) acks.push({ labelKey: 'st_ach_iron', evidenceKey: 'st_ach_ev_iron', vars: { n: user.longestStreak }, color: '#a3e635' });
    if (user.conversationsRevived >= 8) acks.push({ labelKey: 'st_ach_defib', evidenceKey: 'st_ach_ev_defib', vars: { n: user.conversationsRevived }, color: '#34d399' });
    if (user.conversationsKilled >= 8) acks.push({ labelKey: 'st_ach_assassin', evidenceKey: 'st_ach_ev_assassin', vars: { n: user.conversationsKilled }, color: '#ef4444' });
    if (user.emojiCount >= 500) acks.push({ labelKey: 'st_ach_emoji_hof', evidenceKey: 'st_ach_ev_emoji_hof', vars: { n: user.emojiCount }, color: '#fbbf24' });
    if (user.avgRespMin !== null && user.avgRespMin < 1.5 && user.respSampleSize >= 50)
      acks.push({ labelKey: 'st_ach_submin', evidenceKey: 'st_ach_ev_submin', vars: { s: (user.avgRespMin*60).toFixed(0), n: user.respSampleSize }, color: '#60a5fa' });
    if (user.sharePct > 40) acks.push({ labelKey: 'st_ach_solo', evidenceKey: 'st_ach_ev_solo', vars: { pct: user.sharePct.toFixed(0) }, color: '#f472b6' });
    if (user.finalMessagesOfDay >= durationDays * 0.3)
      acks.push({ labelKey: 'st_ach_lastword', evidenceKey: 'st_ach_ev_lastword', vars: { n: user.finalMessagesOfDay }, color: '#a3e635' });
    return acks;
  }
  const achievementsByUser = {};
  for (const user of userList) achievementsByUser[user.author] = achievementsFor(user);

  // "Group would describe you as..."
  function groupDescriptionFor(user) {
    if (user.avgRespMin !== null && user.avgRespMin < 3 && user.respSampleSize >= 20) return 'st_desc_online';
    if (user.sharePct < 5 && user.messageCount >= 5) return 'st_desc_watching';
    if (user.conversationsKilled >= 8 && user.conversationsRevived < 3) return 'st_desc_disappears';
    if (user.conversationsRevived >= 5) return 'st_desc_keeps_alive';
    if (user.nightPct > 30) return 'st_desc_midnight';
    if (user.maxBurst >= 10) return 'st_desc_lot_to_say';
    if (user.questionRate > 0.25) return 'st_desc_asks';
    if (user.longestAbsenceDays > 14 && user.messageCount > 30) return 'st_desc_when_feels';
    if (user.voiceCount > 20) return 'st_desc_voice';
    if (user.emojiCount / user.messageCount > 1.5) return 'st_desc_emoji';
    return 'st_desc_always_there';
  }
  for (const user of userList) user.groupDescriptionKey = groupDescriptionFor(user);

  // Roasts — savage, specific, screenshot-worthy. Every one tied to actual numbers.
  function roastsFor(user) {
    const out = [];

    // ===== TIER 1: Speed-based =====
    if (user.avgRespMin !== null && user.avgRespMin < 0.5 && user.respSampleSize >= 30) {
      out.push({ lineKey: 'st_r_speed_blink_l', kickerKey: 'st_r_speed_blink_k', vars: { s: Math.round(user.avgRespMin * 60) } });
    } else if (user.avgRespMin !== null && user.avgRespMin < 2 && user.respSampleSize >= 30) {
      out.push({ lineKey: 'st_r_speed_flat_l', kickerKey: 'st_r_speed_flat_k', vars: { m: user.avgRespMin.toFixed(1) } });
    } else if (user.avgRespMin !== null && user.avgRespMin > 240 && user.respSampleSize >= 10) {
      out.push({ lineKey: 'st_r_speed_slow_l', kickerKey: 'st_r_speed_slow_k', vars: { h: (user.avgRespMin / 60).toFixed(1) } });
    }

    // ===== TIER 2: Volume-based =====
    if (user.sharePct > 40) {
      out.push({ lineKey: 'st_r_vol_pod_l', kickerKey: 'st_r_vol_pod_k', vars: { pct: user.sharePct.toFixed(0) } });
    } else if (user.sharePct > 30) {
      out.push({ lineKey: 'st_r_vol_dom_l', kickerKey: 'st_r_vol_dom_k', vars: { pct: user.sharePct.toFixed(0) } });
    } else if (user.sharePct < 2 && user.messageCount >= 5) {
      out.push({ lineKey: 'st_r_vol_tiny_l', kickerKey: 'st_r_vol_tiny_k', vars: { pct: user.sharePct.toFixed(1), n: user.messageCount } });
    } else if (user.sharePct < 5 && user.messageCount >= 10) {
      out.push({ lineKey: 'st_r_vol_watch_l', kickerKey: 'st_r_vol_watch_k', vars: { pct: user.sharePct.toFixed(1) } });
    }

    // ===== TIER 3: Spam bursts =====
    if (user.maxBurst >= 20) {
      out.push({ lineKey: 'st_r_burst_hostage_l', kickerKey: 'st_r_burst_hostage_k', vars: { n: user.maxBurst } });
    } else if (user.maxBurst >= 12) {
      out.push({ lineKey: 'st_r_burst_uninterr_l', kickerKey: 'st_r_burst_uninterr_k', vars: { n: user.maxBurst } });
    } else if (user.maxBurst >= 8) {
      out.push({ lineKey: 'st_r_burst_record_l', kickerKey: 'st_r_burst_record_k', vars: { n: user.maxBurst } });
    }

    // ===== TIER 4: Night activity =====
    if (user.nightPct > 45) {
      out.push({ lineKey: 'st_r_night_tab_l', kickerKey: 'st_r_night_tab_k', vars: { pct: user.nightPct.toFixed(0) } });
    } else if (user.nightPct > 30) {
      out.push({ lineKey: 'st_r_night_close_l', kickerKey: 'st_r_night_close_k', vars: { pct: user.nightPct.toFixed(0) } });
    } else if (user.peakHour === 3 || user.peakHour === 4) {
      out.push({ lineKey: 'st_r_night_crisis_l', kickerKey: 'st_r_night_crisis_k', vars: { h: user.peakHour } });
    }

    // ===== TIER 5: Ghosting =====
    if (user.longestAbsenceDays >= 60 && user.messageCount >= 30) {
      out.push({ lineKey: 'st_r_ghost_iconic_l', kickerKey: 'st_r_ghost_iconic_k', vars: { n: user.longestAbsenceDays } });
    } else if (user.longestAbsenceDays >= 21 && user.messageCount >= 20) {
      out.push({ lineKey: 'st_r_ghost_vanish_l', kickerKey: 'st_r_ghost_vanish_k', vars: { n: user.longestAbsenceDays } });
    }

    // ===== TIER 6: Voice notes =====
    if (user.voiceCount >= 50) {
      out.push({ lineKey: 'st_r_voice_beg_l', kickerKey: 'st_r_voice_beg_k', vars: { n: user.voiceCount } });
    } else if (user.voiceCount >= 25) {
      out.push({ lineKey: 'st_r_voice_mono_l', kickerKey: 'st_r_voice_mono_k', vars: { n: user.voiceCount } });
    }

    // ===== TIER 7: Questions =====
    if (user.questionRate > 0.35) {
      out.push({ lineKey: 'st_r_q_google_l', kickerKey: 'st_r_q_google_k', vars: { pct: Math.round(user.questionRate * 100) } });
    } else if (user.questionRate > 0.25) {
      out.push({ lineKey: 'st_r_q_tired_l', kickerKey: 'st_r_q_tired_k', vars: {} });
    }

    // ===== TIER 8: Media spam =====
    if (user.mediaRate > 0.35) {
      out.push({ lineKey: 'st_r_media_fwd_l', kickerKey: 'st_r_media_fwd_k', vars: { pct: Math.round(user.mediaRate * 100) } });
    } else if (user.mediaRate > 0.25) {
      out.push({ lineKey: 'st_r_media_redist_l', kickerKey: 'st_r_media_redist_k', vars: { pct: Math.round(user.mediaRate * 100), rest: Math.round((1 - user.mediaRate) * 100) } });
    }

    // ===== TIER 9: Being ignored =====
    if (user.ignoredRate > 0.40 && user.messageCount >= 30) {
      out.push({ lineKey: 'st_r_ign_thumb_l', kickerKey: 'st_r_ign_thumb_k', vars: { pct: Math.round(user.ignoredRate * 100) } });
    } else if (user.ignoredRate > 0.25 && user.messageCount >= 30) {
      out.push({ lineKey: 'st_r_ign_said_l', kickerKey: 'st_r_ign_said_k', vars: { pct: Math.round(user.ignoredRate * 100) } });
    }

    // ===== TIER 10: Conversation killing =====
    if (user.conversationsKilled >= 15) {
      out.push({ lineKey: 'st_r_kill_arg_l', kickerKey: 'st_r_kill_arg_k', vars: { n: user.conversationsKilled } });
    } else if (user.conversationsKilled >= 8) {
      out.push({ lineKey: 'st_r_kill_susp_l', kickerKey: 'st_r_kill_susp_k', vars: { n: user.conversationsKilled } });
    }

    // ===== TIER 11: Emoji abuse =====
    if (user.emojiCount >= 1000) {
      out.push({ lineKey: 'st_r_emoji_help_l', kickerKey: 'st_r_emoji_help_k', vars: { n: user.emojiCount.toLocaleString(), per: Math.round(user.emojiCount / user.messageCount) } });
    } else if (user.emojiCount >= 500) {
      out.push({ lineKey: 'st_r_emoji_words_l', kickerKey: 'st_r_emoji_words_k', vars: { n: user.emojiCount } });
    } else if (user.emojiCount === 0 && user.messageCount >= 50) {
      out.push({ lineKey: 'st_r_emoji_zero_l', kickerKey: 'st_r_emoji_zero_k', vars: { n: user.messageCount } });
    }

    // ===== TIER 12: Length =====
    if (user.avgWordsPerMsg > 40) {
      out.push({ lineKey: 'st_r_len_ted_l', kickerKey: 'st_r_len_ted_k', vars: { n: user.avgWordsPerMsg.toFixed(0) } });
    } else if (user.avgWordsPerMsg > 25) {
      out.push({ lineKey: 'st_r_len_tldr_l', kickerKey: 'st_r_len_tldr_k', vars: { n: user.avgWordsPerMsg.toFixed(0) } });
    } else if (user.avgWordsPerMsg < 2 && user.messageCount >= 50) {
      out.push({ lineKey: 'st_r_len_poem_l', kickerKey: 'st_r_len_poem_k', vars: { n: user.avgWordsPerMsg.toFixed(1) } });
    }

    // ===== TIER 13: Reviver =====
    if (user.conversationsRevived >= 15) {
      out.push({ lineKey: 'st_r_rev_bless_l', kickerKey: 'st_r_rev_bless_k', vars: { n: user.conversationsRevived } });
    }

    // ===== TIER 14: Streak =====
    if (user.longestStreak >= 60) {
      out.push({ lineKey: 'st_r_streak_grass_l', kickerKey: 'st_r_streak_grass_k', vars: { n: user.longestStreak } });
    } else if (user.longestStreak >= 30) {
      out.push({ lineKey: 'st_r_streak_love_l', kickerKey: 'st_r_streak_love_k', vars: { n: user.longestStreak } });
    }

    // ===== Fallback if nothing extreme =====
    if (out.length === 0) {
      out.push({ lineKey: 'st_r_fallback_l', kickerKey: 'st_r_fallback_k', vars: { n: user.messageCount } });
    }

    return out;
  }
  for (const user of userList) user.roasts = roastsFor(user);

  // Most likely to — only show if there's a real winner with the trait
  const mostLikely = [];
  if (nightOwl && nightOwl.nightPct > 5)
    mostLikely.push({ labelKey: 'likely_to_text_3am', winner: nightOwl.author, icon: '🌙', metric: `${nightOwl.nightPct.toFixed(0)}% night msgs` });
  if (spammer.maxBurst >= 5)
    mostLikely.push({ labelKey: 'likely_to_burst', winner: spammer.author, icon: '💬', metric: `${spammer.maxBurst} msg burst` });
  if (fastestResponder)
    mostLikely.push({ labelKey: 'likely_to_reply_fast', winner: fastestResponder.author, icon: '⚡', metric: `${fastestResponder.avgRespMin.toFixed(1)}m avg` });
  if (ghost.longestAbsenceDays >= 7)
    mostLikely.push({ labelKey: 'likely_to_disappear', winner: ghost.author, icon: '👻', metric: `${ghost.longestAbsenceDays}d gap` });
  if (killer && killer.conversationsKilled >= 3)
    mostLikely.push({ labelKey: 'likely_to_kill', winner: killer.author, icon: '💀', metric: `${killer.conversationsKilled} dead-ends` });
  if (reviver && reviver.conversationsRevived >= 3)
    mostLikely.push({ labelKey: 'likely_to_revive', winner: reviver.author, icon: '✨', metric: `${reviver.conversationsRevived} revivals` });

  // Group personality
  let groupPersonality, groupPersonalityReason;
  if (groupNightPct > 25) {
    groupPersonality = 'Sleep-Deprived Council';
    groupPersonalityReason = `${groupNightPct.toFixed(0)}% of all messages happen after midnight.`;
  } else if (top3Share > 80 && userList.length >= 4) {
    groupPersonality = 'The Same Three People';
    groupPersonalityReason = `Top 3 voices carry ${top3Share.toFixed(0)}% of everything said.`;
  } else if (groupMediaPct > 20) {
    groupPersonality = 'Meme-Powered Friendship';
    groupPersonalityReason = `${groupMediaPct.toFixed(0)}% of messages were media or links.`;
  } else if (groupVoicePct > 15) {
    groupPersonality = 'Voice Note Cult';
    groupPersonalityReason = `${groupVoicePct.toFixed(0)}% of messages were voice notes.`;
  } else if (groupQuestionPct > 25) {
    groupPersonality = 'Eternal Logistics Loop';
    groupPersonalityReason = `${groupQuestionPct.toFixed(0)}% questions. No one ever answers.`;
  } else if (sorted.length / durationDays > 80) {
    groupPersonality = 'Permanently Online';
    groupPersonalityReason = `${Math.round(sorted.length / durationDays)} messages every single day.`;
  } else if (sorted.length / durationDays < 10) {
    groupPersonality = 'The Quiet Chat';
    groupPersonalityReason = `Only ${(sorted.length / durationDays).toFixed(1)} messages per day.`;
  } else {
    groupPersonality = 'Casually Chaotic';
    groupPersonalityReason = `Balanced participation, regular bursts of energy.`;
  }

  return {
    // Core
    totalMessages: sorted.length,
    totalParticipants: authors.length,
    durationDays,
    start, end,
    // Users
    users: userList, userMap,
    // Superlatives (may be null when no eligible winner)
    fastestResponder, yapper, lurker, nightOwl, emojiKing,
    spammer, ghost, voiceNoteUser, reviver, killer, finalWorder,
    // Day-level
    peakDay,
    longestSilenceDays, silenceFromDate,
    chaosMinute,
    // Lists
    topWordsGroup, topEmojisGroup,
    eras,
    groupHourly, groupWeekly,
    // Pairs
    topDuo, topDuoShare,
    // Group personality
    groupPersonality, groupPersonalityReason,
    groupNightPct, groupMediaPct, groupVoicePct, groupQuestionPct,
    top3Share,
    // Social layer outputs
    mostLikely, achievementsByUser,
  };
}

// ============================================================
// SAMPLE DATA — clearly labeled
// ============================================================

function generateSampleText() {
  // Generates a synthetic WhatsApp text with clear bias patterns
  const authors = ['Maya', 'Yoav', 'Noa', 'Daniel', 'Talia'];
  const tplShort = ['חחחחח','lol','😂😂','אש 🔥','אין מצב','כן','ברור','okay','💀','❤️'];
  const tplMid = ['מי בא בערב?','where are we meeting','בואו ניפגש מחר','מה השעה?','איפה אתם?','tomorrow at 8?'];
  const tplLong = [
    'אז חשבתי על כל הסיפור של אתמול והגעתי למסקנה שאולי כדאי שנדבר',
    'I have a whole story to tell you guys about what happened today',
    'אני חייבת לספר לכם משהו מטורף שקרה לי בדרך הבוקר',
  ];
  const tplNight = ['מישהו ער?','cant sleep','אני לא נרדמת','whos up?'];
  const lines = [];
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  for (let day = 0; day < 90; day++) {
    const date = new Date(start);
    date.setDate(date.getDate() + day);
    const isBurst = Math.random() < 0.08;
    const dailyCount = isBurst ? 60 + Math.floor(Math.random() * 50) : Math.floor(Math.random() * 28) + 8;
    for (let i = 0; i < dailyCount; i++) {
      const r = Math.random();
      let hour;
      if (r < 0.1) hour = Math.floor(Math.random() * 6);
      else if (r < 0.3) hour = 8 + Math.floor(Math.random() * 3);
      else if (r < 0.65) hour = 12 + Math.floor(Math.random() * 6);
      else hour = 18 + Math.floor(Math.random() * 6);
      const minute = Math.floor(Math.random() * 60);
      const author = authors[Math.floor(Math.random() * authors.length)];
      let text;
      const tr = Math.random();
      if (hour < 6) text = tplNight[Math.floor(Math.random() * tplNight.length)];
      else if (tr < 0.55) text = tplShort[Math.floor(Math.random() * tplShort.length)];
      else if (tr < 0.85) text = tplMid[Math.floor(Math.random() * tplMid.length)];
      else text = tplLong[Math.floor(Math.random() * tplLong.length)];
      const d = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      const t = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      lines.push(`${d}, ${t} - ${author}: ${text}`);
    }
  }
  return lines.join('\n');
}

// ============================================================
// ERROR BOUNDARY — keeps artifact stable
// ============================================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('ChatWrapped error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0a0f', color: '#f4f4f8',
          padding: 24, fontFamily: 'monospace', fontSize: 23,
        }}>
          <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 12 }}>
            ChatWrapped hit an unexpected error.
          </div>
          <div style={{ marginBottom: 6 }}>{String(this.state.error)}</div>
          <div style={{ color: '#c8c8dc', marginTop: 12 }}>
            {this.state.error?.stack?.slice(0, 800)}
          </div>
          <button onClick={() => this.setState({ error: null })} style={{
            marginTop: 20, padding: '8px 14px', background: '#a3e635',
            color: '#0a0a0f', border: 'none', borderRadius: 8, cursor: 'pointer',
          }}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// HOOKS
// ============================================================

function useAnimatedNumber(target, duration = 1400, deps = []) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null || isNaN(target)) { setValue(0); return; }
    let frame;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, deps);
  return value;
}

// ============================================================
// MAIN
// ============================================================

export default function App() {
  return (
    <ErrorBoundary>
      <ChatWrappedApp />
    </ErrorBoundary>
  );
}

// ============================================================
// I18N — UI strings in 10 languages
// ============================================================

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'he', name: 'עברית', flag: '🇮🇱' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

const RTL_LANGS = new Set(['he', 'ar']);

const I18N = {
  en: {
    landing_eyebrow: 'NEW · WHATSAPP UNWRAPPED',
    landing_h1_a: 'Your',
    landing_h1_b: 'group chat',
    landing_h1_c: 'year is',
    landing_h1_d: 'about to',
    landing_h1_e: 'drop.',
    landing_sub: 'Eras. Awards. Drama. A cinematic recap built from your real messages. Nothing leaves your phone.',
    cta_play: 'Play my Wrapped →',
    cta_demo: 'OR PREVIEW WITH DEMO →',
    privacy_note: 'PROCESSED ENTIRELY ON YOUR DEVICE',
    err_format: 'Upload a .txt or .zip from WhatsApp export.',
    err_no_msgs: 'No messages parsed. Format may not be supported.',
    onboard_skip: 'Skip',
    onboard_continue: 'Continue →',
    onboard_done: 'See my Wrapped →',
    onboard_title: 'Quick questions',
    onboard_sub: 'A few seconds. Makes your Wrapped 10x more accurate.',
    q_who_are_you: "What's your name in this chat?",
    q_who_are_you_hint: 'Pick yourself from the participants',
    q_relationship: 'What kind of chat is this?',
    q_relationship_friends: 'Friends',
    q_relationship_family: 'Family',
    q_relationship_work: 'Work',
    q_relationship_couple: 'Just us two',
    q_relationship_other: 'Other',
    q_tone: 'How spicy should the roasts be?',
    q_tone_mild: 'Gentle',
    q_tone_mild_d: 'Keep it kind',
    q_tone_medium: 'Honest',
    q_tone_medium_d: 'Real but fair',
    q_tone_spicy: 'Savage',
    q_tone_spicy_d: 'No mercy',
    q_lang_q: 'What language is this chat mostly in?',
    parsing_msg_parsed: 'MESSAGES PARSED',
    parsing_label_open: 'Opening file',
    parsing_label_unzip: 'Unzipping export',
    parsing_label_read: 'Reading every line',
    parsing_label_analyze: 'Analyzing your chaos',
    parsing_label_build: 'Building your story',
    parsing_detail_open: 'Reading bytes from disk',
    parsing_detail_unzip: 'Decompressing WhatsApp ZIP',
    parsing_detail_read: 'Parsing timestamps & senders',
    parsing_detail_analyze: 'Detecting drama, eras, peaks',
    parsing_detail_build: 'Almost there…',
    // Intro
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'Get',
    intro_ready: 'ready.',
    intro_summary: '{msgs} messages. {people} people. {days} days. One story.',
    // Message count
    msg_eyebrow: 'THIS YEAR THE GROUP SENT',
    msg_word: 'messages.',
    msg_your_share: 'YOUR SHARE',
    // Rank
    rank_eyebrow: '✦ THE LEADERBOARD',
    rank_finished: 'You finished',
    rank_of: 'of {n}.',
    rank_you: '(you)',
    // Vs everyone
    vs_eyebrow: 'YOU VS EVERYONE',
    vs_outsent_all: 'You out-sent\nevery other person.',
    vs_least: 'You sent fewer\nthan everyone else.',
    vs_middle: 'You sent more than\n{beat} of {others} others.',
    vs_alone: "It's just you here.",
    vs_ranked: '{msgs} msgs · ranked #{rank} of {total}',
    vs_fastest: 'FASTEST IN THE CHAT',
    vs_avg_s: '{s}s avg',
    vs_avg_m: '{m}m avg',
    vs_avg_h: '{h}h avg',
    // Title
    title_eyebrow: '✦ THEY CALL YOU',
    title_based_on: 'BASED ON',
    // Group describes
    descr_eyebrow: 'THE GROUP WOULD DESCRIBE YOU AS',
    descr_footnote: "They didn't say it out loud. But the data did.",
    // Peak hour
    peak_eyebrow: 'YOUR HOUR',
    peak_3am: 'Genuinely concerning.',
    peak_morning: 'An actual morning person.',
    peak_midday: 'Texting during work. Bold.',
    peak_evening: 'Post-work texting champion.',
    peak_late: 'Late-night philosopher behavior.',
    // Night
    night_eyebrow: 'BETWEEN MIDNIGHT & 6 AM',
    night_of_msgs: 'of your messages.',
    night_diag_strong: 'Diagnosis: certified night creature.',
    night_diag_med: "You're up later than you think.",
    night_diag_low: 'Healthy sleep schedule, mostly.',
    night_diag_none: 'You log off. Respect.',
    night_owl: '✦ #1 NIGHT OWL IN THIS CHAT',
    night_count: '{night} of your {total}',
    // Streak
    streak_eyebrow: 'YOUR LONGEST STREAK',
    streak_day: 'day',
    streak_days: 'days straight.',
    // Speed
    speed_eyebrow: 'AVG REPLY SPEED',
    speed_faster: 'Faster than',
    speed_of_group: 'of the group.',
    speed_based: 'BASED ON {n} TRACKED REPLIES',
    // Word
    word_eyebrow: 'YOUR SIGNATURE WORD',
    word_used: 'Used {n} times.',
    // Top words (group)
    top_words_eyebrow: 'THE GROUP’S VOCABULARY',
    top_words_title: 'The words',
    top_words_subtitle: 'you all kept saying',
    // Emoji
    emoji_eyebrow: 'MOST-USED EMOJI',
    emoji_used: 'Used {n} times.',
    // Drama role
    drama_eyebrow: '✦ YOUR ROLE IN THE DRAMA',
    drama_defib: 'The Defibrillator',
    drama_defib_label: 'dead chats revived',
    drama_defib_copy: 'When this group went silent, you brought it back.',
    drama_killer: 'The Conversation Killer',
    drama_killer_label: 'chats ended on you',
    drama_killer_copy: 'Whenever you spoke, no one had anything to add. Suspicious.',
    drama_replied: 'Everyone Replies To You',
    drama_replied_label: '% of your msgs got a reply within 30 min',
    drama_replied_copy: 'When you speak, the group listens.',
    drama_ignored: 'Online But Ignored',
    drama_ignored_label: '% of your msgs got no reply',
    drama_ignored_copy: "It's not you. It's them. Probably.",
    drama_steady: 'Steady in the Mix',
    drama_steady_label: 'days you sent the final message',
    drama_steady_copy: 'You closed the chat plenty of times. Just present.',
    // Roast
    roast_eyebrow_mild: '✦ GENTLE TAKES',
    roast_eyebrow_med: '✦ READING YOU FOR FILTH',
    roast_eyebrow_spicy: '🔥 NO MERCY MODE',
    roast_heading_mild: 'A few gentle notes.',
    roast_heading_med: 'A few observations.',
    roast_heading_spicy: 'No mercy. Brace yourself.',
    roast_more: '+{n} MORE IN ROAST MODE →',
    // Achievements
    ach_eyebrow: '✦ ACHIEVEMENTS UNLOCKED',
    ach_earned: 'You earned',
    ach_badges: 'badge',
    ach_badges_plural: 'badges',
    ach_more: '+{n} MORE',
    // Most likely
    likely_eyebrow: '✦ MOST LIKELY TO',
    likely_title: 'The group',
    likely_verdicts: 'verdicts.',
    likely_label: 'MOST LIKELY TO',
    likely_to_text_3am: 'text at 3 AM',
    likely_to_burst: 'send 10 messages in a row',
    likely_to_reply_fast: 'reply in under a minute',
    likely_to_disappear: 'disappear for weeks',
    likely_to_kill: 'kill the conversation',
    likely_to_revive: 'bring the chat back to life',
    // Duo
    duo_eyebrow: '✦ THE TOP DUO',
    duo_traded: 'traded',
    duo_replies_between: 'replies between them.',
    duo_in_with: 'You and {partner} are basically co-hosts of this chat.',
    duo_share: '{pct}% of all back-and-forth in this group.',
    // Eras
    eras_eyebrow: '✦ YOUR ERAS',
    eras_title: 'The chapters',
    eras_subtitle: 'of this chat.',
    eras_chapter: 'CHAPTER',
    eras_msgs: 'msgs',
    eras_per_day: '{n}/day',
    // Chaos
    chaos_eyebrow: '✦ THE MOMENT IT BROKE',
    chaos_at: 'at {time}.',
    chaos_msgs_minute: 'messages in one minute.',
    chaos_lost_control: 'The group lost control.',
    // Group persona
    persona_eyebrow: '✦ DIAGNOSIS',
    persona_this_group: 'This group is a…',
    persona_evidence: 'EVIDENCE',
    // Awards
    awards_eyebrow: '✦ THE AWARDS CEREMONY',
    awards_title: 'And the winners',
    awards_are: 'are…',
    awards_fastest: 'Fastest Fingers',
    awards_fastest_sub: '{m}m avg reply',
    awards_yapper: 'Biggest Yapper',
    awards_yapper_sub: '{n} messages',
    awards_nightowl: 'Most Dangerous After Midnight',
    awards_nightowl_sub: '{pct}% post-midnight',
    awards_ghost: 'The Return of the Ghost',
    awards_ghost_sub: '{n}-day absence',
    awards_killer: 'Conversation Killer',
    awards_killer_sub: '{n} chats ended on them',
    awards_defib: 'The Defibrillator',
    awards_defib_sub: 'revived {n} dead chats',
    // Peak day
    peakday_eyebrow: "THE GROUP'S WILDEST DAY",
    peakday_msgs: 'messages in one day.',
    // Finale
    finale_eyebrow: "✦ THAT'S A WRAP",
    finale_see: 'See you',
    finale_in_the: 'in the',
    finale_chat: 'group chat.',
    finale_now: 'Now ask your friends what they got.',
    finale_explore: 'Explore the data →',
    // Post menu
    menu_replay: 'REPLAY',
    menu_watch: 'Watch\nagain →',
    menu_roast_mode: 'ROAST MODE',
    menu_roast_everyone: 'Roast\neveryone →',
    menu_viewing_as: 'VIEWING AS',
    menu_switch: 'SWITCH →',
    menu_verified: '✓ VERIFIED DATA · {n}%',
    menu_msgs_senders: '{msgs} msgs · {senders} senders parsed',
    menu_verify: 'VERIFY →',
    menu_this_group_is: '✦ THIS GROUP IS A',
    menu_eras: 'THE ERAS',
    menu_highlights: 'YOUR HIGHLIGHTS',
    menu_badges: 'YOUR BADGES',
    menu_leaderboard: 'FULL LEADERBOARD',
    menu_hl_messages: 'messages',
    menu_hl_of: 'of {n}',
    menu_hl_peak_hour: 'peak hour',
    menu_hl_at_night: 'at night',
    menu_hl_streak: 'streak',
    menu_hl_top_emoji: 'top emoji',
    menu_hl_top_word: 'top word',
    menu_hl_avg_reply: 'avg reply',
    // Roast mode
    rm_back: '← Back',
    rm_title: '🔥 ROAST MODE',
    rm_pick: 'Pick a',
    rm_victim: 'victim.',
    rm_sub: 'Every roast is based on real numbers from this chat. No mercy. Tap a name to switch.',
    rm_now: 'NOW ROASTING',
    rm_roast: 'ROAST',
    rm_hot_take: 'HOT TAKE',
    rm_screenshot: 'Now go screenshot this and\nsend it to {name}.',
    rm_others: 'OTHER VICTIMS',
    rm_ready: '{n} roast ready',
    rm_ready_plural: '{n} roasts ready',
    rm_btn: 'ROAST →',
    rm_language: 'Language',
    rm_switch_person: 'Switch person',
    // Verify
    verify_back: '← Back',
    verify_title: 'Does this look',
    verify_right: 'right',
    verify_sub: 'Numbers are computed straight from the parsed file. Skim them — if anything looks off, hit Reset. If it matches your expectations, continue to Wrapped.',
    verify_continue: 'Looks right · Continue to Wrapped →',
    verify_wrong: 'NUMBERS LOOK WRONG · UPLOAD AGAIN',
    verify_reset: 'RESET',
    // Social Layer — Titles
    st_title_voice_boss: 'Voice Note Final Boss',
    st_title_last_seen: 'Last Seen Recently',
    st_title_spammer: 'Professional Spammer',
    st_title_2am: 'The 2 AM Department',
    st_title_main_char: 'Main Character Energy',
    st_title_available: 'Chronically Available',
    st_title_ceo_overthink: 'CEO of Overthinking',
    st_title_typing: 'Typing…',
    st_title_meme: 'Meme Distribution System',
    st_title_defib: 'The Defibrillator',
    st_title_killer: 'Conversation Killer',
    st_title_emoffline: 'Online But Emotionally Offline',
    st_title_emoji_dipl: 'Emoji Diplomat',
    st_title_from_bed: 'Replying From Bed',
    st_title_watching: 'Never Answers But Always Watching',
    st_title_attached: 'Emotionally Attached To Notifications',
    st_title_essay: 'Essay Sender',
    st_title_morning: 'Morning Glory',
    st_title_anchor: 'The Anchor',
    // Social Layer — Title evidence
    st_ev_voice_boss: '{n} voice notes ({pct}% of msgs)',
    st_ev_last_seen: '{n}-day absence',
    st_ev_spammer: '{n}-message burst',
    st_ev_2am: '{pct}% post-midnight',
    st_ev_main_char: '{pct}% of all messages',
    st_ev_available: '{m}m avg reply (n={n})',
    st_ev_questions: '{pct}% questions',
    st_ev_media: '{pct}% media',
    st_ev_defib: 'revived {n} dead chats',
    st_ev_killer: '{n} chats ended on them',
    st_ev_ignored: '{pct}% messages got no reply',
    st_ev_emoji: '{n} emojis sent',
    st_ev_share_low: 'only {pct}% share',
    st_ev_streak: '{n}-day streak',
    st_ev_essay: '{n} words/msg avg',
    st_ev_peak: 'peaks at {h}:00',
    st_ev_anchor: 'steady, consistent participation',
    // Social Layer — Group descriptions
    st_desc_online: 'always online',
    st_desc_watching: 'never answers but always watching',
    st_desc_disappears: 'starts plans, disappears immediately',
    st_desc_keeps_alive: 'the one who keeps this group alive',
    st_desc_midnight: 'only exists after midnight',
    st_desc_lot_to_say: 'has a lot to say. always.',
    st_desc_asks: 'asks more than they answer',
    st_desc_when_feels: 'shows up exactly when they feel like it',
    st_desc_voice: 'a voice note person, somehow',
    st_desc_emoji: 'speaks fluent emoji',
    st_desc_always_there: 'just kind of always there',
    // Social Layer — Achievements
    st_ach_night: 'Certified Night Creature',
    st_ach_sprint: '{n}-Message Sprint',
    st_ach_voice: 'Voice Note Loyalist',
    st_ach_ghost: 'The Return of the Ghost',
    st_ach_iron: 'Iron Streak',
    st_ach_defib: 'The Defibrillator',
    st_ach_assassin: 'Conversation Assassin',
    st_ach_emoji_hof: 'Emoji Hall of Fame',
    st_ach_submin: 'Sub-Minute Responder',
    st_ach_solo: 'The Solo Show',
    st_ach_lastword: 'The Last Word',
    st_ach_ev_night: '{pct}% of msgs post-midnight',
    st_ach_ev_sprint: 'unbroken streak of {n} msgs in a row',
    st_ach_ev_voice: '{n} voice notes sent',
    st_ach_ev_ghost: '{n}-day absence then came back',
    st_ach_ev_iron: '{n} consecutive days',
    st_ach_ev_defib: 'revived {n} chats after >12h silence',
    st_ach_ev_assassin: '{n} chats ended right after them',
    st_ach_ev_emoji_hof: '{n} emojis sent',
    st_ach_ev_submin: '{s}s avg reply (n={n})',
    st_ach_ev_solo: '{pct}% of all messages',
    st_ach_ev_lastword: 'closed {n} days',
    // Social Layer — Roasts (line + kicker per scenario)
    st_r_speed_blink_l: 'Average reply time: {s} seconds.',
    st_r_speed_blink_k: 'Are you okay. Blink twice.',
    st_r_speed_flat_l: 'Replies in {m} minutes flat.',
    st_r_speed_flat_k: 'What job. What hobbies. What life.',
    st_r_speed_slow_l: 'Takes {h} hours to reply on average.',
    st_r_speed_slow_k: "The phone exists. We've seen you on Instagram.",
    st_r_vol_pod_l: '{pct}% of every message sent here was you.',
    st_r_vol_pod_k: "This isn't a group chat. It's your podcast.",
    st_r_vol_dom_l: 'You said {pct}% of everything.',
    st_r_vol_dom_k: 'The others were trying to talk.',
    st_r_vol_tiny_l: '{pct}% share. {n} messages all year.',
    st_r_vol_tiny_k: 'Are you... okay? Should we check on you?',
    st_r_vol_watch_l: '{pct}% of the chat is yours.',
    st_r_vol_watch_k: "You're watching. Plotting. Saving everything for court.",
    st_r_burst_hostage_l: 'Once sent {n} messages in a row.',
    st_r_burst_hostage_k: "That's not texting. That's a hostage situation.",
    st_r_burst_uninterr_l: '{n} messages in a row. Uninterrupted.',
    st_r_burst_uninterr_k: 'Nobody asked. Nobody could stop you either.',
    st_r_burst_record_l: 'Your record streak: {n} messages, no one replied.',
    st_r_burst_record_k: 'You just kept going. Beautiful, in a way.',
    st_r_night_tab_l: '{pct}% of your messages happen between midnight and 6 AM.',
    st_r_night_tab_k: "You don't have a sleep schedule. You have an open tab.",
    st_r_night_close_l: '{pct}% of your texts are after midnight.',
    st_r_night_close_k: "Whatever you're going through — close the app.",
    st_r_night_crisis_l: 'Your most active hour is {h} AM.',
    st_r_night_crisis_k: 'That\'s not "late night." That\'s "early morning crisis."',
    st_r_ghost_iconic_l: 'Disappeared for {n} days straight.',
    st_r_ghost_iconic_k: 'Then came back like nothing happened. Iconic.',
    st_r_ghost_vanish_l: '{n}-day silence at one point.',
    st_r_ghost_vanish_k: 'No "hey." No explanation. Just vanished.',
    st_r_voice_beg_l: '{n} voice notes sent.',
    st_r_voice_beg_k: "We're begging you to type. Just type. Please.",
    st_r_voice_mono_l: '{n} voice notes. Average human: 3.',
    st_r_voice_mono_k: 'Nobody has time to listen to your 47-second monologue.',
    st_r_q_google_l: '{pct}% of your messages are questions.',
    st_r_q_google_k: "You don't have a personality. You have a Google search bar.",
    st_r_q_tired_l: '1 in every 4 messages from you is a question.',
    st_r_q_tired_k: 'The group is tired. So tired.',
    st_r_media_fwd_l: '{pct}% of what you send is media.',
    st_r_media_fwd_k: "You don't talk. You forward.",
    st_r_media_redist_l: '{pct}% memes. {rest}% actual content.',
    st_r_media_redist_k: "Your contribution: redistributing other people's jokes.",
    st_r_ign_thumb_l: '{pct}% of your messages got zero reply in 30 minutes.',
    st_r_ign_thumb_k: 'Not even a thumbs up. Tough crowd.',
    st_r_ign_said_l: '{pct}% of what you say goes ignored.',
    st_r_ign_said_k: "It's not what you said. It's that you said it.",
    st_r_kill_arg_l: '{n} conversations ended within minutes of you speaking.',
    st_r_kill_arg_k: "You're not a participant. You're a closing argument.",
    st_r_kill_susp_l: '{n} chats died right after you posted.',
    st_r_kill_susp_k: 'Suspicious. Investigation pending.',
    st_r_emoji_help_l: '{n} emojis sent. Approximately {per} per message.',
    st_r_emoji_help_k: 'Your keyboard is 80% pictures. Get help.',
    st_r_emoji_words_l: '{n} emojis in one year.',
    st_r_emoji_words_k: "Words exist. They're free. Try them.",
    st_r_emoji_zero_l: '{n} messages. Zero emojis.',
    st_r_emoji_zero_k: 'What happened to you. Who hurt you.',
    st_r_len_ted_l: '{n} words per message on average.',
    st_r_len_ted_k: 'This is a chat. Not a TED talk.',
    st_r_len_tldr_l: 'Average message: {n} words.',
    st_r_len_tldr_k: "TL;DR. We're begging you.",
    st_r_len_poem_l: 'Your average message: {n} words.',
    st_r_len_poem_k: '"ok" "k" "lol" — a poetry collection.',
    st_r_rev_bless_l: '{n} times you broke a 12+ hour silence.',
    st_r_rev_bless_k: 'Bless you. The chat would be dead without you.',
    st_r_streak_grass_l: '{n} consecutive days of messages.',
    st_r_streak_grass_k: 'Touch grass. Pet a dog. See the sun.',
    st_r_streak_love_l: '{n}-day messaging streak.',
    st_r_streak_love_k: 'Notifications were your love language.',
    st_r_fallback_l: '{n} messages. Steady. Predictable.',
    st_r_fallback_k: 'No drama, no chaos, no notes. The control variable of this group.',
  },
  he: {
    landing_eyebrow: 'חדש · WHATSAPP UNWRAPPED',
    landing_h1_a: 'הקבוצה',
    landing_h1_b: 'שלך',
    landing_h1_c: 'עומדת',
    landing_h1_d: 'להיחשף.',
    landing_h1_e: '',
    landing_sub: 'עידנים. פרסים. דרמה. סיכום קולנועי מההודעות האמיתיות שלכם. שום דבר לא יוצא מהמכשיר.',
    cta_play: 'תפעיל לי את ה-Wrapped ←',
    cta_demo: 'או הצג עם דוגמה ←',
    privacy_note: 'הכל מעובד על המכשיר שלך בלבד',
    err_format: 'העלה קובץ .txt או .zip מהיצוא של ווצאפ.',
    err_no_msgs: 'לא נמצאו הודעות. ייתכן שהפורמט אינו נתמך.',
    onboard_skip: 'דלג',
    onboard_continue: 'המשך ←',
    onboard_done: 'בוא נראה ←',
    onboard_title: 'שאלות מהירות',
    onboard_sub: 'כמה שניות. הופך את ה-Wrapped שלך לדיוק פי 10.',
    q_who_are_you: 'מה השם שלך בצ\'אט?',
    q_who_are_you_hint: 'בחר את עצמך מהמשתתפים',
    q_relationship: 'איזה סוג של צ\'אט זה?',
    q_relationship_friends: 'חברים',
    q_relationship_family: 'משפחה',
    q_relationship_work: 'עבודה',
    q_relationship_couple: 'רק שנינו',
    q_relationship_other: 'אחר',
    q_tone: 'כמה חריף הרוסט יהיה?',
    q_tone_mild: 'עדין',
    q_tone_mild_d: 'בנימוס',
    q_tone_medium: 'כן',
    q_tone_medium_d: 'אמיתי אבל הוגן',
    q_tone_spicy: 'בלי רחמים',
    q_tone_spicy_d: 'הולכים על זה',
    q_lang_q: 'באיזו שפה הצ\'אט בעיקר?',
    parsing_msg_parsed: 'הודעות נקלטו',
    parsing_label_open: 'פותח קובץ',
    parsing_label_unzip: 'מחלץ יצוא',
    parsing_label_read: 'קורא כל שורה',
    parsing_label_analyze: 'מנתח את הכאוס',
    parsing_label_build: 'בונה את הסיפור',
    parsing_detail_open: 'קורא בייטים מהדיסק',
    parsing_detail_unzip: 'מחלץ ZIP של ווצאפ',
    parsing_detail_read: 'מפענח חותמות זמן ושולחים',
    parsing_detail_analyze: 'מזהה דרמה, עידנים, שיאים',
    parsing_detail_build: 'כמעט שם…',
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'תתכוננו.',
    intro_ready: '',
    intro_summary: '{msgs} הודעות. {people} אנשים. {days} ימים. סיפור אחד.',
    msg_eyebrow: 'השנה הקבוצה שלחה',
    msg_word: 'הודעות.',
    msg_your_share: 'החלק שלך',
    rank_eyebrow: '✦ טבלת הצמרת',
    rank_finished: 'סיימת במקום',
    rank_of: 'מתוך {n}.',
    rank_you: '(אתה)',
    vs_eyebrow: 'אתה מול כולם',
    vs_outsent_all: 'שלחת יותר\nמכל אחד אחר.',
    vs_least: 'שלחת פחות\nמכולם.',
    vs_middle: 'שלחת יותר\nמ-{beat} מתוך {others} אחרים.',
    vs_alone: 'רק אתה כאן.',
    vs_ranked: '{msgs} הודעות · מקום #{rank} מתוך {total}',
    vs_fastest: 'המהיר ביותר בצ\'אט',
    vs_avg_s: '{s} שנ׳ בממוצע',
    vs_avg_m: '{m} ד׳ בממוצע',
    vs_avg_h: '{h} שע׳ בממוצע',
    title_eyebrow: '✦ קוראים לך',
    title_based_on: 'מבוסס על',
    descr_eyebrow: 'הקבוצה הייתה מתארת אותך כ',
    descr_footnote: 'הם לא אמרו את זה בקול. הדאטה כן.',
    peak_eyebrow: 'השעה שלך',
    peak_3am: 'באמת מטריד.',
    peak_morning: 'בן אדם של בוקר אמיתי.',
    peak_midday: 'מתכתב באמצע יום העבודה. בעטרה.',
    peak_evening: 'אלוף הסמסים שאחרי העבודה.',
    peak_late: 'פילוסוף של שעות הלילה.',
    night_eyebrow: 'בין חצות ל-6 בבוקר',
    night_of_msgs: 'מההודעות שלך.',
    night_diag_strong: 'אבחנה: יצור לילה מוסמך.',
    night_diag_med: 'אתה ער יותר ממה שאתה חושב.',
    night_diag_low: 'שעות שינה בסדר. בערך.',
    night_diag_none: 'אתה מתנתק. כבוד.',
    night_owl: '✦ #1 ינשוף לילה בצ\'אט',
    night_count: '{night} מתוך {total}',
    streak_eyebrow: 'הרצף הארוך ביותר שלך',
    streak_day: 'יום',
    streak_days: 'ימים רצופים.',
    speed_eyebrow: 'זמן תגובה ממוצע',
    speed_faster: 'מהיר יותר מ-',
    speed_of_group: 'מהקבוצה.',
    speed_based: 'מבוסס על {n} תגובות שנמדדו',
    word_eyebrow: 'המילה שלך',
    word_used: 'השתמשת ב-{n} פעמים.',
    top_words_eyebrow: 'אוצר המילים של הקבוצה',
    top_words_title: 'המילים',
    top_words_subtitle: 'שכולם חזרו עליהן',
    emoji_eyebrow: 'האימוג׳י הכי נפוץ אצלך',
    emoji_used: 'השתמשת ב-{n} פעמים.',
    drama_eyebrow: '✦ התפקיד שלך בדרמה',
    drama_defib: 'מחייה הצ׳אטים',
    drama_defib_label: 'שיחות מתות שהחיית',
    drama_defib_copy: 'כשהקבוצה שתקה, אתה החזרת אותה לחיים.',
    drama_killer: 'הורג השיחות',
    drama_killer_label: 'שיחות שמתו אחריך',
    drama_killer_copy: 'בכל פעם שדיברת, לאף אחד לא היה מה להוסיף. חשוד.',
    drama_replied: 'לכולם יש מה לענות לך',
    drama_replied_label: '% מההודעות שלך קיבלו תגובה תוך 30 דקות',
    drama_replied_copy: 'כשאתה מדבר, הקבוצה מקשיבה.',
    drama_ignored: 'מחובר אבל מתעלמים',
    drama_ignored_label: '% מההודעות שלך לא קיבלו תגובה',
    drama_ignored_copy: 'זה לא אתה. זה הם. כנראה.',
    drama_steady: 'יציב בעניינים',
    drama_steady_label: 'ימים סגרת את הצ׳אט',
    drama_steady_copy: 'סגרת את הצ׳אט הרבה פעמים. פשוט נמצא.',
    roast_eyebrow_mild: '✦ הערות עדינות',
    roast_eyebrow_med: '✦ קוראים לך בלי פילטרים',
    roast_eyebrow_spicy: '🔥 בלי רחמים',
    roast_heading_mild: 'כמה הערות עדינות.',
    roast_heading_med: 'כמה תצפיות.',
    roast_heading_spicy: 'בלי רחמים. תיכון.',
    roast_more: '+{n} נוספים במצב הרוסט ←',
    ach_eyebrow: '✦ הישגים נפתחו',
    ach_earned: 'זכית ב',
    ach_badges: 'תג',
    ach_badges_plural: 'תגים',
    ach_more: '+{n} נוספים',
    likely_eyebrow: '✦ הכי סביר',
    likely_title: 'פסקי הדין',
    likely_verdicts: 'של הקבוצה.',
    likely_label: 'הכי סביר',
    likely_to_text_3am: 'לשלוח הודעה ב-3 בלילה',
    likely_to_burst: 'לשלוח 10 הודעות ברצף',
    likely_to_reply_fast: 'לענות בפחות מדקה',
    likely_to_disappear: 'להיעלם לשבועות',
    likely_to_kill: 'להרוג את השיחה',
    likely_to_revive: 'להחיות את הצ׳אט',
    duo_eyebrow: '✦ הצמד המוביל',
    duo_traded: 'החליפו',
    duo_replies_between: 'תגובות ביניהם.',
    duo_in_with: 'אתה ו-{partner} בעצם מנחים את הצ׳אט הזה ביחד.',
    duo_share: '{pct}% מכל ההלוך-חזור בקבוצה.',
    eras_eyebrow: '✦ העידנים שלך',
    eras_title: 'הפרקים',
    eras_subtitle: 'של הצ׳אט הזה.',
    eras_chapter: 'פרק',
    eras_msgs: 'הודעות',
    eras_per_day: '{n}/יום',
    chaos_eyebrow: '✦ הרגע שזה התפוצץ',
    chaos_at: 'בשעה {time}.',
    chaos_msgs_minute: 'הודעות בדקה אחת.',
    chaos_lost_control: 'הקבוצה איבדה שליטה.',
    persona_eyebrow: '✦ אבחנה',
    persona_this_group: 'הקבוצה הזאת היא…',
    persona_evidence: 'הוכחה',
    awards_eyebrow: '✦ טקס הפרסים',
    awards_title: 'והזוכים',
    awards_are: 'הם…',
    awards_fastest: 'אצבעות הברק',
    awards_fastest_sub: 'תגובה ממוצעת של {m} ד׳',
    awards_yapper: 'הפטפטן הגדול ביותר',
    awards_yapper_sub: '{n} הודעות',
    awards_nightowl: 'הכי מסוכן אחרי חצות',
    awards_nightowl_sub: '{pct}% אחרי חצות',
    awards_ghost: 'שובו של הרוח',
    awards_ghost_sub: 'היעדרות של {n} ימים',
    awards_killer: 'הורג השיחות',
    awards_killer_sub: '{n} שיחות מתו אחריהם',
    awards_defib: 'מחייה הצ׳אטים',
    awards_defib_sub: 'החייה {n} שיחות מתות',
    peakday_eyebrow: 'היום הכי פראי של הקבוצה',
    peakday_msgs: 'הודעות ביום אחד.',
    finale_eyebrow: '✦ זהו, סוף',
    finale_see: 'נתראה',
    finale_in_the: 'בצ׳אט',
    finale_chat: 'הקבוצתי.',
    finale_now: 'עכשיו תשאל את החברים שלך מה הם קיבלו.',
    finale_explore: 'תחקור את הדאטה ←',
    menu_replay: 'הצג שוב',
    menu_watch: 'צפה\nשוב ←',
    menu_roast_mode: 'מצב רוסט',
    menu_roast_everyone: 'תרסט\nאת כולם ←',
    menu_viewing_as: 'צופה כ',
    menu_switch: 'החלף ←',
    menu_verified: '✓ נתונים מאומתים · {n}%',
    menu_msgs_senders: '{msgs} הודעות · {senders} שולחים',
    menu_verify: 'אמת ←',
    menu_this_group_is: '✦ הקבוצה הזאת היא',
    menu_eras: 'העידנים',
    menu_highlights: 'הנקודות החזקות שלך',
    menu_badges: 'התגים שלך',
    menu_leaderboard: 'טבלה מלאה',
    menu_hl_messages: 'הודעות',
    menu_hl_of: 'מתוך {n}',
    menu_hl_peak_hour: 'שעת שיא',
    menu_hl_at_night: 'בלילה',
    menu_hl_streak: 'רצף',
    menu_hl_top_emoji: 'אימוג׳י מוביל',
    menu_hl_top_word: 'מילה מובילה',
    menu_hl_avg_reply: 'תגובה ממוצעת',
    rm_back: '→ חזור',
    rm_title: '🔥 מצב רוסט',
    rm_pick: 'בחר',
    rm_victim: 'קורבן.',
    rm_sub: 'כל רוסט מבוסס על מספרים אמיתיים מהצ׳אט. בלי רחמים. הקש על שם כדי להחליף.',
    rm_now: 'מרסטים כעת',
    rm_roast: 'רוסט',
    rm_hot_take: 'דעה חמה',
    rm_screenshot: 'עכשיו צלם מסך\nושלח את זה ל-{name}.',
    rm_others: 'קורבנות נוספים',
    rm_ready: '{n} רוסט מוכן',
    rm_ready_plural: '{n} רוסטים מוכנים',
    rm_btn: 'רסט ←',
    rm_language: 'שפה',
    rm_switch_person: 'החלף אדם',
    verify_back: '→ חזור',
    verify_title: 'זה נראה',
    verify_right: 'נכון',
    verify_sub: 'המספרים חושבו ישירות מהקובץ. עבור עליהם — אם משהו נראה לא בסדר, לחץ אפס. אם זה תואם לציפיות שלך, המשך ל-Wrapped.',
    verify_continue: 'נראה תקין · המשך ל-Wrapped ←',
    verify_wrong: 'המספרים לא נכונים · העלה שוב',
    verify_reset: 'איפוס',
    // Social Layer — Titles
    st_title_voice_boss: 'הבוס של ההקלטות',
    st_title_last_seen: 'נראה לאחרונה',
    st_title_spammer: 'ספאמר מקצועי',
    st_title_2am: 'המחלקה של 2 בלילה',
    st_title_main_char: 'אנרגיית הדמות הראשית',
    st_title_available: 'זמין באופן כרוני',
    st_title_ceo_overthink: 'מנכ״ל של חשיבת יתר',
    st_title_typing: 'מקליד…',
    st_title_meme: 'מערכת הפצת ממים',
    st_title_defib: 'הדפיברילטור',
    st_title_killer: 'הורג השיחות',
    st_title_emoffline: 'אונליין אבל רגשית במצב מטוס',
    st_title_emoji_dipl: 'דיפלומט אימוג׳ים',
    st_title_from_bed: 'עונה מהמיטה',
    st_title_watching: 'אף פעם לא עונה אבל תמיד צופה',
    st_title_attached: 'מכור להתראות',
    st_title_essay: 'שולח חיבורים',
    st_title_morning: 'כוכב הבוקר',
    st_title_anchor: 'העוגן',
    // Social Layer — Title evidence
    st_ev_voice_boss: '{n} הקלטות קוליות ({pct}% מההודעות)',
    st_ev_last_seen: 'נעלם ל-{n} ימים',
    st_ev_spammer: 'רצף של {n} הודעות',
    st_ev_2am: '{pct}% אחרי חצות',
    st_ev_main_char: '{pct}% מכל ההודעות',
    st_ev_available: '{m} ד׳ זמן תגובה ממוצע (n={n})',
    st_ev_questions: '{pct}% שאלות',
    st_ev_media: '{pct}% מדיה',
    st_ev_defib: 'החייה {n} שיחות מתות',
    st_ev_killer: '{n} שיחות נגמרו עליו',
    st_ev_ignored: '{pct}% מההודעות לא קיבלו תגובה',
    st_ev_emoji: '{n} אימוג׳ים נשלחו',
    st_ev_share_low: 'רק {pct}% מההודעות',
    st_ev_streak: 'רצף של {n} ימים',
    st_ev_essay: '{n} מילים להודעה בממוצע',
    st_ev_peak: 'שיא ב-{h}:00',
    st_ev_anchor: 'השתתפות יציבה ועקבית',
    // Social Layer — Group descriptions
    st_desc_online: 'תמיד אונליין',
    st_desc_watching: 'אף פעם לא עונה אבל תמיד צופה',
    st_desc_disappears: 'מתחיל תכניות, נעלם מיד',
    st_desc_keeps_alive: 'זה שמחזיק את הקבוצה הזאת בחיים',
    st_desc_midnight: 'קיים רק אחרי חצות',
    st_desc_lot_to_say: 'יש לו הרבה לומר. תמיד.',
    st_desc_asks: 'שואל יותר ממה שעונה',
    st_desc_when_feels: 'מגיע בדיוק כשבא לו',
    st_desc_voice: 'איש של הקלטות, איכשהו',
    st_desc_emoji: 'דובר אימוג׳י שוטף',
    st_desc_always_there: 'פשוט תמיד שם',
    // Social Layer — Achievements
    st_ach_night: 'יצור לילה מוסמך',
    st_ach_sprint: 'ספרינט של {n} הודעות',
    st_ach_voice: 'נאמן ההקלטות',
    st_ach_ghost: 'שובו של הרוח',
    st_ach_iron: 'רצף ברזל',
    st_ach_defib: 'הדפיברילטור',
    st_ach_assassin: 'מתנקש שיחות',
    st_ach_emoji_hof: 'היכל התהילה של האימוג׳ים',
    st_ach_submin: 'תגובה בפחות מדקה',
    st_ach_solo: 'מופע יחיד',
    st_ach_lastword: 'המילה האחרונה',
    st_ach_ev_night: '{pct}% מההודעות אחרי חצות',
    st_ach_ev_sprint: 'רצף בלתי שבור של {n} הודעות',
    st_ach_ev_voice: '{n} הקלטות נשלחו',
    st_ach_ev_ghost: 'נעלם ל-{n} ימים ואז חזר',
    st_ach_ev_iron: '{n} ימים רצופים',
    st_ach_ev_defib: 'החייה {n} שיחות אחרי שתיקה של 12+ שעות',
    st_ach_ev_assassin: '{n} שיחות נגמרו מיד אחריו',
    st_ach_ev_emoji_hof: '{n} אימוג׳ים נשלחו',
    st_ach_ev_submin: '{s} שנ׳ זמן תגובה ממוצע (n={n})',
    st_ach_ev_solo: '{pct}% מכל ההודעות',
    st_ach_ev_lastword: 'סגר {n} ימים',
    // Social Layer — Roasts (line + kicker per scenario)
    st_r_speed_blink_l: 'זמן תגובה ממוצע: {s} שניות.',
    st_r_speed_blink_k: 'אתה בסדר? תמצמץ פעמיים.',
    st_r_speed_flat_l: 'עונה תוך {m} דקות בדיוק.',
    st_r_speed_flat_k: 'איזו עבודה. אילו תחביבים. איזה חיים.',
    st_r_speed_slow_l: 'לוקח לך {h} שעות לענות בממוצע.',
    st_r_speed_slow_k: 'הטלפון קיים. ראינו אותך באינסטגרם.',
    st_r_vol_pod_l: '{pct}% מכל הודעה שנשלחה פה היו אתה.',
    st_r_vol_pod_k: 'זה לא צ׳אט קבוצתי. זה הפודקאסט שלך.',
    st_r_vol_dom_l: 'אמרת {pct}% מהכל.',
    st_r_vol_dom_k: 'האחרים ניסו לדבר.',
    st_r_vol_tiny_l: '{pct}% מהשיחה. {n} הודעות בכל השנה.',
    st_r_vol_tiny_k: 'אתה... בסדר? כדאי שנבדוק מה איתך?',
    st_r_vol_watch_l: '{pct}% מהצ׳אט שייכים לך.',
    st_r_vol_watch_k: 'אתה צופה. מתכנן. שומר הכל לבית משפט.',
    st_r_burst_hostage_l: 'פעם שלחת {n} הודעות ברצף.',
    st_r_burst_hostage_k: 'זה לא הודעות. זה מצב חטופים.',
    st_r_burst_uninterr_l: '{n} הודעות ברצף. ללא הפסקה.',
    st_r_burst_uninterr_k: 'אף אחד לא ביקש. גם אף אחד לא הצליח לעצור אותך.',
    st_r_burst_record_l: 'השיא שלך: {n} הודעות, אף אחד לא ענה.',
    st_r_burst_record_k: 'פשוט המשכת. יש בזה משהו יפה.',
    st_r_night_tab_l: '{pct}% מההודעות שלך בין חצות ל-6 בבוקר.',
    st_r_night_tab_k: 'אין לך שעות שינה. יש לך טאב פתוח.',
    st_r_night_close_l: '{pct}% מההודעות שלך אחרי חצות.',
    st_r_night_close_k: 'מה שלא עובר עליך — תסגור את האפליקציה.',
    st_r_night_crisis_l: 'השעה הכי פעילה שלך היא {h} לפנות בוקר.',
    st_r_night_crisis_k: 'זה לא "מאוחר בלילה". זה "משבר מוקדם בבוקר".',
    st_r_ghost_iconic_l: 'נעלמת ל-{n} ימים רצופים.',
    st_r_ghost_iconic_k: 'ואז חזרת כאילו כלום. אייקוני.',
    st_r_ghost_vanish_l: 'בנקודה מסוימת — {n} ימים של שתיקה.',
    st_r_ghost_vanish_k: 'בלי "היי". בלי הסבר. פשוט נעלמת.',
    st_r_voice_beg_l: '{n} הקלטות קוליות נשלחו.',
    st_r_voice_beg_k: 'אנחנו מתחננים, תקליד. פשוט תקליד. בבקשה.',
    st_r_voice_mono_l: '{n} הקלטות. אדם ממוצע: 3.',
    st_r_voice_mono_k: 'לאף אחד אין זמן לשמוע את המונולוג של 47 שניות שלך.',
    st_r_q_google_l: '{pct}% מההודעות שלך הן שאלות.',
    st_r_q_google_k: 'אין לך אישיות. יש לך שורת חיפוש בגוגל.',
    st_r_q_tired_l: '1 מכל 4 הודעות ממך זאת שאלה.',
    st_r_q_tired_k: 'הקבוצה עייפה. כל כך עייפה.',
    st_r_media_fwd_l: '{pct}% ממה שאתה שולח זה מדיה.',
    st_r_media_fwd_k: 'אתה לא מדבר. אתה מעביר הלאה.',
    st_r_media_redist_l: '{pct}% ממים. {rest}% תוכן אמיתי.',
    st_r_media_redist_k: 'התרומה שלך: הפצה מחדש של בדיחות של אחרים.',
    st_r_ign_thumb_l: '{pct}% מההודעות שלך לא קיבלו שום תגובה תוך 30 דקות.',
    st_r_ign_thumb_k: 'אפילו לא לייק. קהל קשוח.',
    st_r_ign_said_l: '{pct}% ממה שאתה אומר נשאר ללא תגובה.',
    st_r_ign_said_k: 'זה לא מה שאמרת. זה שאתה אמרת את זה.',
    st_r_kill_arg_l: '{n} שיחות נגמרו תוך דקות אחרי שדיברת.',
    st_r_kill_arg_k: 'אתה לא משתתף. אתה טיעון מסכם.',
    st_r_kill_susp_l: '{n} צ׳אטים מתו מיד אחרי שכתבת.',
    st_r_kill_susp_k: 'חשוד. החקירה ממתינה.',
    st_r_emoji_help_l: '{n} אימוג׳ים נשלחו. בערך {per} להודעה.',
    st_r_emoji_help_k: 'המקלדת שלך 80% תמונות. תקבל עזרה.',
    st_r_emoji_words_l: '{n} אימוג׳ים בשנה אחת.',
    st_r_emoji_words_k: 'מילים קיימות. הן חינם. תנסה אותן.',
    st_r_emoji_zero_l: '{n} הודעות. אפס אימוג׳ים.',
    st_r_emoji_zero_k: 'מה קרה לך. מי פגע בך.',
    st_r_len_ted_l: '{n} מילים להודעה בממוצע.',
    st_r_len_ted_k: 'זה צ׳אט. לא הרצאת TED.',
    st_r_len_tldr_l: 'הודעה ממוצעת: {n} מילים.',
    st_r_len_tldr_k: 'TL;DR. אנחנו מתחננים.',
    st_r_len_poem_l: 'הודעה ממוצעת שלך: {n} מילים.',
    st_r_len_poem_k: '"אוקיי" "ק" "חחח" — אוסף שירה.',
    st_r_rev_bless_l: '{n} פעמים שברת שתיקה של 12+ שעות.',
    st_r_rev_bless_k: 'תודה לך. הצ׳אט היה מת בלעדיך.',
    st_r_streak_grass_l: '{n} ימים רצופים של הודעות.',
    st_r_streak_grass_k: 'תיגע בעשב. תלטף כלב. תראה את השמש.',
    st_r_streak_love_l: 'רצף שליחה של {n} ימים.',
    st_r_streak_love_k: 'התראות היו שפת האהבה שלך.',
    st_r_fallback_l: '{n} הודעות. יציב. צפוי.',
    st_r_fallback_k: 'בלי דרמה, בלי כאוס, בלי הערות. המשתנה הקבוע של הקבוצה.',
  },
  es: {
    landing_eyebrow: 'NUEVO · WHATSAPP UNWRAPPED',
    landing_h1_a: 'El año',
    landing_h1_b: 'de tu chat',
    landing_h1_c: 'está a punto',
    landing_h1_d: 'de',
    landing_h1_e: 'salir.',
    landing_sub: 'Eras. Premios. Drama. Un resumen cinematográfico de tus mensajes reales. Nada sale de tu teléfono.',
    cta_play: 'Ver mi Wrapped →',
    cta_demo: 'O VER CON DEMO →',
    privacy_note: 'PROCESADO ENTERAMENTE EN TU DISPOSITIVO',
    err_format: 'Sube un archivo .txt o .zip exportado de WhatsApp.',
    err_no_msgs: 'No se encontraron mensajes. Formato no soportado.',
    onboard_skip: 'Saltar',
    onboard_continue: 'Continuar →',
    onboard_done: 'Ver mi Wrapped →',
    onboard_title: 'Preguntas rápidas',
    onboard_sub: 'Unos segundos. Hace tu Wrapped 10 veces más preciso.',
    q_who_are_you: '¿Cómo te llamas en este chat?',
    q_who_are_you_hint: 'Elige tu nombre',
    q_relationship: '¿Qué tipo de chat es?',
    q_relationship_friends: 'Amigos',
    q_relationship_family: 'Familia',
    q_relationship_work: 'Trabajo',
    q_relationship_couple: 'Solo nosotros dos',
    q_relationship_other: 'Otro',
    q_tone: '¿Qué tan picantes deben ser las críticas?',
    q_tone_mild: 'Suave',
    q_tone_mild_d: 'Sé amable',
    q_tone_medium: 'Honesto',
    q_tone_medium_d: 'Real pero justo',
    q_tone_spicy: 'Brutal',
    q_tone_spicy_d: 'Sin piedad',
    q_lang_q: '¿En qué idioma está mayormente el chat?',
    parsing_msg_parsed: 'MENSAJES ANALIZADOS',
    parsing_label_open: 'Abriendo archivo',
    parsing_label_unzip: 'Descomprimiendo',
    parsing_label_read: 'Leyendo cada línea',
    parsing_label_analyze: 'Analizando el caos',
    parsing_label_build: 'Construyendo tu historia',
    parsing_detail_open: 'Leyendo bytes',
    parsing_detail_unzip: 'Descomprimiendo ZIP de WhatsApp',
    parsing_detail_read: 'Procesando timestamps y remitentes',
    parsing_detail_analyze: 'Detectando drama, eras, picos',
    parsing_detail_build: 'Ya casi…',
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'Prepárate.',
    intro_ready: '',
    intro_summary: '{msgs} mensajes. {people} personas. {days} días. Una historia.',
    msg_eyebrow: 'ESTE AÑO EL GRUPO ENVIÓ',
    msg_word: 'mensajes.',
    msg_your_share: 'TU PARTE',
    rank_eyebrow: '✦ LA TABLA',
    rank_finished: 'Terminaste',
    rank_of: 'de {n}.',
    rank_you: '(tú)',
    vs_eyebrow: 'TÚ VS TODOS',
    vs_outsent_all: 'Enviaste más\nque todos los demás.',
    vs_least: 'Enviaste menos\nque todos.',
    vs_middle: 'Enviaste más que\n{beat} de {others}.',
    vs_alone: 'Estás solo aquí.',
    vs_ranked: '{msgs} msgs · #{rank} de {total}',
    vs_fastest: 'EL MÁS RÁPIDO',
    vs_avg_s: '{s}s prom',
    vs_avg_m: '{m}m prom',
    vs_avg_h: '{h}h prom',
    title_eyebrow: '✦ TE LLAMAN',
    title_based_on: 'BASADO EN',
    descr_eyebrow: 'EL GRUPO TE DESCRIBIRÍA COMO',
    descr_footnote: 'No lo dijeron en voz alta. Pero los datos sí.',
    peak_eyebrow: 'TU HORA',
    peak_3am: 'Genuinamente preocupante.',
    peak_morning: 'Realmente persona mañanera.',
    peak_midday: 'Texteando en el trabajo. Audaz.',
    peak_evening: 'Campeón del texteo después del trabajo.',
    peak_late: 'Filósofo nocturno.',
    night_eyebrow: 'ENTRE MEDIANOCHE Y 6 AM',
    night_of_msgs: 'de tus mensajes.',
    night_diag_strong: 'Diagnóstico: criatura nocturna certificada.',
    night_diag_med: 'Estás despierto más tarde de lo que crees.',
    night_diag_low: 'Horario de sueño saludable, mayormente.',
    night_diag_none: 'Te desconectas. Respeto.',
    night_owl: '✦ EL #1 BÚHO NOCTURNO',
    night_count: '{night} de tus {total}',
    streak_eyebrow: 'TU RACHA MÁS LARGA',
    streak_day: 'día',
    streak_days: 'días seguidos.',
    speed_eyebrow: 'TIEMPO DE RESPUESTA',
    speed_faster: 'Más rápido que',
    speed_of_group: 'del grupo.',
    speed_based: 'BASADO EN {n} RESPUESTAS',
    word_eyebrow: 'TU PALABRA SIGNATURA',
    word_used: 'Usada {n} veces.',
    top_words_eyebrow: 'EL VOCABULARIO DEL GRUPO',
    top_words_title: 'Las palabras',
    top_words_subtitle: 'que todos repetían',
    emoji_eyebrow: 'EMOJI MÁS USADO',
    emoji_used: 'Usado {n} veces.',
    drama_eyebrow: '✦ TU ROL EN EL DRAMA',
    drama_defib: 'El Desfibrilador',
    drama_defib_label: 'chats revividos',
    drama_defib_copy: 'Cuando el grupo se silenció, tú lo trajiste de vuelta.',
    drama_killer: 'El Asesino de Conversaciones',
    drama_killer_label: 'chats terminados contigo',
    drama_killer_copy: 'Cuando hablabas, nadie tenía nada que añadir. Sospechoso.',
    drama_replied: 'Todos te Responden',
    drama_replied_label: '% de tus msgs recibieron respuesta en 30 min',
    drama_replied_copy: 'Cuando hablas, el grupo escucha.',
    drama_ignored: 'Online Pero Ignorado',
    drama_ignored_label: '% de tus msgs sin respuesta',
    drama_ignored_copy: 'No eres tú. Son ellos. Probablemente.',
    drama_steady: 'Constante en la Mezcla',
    drama_steady_label: 'días que cerraste el chat',
    drama_steady_copy: 'Cerraste el chat muchas veces. Solo presente.',
    roast_eyebrow_mild: '✦ COMENTARIOS SUAVES',
    roast_eyebrow_med: '✦ LEYÉNDOTE A FONDO',
    roast_eyebrow_spicy: '🔥 SIN PIEDAD',
    roast_heading_mild: 'Unas notas suaves.',
    roast_heading_med: 'Unas observaciones.',
    roast_heading_spicy: 'Sin piedad. Prepárate.',
    roast_more: '+{n} MÁS EN ROAST MODE →',
    ach_eyebrow: '✦ LOGROS DESBLOQUEADOS',
    ach_earned: 'Ganaste',
    ach_badges: 'insignia',
    ach_badges_plural: 'insignias',
    ach_more: '+{n} MÁS',
    likely_eyebrow: '✦ MÁS PROBABLE QUE',
    likely_title: 'Los veredictos',
    likely_verdicts: 'del grupo.',
    likely_label: 'MÁS PROBABLE QUE',
    likely_to_text_3am: 'texteen a las 3 AM',
    likely_to_burst: 'envíen 10 mensajes seguidos',
    likely_to_reply_fast: 'respondan en menos de un minuto',
    likely_to_disappear: 'desaparezcan por semanas',
    likely_to_kill: 'maten la conversación',
    likely_to_revive: 'revivan el chat',
    duo_eyebrow: '✦ EL DÚO PRINCIPAL',
    duo_traded: 'intercambiaron',
    duo_replies_between: 'respuestas entre ellos.',
    duo_in_with: 'Tú y {partner} son básicamente co-anfitriones.',
    duo_share: '{pct}% de todo el ida y vuelta del grupo.',
    eras_eyebrow: '✦ TUS ERAS',
    eras_title: 'Los capítulos',
    eras_subtitle: 'de este chat.',
    eras_chapter: 'CAPÍTULO',
    eras_msgs: 'msgs',
    eras_per_day: '{n}/día',
    chaos_eyebrow: '✦ EL MOMENTO QUE EXPLOTÓ',
    chaos_at: 'a las {time}.',
    chaos_msgs_minute: 'mensajes en un minuto.',
    chaos_lost_control: 'El grupo perdió el control.',
    persona_eyebrow: '✦ DIAGNÓSTICO',
    persona_this_group: 'Este grupo es un…',
    persona_evidence: 'EVIDENCIA',
    awards_eyebrow: '✦ LA CEREMONIA DE PREMIOS',
    awards_title: 'Y los ganadores',
    awards_are: 'son…',
    awards_fastest: 'Dedos Más Rápidos',
    awards_fastest_sub: '{m}m respuesta prom',
    awards_yapper: 'El Más Hablador',
    awards_yapper_sub: '{n} mensajes',
    awards_nightowl: 'Más Peligroso Después de Medianoche',
    awards_nightowl_sub: '{pct}% post-medianoche',
    awards_ghost: 'El Regreso del Fantasma',
    awards_ghost_sub: '{n} días ausente',
    awards_killer: 'Asesino de Conversaciones',
    awards_killer_sub: '{n} chats terminaron en ellos',
    awards_defib: 'El Desfibrilador',
    awards_defib_sub: 'revivió {n} chats muertos',
    peakday_eyebrow: 'EL DÍA MÁS SALVAJE',
    peakday_msgs: 'mensajes en un día.',
    finale_eyebrow: '✦ ESO ES TODO',
    finale_see: 'Nos vemos',
    finale_in_the: 'en el',
    finale_chat: 'chat grupal.',
    finale_now: 'Ahora pregunta a tus amigos qué les tocó.',
    finale_explore: 'Explorar los datos →',
    menu_replay: 'REPETIR',
    menu_watch: 'Ver\notra vez →',
    menu_roast_mode: 'ROAST MODE',
    menu_roast_everyone: 'Rostiza\na todos →',
    menu_viewing_as: 'VIENDO COMO',
    menu_switch: 'CAMBIAR →',
    menu_verified: '✓ DATOS VERIFICADOS · {n}%',
    menu_msgs_senders: '{msgs} msgs · {senders} remitentes',
    menu_verify: 'VERIFICAR →',
    menu_this_group_is: '✦ ESTE GRUPO ES UN',
    menu_eras: 'LAS ERAS',
    menu_highlights: 'TUS DESTACADOS',
    menu_badges: 'TUS INSIGNIAS',
    menu_leaderboard: 'TABLA COMPLETA',
    menu_hl_messages: 'mensajes',
    menu_hl_of: 'de {n}',
    menu_hl_peak_hour: 'hora pico',
    menu_hl_at_night: 'de noche',
    menu_hl_streak: 'racha',
    menu_hl_top_emoji: 'emoji top',
    menu_hl_top_word: 'palabra top',
    menu_hl_avg_reply: 'respuesta prom',
    rm_back: '← Atrás',
    rm_title: '🔥 ROAST MODE',
    rm_pick: 'Elige una',
    rm_victim: 'víctima.',
    rm_sub: 'Cada roast se basa en números reales del chat. Sin piedad. Toca un nombre para cambiar.',
    rm_now: 'AHORA ROSTIZANDO',
    rm_roast: 'ROAST',
    rm_hot_take: 'OPINIÓN PICANTE',
    rm_screenshot: 'Ahora toma captura\ny envíala a {name}.',
    rm_others: 'OTRAS VÍCTIMAS',
    rm_ready: '{n} roast listo',
    rm_ready_plural: '{n} roasts listos',
    rm_btn: 'ROAST →',
    rm_language: 'Idioma',
    rm_switch_person: 'Cambiar persona',
    verify_back: '← Atrás',
    verify_title: '¿Se ve',
    verify_right: 'bien',
    verify_sub: 'Los números se calculan del archivo. Si algo se ve mal, presiona Reiniciar. Si coincide, continúa a Wrapped.',
    verify_continue: 'Se ve bien · Continuar a Wrapped →',
    verify_wrong: 'LOS NÚMEROS ESTÁN MAL · SUBIR DE NUEVO',
    verify_reset: 'REINICIAR',
  },
  fr: {
    landing_eyebrow: 'NOUVEAU · WHATSAPP UNWRAPPED',
    landing_h1_a: 'L\'année',
    landing_h1_b: 'de ton chat',
    landing_h1_c: 'est sur le',
    landing_h1_d: 'point de',
    landing_h1_e: 'sortir.',
    landing_sub: 'Eres. Récompenses. Drame. Un résumé cinématographique de tes vrais messages. Rien ne quitte ton téléphone.',
    cta_play: 'Voir mon Wrapped →',
    cta_demo: 'OU VOIR LA DÉMO →',
    privacy_note: 'TRAITÉ ENTIÈREMENT SUR TON APPAREIL',
    err_format: 'Téléverse un .txt ou .zip exporté de WhatsApp.',
    err_no_msgs: 'Aucun message trouvé. Format non supporté.',
    onboard_skip: 'Passer',
    onboard_continue: 'Continuer →',
    onboard_done: 'Voir mon Wrapped →',
    onboard_title: 'Questions rapides',
    onboard_sub: 'Quelques secondes. Rend ton Wrapped 10x plus précis.',
    q_who_are_you: 'Comment t\'appelles-tu dans ce chat?',
    q_who_are_you_hint: 'Choisis-toi',
    q_relationship: 'Quel genre de chat est-ce?',
    q_relationship_friends: 'Amis',
    q_relationship_family: 'Famille',
    q_relationship_work: 'Travail',
    q_relationship_couple: 'Juste nous deux',
    q_relationship_other: 'Autre',
    q_tone: 'À quel point les roasts doivent être épicés?',
    q_tone_mild: 'Doux',
    q_tone_mild_d: 'Sois gentil',
    q_tone_medium: 'Honnête',
    q_tone_medium_d: 'Vrai mais juste',
    q_tone_spicy: 'Sauvage',
    q_tone_spicy_d: 'Sans pitié',
    q_lang_q: 'Dans quelle langue est principalement ce chat?',
    parsing_msg_parsed: 'MESSAGES ANALYSÉS',
    parsing_label_open: 'Ouverture du fichier',
    parsing_label_unzip: 'Décompression',
    parsing_label_read: 'Lecture de chaque ligne',
    parsing_label_analyze: 'Analyse du chaos',
    parsing_label_build: 'Construction de ton histoire',
    parsing_detail_open: 'Lecture des octets',
    parsing_detail_unzip: 'Décompression du ZIP WhatsApp',
    parsing_detail_read: 'Analyse des timestamps et expéditeurs',
    parsing_detail_analyze: 'Détection drame, eres, pics',
    parsing_detail_build: 'Presque fini…',
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'Prépare-toi.',
    intro_ready: '',
    intro_summary: '{msgs} messages. {people} personnes. {days} jours. Une histoire.',
    msg_eyebrow: 'CETTE ANNÉE LE GROUPE A ENVOYÉ',
    msg_word: 'messages.',
    msg_your_share: 'TA PART',
    rank_eyebrow: '✦ LE CLASSEMENT',
    rank_finished: 'Tu as fini',
    rank_of: 'sur {n}.',
    rank_you: '(toi)',
    vs_eyebrow: 'TOI VS TOUS',
    vs_outsent_all: 'Tu as envoyé plus\nque tout le monde.',
    vs_least: 'Tu as envoyé moins\nque tout le monde.',
    vs_middle: 'Tu as envoyé plus que\n{beat} sur {others}.',
    vs_alone: 'Il n\'y a que toi ici.',
    vs_ranked: '{msgs} msgs · #{rank} sur {total}',
    vs_fastest: 'LE PLUS RAPIDE',
    vs_avg_s: '{s}s moy',
    vs_avg_m: '{m}m moy',
    vs_avg_h: '{h}h moy',
    title_eyebrow: '✦ ON T\'APPELLE',
    title_based_on: 'BASÉ SUR',
    descr_eyebrow: 'LE GROUPE TE DÉCRIRAIT COMME',
    descr_footnote: 'Ils ne l\'ont pas dit à voix haute. Mais les données si.',
    peak_eyebrow: 'TON HEURE',
    peak_3am: 'Vraiment inquiétant.',
    peak_morning: 'Une vraie personne du matin.',
    peak_midday: 'Tu textotes au boulot. Audacieux.',
    peak_evening: 'Champion du textoto post-travail.',
    peak_late: 'Philosophe nocturne.',
    night_eyebrow: 'ENTRE MINUIT ET 6H',
    night_of_msgs: 'de tes messages.',
    night_diag_strong: 'Diagnostic : créature nocturne certifiée.',
    night_diag_med: 'Tu es éveillé plus tard que tu ne penses.',
    night_diag_low: 'Sommeil sain, en général.',
    night_diag_none: 'Tu te déconnectes. Respect.',
    night_owl: '✦ #1 NOCTAMBULE',
    night_count: '{night} sur tes {total}',
    streak_eyebrow: 'TA PLUS LONGUE SÉRIE',
    streak_day: 'jour',
    streak_days: 'jours d\'affilée.',
    speed_eyebrow: 'TEMPS DE RÉPONSE',
    speed_faster: 'Plus rapide que',
    speed_of_group: 'du groupe.',
    speed_based: 'BASÉ SUR {n} RÉPONSES',
    word_eyebrow: 'TON MOT SIGNATURE',
    word_used: 'Utilisé {n} fois.',
    top_words_eyebrow: 'LE VOCABULAIRE DU GROUPE',
    top_words_title: 'Les mots',
    top_words_subtitle: 'que vous répétiez tous',
    emoji_eyebrow: 'EMOJI LE PLUS UTILISÉ',
    emoji_used: 'Utilisé {n} fois.',
    drama_eyebrow: '✦ TON RÔLE DANS LE DRAME',
    drama_defib: 'Le Défibrillateur',
    drama_defib_label: 'chats ranimés',
    drama_defib_copy: 'Quand le groupe était silencieux, tu l\'as ramené.',
    drama_killer: 'Le Tueur de Conversations',
    drama_killer_label: 'chats terminés sur toi',
    drama_killer_copy: 'Quand tu parlais, personne n\'avait rien à ajouter. Suspect.',
    drama_replied: 'Tout le Monde Te Répond',
    drama_replied_label: '% de tes msgs ont reçu une réponse en 30 min',
    drama_replied_copy: 'Quand tu parles, le groupe écoute.',
    drama_ignored: 'En Ligne Mais Ignoré',
    drama_ignored_label: '% de tes msgs sans réponse',
    drama_ignored_copy: 'Ce n\'est pas toi. C\'est eux. Probablement.',
    drama_steady: 'Constant dans le Mix',
    drama_steady_label: 'jours où tu as fermé le chat',
    drama_steady_copy: 'Tu as fermé le chat plein de fois. Juste présent.',
    roast_eyebrow_mild: '✦ COMMENTAIRES DOUX',
    roast_eyebrow_med: '✦ ON TE DÉCRYPTE',
    roast_eyebrow_spicy: '🔥 SANS PITIÉ',
    roast_heading_mild: 'Quelques notes douces.',
    roast_heading_med: 'Quelques observations.',
    roast_heading_spicy: 'Sans pitié. Prépare-toi.',
    roast_more: '+{n} DE PLUS EN ROAST MODE →',
    ach_eyebrow: '✦ SUCCÈS DÉBLOQUÉS',
    ach_earned: 'Tu as gagné',
    ach_badges: 'badge',
    ach_badges_plural: 'badges',
    ach_more: '+{n} DE PLUS',
    likely_eyebrow: '✦ LE PLUS SUSCEPTIBLE DE',
    likely_title: 'Les verdicts',
    likely_verdicts: 'du groupe.',
    likely_label: 'LE PLUS SUSCEPTIBLE DE',
    likely_to_text_3am: 'textoter à 3h du matin',
    likely_to_burst: 'envoyer 10 messages à la suite',
    likely_to_reply_fast: 'répondre en moins d\'une minute',
    likely_to_disappear: 'disparaître pendant des semaines',
    likely_to_kill: 'tuer la conversation',
    likely_to_revive: 'ranimer le chat',
    duo_eyebrow: '✦ LE DUO',
    duo_traded: 'ont échangé',
    duo_replies_between: 'réponses entre eux.',
    duo_in_with: 'Toi et {partner} êtes les co-animateurs.',
    duo_share: '{pct}% des allers-retours du groupe.',
    eras_eyebrow: '✦ TES ÈRES',
    eras_title: 'Les chapitres',
    eras_subtitle: 'de ce chat.',
    eras_chapter: 'CHAPITRE',
    eras_msgs: 'msgs',
    eras_per_day: '{n}/jour',
    chaos_eyebrow: '✦ LE MOMENT DE RUPTURE',
    chaos_at: 'à {time}.',
    chaos_msgs_minute: 'messages en une minute.',
    chaos_lost_control: 'Le groupe a perdu le contrôle.',
    persona_eyebrow: '✦ DIAGNOSTIC',
    persona_this_group: 'Ce groupe est un…',
    persona_evidence: 'PREUVE',
    awards_eyebrow: '✦ LA CÉRÉMONIE DES PRIX',
    awards_title: 'Et les gagnants',
    awards_are: 'sont…',
    awards_fastest: 'Doigts les Plus Rapides',
    awards_fastest_sub: '{m}m réponse moy',
    awards_yapper: 'Le Plus Bavard',
    awards_yapper_sub: '{n} messages',
    awards_nightowl: 'Le Plus Dangereux Après Minuit',
    awards_nightowl_sub: '{pct}% post-minuit',
    awards_ghost: 'Le Retour du Fantôme',
    awards_ghost_sub: 'absence de {n} jours',
    awards_killer: 'Tueur de Conversations',
    awards_killer_sub: '{n} chats terminés sur eux',
    awards_defib: 'Le Défibrillateur',
    awards_defib_sub: 'a ranimé {n} chats morts',
    peakday_eyebrow: 'LE JOUR LE PLUS FOU',
    peakday_msgs: 'messages en un jour.',
    finale_eyebrow: '✦ C\'EST FINI',
    finale_see: 'À bientôt',
    finale_in_the: 'dans le',
    finale_chat: 'chat de groupe.',
    finale_now: 'Maintenant demande à tes amis ce qu\'ils ont eu.',
    finale_explore: 'Explorer les données →',
    menu_replay: 'REPLAY',
    menu_watch: 'Regarder\nencore →',
    menu_roast_mode: 'ROAST MODE',
    menu_roast_everyone: 'Roast\ntout le monde →',
    menu_viewing_as: 'EN TANT QUE',
    menu_switch: 'CHANGER →',
    menu_verified: '✓ DONNÉES VÉRIFIÉES · {n}%',
    menu_msgs_senders: '{msgs} msgs · {senders} expéditeurs',
    menu_verify: 'VÉRIFIER →',
    menu_this_group_is: '✦ CE GROUPE EST UN',
    menu_eras: 'LES ÈRES',
    menu_highlights: 'TES TEMPS FORTS',
    menu_badges: 'TES BADGES',
    menu_leaderboard: 'CLASSEMENT COMPLET',
    menu_hl_messages: 'messages',
    menu_hl_of: 'sur {n}',
    menu_hl_peak_hour: 'heure de pointe',
    menu_hl_at_night: 'la nuit',
    menu_hl_streak: 'série',
    menu_hl_top_emoji: 'emoji top',
    menu_hl_top_word: 'mot top',
    menu_hl_avg_reply: 'réponse moy',
    rm_back: '← Retour',
    rm_title: '🔥 ROAST MODE',
    rm_pick: 'Choisis une',
    rm_victim: 'victime.',
    rm_sub: 'Chaque roast est basé sur des chiffres réels. Sans pitié. Tape un nom pour changer.',
    rm_now: 'EN TRAIN DE ROAST',
    rm_roast: 'ROAST',
    rm_hot_take: 'OPINION CHAUDE',
    rm_screenshot: 'Maintenant fais une capture\net envoie-la à {name}.',
    rm_others: 'AUTRES VICTIMES',
    rm_ready: '{n} roast prêt',
    rm_ready_plural: '{n} roasts prêts',
    rm_btn: 'ROAST →',
    rm_language: 'Langue',
    rm_switch_person: 'Changer de personne',
    verify_back: '← Retour',
    verify_title: 'Ça a l\'air',
    verify_right: 'bon',
    verify_sub: 'Les chiffres sont calculés du fichier. Si ça semble faux, appuie sur Reset. Si ça correspond, continue vers Wrapped.',
    verify_continue: 'Ça a l\'air bon · Continuer vers Wrapped →',
    verify_wrong: 'LES CHIFFRES SONT FAUX · RECHARGER',
    verify_reset: 'RÉINITIALISER',
  },
  de: {
    landing_eyebrow: 'NEU · WHATSAPP UNWRAPPED',
    landing_h1_a: 'Dein',
    landing_h1_b: 'Gruppenchat-',
    landing_h1_c: 'Jahr wird',
    landing_h1_d: 'gleich',
    landing_h1_e: 'enthüllt.',
    landing_sub: 'Eren. Awards. Drama. Eine kinoreife Zusammenfassung deiner echten Nachrichten. Nichts verlässt dein Telefon.',
    cta_play: 'Mein Wrapped abspielen →',
    cta_demo: 'ODER DEMO ANZEIGEN →',
    privacy_note: 'KOMPLETT AUF DEINEM GERÄT VERARBEITET',
    err_format: 'Lade eine .txt oder .zip aus WhatsApp-Export hoch.',
    err_no_msgs: 'Keine Nachrichten gefunden. Format nicht unterstützt.',
    onboard_skip: 'Überspringen',
    onboard_continue: 'Weiter →',
    onboard_done: 'Mein Wrapped sehen →',
    onboard_title: 'Schnelle Fragen',
    onboard_sub: 'Ein paar Sekunden. Macht dein Wrapped 10x genauer.',
    q_who_are_you: 'Wie heißt du in diesem Chat?',
    q_who_are_you_hint: 'Wähle dich selbst',
    q_relationship: 'Was für ein Chat ist das?',
    q_relationship_friends: 'Freunde',
    q_relationship_family: 'Familie',
    q_relationship_work: 'Arbeit',
    q_relationship_couple: 'Nur wir zwei',
    q_relationship_other: 'Anderes',
    q_tone: 'Wie scharf sollen die Roasts sein?',
    q_tone_mild: 'Sanft',
    q_tone_mild_d: 'Sei nett',
    q_tone_medium: 'Ehrlich',
    q_tone_medium_d: 'Echt aber fair',
    q_tone_spicy: 'Brutal',
    q_tone_spicy_d: 'Keine Gnade',
    q_lang_q: 'In welcher Sprache ist der Chat hauptsächlich?',
    parsing_msg_parsed: 'NACHRICHTEN ANALYSIERT',
    parsing_label_open: 'Datei wird geöffnet',
    parsing_label_unzip: 'Entpacken',
    parsing_label_read: 'Jede Zeile lesen',
    parsing_label_analyze: 'Chaos analysieren',
    parsing_label_build: 'Story bauen',
    parsing_detail_open: 'Bytes lesen',
    parsing_detail_unzip: 'WhatsApp ZIP entpacken',
    parsing_detail_read: 'Zeitstempel & Sender parsen',
    parsing_detail_analyze: 'Drama, Eren, Höhepunkte',
    parsing_detail_build: 'Fast fertig…',
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'Mach dich',
    intro_ready: 'bereit.',
    intro_summary: '{msgs} Nachrichten. {people} Personen. {days} Tage. Eine Geschichte.',
    msg_eyebrow: 'DIESES JAHR HAT DIE GRUPPE',
    msg_word: 'Nachrichten gesendet.',
    msg_your_share: 'DEIN ANTEIL',
    rank_eyebrow: '✦ DIE RANGLISTE',
    rank_finished: 'Du hast',
    rank_of: 'von {n} erreicht.',
    rank_you: '(du)',
    vs_eyebrow: 'DU VS ALLE',
    vs_outsent_all: 'Du hast mehr\nals alle anderen gesendet.',
    vs_least: 'Du hast weniger\nals alle anderen gesendet.',
    vs_middle: 'Du hast mehr als\n{beat} von {others} gesendet.',
    vs_alone: 'Du bist hier allein.',
    vs_ranked: '{msgs} msgs · #{rank} von {total}',
    vs_fastest: 'DER SCHNELLSTE',
    vs_avg_s: '{s}s Durchschnitt',
    vs_avg_m: '{m}m Durchschnitt',
    vs_avg_h: '{h}h Durchschnitt',
    title_eyebrow: '✦ MAN NENNT DICH',
    title_based_on: 'BASIEREND AUF',
    descr_eyebrow: 'DIE GRUPPE WÜRDE DICH BESCHREIBEN ALS',
    descr_footnote: 'Sie haben es nicht laut gesagt. Aber die Daten schon.',
    peak_eyebrow: 'DEINE STUNDE',
    peak_3am: 'Ehrlich besorgniserregend.',
    peak_morning: 'Ein echter Morgenmensch.',
    peak_midday: 'Textest während der Arbeit. Mutig.',
    peak_evening: 'Champion des Nach-Feierabend-Textens.',
    peak_late: 'Nächtliches Philosophenverhalten.',
    night_eyebrow: 'ZWISCHEN MITTERNACHT & 6 UHR',
    night_of_msgs: 'deiner Nachrichten.',
    night_diag_strong: 'Diagnose: zertifizierte Nachtkreatur.',
    night_diag_med: 'Du bist später wach als du denkst.',
    night_diag_low: 'Gesunder Schlafrhythmus, meistens.',
    night_diag_none: 'Du loggst dich aus. Respekt.',
    night_owl: '✦ #1 NACHTEULE',
    night_count: '{night} von deinen {total}',
    streak_eyebrow: 'DEINE LÄNGSTE SERIE',
    streak_day: 'Tag',
    streak_days: 'Tage am Stück.',
    speed_eyebrow: 'ANTWORTZEIT',
    speed_faster: 'Schneller als',
    speed_of_group: 'der Gruppe.',
    speed_based: 'BASIEREND AUF {n} ANTWORTEN',
    word_eyebrow: 'DEIN SIGNATURWORT',
    word_used: '{n}-mal verwendet.',
    top_words_eyebrow: 'DER WORTSCHATZ DER GRUPPE',
    top_words_title: 'Die Wörter',
    top_words_subtitle: 'die ihr alle wiederholt habt',
    emoji_eyebrow: 'MEISTGENUTZTES EMOJI',
    emoji_used: '{n}-mal verwendet.',
    drama_eyebrow: '✦ DEINE ROLLE IM DRAMA',
    drama_defib: 'Der Defibrillator',
    drama_defib_label: 'tote Chats wiederbelebt',
    drama_defib_copy: 'Als die Gruppe schwieg, hast du sie zurückgebracht.',
    drama_killer: 'Der Gesprächs-Killer',
    drama_killer_label: 'Chats endeten auf dir',
    drama_killer_copy: 'Wenn du gesprochen hast, hatte niemand etwas hinzuzufügen. Verdächtig.',
    drama_replied: 'Alle Antworten Dir',
    drama_replied_label: '% deiner msgs bekamen Antwort in 30 Min',
    drama_replied_copy: 'Wenn du sprichst, hört die Gruppe zu.',
    drama_ignored: 'Online Aber Ignoriert',
    drama_ignored_label: '% deiner msgs ohne Antwort',
    drama_ignored_copy: 'Es liegt nicht an dir. An ihnen. Wahrscheinlich.',
    drama_steady: 'Konstant Dabei',
    drama_steady_label: 'Tage, an denen du den Chat geschlossen hast',
    drama_steady_copy: 'Du hast den Chat oft geschlossen. Einfach da.',
    roast_eyebrow_mild: '✦ SANFTE BEOBACHTUNGEN',
    roast_eyebrow_med: '✦ AUFGEDECKT',
    roast_eyebrow_spicy: '🔥 KEINE GNADE',
    roast_heading_mild: 'Ein paar sanfte Notizen.',
    roast_heading_med: 'Ein paar Beobachtungen.',
    roast_heading_spicy: 'Keine Gnade. Halt dich fest.',
    roast_more: '+{n} MEHR IN ROAST MODE →',
    ach_eyebrow: '✦ ERFOLGE FREIGESCHALTET',
    ach_earned: 'Du hast',
    ach_badges: 'Abzeichen verdient',
    ach_badges_plural: 'Abzeichen verdient',
    ach_more: '+{n} MEHR',
    likely_eyebrow: '✦ AM WAHRSCHEINLICHSTEN',
    likely_title: 'Die Urteile',
    likely_verdicts: 'der Gruppe.',
    likely_label: 'AM WAHRSCHEINLICHSTEN',
    likely_to_text_3am: 'um 3 Uhr morgens texten',
    likely_to_burst: '10 Nachrichten hintereinander senden',
    likely_to_reply_fast: 'in unter einer Minute antworten',
    likely_to_disappear: 'wochenlang verschwinden',
    likely_to_kill: 'das Gespräch beenden',
    likely_to_revive: 'den Chat zurückbringen',
    duo_eyebrow: '✦ DAS TOP-DUO',
    duo_traded: 'tauschten',
    duo_replies_between: 'Antworten aus.',
    duo_in_with: 'Du und {partner} seid quasi Co-Hosts.',
    duo_share: '{pct}% des Hin und Her in dieser Gruppe.',
    eras_eyebrow: '✦ DEINE ÄREN',
    eras_title: 'Die Kapitel',
    eras_subtitle: 'dieses Chats.',
    eras_chapter: 'KAPITEL',
    eras_msgs: 'msgs',
    eras_per_day: '{n}/Tag',
    chaos_eyebrow: '✦ DER MOMENT DES BRUCHS',
    chaos_at: 'um {time}.',
    chaos_msgs_minute: 'Nachrichten in einer Minute.',
    chaos_lost_control: 'Die Gruppe verlor die Kontrolle.',
    persona_eyebrow: '✦ DIAGNOSE',
    persona_this_group: 'Diese Gruppe ist ein…',
    persona_evidence: 'BEWEIS',
    awards_eyebrow: '✦ DIE PREISVERLEIHUNG',
    awards_title: 'Und die Gewinner',
    awards_are: 'sind…',
    awards_fastest: 'Schnellste Finger',
    awards_fastest_sub: '{m}m durchschn. Antwort',
    awards_yapper: 'Größter Quasselstrippe',
    awards_yapper_sub: '{n} Nachrichten',
    awards_nightowl: 'Gefährlichste Nach Mitternacht',
    awards_nightowl_sub: '{pct}% nach Mitternacht',
    awards_ghost: 'Rückkehr des Geistes',
    awards_ghost_sub: '{n} Tage Abwesenheit',
    awards_killer: 'Gesprächs-Killer',
    awards_killer_sub: '{n} Chats endeten auf ihnen',
    awards_defib: 'Der Defibrillator',
    awards_defib_sub: 'belebte {n} tote Chats',
    peakday_eyebrow: 'DER WILDESTE TAG',
    peakday_msgs: 'Nachrichten an einem Tag.',
    finale_eyebrow: '✦ DAS WAR\'S',
    finale_see: 'Wir sehen uns',
    finale_in_the: 'im',
    finale_chat: 'Gruppenchat.',
    finale_now: 'Frag deine Freunde, was sie bekommen haben.',
    finale_explore: 'Die Daten erkunden →',
    menu_replay: 'WIEDERHOLEN',
    menu_watch: 'Nochmal\nansehen →',
    menu_roast_mode: 'ROAST MODE',
    menu_roast_everyone: 'Alle\nrosten →',
    menu_viewing_as: 'ALS',
    menu_switch: 'WECHSELN →',
    menu_verified: '✓ VERIFIZIERTE DATEN · {n}%',
    menu_msgs_senders: '{msgs} msgs · {senders} Absender',
    menu_verify: 'VERIFIZIEREN →',
    menu_this_group_is: '✦ DIESE GRUPPE IST EIN',
    menu_eras: 'DIE ÄREN',
    menu_highlights: 'DEINE HIGHLIGHTS',
    menu_badges: 'DEINE ABZEICHEN',
    menu_leaderboard: 'KOMPLETTE RANGLISTE',
    menu_hl_messages: 'Nachrichten',
    menu_hl_of: 'von {n}',
    menu_hl_peak_hour: 'Spitzenstunde',
    menu_hl_at_night: 'nachts',
    menu_hl_streak: 'Serie',
    menu_hl_top_emoji: 'Top-Emoji',
    menu_hl_top_word: 'Top-Wort',
    menu_hl_avg_reply: 'Antwortzeit',
    rm_back: '← Zurück',
    rm_title: '🔥 ROAST MODE',
    rm_pick: 'Wähle ein',
    rm_victim: 'Opfer.',
    rm_sub: 'Jeder Roast basiert auf echten Zahlen. Keine Gnade. Tippe auf einen Namen.',
    rm_now: 'JETZT ROSTEN',
    rm_roast: 'ROAST',
    rm_hot_take: 'HEISSE MEINUNG',
    rm_screenshot: 'Jetzt screenshot machen\nund an {name} senden.',
    rm_others: 'ANDERE OPFER',
    rm_ready: '{n} Roast bereit',
    rm_ready_plural: '{n} Roasts bereit',
    rm_btn: 'ROAST →',
    rm_language: 'Sprache',
    rm_switch_person: 'Person wechseln',
    verify_back: '← Zurück',
    verify_title: 'Sieht das',
    verify_right: 'richtig',
    verify_sub: 'Zahlen aus der Datei berechnet. Wenn etwas nicht stimmt, drücke Reset. Wenn es passt, weiter zu Wrapped.',
    verify_continue: 'Sieht richtig aus · Weiter zu Wrapped →',
    verify_wrong: 'ZAHLEN STIMMEN NICHT · NEU HOCHLADEN',
    verify_reset: 'ZURÜCKSETZEN',
  },
  pt: {
    landing_eyebrow: 'NOVO · WHATSAPP UNWRAPPED',
    landing_h1_a: 'O ano',
    landing_h1_b: 'do seu chat',
    landing_h1_c: 'está prestes',
    landing_h1_d: 'a',
    landing_h1_e: 'sair.',
    landing_sub: 'Eras. Prêmios. Drama. Um resumo cinematográfico das suas mensagens reais. Nada sai do seu celular.',
    cta_play: 'Ver meu Wrapped →',
    cta_demo: 'OU VER COM DEMO →',
    privacy_note: 'PROCESSADO INTEIRAMENTE NO SEU DISPOSITIVO',
    err_format: 'Envie um .txt ou .zip exportado do WhatsApp.',
    err_no_msgs: 'Nenhuma mensagem encontrada. Formato não suportado.',
    onboard_skip: 'Pular',
    onboard_continue: 'Continuar →',
    onboard_done: 'Ver meu Wrapped →',
    onboard_title: 'Perguntas rápidas',
    onboard_sub: 'Alguns segundos. Deixa seu Wrapped 10x mais preciso.',
    q_who_are_you: 'Qual seu nome neste chat?',
    q_who_are_you_hint: 'Escolha você mesmo',
    q_relationship: 'Que tipo de chat é esse?',
    q_relationship_friends: 'Amigos',
    q_relationship_family: 'Família',
    q_relationship_work: 'Trabalho',
    q_relationship_couple: 'Só nós dois',
    q_relationship_other: 'Outro',
    q_tone: 'Quão pesados devem ser os roasts?',
    q_tone_mild: 'Leve',
    q_tone_mild_d: 'Vai com calma',
    q_tone_medium: 'Honesto',
    q_tone_medium_d: 'Real mas justo',
    q_tone_spicy: 'Brutal',
    q_tone_spicy_d: 'Sem piedade',
    q_lang_q: 'Em qual idioma o chat está principalmente?',
    parsing_msg_parsed: 'MENSAGENS ANALISADAS',
    parsing_label_open: 'Abrindo arquivo',
    parsing_label_unzip: 'Descompactando',
    parsing_label_read: 'Lendo cada linha',
    parsing_label_analyze: 'Analisando o caos',
    parsing_label_build: 'Construindo sua história',
    parsing_detail_open: 'Lendo bytes',
    parsing_detail_unzip: 'Descompactando ZIP do WhatsApp',
    parsing_detail_read: 'Processando timestamps e remetentes',
    parsing_detail_analyze: 'Detectando drama, eras, picos',
    parsing_detail_build: 'Quase lá…',
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'Se prepara.',
    intro_ready: '',
    intro_summary: '{msgs} mensagens. {people} pessoas. {days} dias. Uma história.',
    msg_eyebrow: 'ESTE ANO O GRUPO ENVIOU',
    msg_word: 'mensagens.',
    msg_your_share: 'SUA PARTE',
    rank_eyebrow: '✦ O RANKING',
    rank_finished: 'Você terminou em',
    rank_of: 'de {n}.',
    rank_you: '(você)',
    vs_eyebrow: 'VOCÊ VS TODOS',
    vs_outsent_all: 'Você mandou mais\nque todo mundo.',
    vs_least: 'Você mandou menos\nque todo mundo.',
    vs_middle: 'Você mandou mais que\n{beat} de {others}.',
    vs_alone: 'Só você aqui.',
    vs_ranked: '{msgs} msgs · #{rank} de {total}',
    vs_fastest: 'O MAIS RÁPIDO',
    vs_avg_s: '{s}s méd',
    vs_avg_m: '{m}m méd',
    vs_avg_h: '{h}h méd',
    title_eyebrow: '✦ TE CHAMAM DE',
    title_based_on: 'BASEADO EM',
    descr_eyebrow: 'O GRUPO TE DESCREVERIA COMO',
    descr_footnote: 'Não falaram em voz alta. Mas os dados sim.',
    peak_eyebrow: 'SUA HORA',
    peak_3am: 'Genuinamente preocupante.',
    peak_morning: 'Pessoa matinal de verdade.',
    peak_midday: 'Mandando msg no trabalho. Ousado.',
    peak_evening: 'Campeão do texto pós-trabalho.',
    peak_late: 'Filósofo noturno.',
    night_eyebrow: 'ENTRE MEIA-NOITE & 6H',
    night_of_msgs: 'das suas mensagens.',
    night_diag_strong: 'Diagnóstico: criatura noturna certificada.',
    night_diag_med: 'Você fica acordado mais do que pensa.',
    night_diag_low: 'Sono saudável, geralmente.',
    night_diag_none: 'Você desliga. Respeito.',
    night_owl: '✦ #1 CORUJA',
    night_count: '{night} das suas {total}',
    streak_eyebrow: 'SUA MAIOR SEQUÊNCIA',
    streak_day: 'dia',
    streak_days: 'dias seguidos.',
    speed_eyebrow: 'TEMPO DE RESPOSTA',
    speed_faster: 'Mais rápido que',
    speed_of_group: 'do grupo.',
    speed_based: 'BASEADO EM {n} RESPOSTAS',
    word_eyebrow: 'SUA PALAVRA ASSINATURA',
    word_used: 'Usada {n} vezes.',
    top_words_eyebrow: 'O VOCABULÁRIO DO GRUPO',
    top_words_title: 'As palavras',
    top_words_subtitle: 'que todos repetiam',
    emoji_eyebrow: 'EMOJI MAIS USADO',
    emoji_used: 'Usado {n} vezes.',
    drama_eyebrow: '✦ SEU PAPEL NO DRAMA',
    drama_defib: 'O Desfibrilador',
    drama_defib_label: 'chats ressuscitados',
    drama_defib_copy: 'Quando o grupo silenciou, você trouxe de volta.',
    drama_killer: 'O Assassino de Conversas',
    drama_killer_label: 'chats terminaram em você',
    drama_killer_copy: 'Quando você falava, ninguém tinha o que adicionar. Suspeito.',
    drama_replied: 'Todo Mundo Te Responde',
    drama_replied_label: '% das suas msgs receberam resposta em 30 min',
    drama_replied_copy: 'Quando você fala, o grupo escuta.',
    drama_ignored: 'Online Mas Ignorado',
    drama_ignored_label: '% das suas msgs sem resposta',
    drama_ignored_copy: 'Não é você. São eles. Provavelmente.',
    drama_steady: 'Constante na Jogada',
    drama_steady_label: 'dias que você fechou o chat',
    drama_steady_copy: 'Fechou o chat várias vezes. Só presente.',
    roast_eyebrow_mild: '✦ OBSERVAÇÕES LEVES',
    roast_eyebrow_med: '✦ TE LENDO ATÉ O FIM',
    roast_eyebrow_spicy: '🔥 SEM PIEDADE',
    roast_heading_mild: 'Algumas notas leves.',
    roast_heading_med: 'Algumas observações.',
    roast_heading_spicy: 'Sem piedade. Se prepara.',
    roast_more: '+{n} MAIS NO ROAST MODE →',
    ach_eyebrow: '✦ CONQUISTAS DESBLOQUEADAS',
    ach_earned: 'Você ganhou',
    ach_badges: 'distintivo',
    ach_badges_plural: 'distintivos',
    ach_more: '+{n} MAIS',
    likely_eyebrow: '✦ MAIS PROVÁVEL DE',
    likely_title: 'Os veredictos',
    likely_verdicts: 'do grupo.',
    likely_label: 'MAIS PROVÁVEL DE',
    likely_to_text_3am: 'mandar msg às 3 da manhã',
    likely_to_burst: 'mandar 10 mensagens seguidas',
    likely_to_reply_fast: 'responder em menos de um minuto',
    likely_to_disappear: 'sumir por semanas',
    likely_to_kill: 'matar a conversa',
    likely_to_revive: 'trazer o chat de volta',
    duo_eyebrow: '✦ A DUPLA',
    duo_traded: 'trocaram',
    duo_replies_between: 'respostas entre eles.',
    duo_in_with: 'Você e {partner} são basicamente co-anfitriões.',
    duo_share: '{pct}% de todo o vai-e-vem do grupo.',
    eras_eyebrow: '✦ SUAS ERAS',
    eras_title: 'Os capítulos',
    eras_subtitle: 'desse chat.',
    eras_chapter: 'CAPÍTULO',
    eras_msgs: 'msgs',
    eras_per_day: '{n}/dia',
    chaos_eyebrow: '✦ O MOMENTO QUE EXPLODIU',
    chaos_at: 'às {time}.',
    chaos_msgs_minute: 'mensagens em um minuto.',
    chaos_lost_control: 'O grupo perdeu o controle.',
    persona_eyebrow: '✦ DIAGNÓSTICO',
    persona_this_group: 'Esse grupo é um…',
    persona_evidence: 'EVIDÊNCIA',
    awards_eyebrow: '✦ A CERIMÔNIA DE PRÊMIOS',
    awards_title: 'E os vencedores',
    awards_are: 'são…',
    awards_fastest: 'Dedos Mais Rápidos',
    awards_fastest_sub: '{m}m resposta méd',
    awards_yapper: 'Maior Tagarela',
    awards_yapper_sub: '{n} mensagens',
    awards_nightowl: 'Mais Perigoso Depois da Meia-Noite',
    awards_nightowl_sub: '{pct}% pós-meia-noite',
    awards_ghost: 'O Retorno do Fantasma',
    awards_ghost_sub: 'ausência de {n} dias',
    awards_killer: 'Assassino de Conversas',
    awards_killer_sub: '{n} chats terminaram neles',
    awards_defib: 'O Desfibrilador',
    awards_defib_sub: 'reviveu {n} chats mortos',
    peakday_eyebrow: 'O DIA MAIS SELVAGEM',
    peakday_msgs: 'mensagens em um dia.',
    finale_eyebrow: '✦ ACABOU',
    finale_see: 'Te vejo',
    finale_in_the: 'no',
    finale_chat: 'chat do grupo.',
    finale_now: 'Agora pergunta aos amigos o que eles tiraram.',
    finale_explore: 'Explorar os dados →',
    menu_replay: 'REPETIR',
    menu_watch: 'Assistir\nde novo →',
    menu_roast_mode: 'ROAST MODE',
    menu_roast_everyone: 'Detonar\ntodos →',
    menu_viewing_as: 'VENDO COMO',
    menu_switch: 'TROCAR →',
    menu_verified: '✓ DADOS VERIFICADOS · {n}%',
    menu_msgs_senders: '{msgs} msgs · {senders} remetentes',
    menu_verify: 'VERIFICAR →',
    menu_this_group_is: '✦ ESSE GRUPO É UM',
    menu_eras: 'AS ERAS',
    menu_highlights: 'SEUS DESTAQUES',
    menu_badges: 'SEUS DISTINTIVOS',
    menu_leaderboard: 'RANKING COMPLETO',
    menu_hl_messages: 'mensagens',
    menu_hl_of: 'de {n}',
    menu_hl_peak_hour: 'hora de pico',
    menu_hl_at_night: 'à noite',
    menu_hl_streak: 'sequência',
    menu_hl_top_emoji: 'emoji top',
    menu_hl_top_word: 'palavra top',
    menu_hl_avg_reply: 'resposta méd',
    rm_back: '← Voltar',
    rm_title: '🔥 ROAST MODE',
    rm_pick: 'Escolha uma',
    rm_victim: 'vítima.',
    rm_sub: 'Cada roast é baseado em números reais. Sem piedade. Toque num nome para trocar.',
    rm_now: 'DETONANDO AGORA',
    rm_roast: 'ROAST',
    rm_hot_take: 'OPINIÃO QUENTE',
    rm_screenshot: 'Agora tire um print\ne mande pra {name}.',
    rm_others: 'OUTRAS VÍTIMAS',
    rm_ready: '{n} roast pronto',
    rm_ready_plural: '{n} roasts prontos',
    rm_btn: 'DETONAR →',
    rm_language: 'Idioma',
    rm_switch_person: 'Trocar pessoa',
    verify_back: '← Voltar',
    verify_title: 'Tá',
    verify_right: 'certo',
    verify_sub: 'Números calculados do arquivo. Se algo parecer errado, aperta Reset. Se bater, continua para Wrapped.',
    verify_continue: 'Tá certo · Continuar para Wrapped →',
    verify_wrong: 'NÚMEROS ERRADOS · ENVIAR DE NOVO',
    verify_reset: 'RESETAR',
  },
  it: {
    landing_eyebrow: 'NUOVO · WHATSAPP UNWRAPPED',
    landing_h1_a: 'L\'anno',
    landing_h1_b: 'della tua chat',
    landing_h1_c: 'sta per',
    landing_h1_d: 'essere',
    landing_h1_e: 'rivelato.',
    landing_sub: 'Ere. Premi. Drama. Un riassunto cinematografico dei tuoi messaggi reali. Niente lascia il tuo telefono.',
    cta_play: 'Vedi il mio Wrapped →',
    cta_demo: 'O VEDI CON DEMO →',
    privacy_note: 'ELABORATO INTERAMENTE SUL TUO DISPOSITIVO',
    err_format: 'Carica un .txt o .zip esportato da WhatsApp.',
    err_no_msgs: 'Nessun messaggio trovato. Formato non supportato.',
    onboard_skip: 'Salta',
    onboard_continue: 'Continua →',
    onboard_done: 'Vedi il mio Wrapped →',
    onboard_title: 'Domande veloci',
    onboard_sub: 'Pochi secondi. Rende il tuo Wrapped 10x più preciso.',
    q_who_are_you: 'Come ti chiami in questa chat?',
    q_who_are_you_hint: 'Scegli te stesso',
    q_relationship: 'Che tipo di chat è?',
    q_relationship_friends: 'Amici',
    q_relationship_family: 'Famiglia',
    q_relationship_work: 'Lavoro',
    q_relationship_couple: 'Solo noi due',
    q_relationship_other: 'Altro',
    q_tone: 'Quanto piccanti devono essere i roast?',
    q_tone_mild: 'Delicato',
    q_tone_mild_d: 'Vai piano',
    q_tone_medium: 'Onesto',
    q_tone_medium_d: 'Vero ma giusto',
    q_tone_spicy: 'Brutale',
    q_tone_spicy_d: 'Senza pietà',
    q_lang_q: 'In che lingua è principalmente la chat?',
    parsing_msg_parsed: 'MESSAGGI ANALIZZATI',
    parsing_label_open: 'Apertura file',
    parsing_label_unzip: 'Decompressione',
    parsing_label_read: 'Lettura righe',
    parsing_label_analyze: 'Analisi del caos',
    parsing_label_build: 'Costruzione storia',
    parsing_detail_open: 'Lettura byte',
    parsing_detail_unzip: 'Decompressione ZIP WhatsApp',
    parsing_detail_read: 'Parsing timestamp e mittenti',
    parsing_detail_analyze: 'Rilevamento drama, ere, picchi',
    parsing_detail_build: 'Quasi pronto…',
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'Preparati.',
    intro_ready: '',
    intro_summary: '{msgs} messaggi. {people} persone. {days} giorni. Una storia.',
    msg_eyebrow: 'QUEST\'ANNO IL GRUPPO HA INVIATO',
    msg_word: 'messaggi.',
    msg_your_share: 'LA TUA QUOTA',
    rank_eyebrow: '✦ LA CLASSIFICA',
    rank_finished: 'Sei arrivato',
    rank_of: 'su {n}.',
    rank_you: '(tu)',
    vs_eyebrow: 'TU VS TUTTI',
    vs_outsent_all: 'Hai inviato più\ndi tutti gli altri.',
    vs_least: 'Hai inviato meno\ndi tutti.',
    vs_middle: 'Hai inviato più di\n{beat} su {others}.',
    vs_alone: 'Sei da solo qui.',
    vs_ranked: '{msgs} msgs · #{rank} su {total}',
    vs_fastest: 'IL PIÙ VELOCE',
    vs_avg_s: '{s}s media',
    vs_avg_m: '{m}m media',
    vs_avg_h: '{h}h media',
    title_eyebrow: '✦ TI CHIAMANO',
    title_based_on: 'BASATO SU',
    descr_eyebrow: 'IL GRUPPO TI DESCRIVEREBBE COME',
    descr_footnote: 'Non lo hanno detto a voce. Ma i dati sì.',
    peak_eyebrow: 'LA TUA ORA',
    peak_3am: 'Davvero preoccupante.',
    peak_morning: 'Una vera persona del mattino.',
    peak_midday: 'Messaggi a lavoro. Coraggioso.',
    peak_evening: 'Campione dei messaggi post-lavoro.',
    peak_late: 'Filosofo notturno.',
    night_eyebrow: 'TRA MEZZANOTTE E LE 6',
    night_of_msgs: 'dei tuoi messaggi.',
    night_diag_strong: 'Diagnosi: creatura notturna certificata.',
    night_diag_med: 'Resti sveglio più di quanto pensi.',
    night_diag_low: 'Sonno sano, per lo più.',
    night_diag_none: 'Ti scolleghi. Rispetto.',
    night_owl: '✦ #1 GUFO NOTTURNO',
    night_count: '{night} dei tuoi {total}',
    streak_eyebrow: 'LA TUA SERIE PIÙ LUNGA',
    streak_day: 'giorno',
    streak_days: 'giorni di seguito.',
    speed_eyebrow: 'TEMPO DI RISPOSTA',
    speed_faster: 'Più veloce di',
    speed_of_group: 'del gruppo.',
    speed_based: 'BASATO SU {n} RISPOSTE',
    word_eyebrow: 'LA TUA PAROLA SIGNATURE',
    word_used: 'Usata {n} volte.',
    top_words_eyebrow: 'IL VOCABOLARIO DEL GRUPPO',
    top_words_title: 'Le parole',
    top_words_subtitle: 'che ripetevate tutti',
    emoji_eyebrow: 'EMOJI PIÙ USATO',
    emoji_used: 'Usato {n} volte.',
    drama_eyebrow: '✦ IL TUO RUOLO NEL DRAMMA',
    drama_defib: 'Il Defibrillatore',
    drama_defib_label: 'chat resuscitate',
    drama_defib_copy: 'Quando il gruppo taceva, l\'hai riportato in vita.',
    drama_killer: 'L\'Assassino di Conversazioni',
    drama_killer_label: 'chat finite su di te',
    drama_killer_copy: 'Quando parlavi, nessuno aveva nulla da aggiungere. Sospetto.',
    drama_replied: 'Tutti Ti Rispondono',
    drama_replied_label: '% dei tuoi msgs ha avuto risposta in 30 min',
    drama_replied_copy: 'Quando parli, il gruppo ascolta.',
    drama_ignored: 'Online Ma Ignorato',
    drama_ignored_label: '% dei tuoi msgs senza risposta',
    drama_ignored_copy: 'Non sei tu. Sono loro. Probabilmente.',
    drama_steady: 'Costante nel Mix',
    drama_steady_label: 'giorni in cui hai chiuso la chat',
    drama_steady_copy: 'Hai chiuso la chat un sacco di volte. Solo presente.',
    roast_eyebrow_mild: '✦ NOTE GENTILI',
    roast_eyebrow_med: '✦ TI LEGGIAMO FINO IN FONDO',
    roast_eyebrow_spicy: '🔥 SENZA PIETÀ',
    roast_heading_mild: 'Qualche nota gentile.',
    roast_heading_med: 'Qualche osservazione.',
    roast_heading_spicy: 'Senza pietà. Preparati.',
    roast_more: '+{n} ALTRI IN ROAST MODE →',
    ach_eyebrow: '✦ OBIETTIVI SBLOCCATI',
    ach_earned: 'Hai guadagnato',
    ach_badges: 'medaglia',
    ach_badges_plural: 'medaglie',
    ach_more: '+{n} ALTRI',
    likely_eyebrow: '✦ PIÙ PROBABILE',
    likely_title: 'I verdetti',
    likely_verdicts: 'del gruppo.',
    likely_label: 'PIÙ PROBABILE',
    likely_to_text_3am: 'scrivere alle 3 di notte',
    likely_to_burst: 'inviare 10 messaggi di fila',
    likely_to_reply_fast: 'rispondere in meno di un minuto',
    likely_to_disappear: 'sparire per settimane',
    likely_to_kill: 'uccidere la conversazione',
    likely_to_revive: 'riportare la chat in vita',
    duo_eyebrow: '✦ IL DUO',
    duo_traded: 'hanno scambiato',
    duo_replies_between: 'risposte tra loro.',
    duo_in_with: 'Tu e {partner} siete praticamente co-host.',
    duo_share: '{pct}% di tutto lo scambio nel gruppo.',
    eras_eyebrow: '✦ LE TUE ERE',
    eras_title: 'I capitoli',
    eras_subtitle: 'di questa chat.',
    eras_chapter: 'CAPITOLO',
    eras_msgs: 'msgs',
    eras_per_day: '{n}/giorno',
    chaos_eyebrow: '✦ IL MOMENTO DELLA ROTTURA',
    chaos_at: 'alle {time}.',
    chaos_msgs_minute: 'messaggi in un minuto.',
    chaos_lost_control: 'Il gruppo ha perso il controllo.',
    persona_eyebrow: '✦ DIAGNOSI',
    persona_this_group: 'Questo gruppo è un…',
    persona_evidence: 'PROVA',
    awards_eyebrow: '✦ LA CERIMONIA DEI PREMI',
    awards_title: 'E i vincitori',
    awards_are: 'sono…',
    awards_fastest: 'Dita Più Veloci',
    awards_fastest_sub: '{m}m risposta media',
    awards_yapper: 'Il Più Chiacchierone',
    awards_yapper_sub: '{n} messaggi',
    awards_nightowl: 'Più Pericoloso Dopo Mezzanotte',
    awards_nightowl_sub: '{pct}% post-mezzanotte',
    awards_ghost: 'Il Ritorno del Fantasma',
    awards_ghost_sub: 'assenza di {n} giorni',
    awards_killer: 'Assassino di Conversazioni',
    awards_killer_sub: '{n} chat finite su di loro',
    awards_defib: 'Il Defibrillatore',
    awards_defib_sub: 'ha resuscitato {n} chat morte',
    peakday_eyebrow: 'IL GIORNO PIÙ FOLLE',
    peakday_msgs: 'messaggi in un giorno.',
    finale_eyebrow: '✦ È FINITA',
    finale_see: 'Ci vediamo',
    finale_in_the: 'nella',
    finale_chat: 'chat di gruppo.',
    finale_now: 'Ora chiedi ai tuoi amici cosa hanno avuto.',
    finale_explore: 'Esplora i dati →',
    menu_replay: 'REPLAY',
    menu_watch: 'Guarda\ndi nuovo →',
    menu_roast_mode: 'ROAST MODE',
    menu_roast_everyone: 'Roast\ntutti →',
    menu_viewing_as: 'VEDENDO COME',
    menu_switch: 'CAMBIA →',
    menu_verified: '✓ DATI VERIFICATI · {n}%',
    menu_msgs_senders: '{msgs} msgs · {senders} mittenti',
    menu_verify: 'VERIFICA →',
    menu_this_group_is: '✦ QUESTO GRUPPO È UN',
    menu_eras: 'LE ERE',
    menu_highlights: 'I TUOI HIGHLIGHTS',
    menu_badges: 'LE TUE MEDAGLIE',
    menu_leaderboard: 'CLASSIFICA COMPLETA',
    menu_hl_messages: 'messaggi',
    menu_hl_of: 'su {n}',
    menu_hl_peak_hour: 'ora di punta',
    menu_hl_at_night: 'di notte',
    menu_hl_streak: 'serie',
    menu_hl_top_emoji: 'emoji top',
    menu_hl_top_word: 'parola top',
    menu_hl_avg_reply: 'risposta media',
    rm_back: '← Indietro',
    rm_title: '🔥 ROAST MODE',
    rm_pick: 'Scegli una',
    rm_victim: 'vittima.',
    rm_sub: 'Ogni roast è basato su numeri veri. Senza pietà. Tocca un nome per cambiare.',
    rm_now: 'ROASTING ORA',
    rm_roast: 'ROAST',
    rm_hot_take: 'OPINIONE PICCANTE',
    rm_screenshot: 'Ora fai uno screenshot\ne mandalo a {name}.',
    rm_others: 'ALTRE VITTIME',
    rm_ready: '{n} roast pronto',
    rm_ready_plural: '{n} roast pronti',
    rm_btn: 'ROAST →',
    rm_language: 'Lingua',
    rm_switch_person: 'Cambia persona',
    verify_back: '← Indietro',
    verify_title: 'Sembra',
    verify_right: 'giusto',
    verify_sub: 'Numeri calcolati dal file. Se qualcosa sembra sbagliato, premi Reset. Se torna, continua a Wrapped.',
    verify_continue: 'Sembra giusto · Continua a Wrapped →',
    verify_wrong: 'NUMERI SBAGLIATI · CARICA DI NUOVO',
    verify_reset: 'RESET',
  },
  ru: {
    landing_eyebrow: 'НОВОЕ · WHATSAPP UNWRAPPED',
    landing_h1_a: 'Год',
    landing_h1_b: 'вашего чата',
    landing_h1_c: 'скоро',
    landing_h1_d: 'будет',
    landing_h1_e: 'раскрыт.',
    landing_sub: 'Эры. Награды. Драма. Кинематографический обзор ваших реальных сообщений. Ничего не покидает ваш телефон.',
    cta_play: 'Показать Wrapped →',
    cta_demo: 'ИЛИ СМОТРЕТЬ ДЕМО →',
    privacy_note: 'ПОЛНОСТЬЮ ОБРАБАТЫВАЕТСЯ НА УСТРОЙСТВЕ',
    err_format: 'Загрузите .txt или .zip из экспорта WhatsApp.',
    err_no_msgs: 'Сообщения не найдены. Формат не поддерживается.',
    onboard_skip: 'Пропустить',
    onboard_continue: 'Дальше →',
    onboard_done: 'Показать Wrapped →',
    onboard_title: 'Быстрые вопросы',
    onboard_sub: 'Несколько секунд. Делает Wrapped в 10 раз точнее.',
    q_who_are_you: 'Как тебя зовут в этом чате?',
    q_who_are_you_hint: 'Выбери себя',
    q_relationship: 'Что это за чат?',
    q_relationship_friends: 'Друзья',
    q_relationship_family: 'Семья',
    q_relationship_work: 'Работа',
    q_relationship_couple: 'Только мы вдвоём',
    q_relationship_other: 'Другое',
    q_tone: 'Насколько острыми должны быть подколы?',
    q_tone_mild: 'Мягко',
    q_tone_mild_d: 'По-доброму',
    q_tone_medium: 'Честно',
    q_tone_medium_d: 'По-настоящему',
    q_tone_spicy: 'Жёстко',
    q_tone_spicy_d: 'Без пощады',
    q_lang_q: 'На каком языке чат в основном?',
    parsing_msg_parsed: 'СООБЩЕНИЙ ОБРАБОТАНО',
    parsing_label_open: 'Открытие файла',
    parsing_label_unzip: 'Распаковка',
    parsing_label_read: 'Чтение строк',
    parsing_label_analyze: 'Анализ хаоса',
    parsing_label_build: 'Построение истории',
    parsing_detail_open: 'Чтение байтов',
    parsing_detail_unzip: 'Распаковка ZIP WhatsApp',
    parsing_detail_read: 'Разбор временных меток',
    parsing_detail_analyze: 'Обнаружение драмы, эр, пиков',
    parsing_detail_build: 'Почти готово…',
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'Готовься.',
    intro_ready: '',
    intro_summary: '{msgs} сообщений. {people} людей. {days} дней. Одна история.',
    msg_eyebrow: 'В ЭТОМ ГОДУ ГРУППА ОТПРАВИЛА',
    msg_word: 'сообщений.',
    msg_your_share: 'ТВОЯ ДОЛЯ',
    rank_eyebrow: '✦ ТАБЛИЦА ЛИДЕРОВ',
    rank_finished: 'Ты на',
    rank_of: 'из {n}.',
    rank_you: '(ты)',
    vs_eyebrow: 'ТЫ ПРОТИВ ВСЕХ',
    vs_outsent_all: 'Ты отправил больше\nчем кто-либо.',
    vs_least: 'Ты отправил меньше\nчем кто-либо.',
    vs_middle: 'Ты отправил больше чем\n{beat} из {others}.',
    vs_alone: 'Тут только ты.',
    vs_ranked: '{msgs} сооб · #{rank} из {total}',
    vs_fastest: 'САМЫЙ БЫСТРЫЙ',
    vs_avg_s: '{s}с ср',
    vs_avg_m: '{m}м ср',
    vs_avg_h: '{h}ч ср',
    title_eyebrow: '✦ ТЕБЯ ЗОВУТ',
    title_based_on: 'НА ОСНОВЕ',
    descr_eyebrow: 'ГРУППА ОПИСАЛА БЫ ТЕБЯ КАК',
    descr_footnote: 'Они не сказали вслух. Но данные говорят.',
    peak_eyebrow: 'ТВОЙ ЧАС',
    peak_3am: 'Реально тревожно.',
    peak_morning: 'Настоящий жаворонок.',
    peak_midday: 'Пишешь на работе. Смело.',
    peak_evening: 'Чемпион вечерних сообщений.',
    peak_late: 'Ночной философ.',
    night_eyebrow: 'МЕЖДУ ПОЛУНОЧЬЮ И 6 УТРА',
    night_of_msgs: 'твоих сообщений.',
    night_diag_strong: 'Диагноз: сертифицированное ночное создание.',
    night_diag_med: 'Ты не спишь дольше, чем думаешь.',
    night_diag_low: 'Здоровый режим, в основном.',
    night_diag_none: 'Ты выходишь. Уважение.',
    night_owl: '✦ #1 НОЧНАЯ СОВА',
    night_count: '{night} из твоих {total}',
    streak_eyebrow: 'ТВОЯ САМАЯ ДЛИННАЯ СЕРИЯ',
    streak_day: 'день',
    streak_days: 'дней подряд.',
    speed_eyebrow: 'ВРЕМЯ ОТВЕТА',
    speed_faster: 'Быстрее чем',
    speed_of_group: 'группы.',
    speed_based: 'НА ОСНОВЕ {n} ОТВЕТОВ',
    word_eyebrow: 'ТВОЁ ФИРМЕННОЕ СЛОВО',
    word_used: 'Использовано {n} раз.',
    top_words_eyebrow: 'СЛОВАРЬ ГРУППЫ',
    top_words_title: 'Слова,',
    top_words_subtitle: 'которые вы все повторяли',
    emoji_eyebrow: 'ЛЮБИМЫЙ ЭМОДЗИ',
    emoji_used: 'Использован {n} раз.',
    drama_eyebrow: '✦ ТВОЯ РОЛЬ В ДРАМЕ',
    drama_defib: 'Дефибриллятор',
    drama_defib_label: 'мёртвых чатов оживлено',
    drama_defib_copy: 'Когда группа замолчала, ты её вернул.',
    drama_killer: 'Убийца Разговоров',
    drama_killer_label: 'чатов умерло на тебе',
    drama_killer_copy: 'Когда ты говорил, никому нечего было добавить. Подозрительно.',
    drama_replied: 'Все Тебе Отвечают',
    drama_replied_label: '% твоих сооб получили ответ за 30 мин',
    drama_replied_copy: 'Когда ты говоришь, группа слушает.',
    drama_ignored: 'Онлайн, Но Игнорируют',
    drama_ignored_label: '% твоих сооб без ответа',
    drama_ignored_copy: 'Это не ты. Это они. Скорее всего.',
    drama_steady: 'Стабильно В Деле',
    drama_steady_label: 'дней ты закрывал чат',
    drama_steady_copy: 'Закрывал чат много раз. Просто присутствие.',
    roast_eyebrow_mild: '✦ МЯГКИЕ ЗАМЕЧАНИЯ',
    roast_eyebrow_med: '✦ ЧИТАЕМ ТЕБЯ НАСКВОЗЬ',
    roast_eyebrow_spicy: '🔥 БЕЗ ПОЩАДЫ',
    roast_heading_mild: 'Несколько мягких заметок.',
    roast_heading_med: 'Несколько наблюдений.',
    roast_heading_spicy: 'Без пощады. Держись.',
    roast_more: '+{n} ЕЩЁ В ROAST MODE →',
    ach_eyebrow: '✦ ДОСТИЖЕНИЯ ОТКРЫТЫ',
    ach_earned: 'Ты получил',
    ach_badges: 'значок',
    ach_badges_plural: 'значков',
    ach_more: '+{n} ЕЩЁ',
    likely_eyebrow: '✦ СКОРЕЕ ВСЕГО',
    likely_title: 'Вердикты',
    likely_verdicts: 'группы.',
    likely_label: 'СКОРЕЕ ВСЕГО',
    likely_to_text_3am: 'пишут в 3 утра',
    likely_to_burst: 'отправят 10 сообщений подряд',
    likely_to_reply_fast: 'ответят за минуту',
    likely_to_disappear: 'пропадают на недели',
    likely_to_kill: 'убьют разговор',
    likely_to_revive: 'оживят чат',
    duo_eyebrow: '✦ ТОП ДУЭТ',
    duo_traded: 'обменялись',
    duo_replies_between: 'ответами между собой.',
    duo_in_with: 'Ты и {partner} — соведущие чата.',
    duo_share: '{pct}% всего обмена в группе.',
    eras_eyebrow: '✦ ТВОИ ЭРЫ',
    eras_title: 'Главы',
    eras_subtitle: 'этого чата.',
    eras_chapter: 'ГЛАВА',
    eras_msgs: 'сооб',
    eras_per_day: '{n}/день',
    chaos_eyebrow: '✦ МОМЕНТ КОГДА СЛОМАЛОСЬ',
    chaos_at: 'в {time}.',
    chaos_msgs_minute: 'сообщений за минуту.',
    chaos_lost_control: 'Группа потеряла контроль.',
    persona_eyebrow: '✦ ДИАГНОЗ',
    persona_this_group: 'Эта группа —',
    persona_evidence: 'ДОКАЗАТЕЛЬСТВО',
    awards_eyebrow: '✦ ЦЕРЕМОНИЯ НАГРАЖДЕНИЯ',
    awards_title: 'И победители',
    awards_are: '…',
    awards_fastest: 'Самые Быстрые Пальцы',
    awards_fastest_sub: '{m}м ср ответ',
    awards_yapper: 'Главный Болтун',
    awards_yapper_sub: '{n} сообщений',
    awards_nightowl: 'Опаснее Всех После Полуночи',
    awards_nightowl_sub: '{pct}% после полуночи',
    awards_ghost: 'Возвращение Призрака',
    awards_ghost_sub: 'отсутствие {n} дней',
    awards_killer: 'Убийца Разговоров',
    awards_killer_sub: '{n} чатов умерло на них',
    awards_defib: 'Дефибриллятор',
    awards_defib_sub: 'оживил {n} мёртвых чатов',
    peakday_eyebrow: 'САМЫЙ ДИКИЙ ДЕНЬ',
    peakday_msgs: 'сообщений за день.',
    finale_eyebrow: '✦ ЭТО ВСЁ',
    finale_see: 'Увидимся',
    finale_in_the: 'в',
    finale_chat: 'групповом чате.',
    finale_now: 'Теперь спроси друзей, что у них получилось.',
    finale_explore: 'Исследовать данные →',
    menu_replay: 'ПОВТОР',
    menu_watch: 'Смотреть\nещё раз →',
    menu_roast_mode: 'ROAST MODE',
    menu_roast_everyone: 'Прожарить\nвсех →',
    menu_viewing_as: 'СМОТРИШЬ КАК',
    menu_switch: 'СМЕНИТЬ →',
    menu_verified: '✓ ДАННЫЕ ПОДТВЕРЖДЕНЫ · {n}%',
    menu_msgs_senders: '{msgs} сооб · {senders} отправителей',
    menu_verify: 'ПРОВЕРИТЬ →',
    menu_this_group_is: '✦ ЭТА ГРУППА —',
    menu_eras: 'ЭРЫ',
    menu_highlights: 'ТВОИ МОМЕНТЫ',
    menu_badges: 'ТВОИ ЗНАЧКИ',
    menu_leaderboard: 'ПОЛНАЯ ТАБЛИЦА',
    menu_hl_messages: 'сообщений',
    menu_hl_of: 'из {n}',
    menu_hl_peak_hour: 'пиковый час',
    menu_hl_at_night: 'ночью',
    menu_hl_streak: 'серия',
    menu_hl_top_emoji: 'топ эмодзи',
    menu_hl_top_word: 'топ слово',
    menu_hl_avg_reply: 'ср ответ',
    rm_back: '← Назад',
    rm_title: '🔥 ROAST MODE',
    rm_pick: 'Выбери',
    rm_victim: 'жертву.',
    rm_sub: 'Каждый roast основан на реальных числах. Без пощады. Нажми имя.',
    rm_now: 'ПРОЖАРИВАЕМ',
    rm_roast: 'ROAST',
    rm_hot_take: 'ГОРЯЧЕЕ МНЕНИЕ',
    rm_screenshot: 'Сделай скриншот\nи отправь {name}.',
    rm_others: 'ДРУГИЕ ЖЕРТВЫ',
    rm_ready: '{n} roast готов',
    rm_ready_plural: '{n} roasts готовы',
    rm_btn: 'ROAST →',
    rm_language: 'Язык',
    rm_switch_person: 'Сменить человека',
    verify_back: '← Назад',
    verify_title: 'Выглядит',
    verify_right: 'правильно',
    verify_sub: 'Числа из файла. Если что-то не так — Сброс. Если совпадает — продолжить.',
    verify_continue: 'Выглядит правильно · Продолжить к Wrapped →',
    verify_wrong: 'ЧИСЛА НЕВЕРНЫ · ЗАГРУЗИТЬ СНОВА',
    verify_reset: 'СБРОС',
  },
  ar: {
    landing_eyebrow: 'جديد · WHATSAPP UNWRAPPED',
    landing_h1_a: 'سنة',
    landing_h1_b: 'دردشتك',
    landing_h1_c: 'على وشك',
    landing_h1_d: 'أن',
    landing_h1_e: 'تنكشف.',
    landing_sub: 'حقب. جوائز. دراما. ملخص سينمائي من رسائلك الحقيقية. لا شيء يغادر هاتفك.',
    cta_play: 'شغّل الـ Wrapped ←',
    cta_demo: 'أو شاهد العرض ←',
    privacy_note: 'يُعالَج بالكامل على جهازك',
    err_format: 'حمّل ملف .txt أو .zip من تصدير واتساب.',
    err_no_msgs: 'لم يُعثر على رسائل. التنسيق غير مدعوم.',
    onboard_skip: 'تخطّى',
    onboard_continue: 'متابعة ←',
    onboard_done: 'شاهد الـ Wrapped ←',
    onboard_title: 'أسئلة سريعة',
    onboard_sub: 'بضع ثوانٍ. تجعل الـ Wrapped أدق بـ 10 مرات.',
    q_who_are_you: 'ما اسمك في هذه الدردشة؟',
    q_who_are_you_hint: 'اختر نفسك',
    q_relationship: 'ما نوع هذه الدردشة؟',
    q_relationship_friends: 'أصدقاء',
    q_relationship_family: 'عائلة',
    q_relationship_work: 'عمل',
    q_relationship_couple: 'نحن الاثنان فقط',
    q_relationship_other: 'أخرى',
    q_tone: 'كم تريد الرَّوست حادّاً؟',
    q_tone_mild: 'لطيف',
    q_tone_mild_d: 'بلطف',
    q_tone_medium: 'صريح',
    q_tone_medium_d: 'حقيقي وعادل',
    q_tone_spicy: 'وحشي',
    q_tone_spicy_d: 'بلا رحمة',
    q_lang_q: 'بأي لغة الدردشة بشكل رئيسي؟',
    parsing_msg_parsed: 'الرسائل المُحلَّلة',
    parsing_label_open: 'فتح الملف',
    parsing_label_unzip: 'فك الضغط',
    parsing_label_read: 'قراءة كل سطر',
    parsing_label_analyze: 'تحليل الفوضى',
    parsing_label_build: 'بناء قصتك',
    parsing_detail_open: 'قراءة البايتات',
    parsing_detail_unzip: 'فك ضغط ZIP واتساب',
    parsing_detail_read: 'تحليل الطوابع الزمنية',
    parsing_detail_analyze: 'كشف الدراما والحقب والذروات',
    parsing_detail_build: 'اقتربنا…',
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'استعد.',
    intro_ready: '',
    intro_summary: '{msgs} رسالة. {people} أشخاص. {days} يوم. قصة واحدة.',
    msg_eyebrow: 'هذا العام أرسلت المجموعة',
    msg_word: 'رسالة.',
    msg_your_share: 'حصتك',
    rank_eyebrow: '✦ لوحة المتصدرين',
    rank_finished: 'انتهيت في المركز',
    rank_of: 'من {n}.',
    rank_you: '(أنت)',
    vs_eyebrow: 'أنت ضد الجميع',
    vs_outsent_all: 'أرسلت أكثر\nمن أي شخص آخر.',
    vs_least: 'أرسلت أقل\nمن الجميع.',
    vs_middle: 'أرسلت أكثر من\n{beat} من {others}.',
    vs_alone: 'أنت وحدك هنا.',
    vs_ranked: '{msgs} رسالة · #{rank} من {total}',
    vs_fastest: 'الأسرع',
    vs_avg_s: '{s}ث متوسط',
    vs_avg_m: '{m}د متوسط',
    vs_avg_h: '{h}س متوسط',
    title_eyebrow: '✦ يسمونك',
    title_based_on: 'بناءً على',
    descr_eyebrow: 'المجموعة تصفك بأنك',
    descr_footnote: 'لم يقولوها بصوت عال. لكن البيانات قالت.',
    peak_eyebrow: 'ساعتك',
    peak_3am: 'مقلق فعلاً.',
    peak_morning: 'شخص صباحي حقيقي.',
    peak_midday: 'تراسل في العمل. جريء.',
    peak_evening: 'بطل المراسلة بعد العمل.',
    peak_late: 'فيلسوف ليلي.',
    night_eyebrow: 'بين منتصف الليل و6 صباحاً',
    night_of_msgs: 'من رسائلك.',
    night_diag_strong: 'التشخيص: مخلوق ليلي معتمد.',
    night_diag_med: 'أنت مستيقظ أكثر مما تظن.',
    night_diag_low: 'نوم صحي، في الغالب.',
    night_diag_none: 'تسجل الخروج. احترام.',
    night_owl: '✦ بومة الليل #1',
    night_count: '{night} من {total}',
    streak_eyebrow: 'أطول سلسلة لك',
    streak_day: 'يوم',
    streak_days: 'أيام متتالية.',
    speed_eyebrow: 'سرعة الرد',
    speed_faster: 'أسرع من',
    speed_of_group: 'من المجموعة.',
    speed_based: 'بناءً على {n} رد',
    word_eyebrow: 'كلمتك المميزة',
    word_used: 'استخدمت {n} مرة.',
    top_words_eyebrow: 'مفردات المجموعة',
    top_words_title: 'الكلمات',
    top_words_subtitle: 'التي ظل الجميع يكررها',
    emoji_eyebrow: 'الإيموجي الأكثر استخداماً',
    emoji_used: 'استخدم {n} مرة.',
    drama_eyebrow: '✦ دورك في الدراما',
    drama_defib: 'المُنعش',
    drama_defib_label: 'محادثات أحييتها',
    drama_defib_copy: 'عندما صمتت المجموعة، أعدتها للحياة.',
    drama_killer: 'قاتل المحادثات',
    drama_killer_label: 'محادثات انتهت عندك',
    drama_killer_copy: 'عندما تتحدث، لا أحد لديه ما يضيفه. مشبوه.',
    drama_replied: 'الجميع يردون عليك',
    drama_replied_label: '% من رسائلك تلقت رد خلال 30 دقيقة',
    drama_replied_copy: 'عندما تتحدث، المجموعة تستمع.',
    drama_ignored: 'متصل لكن متجاهل',
    drama_ignored_label: '% من رسائلك بدون رد',
    drama_ignored_copy: 'ليس أنت. بل هم. على الأرجح.',
    drama_steady: 'ثابت في المزيج',
    drama_steady_label: 'أيام أنهيت فيها المحادثة',
    drama_steady_copy: 'أنهيت المحادثة كثيراً. حاضر فقط.',
    roast_eyebrow_mild: '✦ ملاحظات لطيفة',
    roast_eyebrow_med: '✦ نكشفك بالكامل',
    roast_eyebrow_spicy: '🔥 بلا رحمة',
    roast_heading_mild: 'ملاحظات قليلة لطيفة.',
    roast_heading_med: 'بعض الملاحظات.',
    roast_heading_spicy: 'بلا رحمة. استعد.',
    roast_more: '+{n} المزيد في ROAST MODE →',
    ach_eyebrow: '✦ إنجازات مفتوحة',
    ach_earned: 'حصلت على',
    ach_badges: 'شارة',
    ach_badges_plural: 'شارات',
    ach_more: '+{n} المزيد',
    likely_eyebrow: '✦ الأكثر احتمالاً',
    likely_title: 'أحكام',
    likely_verdicts: 'المجموعة.',
    likely_label: 'الأكثر احتمالاً',
    likely_to_text_3am: 'يراسل الساعة 3 صباحاً',
    likely_to_burst: 'يرسل 10 رسائل متتالية',
    likely_to_reply_fast: 'يرد في أقل من دقيقة',
    likely_to_disappear: 'يختفي لأسابيع',
    likely_to_kill: 'يقتل المحادثة',
    likely_to_revive: 'يعيد المحادثة للحياة',
    duo_eyebrow: '✦ الثنائي الأول',
    duo_traded: 'تبادلا',
    duo_replies_between: 'رد بينهما.',
    duo_in_with: 'أنت و{partner} مضيفان مشاركان للمجموعة.',
    duo_share: '{pct}% من كل التبادل في المجموعة.',
    eras_eyebrow: '✦ عصورك',
    eras_title: 'فصول',
    eras_subtitle: 'هذه المحادثة.',
    eras_chapter: 'الفصل',
    eras_msgs: 'رسائل',
    eras_per_day: '{n}/يوم',
    chaos_eyebrow: '✦ لحظة الانفجار',
    chaos_at: 'في {time}.',
    chaos_msgs_minute: 'رسالة في دقيقة واحدة.',
    chaos_lost_control: 'فقدت المجموعة السيطرة.',
    persona_eyebrow: '✦ التشخيص',
    persona_this_group: 'هذه المجموعة…',
    persona_evidence: 'الدليل',
    awards_eyebrow: '✦ حفل الجوائز',
    awards_title: 'والفائزون',
    awards_are: 'هم…',
    awards_fastest: 'أسرع الأصابع',
    awards_fastest_sub: '{m}د متوسط الرد',
    awards_yapper: 'الأكثر ثرثرة',
    awards_yapper_sub: '{n} رسالة',
    awards_nightowl: 'الأخطر بعد منتصف الليل',
    awards_nightowl_sub: '{pct}% بعد منتصف الليل',
    awards_ghost: 'عودة الشبح',
    awards_ghost_sub: 'غياب {n} يوم',
    awards_killer: 'قاتل المحادثات',
    awards_killer_sub: '{n} محادثة انتهت عندهم',
    awards_defib: 'المُنعش',
    awards_defib_sub: 'أحيا {n} محادثة',
    peakday_eyebrow: 'اليوم الأكثر جنوناً',
    peakday_msgs: 'رسالة في يوم واحد.',
    finale_eyebrow: '✦ انتهى',
    finale_see: 'أراك',
    finale_in_the: 'في',
    finale_chat: 'محادثة المجموعة.',
    finale_now: 'الآن اسأل أصدقاءك عما حصلوا عليه.',
    finale_explore: 'استكشف البيانات →',
    menu_replay: 'إعادة',
    menu_watch: 'مشاهدة\nمرة أخرى →',
    menu_roast_mode: 'ROAST MODE',
    menu_roast_everyone: 'حرق\nالجميع →',
    menu_viewing_as: 'تشاهد كـ',
    menu_switch: 'تبديل →',
    menu_verified: '✓ بيانات موثقة · {n}%',
    menu_msgs_senders: '{msgs} رسالة · {senders} مرسل',
    menu_verify: 'تحقق →',
    menu_this_group_is: '✦ هذه المجموعة',
    menu_eras: 'العصور',
    menu_highlights: 'أبرز لحظاتك',
    menu_badges: 'شاراتك',
    menu_leaderboard: 'الترتيب الكامل',
    menu_hl_messages: 'رسائل',
    menu_hl_of: 'من {n}',
    menu_hl_peak_hour: 'ساعة الذروة',
    menu_hl_at_night: 'ليلاً',
    menu_hl_streak: 'سلسلة',
    menu_hl_top_emoji: 'أفضل إيموجي',
    menu_hl_top_word: 'أفضل كلمة',
    menu_hl_avg_reply: 'متوسط الرد',
    rm_back: '→ عودة',
    rm_title: '🔥 ROAST MODE',
    rm_pick: 'اختر',
    rm_victim: 'ضحية.',
    rm_sub: 'كل roast مبني على أرقام حقيقية. بلا رحمة. اضغط اسم للتبديل.',
    rm_now: 'الآن يُحرق',
    rm_roast: 'ROAST',
    rm_hot_take: 'رأي حار',
    rm_screenshot: 'الآن خذ لقطة شاشة\nوأرسلها إلى {name}.',
    rm_others: 'ضحايا أخرى',
    rm_ready: '{n} roast جاهز',
    rm_ready_plural: '{n} roast جاهز',
    rm_btn: 'ROAST →',
    rm_language: 'اللغة',
    rm_switch_person: 'تبديل الشخص',
    verify_back: '→ عودة',
    verify_title: 'هل يبدو هذا',
    verify_right: 'صحيحاً',
    verify_sub: 'الأرقام محسوبة من الملف. إذا بدا شيء خاطئ، اضغط إعادة تعيين. إذا تطابق، تابع إلى Wrapped.',
    verify_continue: 'يبدو صحيحاً · المتابعة إلى Wrapped →',
    verify_wrong: 'الأرقام خاطئة · ارفع مرة أخرى',
    verify_reset: 'إعادة تعيين',
  },
  tr: {
    landing_eyebrow: 'YENİ · WHATSAPP UNWRAPPED',
    landing_h1_a: 'Grup',
    landing_h1_b: 'sohbetinin',
    landing_h1_c: 'yılı açıklan-',
    landing_h1_d: 'mak',
    landing_h1_e: 'üzere.',
    landing_sub: 'Çağlar. Ödüller. Drama. Gerçek mesajlarından sinematik bir özet. Hiçbir şey telefonundan çıkmıyor.',
    cta_play: 'Wrapped\'imi aç →',
    cta_demo: 'YA DA DEMOYU İZLE →',
    privacy_note: 'TAMAMEN CİHAZINDA İŞLENİR',
    err_format: 'WhatsApp dışa aktarımından .txt veya .zip yükle.',
    err_no_msgs: 'Mesaj bulunamadı. Format desteklenmiyor.',
    onboard_skip: 'Atla',
    onboard_continue: 'Devam →',
    onboard_done: 'Wrapped\'i gör →',
    onboard_title: 'Hızlı sorular',
    onboard_sub: 'Birkaç saniye. Wrapped\'i 10x daha doğru yapar.',
    q_who_are_you: 'Bu sohbette adın ne?',
    q_who_are_you_hint: 'Kendini seç',
    q_relationship: 'Bu nasıl bir sohbet?',
    q_relationship_friends: 'Arkadaşlar',
    q_relationship_family: 'Aile',
    q_relationship_work: 'İş',
    q_relationship_couple: 'Sadece ikimiz',
    q_relationship_other: 'Diğer',
    q_tone: 'Roastlar ne kadar acı olsun?',
    q_tone_mild: 'Yumuşak',
    q_tone_mild_d: 'Nazik ol',
    q_tone_medium: 'Dürüst',
    q_tone_medium_d: 'Gerçek ama adil',
    q_tone_spicy: 'Acımasız',
    q_tone_spicy_d: 'Merhamet yok',
    q_lang_q: 'Sohbet ağırlıklı olarak hangi dilde?',
    parsing_msg_parsed: 'MESAJLAR İŞLENDİ',
    parsing_label_open: 'Dosya açılıyor',
    parsing_label_unzip: 'Arşiv açılıyor',
    parsing_label_read: 'Her satır okunuyor',
    parsing_label_analyze: 'Kaos analiz ediliyor',
    parsing_label_build: 'Hikayen oluşturuluyor',
    parsing_detail_open: 'Bayt okunuyor',
    parsing_detail_unzip: 'WhatsApp ZIP açılıyor',
    parsing_detail_read: 'Zaman damgaları ayrıştırılıyor',
    parsing_detail_analyze: 'Drama, çağ, zirve tespiti',
    parsing_detail_build: 'Neredeyse bitti…',
    intro_eyebrow: 'CHATWRAPPED',
    intro_get: 'Hazır',
    intro_ready: 'ol.',
    intro_summary: '{msgs} mesaj. {people} kişi. {days} gün. Tek hikaye.',
    msg_eyebrow: 'BU YIL GRUP GÖNDERDİ',
    msg_word: 'mesaj.',
    msg_your_share: 'SENİN PAYIN',
    rank_eyebrow: '✦ LİDER TABLOSU',
    rank_finished: 'Bitirdiğin sıra',
    rank_of: '{n} kişiden.',
    rank_you: '(sen)',
    vs_eyebrow: 'SEN VS HERKES',
    vs_outsent_all: 'Herkesten\ndaha çok gönderdin.',
    vs_least: 'Herkesten\ndaha az gönderdin.',
    vs_middle: 'Senden daha çok\n{others} kişiden {beat}.',
    vs_alone: 'Burada yalnızsın.',
    vs_ranked: '{msgs} msj · #{rank}/{total}',
    vs_fastest: 'EN HIZLI',
    vs_avg_s: '{s}sn ort',
    vs_avg_m: '{m}dk ort',
    vs_avg_h: '{h}s ort',
    title_eyebrow: '✦ SANA DİYORLAR',
    title_based_on: 'TEMEL ALAN',
    descr_eyebrow: 'GRUP SENİ ŞÖYLE TARİF EDERDİ',
    descr_footnote: 'Yüksek sesle söylemediler. Ama veri söyledi.',
    peak_eyebrow: 'SENİN SAATİN',
    peak_3am: 'Gerçekten endişe verici.',
    peak_morning: 'Gerçek bir sabahçı.',
    peak_midday: 'İşte mesajlaşıyorsun. Cesur.',
    peak_evening: 'İş sonrası mesaj şampiyonu.',
    peak_late: 'Gece filozofu davranışı.',
    night_eyebrow: 'GECE YARISI - 06:00 ARASI',
    night_of_msgs: 'mesajının.',
    night_diag_strong: 'Teşhis: sertifikalı gece yaratığı.',
    night_diag_med: 'Sandığından geç uyanıksın.',
    night_diag_low: 'Sağlıklı uyku düzeni, çoğunlukla.',
    night_diag_none: 'Çıkış yapıyorsun. Saygılar.',
    night_owl: '✦ #1 GECE KUŞU',
    night_count: '{total} mesajından {night}',
    streak_eyebrow: 'EN UZUN SERİN',
    streak_day: 'gün',
    streak_days: 'gün üst üste.',
    speed_eyebrow: 'YANIT HIZI',
    speed_faster: 'Daha hızlı',
    speed_of_group: 'gruptan.',
    speed_based: '{n} YANIT TEMEL ALINDI',
    word_eyebrow: 'İMZA KELİMEN',
    word_used: '{n} kez kullanıldı.',
    top_words_eyebrow: 'GRUBUN KELİME DAĞARCIĞI',
    top_words_title: 'Hepinizin',
    top_words_subtitle: 'tekrarladığı kelimeler',
    emoji_eyebrow: 'EN ÇOK KULLANILAN EMOJİ',
    emoji_used: '{n} kez kullanıldı.',
    drama_eyebrow: '✦ DRAMADAKİ ROLÜN',
    drama_defib: 'Defibrilatör',
    drama_defib_label: 'ölü sohbet canlandırıldı',
    drama_defib_copy: 'Grup sustuğunda, sen geri getirdin.',
    drama_killer: 'Sohbet Katili',
    drama_killer_label: 'sohbet sende bitti',
    drama_killer_copy: 'Konuştuğunda kimsenin ekleyecek bir şeyi yoktu. Şüpheli.',
    drama_replied: 'Herkes Sana Yanıt Veriyor',
    drama_replied_label: '% msj 30 dk içinde yanıt aldı',
    drama_replied_copy: 'Konuştuğunda grup dinler.',
    drama_ignored: 'Çevrimiçi Ama Görmezden Gelinen',
    drama_ignored_label: '% msj yanıtsız',
    drama_ignored_copy: 'Sen değilsin. Onlar. Muhtemelen.',
    drama_steady: 'İstikrarlı',
    drama_steady_label: 'gün sohbeti sen kapattın',
    drama_steady_copy: 'Sohbeti çokça kapattın. Sadece varlık.',
    roast_eyebrow_mild: '✦ HAFİF YORUMLAR',
    roast_eyebrow_med: '✦ SENİ ÇÖZÜYORUZ',
    roast_eyebrow_spicy: '🔥 MERHAMET YOK',
    roast_heading_mild: 'Birkaç nazik not.',
    roast_heading_med: 'Birkaç gözlem.',
    roast_heading_spicy: 'Merhamet yok. Sıkı dur.',
    roast_more: '+{n} DAHA ROAST MODE\'DA →',
    ach_eyebrow: '✦ BAŞARILAR AÇILDI',
    ach_earned: 'Kazandın',
    ach_badges: 'rozet',
    ach_badges_plural: 'rozet',
    ach_more: '+{n} DAHA',
    likely_eyebrow: '✦ EN MUHTEMEL',
    likely_title: 'Grubun',
    likely_verdicts: 'kararı.',
    likely_label: 'EN MUHTEMEL',
    likely_to_text_3am: 'gece 3\'te mesaj atan',
    likely_to_burst: 'arka arkaya 10 mesaj atan',
    likely_to_reply_fast: 'bir dakikada yanıt veren',
    likely_to_disappear: 'haftalarca kaybolan',
    likely_to_kill: 'sohbeti öldüren',
    likely_to_revive: 'sohbeti canlandıran',
    duo_eyebrow: '✦ EN İYİ İKİLİ',
    duo_traded: 'aralarında',
    duo_replies_between: 'yanıt değiştirdiler.',
    duo_in_with: 'Sen ve {partner} grubun ortak sunucularısınız.',
    duo_share: '{pct}% grup içi gidiş gelişin.',
    eras_eyebrow: '✦ ÇAĞLARIN',
    eras_title: 'Bölümler',
    eras_subtitle: 'bu sohbetin.',
    eras_chapter: 'BÖLÜM',
    eras_msgs: 'msj',
    eras_per_day: '{n}/gün',
    chaos_eyebrow: '✦ KIRILDIĞI AN',
    chaos_at: 'saat {time}.',
    chaos_msgs_minute: 'bir dakikada mesaj.',
    chaos_lost_control: 'Grup kontrolü kaybetti.',
    persona_eyebrow: '✦ TEŞHİS',
    persona_this_group: 'Bu grup bir…',
    persona_evidence: 'KANIT',
    awards_eyebrow: '✦ ÖDÜL TÖRENİ',
    awards_title: 'Ve kazananlar',
    awards_are: '…',
    awards_fastest: 'En Hızlı Parmaklar',
    awards_fastest_sub: '{m}dk ort yanıt',
    awards_yapper: 'En Büyük Geveze',
    awards_yapper_sub: '{n} mesaj',
    awards_nightowl: 'Gece Yarısından Sonra En Tehlikeli',
    awards_nightowl_sub: '{pct}% gece yarısı sonrası',
    awards_ghost: 'Hayaletin Dönüşü',
    awards_ghost_sub: '{n} günlük yokluk',
    awards_killer: 'Sohbet Katili',
    awards_killer_sub: '{n} sohbet onlarda bitti',
    awards_defib: 'Defibrilatör',
    awards_defib_sub: '{n} ölü sohbeti canlandırdı',
    peakday_eyebrow: 'EN ÇILGIN GÜN',
    peakday_msgs: 'bir günde mesaj.',
    finale_eyebrow: '✦ BU KADAR',
    finale_see: 'Görüşürüz',
    finale_in_the: '',
    finale_chat: 'grup sohbetinde.',
    finale_now: 'Şimdi arkadaşlarına ne çıktığını sor.',
    finale_explore: 'Verileri keşfet →',
    menu_replay: 'TEKRAR',
    menu_watch: 'Tekrar\nizle →',
    menu_roast_mode: 'ROAST MODE',
    menu_roast_everyone: 'Herkesi\nroast et →',
    menu_viewing_as: 'GÖRÜNÜM',
    menu_switch: 'DEĞİŞTİR →',
    menu_verified: '✓ DOĞRULANMIŞ VERİ · {n}%',
    menu_msgs_senders: '{msgs} msj · {senders} gönderen',
    menu_verify: 'DOĞRULA →',
    menu_this_group_is: '✦ BU GRUP BİR',
    menu_eras: 'ÇAĞLAR',
    menu_highlights: 'ÖNE ÇIKANLAR',
    menu_badges: 'ROZETLERİN',
    menu_leaderboard: 'TAM SIRALAMA',
    menu_hl_messages: 'mesaj',
    menu_hl_of: '{n} içinden',
    menu_hl_peak_hour: 'zirve saat',
    menu_hl_at_night: 'geceleyin',
    menu_hl_streak: 'seri',
    menu_hl_top_emoji: 'en sevdiğin emoji',
    menu_hl_top_word: 'en sevdiğin kelime',
    menu_hl_avg_reply: 'ort yanıt',
    rm_back: '← Geri',
    rm_title: '🔥 ROAST MODE',
    rm_pick: 'Bir kurban',
    rm_victim: 'seç.',
    rm_sub: 'Her roast gerçek sayılara dayanır. Merhamet yok. İsim seç.',
    rm_now: 'ŞİMDİ ROASTLANIYOR',
    rm_roast: 'ROAST',
    rm_hot_take: 'SICAK YORUM',
    rm_screenshot: 'Şimdi ekran görüntüsü al\nve {name}\'a gönder.',
    rm_others: 'DİĞER KURBANLAR',
    rm_ready: '{n} roast hazır',
    rm_ready_plural: '{n} roast hazır',
    rm_btn: 'ROAST →',
    rm_language: 'Dil',
    rm_switch_person: 'Kişi değiştir',
    verify_back: '← Geri',
    verify_title: 'Bu',
    verify_right: 'doğru',
    verify_sub: 'Sayılar dosyadan hesaplanır. Bir şey yanlış görünüyorsa Sıfırla. Eşleşiyorsa Wrapped\'a devam et.',
    verify_continue: 'Doğru görünüyor · Wrapped\'a devam →',
    verify_wrong: 'SAYILAR YANLIŞ · TEKRAR YÜKLE',
    verify_reset: 'SIFIRLA',
  },
};

function detectLang() {
  if (typeof navigator === 'undefined') return 'en';
  const browserLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return I18N[browserLang] ? browserLang : 'en';
}

// Build a translation object that falls back to English for any missing key
function buildT(lang) {
  return { ...I18N.en, ...(I18N[lang] || {}) };
}

// Simple {placeholder} interpolation
function interp(str, vars) {
  if (!str || !vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? vars[k] : `{${k}}`);
}

// Translate a user's title from their stored key + vars
function resolveTitle(u, t) {
  if (!u || !u.titleKey) return '';
  return t[u.titleKey] || u.titleKey;
}
function resolveTitleEvidence(u, t) {
  if (!u || !u.titleEvidenceKey) return '';
  return interp(t[u.titleEvidenceKey] || '', u.titleVars || {});
}

function ChatWrappedApp() {
  const [stage, setStage] = useState('landing');
  const [analytics, setAnalytics] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [parseError, setParseError] = useState(null);
  const [fileName, setFileName] = useState('');
  const [slide, setSlide] = useState(0);
  const [parsingStage, setParsingStage] = useState(0);
  const [lang, setLang] = useState(() => detectLang());
  const [profile, setProfile] = useState({
    relationship: null,
    tone: null,
    self: null,
  });
  const t = useMemo(() => buildT(lang), [lang]);
  const isRTL = RTL_LANGS.has(lang);

  const handleFile = useCallback(async (file) => {
    setFileName(file.name);
    setParseError(null);
    setStage('parsing');
    setParsingStage(0);
    try {
      let text;
      const lname = file.name.toLowerCase();
      if (lname.endsWith('.zip')) {
        setParsingStage(1);
        await new Promise(r => setTimeout(r, 400));
        text = await readZipText(file);
      } else if (lname.endsWith('.txt')) {
        text = await file.text();
      } else {
        throw new Error('Upload a .txt or .zip from WhatsApp export.');
      }
      setParsingStage(2);
      await new Promise(r => setTimeout(r, 500));
      const { messages: parsed, diagnostics: diag } = parseWhatsApp(text);
      setDiagnostics(diag);
      if (parsed.length === 0) {
        setParseError(t.err_no_msgs);
        setStage('landing');
        return;
      }
      setParsingStage(3);
      await new Promise(r => setTimeout(r, 600));
      const a = computeAll(parsed);
      setParsingStage(4);
      await new Promise(r => setTimeout(r, 400));
      setAnalytics(a);
      setSelectedAuthor(a.users[0].author);
      setSlide(0);
      setStage('onboard');
    } catch (e) {
      console.error(e);
      setParseError(e.message || t.err_format);
      setStage('landing');
    }
  }, [t]);

  const loadDemo = useCallback(async () => {
    setFileName('demo-chat.txt');
    setParseError(null);
    setStage('parsing');
    setParsingStage(0);
    await new Promise(r => setTimeout(r, 400));
    setParsingStage(2);
    const text = generateSampleText();
    const { messages: parsed, diagnostics: diag } = parseWhatsApp(text);
    setDiagnostics(diag);
    await new Promise(r => setTimeout(r, 600));
    setParsingStage(3);
    const a = computeAll(parsed);
    await new Promise(r => setTimeout(r, 500));
    setParsingStage(4);
    await new Promise(r => setTimeout(r, 400));
    setAnalytics(a);
    setSelectedAuthor(a.users[0].author);
    setSlide(0);
    setStage('onboard');
  }, []);

  const reset = () => {
    setAnalytics(null);
    setDiagnostics(null);
    setStage('landing');
    setParseError(null);
    setSlide(0);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 12,
      backgroundImage: 'radial-gradient(ellipse at top, #1a1228 0%, #050505 70%)',
    }}>
      <GlobalStyles />
      <div className="cw-frame" style={{
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        width: '100%', maxWidth: 380,
        height: 'min(820px, calc(100vh - 24px))',
        background: '#0a0a0f',
        borderRadius: 40,
        border: '1px solid #1a1a24',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px #0a0a10',
        color: '#f4f4f8',
        fontFamily: '"Inter Tight", "Comix CLM", -apple-system, sans-serif',
      }}>
        <StatusBar />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} dir={isRTL ? 'rtl' : 'ltr'}>
          {stage === 'landing' && (
            <Landing
              onFile={handleFile}
              onDemo={loadDemo}
              parseError={parseError}
              t={t}
              lang={lang}
              setLang={setLang}
            />
          )}
          {stage === 'parsing' && (
            <Parsing fileName={fileName} parsingStage={parsingStage} diagnostics={diagnostics} t={t} />
          )}
          {stage === 'onboard' && analytics && (
            <Onboarding
              analytics={analytics}
              t={t}
              profile={profile}
              setProfile={setProfile}
              onComplete={(finalProfile) => {
                setProfile(finalProfile);
                if (finalProfile.self && analytics.userMap[finalProfile.self]) {
                  setSelectedAuthor(finalProfile.self);
                }
                setStage('wrapped');
              }}
              onSkip={() => setStage('wrapped')}
            />
          )}
          {stage === 'verify' && diagnostics && analytics && (
            <VerifyView
              diagnostics={diagnostics}
              analytics={analytics}
              fileName={fileName}
              t={t}
              onContinue={() => setStage('wrapped')}
              onReset={reset}
            />
          )}
          {stage === 'wrapped' && analytics && (
            <Wrapped
              analytics={analytics}
              diagnostics={diagnostics}
              selectedAuthor={selectedAuthor}
              setSelectedAuthor={setSelectedAuthor}
              slide={slide}
              setSlide={setSlide}
              profile={profile}
              t={t}
              onExit={() => setStage('menu')}
            />
          )}
          {stage === 'menu' && analytics && (
            <PostMenu
              analytics={analytics}
              diagnostics={diagnostics}
              selectedAuthor={selectedAuthor}
              setSelectedAuthor={setSelectedAuthor}
              t={t}
              onReplay={() => { setSlide(0); setStage('wrapped'); }}
              onReset={reset}
              onDebug={() => setStage('verify')}
              onRoastMode={() => setStage('roastmode')}
            />
          )}
          {stage === 'roastmode' && analytics && (
            <RoastMode
              analytics={analytics}
              selectedAuthor={selectedAuthor}
              setSelectedAuthor={setSelectedAuthor}
              t={t}
              onBack={() => setStage('menu')}
            />
          )}
        </div>
        <HomeIndicator />
      </div>
    </div>
  );
}

// ============================================================
// GLOBAL STYLES
// ============================================================

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700;800;900&display=swap');
      @font-face {
        font-family: 'Rubik Black';
        src: url('/fonts/RubikBlack.ttf') format('truetype');
        font-weight: 900;
        font-style: normal;
        font-display: swap;
        unicode-range: U+0590-05FF, U+FB1D-FB4F, U+200F, U+200E;
      }
      @font-face {
        font-family: 'Comix CLM';
        src: url('/fonts/comixno2clm_medium-webfont.woff') format('woff'),
             url('/fonts/comixno2clm_medium-webfont.ttf') format('truetype');
        font-weight: 300 600;
        font-style: normal;
        font-display: swap;
        unicode-range: U+0590-05FF, U+FB1D-FB4F, U+200F, U+200E;
      }
      @font-face {
        font-family: 'Comix CLM';
        src: url('/fonts/comixno2clm_bold-webfont.woff') format('woff'),
             url('/fonts/comixno2clm_bold-webfont.ttf') format('truetype');
        font-weight: 700 900;
        font-style: normal;
        font-display: swap;
        unicode-range: U+0590-05FF, U+FB1D-FB4F, U+200F, U+200E;
      }
      .fs-display { font-family: 'Instrument Serif', 'Rubik Black', 'Comix CLM', serif; }
      .fs-mono { font-family: 'JetBrains Mono', 'Comix CLM', monospace; font-feature-settings: 'tnum' on; font-variant-numeric: tabular-nums; }
      .fs-sans { font-family: 'Inter Tight', 'Comix CLM', -apple-system, sans-serif; }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleSpring { 0% { opacity: 0; transform: scale(0.5); } 60% { transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      @keyframes slideRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes slideUpFar { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes spin360 { to { transform: rotate(360deg); } }
      @keyframes pulseGlow {
        0%, 100% { filter: drop-shadow(0 0 14px rgba(163,230,53,0.45)); }
        50% { filter: drop-shadow(0 0 30px rgba(163,230,53,0.9)); }
      }
      @keyframes floatUp {
        0% { opacity: 0; transform: translateY(20px) scale(0.6); }
        20% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
      }
      @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      @keyframes shineMove {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes shakeScreen {
        0%, 100% { transform: translate(0, 0); }
        10% { transform: translate(-3px, 1px); }
        20% { transform: translate(3px, -2px); }
        30% { transform: translate(-2px, 2px); }
        40% { transform: translate(2px, 1px); }
        50% { transform: translate(-1px, -1px); }
        60% { transform: translate(1px, 2px); }
        70% { transform: translate(-2px, 1px); }
        80% { transform: translate(2px, -1px); }
        90% { transform: translate(-1px, 1px); }
      }
      @keyframes notifRain {
        0% { opacity: 0; transform: translateY(-30px); }
        15% { opacity: 1; }
        85% { opacity: 1; }
        100% { opacity: 0; transform: translateY(280px); }
      }
      @keyframes orbit {
        0% { transform: rotate(0deg) translateX(60px) rotate(0deg); }
        100% { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
      }
      @keyframes ringPulse {
        0% { transform: scale(0.6); opacity: 0.8; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      @keyframes roastIn {
        0% { opacity: 0; transform: translateY(50px) scale(0.85) rotate(-2deg); }
        50% { transform: translateY(-6px) scale(1.04) rotate(1deg); }
        70% { transform: translateY(2px) scale(0.98) rotate(0deg); }
        100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
      }
      @keyframes gradientShift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      @keyframes wobble {
        0%, 100% { transform: rotate(-2deg); }
        50% { transform: rotate(2deg); }
      }
      @keyframes popIn {
        0% { opacity: 0; transform: scale(0.3); }
        70% { transform: scale(1.15); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes shimmerFlash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .a-fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .a-fade-in { animation: fadeIn 0.6s ease-out both; }
      .a-scale-in { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .a-spring { animation: scaleSpring 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      .a-slide-right { animation: slideRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .a-slide-up-far { animation: slideUpFar 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .a-spin { animation: spin360 0.8s linear infinite; }
      .a-pulse-glow { animation: pulseGlow 2.5s ease-in-out infinite; }
      .a-float { animation: floatUp 2.8s ease-out infinite; }
      .a-bar { animation: barGrow 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; transform-origin: bottom; }
      .a-shake { animation: shakeScreen 0.5s ease-in-out infinite; }
      .a-roast-card { animation: roastIn 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      .a-wobble { animation: wobble 3s ease-in-out infinite; }
      .a-pop-in { animation: popIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      .a-gradient-shift {
        background-size: 200% 200%;
        animation: gradientShift 6s ease-in-out infinite;
      }
      .a-shimmer-flash { animation: shimmerFlash 1.4s ease-in-out infinite; }
      .a-shine {
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
        background-size: 200% 100%;
        animation: shineMove 2.2s linear infinite;
      }
      .no-sb::-webkit-scrollbar { display: none; }
      .no-sb { scrollbar-width: none; }
      .press { transition: transform 0.1s; }
      .press:active { transform: scale(0.94); }
      .lift { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s; }
      .lift:active { transform: scale(0.97) translateY(2px); }
      .cw-frame * { box-sizing: border-box; }

      /* Keyboard focus indicator — does not appear on mouse/touch click. */
      .cw-frame :focus { outline: none; }
      .cw-frame :focus-visible {
        outline: 2px solid #a3e635;
        outline-offset: 2px;
        border-radius: 4px;
      }
      .cw-frame button:focus-visible,
      .cw-frame [role="button"]:focus-visible {
        outline: 2px solid #a3e635;
        outline-offset: 3px;
        box-shadow: 0 0 0 4px rgba(163,230,53,0.18);
      }

      /* Respect reduced-motion preference: stop infinite/decorative animations. */
      @media (prefers-reduced-motion: reduce) {
        .a-pulse-glow, .a-spin, .a-shine, .a-shimmer-flash,
        .a-gradient-shift, .a-shake, .a-wobble, .a-float {
          animation: none !important;
        }
        .a-fade-up, .a-fade-in, .a-scale-in, .a-spring,
        .a-slide-right, .a-slide-up-far, .a-bar,
        .a-pop-in, .a-roast-card {
          animation-duration: 0.001ms !important;
          animation-delay: 0ms !important;
        }
        * { transition-duration: 0.001ms !important; }
      }
    `}</style>
  );
}

function StatusBar() {
  return (
    <div className="fs-mono" style={{
      flexShrink: 0, position: 'relative', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', height: 40, fontSize: 22, fontWeight: 600, zIndex: 50,
    }}>
      <span>9:41</span>
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        top: 6, width: 90, height: 26, background: '#000', borderRadius: 999,
      }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="15" height="9" viewBox="0 0 16 10" fill="currentColor">
          <rect x="0" y="7" width="2.5" height="3" rx="0.5"/>
          <rect x="4" y="5" width="2.5" height="5" rx="0.5"/>
          <rect x="8" y="3" width="2.5" height="7" rx="0.5"/>
          <rect x="12" y="0.5" width="2.5" height="9.5" rx="0.5"/>
        </svg>
        <svg width="24" height="10" viewBox="0 0 26 11" fill="none">
          <rect x="0.5" y="0.5" width="22" height="10" rx="2.5" stroke="currentColor" opacity="0.5"/>
          <rect x="2" y="2" width="19" height="7" rx="1" fill="currentColor"/>
          <rect x="23" y="3.5" width="2" height="4" rx="1" fill="currentColor" opacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}

function HomeIndicator() {
  return (
    <div style={{
      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
      bottom: 6, width: 120, height: 4, background: '#fff', borderRadius: 999, zIndex: 50,
    }} />
  );
}

// ============================================================
// LANDING
// ============================================================

function Landing({ onFile, onDemo, parseError, t, lang, setLang }) {
  const fileInputRef = useRef(null);
  const [langOpen, setLangOpen] = useState(false);
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      padding: '20px 24px 28px', height: '100%',
    }}>
      <div className="a-pulse-glow" style={{
        position: 'absolute', top: 60, right: -60, width: 240, height: 240,
        borderRadius: '50%', background: '#a3e635', opacity: 0.20,
        filter: 'blur(70px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 100, left: -60, width: 220, height: 220,
        borderRadius: '50%', background: '#f472b6', opacity: 0.14,
        filter: 'blur(70px)', pointerEvents: 'none',
      }} />

      {/* Top row: eyebrow + language picker */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 20, color: '#a3e635', letterSpacing: '0.3em',
        }}>
          ✦ {t.landing_eyebrow}
        </div>
        <button onClick={() => setLangOpen(true)} className="press" aria-label={t.a11y_change_language || `Change language. Current: ${currentLang.name}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: 999,
          background: 'rgba(255,255,255,0.06)', border: '1px solid #2a2a36',
          color: '#f4f4f8', fontSize: 20, cursor: 'pointer',
        }}>
          {currentLang.flag}
        </button>
      </div>

      <div className="a-fade-up" style={{
        position: 'relative', zIndex: 10, flex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        animationDelay: '0.15s',
      }}>
        <h1 className="fs-display" style={{
          fontSize: 64, lineHeight: 0.92, letterSpacing: '-0.05em',
          fontWeight: 400, margin: '0 0 18px',
        }}>
          {t.landing_h1_a}<br/>
          <span style={{ fontStyle: 'italic', color: '#a3e635' }}>{t.landing_h1_b}</span><br/>
          {t.landing_h1_c}<br/>
          <span style={{ fontStyle: 'italic' }}>{t.landing_h1_d}</span>{t.landing_h1_e ? ' ' : ''}
          {t.landing_h1_e && <>{t.landing_h1_e}</>}
        </h1>
        <p style={{ fontSize: 22, lineHeight: 1.5, color: '#d0d0e0', margin: '14px 0 0', maxWidth: 280 }}>
          {t.landing_sub}
        </p>
      </div>

      {parseError && (
        <div role="alert" className="a-scale-in" style={{
          position: 'relative', zIndex: 10,
          display: 'flex', gap: 10, marginBottom: 12,
          background: '#ef444420', border: '1px solid #ef444470',
          borderRadius: 12, padding: 14,
        }}>
          <div style={{ flexShrink: 0, marginTop: 2, color: '#ff6b6b' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ fontSize: 23, lineHeight: 1.5, color: '#f4f4f8' }}>{parseError}</div>
        </div>
      )}

      <div className="a-fade-up" style={{ position: 'relative', zIndex: 10, animationDelay: '0.3s' }}>
        <input ref={fileInputRef} type="file" accept=".txt,.zip,application/zip,text/plain"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        <button onClick={() => fileInputRef.current?.click()} className="press lift a-gradient-shift" style={{
          width: '100%', position: 'relative', overflow: 'hidden',
          padding: 20, color: '#0a0a0f',
          background: 'linear-gradient(135deg, #a3e635 0%, #d4f04a 50%, #84cc16 100%)',
          backgroundSize: '200% 200%',
          border: 'none', borderRadius: 18, fontSize: 17, fontWeight: 800,
          cursor: 'pointer', letterSpacing: '-0.01em',
          boxShadow: '0 12px 32px rgba(163,230,53,0.45)',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          {t.cta_play}
        </button>
        <button onClick={onDemo} className="fs-mono press" style={{
          width: '100%', marginTop: 10, padding: 16, minHeight: 48,
          background: 'transparent', border: '1px solid #3a3a48',
          color: '#cfcfdc', borderRadius: 14, fontSize: 22,
          cursor: 'pointer', letterSpacing: '0.15em', fontWeight: 600,
        }}>
          {t.cta_demo}
        </button>

        <div className="fs-mono" style={{
          textAlign: 'center', marginTop: 16,
          fontSize: 20, color: '#c8c8dc', letterSpacing: '0.15em',
        }}>
          {t.privacy_note}
        </div>
      </div>

      {langOpen && (
        <BottomSheet onClose={() => setLangOpen(false)} title="Language">
          {LANGUAGES.map(l => (
            <button key={l.code} className="press" onClick={() => {
              setLang(l.code);
              setLangOpen(false);
            }} style={{
              width: '100%', padding: '16px 8px', minHeight: 56, background: 'transparent',
              border: 'none', borderBottom: '1px solid #2a2a36', color: '#f4f4f8',
              fontSize: 23, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{l.flag}</span>
                <span style={{ fontSize: 23, fontWeight: 600 }}>{l.name}</span>
              </div>
              {l.code === lang && (
                <span style={{ color: '#a3e635', fontSize: 18 }}>✓</span>
              )}
            </button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}

// ============================================================
// PARSING — dramatic loading
// ============================================================

function Parsing({ fileName, parsingStage, diagnostics, t }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 80);
    return () => clearInterval(id);
  }, []);
  const fakeCount = diagnostics?.parsedMessages
    ? Math.min(diagnostics.parsedMessages, Math.floor(tick * 47))
    : Math.floor(tick * 23);

  const stages = [
    { label: t.parsing_label_open, detail: t.parsing_detail_open },
    { label: t.parsing_label_unzip, detail: t.parsing_detail_unzip },
    { label: t.parsing_label_read, detail: t.parsing_detail_read },
    { label: t.parsing_label_analyze, detail: t.parsing_detail_analyze },
    { label: t.parsing_label_build, detail: t.parsing_detail_build },
  ];

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '32px 28px',
    }}>
      <div className="a-pulse-glow" style={{
        position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 320, height: 320, borderRadius: '50%',
        background: '#a3e635', opacity: 0.18, filter: 'blur(80px)',
      }} />

      <div style={{
        position: 'absolute', top: '40%', left: '50%', width: 1, height: 1, pointerEvents: 'none',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute', width: 8, height: 8,
            background: ['#a3e635', '#f472b6', '#60a5fa'][i],
            borderRadius: '50%',
            animation: `orbit ${4 + i}s linear infinite`,
            animationDelay: `${-i * 0.8}s`,
            filter: 'blur(1px)',
            boxShadow: `0 0 20px ${['#a3e635', '#f472b6', '#60a5fa'][i]}`,
          }} />
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#a3e635', letterSpacing: '0.3em' }}>
          ✦ {t.parsing_msg_parsed}
        </div>
        <div className="fs-mono a-fade-in" style={{
          fontSize: 21, color: '#c8c8dc', marginTop: 8, wordBreak: 'break-all',
          animationDelay: '0.2s',
        }}>
          {fileName}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
        <div className="fs-display a-spring a-pulse-glow" style={{
          fontSize: 96, lineHeight: 1, letterSpacing: '-0.05em', color: '#a3e635',
        }}>
          {fakeCount.toLocaleString()}
        </div>
        <div className="fs-mono" style={{
          fontSize: 21, color: '#d0d0e0', marginTop: 8, letterSpacing: '0.15em',
        }}>
          {t.parsing_msg_parsed}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        {stages.map((s, i) => {
          const active = i === parsingStage;
          const done = i < parsingStage;
          return (
            <div key={i} className="a-fade-up" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 0', opacity: done || active ? 1 : 0.3,
              animationDelay: `${i * 0.1}s`,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: done ? '#a3e635' : 'transparent',
                border: done ? 'none' : `2px solid ${active ? '#a3e635' : '#2a2a36'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f"
                    strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                {active && (
                  <div className="a-spin" style={{
                    position: 'absolute', inset: -2,
                    border: '2px solid transparent', borderTopColor: '#a3e635',
                    borderRadius: '50%',
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 23, fontWeight: active ? 700 : 500, color: done || active ? '#fff' : '#c8c8dc' }}>
                  {s.label}
                </div>
                {active && (
                  <div className="fs-mono a-fade-in" style={{
                    fontSize: 20, color: '#a3e635', marginTop: 2, letterSpacing: '0.1em',
                  }}>
                    {s.detail}…
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// WRAPPED — story player
// ============================================================

const SLIDES_DEF = [
  'intro',
  'message_count',
  'rank',
  'vs_everyone',
  'title',
  'group_describes',
  'peak_hour',
  'night',
  'streak',
  'speed',
  'signature_word',
  'top_words',
  'top_emoji',
  'drama_role',
  'roast',
  'achievements',
  'most_likely',
  'duo',
  'eras',
  'chaos_moment',
  'group_persona',
  'awards',
  'peak_day',
  'finale',
];

// ============================================================
// ONBOARDING — quick questions for personalized analysis
// ============================================================

function Onboarding({ analytics, t, profile, setProfile, onComplete, onSkip }) {
  const [step, setStep] = useState(0); // 0: who_are_you, 1: relationship, 2: tone
  const [draft, setDraft] = useState({
    self: profile.self || analytics.users[0]?.author || null,
    relationship: profile.relationship || null,
    tone: profile.tone || null,
  });

  const steps = [
    {
      key: 'self',
      question: t.q_who_are_you,
      hint: t.q_who_are_you_hint,
      type: 'people',
    },
    {
      key: 'relationship',
      question: t.q_relationship,
      type: 'choice',
      options: [
        { value: 'friends', label: t.q_relationship_friends, icon: '🍻' },
        { value: 'family', label: t.q_relationship_family, icon: '👨‍👩‍👧' },
        { value: 'work', label: t.q_relationship_work, icon: '💼' },
        { value: 'couple', label: t.q_relationship_couple, icon: '💕' },
        { value: 'other', label: t.q_relationship_other, icon: '✦' },
      ],
    },
    {
      key: 'tone',
      question: t.q_tone,
      type: 'tone',
      options: [
        { value: 'mild', label: t.q_tone_mild, desc: t.q_tone_mild_d, color: '#60a5fa', icon: '😊' },
        { value: 'medium', label: t.q_tone_medium, desc: t.q_tone_medium_d, color: '#a3e635', icon: '😏' },
        { value: 'spicy', label: t.q_tone_spicy, desc: t.q_tone_spicy_d, color: '#ef4444', icon: '🔥' },
      ],
    },
  ];

  const currentStep = steps[step];
  const currentValue = draft[currentStep.key];
  const canContinue = currentValue !== null;
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete(draft);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="no-sb" style={{
      position: 'relative', height: '100%', overflow: 'auto',
      background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #050507 70%)',
    }}>
      <div style={{ position: 'absolute', top: 60, right: -80, width: 220, height: 220,
        borderRadius: '50%', background: '#a3e635', opacity: 0.15, filter: 'blur(80px)',
        pointerEvents: 'none' }} />

      <div style={{
        position: 'relative', zIndex: 1, padding: '16px 22px 28px',
        minHeight: '100%', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header: skip + progress */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 28 : 8, height: 4, borderRadius: 999,
                background: i <= step ? '#a3e635' : 'rgba(255,255,255,0.18)',
                transition: 'width 0.35s, background 0.3s',
              }} />
            ))}
          </div>
          <button onClick={onSkip} className="fs-mono press" style={{
            background: 'transparent', border: 'none',
            color: '#b8b8c8', padding: '12px 10px', minHeight: 44,
            fontSize: 22, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.1em',
          }}>
            {t.onboard_skip}
          </button>
        </div>

        {/* Title */}
        <div className="a-fade-up" style={{ marginBottom: 6 }}>
          <div className="fs-display" style={{
            fontSize: 32, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 6,
          }}>
            {currentStep.question}
          </div>
          {currentStep.hint && (
            <div style={{ fontSize: 22, color: '#c8c8dc', marginTop: 4 }}>
              {currentStep.hint}
            </div>
          )}
        </div>

        {/* Body */}
        <div key={step} style={{ marginTop: 22, flex: 1 }}>
          {currentStep.type === 'people' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {analytics.users.map((u, i) => {
                const selected = draft.self === u.author;
                return (
                  <button key={u.author} onClick={() => setDraft({ ...draft, self: u.author })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'left',
                      padding: '14px 16px', cursor: 'pointer',
                      background: selected
                        ? 'linear-gradient(135deg, rgba(163,230,53,0.18), rgba(163,230,53,0.04))'
                        : '#15151d',
                      border: `1px solid ${selected ? '#a3e635' : '#2a2a36'}`,
                      borderRadius: 14, color: '#f4f4f8',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`,
                    }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 23, fontWeight: selected ? 800 : 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {u.author}
                      </div>
                      <div className="fs-mono" style={{
                        fontSize: 21, color: '#d8d8e8', marginTop: 3,
                      }}>
                        {u.messageCount.toLocaleString()} msgs · {u.sharePct.toFixed(0)}%
                      </div>
                    </div>
                    {selected && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#a3e635',
                        color: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {currentStep.type === 'choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentStep.options.map((opt, i) => {
                const selected = draft[currentStep.key] === opt.value;
                return (
                  <button key={opt.value} onClick={() => setDraft({ ...draft, [currentStep.key]: opt.value })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'left',
                      padding: '16px 18px', cursor: 'pointer',
                      background: selected
                        ? 'linear-gradient(135deg, rgba(163,230,53,0.18), rgba(163,230,53,0.04))'
                        : '#15151d',
                      border: `1px solid ${selected ? '#a3e635' : '#2a2a36'}`,
                      borderRadius: 14, color: '#f4f4f8',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both`,
                    }}>
                    <div style={{ fontSize: 26 }}>{opt.icon}</div>
                    <div style={{ flex: 1, fontSize: 16, fontWeight: selected ? 800 : 600 }}>
                      {opt.label}
                    </div>
                    {selected && (
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', background: '#a3e635',
                        color: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {currentStep.type === 'tone' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentStep.options.map((opt, i) => {
                const selected = draft.tone === opt.value;
                return (
                  <button key={opt.value} onClick={() => setDraft({ ...draft, tone: opt.value })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'left',
                      padding: '18px 20px', cursor: 'pointer',
                      background: selected
                        ? `linear-gradient(135deg, ${opt.color}28, ${opt.color}08)`
                        : '#15151d',
                      border: `1px solid ${selected ? opt.color : '#2a2a36'}`,
                      borderRadius: 16, color: '#f4f4f8',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both`,
                      boxShadow: selected ? `0 8px 24px ${opt.color}22` : 'none',
                    }}>
                    <div style={{ fontSize: 32, lineHeight: 1 }}>{opt.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div className="fs-display" style={{
                        fontSize: 22, lineHeight: 1, letterSpacing: '-0.02em',
                        fontStyle: selected ? 'italic' : 'normal',
                        color: selected ? opt.color : '#f4f4f8',
                      }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 22, color: '#dcdcec', marginTop: 5 }}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Continue CTA */}
        <button onClick={handleNext}
          disabled={!canContinue}
          aria-disabled={!canContinue}
          className="press lift a-gradient-shift" style={{
            width: '100%', marginTop: 22, position: 'relative', overflow: 'hidden',
            padding: 18, minHeight: 56,
            background: canContinue
              ? 'linear-gradient(135deg, #a3e635 0%, #d4f04a 50%, #84cc16 100%)'
              : '#3a3a48',
            backgroundSize: '200% 200%',
            color: canContinue ? '#0a0a0f' : '#d6d6e0',
            border: 'none', borderRadius: 16,
            fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            boxShadow: canContinue ? '0 12px 32px rgba(163,230,53,0.40)' : 'none',
          }}>
          {canContinue && <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />}
          {isLast ? t.onboard_done : t.onboard_continue}
        </button>
      </div>
    </div>
  );
}

function Wrapped({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, slide, setSlide, profile, t, onExit }) {
  const user = analytics.userMap[selectedAuthor];
  if (!user) return null;
  const userAchievements = analytics.achievementsByUser[selectedAuthor] || [];

  const slides = useMemo(() => SLIDES_DEF.filter(s => {
    if (s === 'achievements' && userAchievements.length === 0) return false;
    if (s === 'roast' && (!user.roasts || user.roasts.length === 0)) return false;
    // Work chats: hide roasts to stay professional
    if (s === 'roast' && profile?.relationship === 'work') return false;
    if (s === 'duo' && !analytics.topDuo) return false;
    if (s === 'eras' && (!analytics.eras || analytics.eras.length < 2)) return false;
    if (s === 'chaos_moment' && !analytics.chaosMinute) return false;
    if (s === 'speed' && user.avgRespMin == null) return false;
    if (s === 'top_emoji' && !user.topEmoji) return false;
    if (s === 'signature_word' && !user.topWord) return false;
    if (s === 'top_words' && (!analytics.topWordsGroup || analytics.topWordsGroup.length === 0)) return false;
    if (s === 'most_likely' && analytics.mostLikely.length === 0) return false;
    return true;
  }), [selectedAuthor, userAchievements.length, user, analytics, profile]);

  const total = slides.length;
  const current = slides[slide];

  useEffect(() => {
    if (slide >= total - 1) return;
    const id = setTimeout(() => {
      setSlide(s => Math.min(s + 1, total - 1));
    }, 6500);
    return () => clearTimeout(id);
  }, [slide, total, setSlide]);

  const next = () => setSlide(Math.min(slide + 1, total - 1));
  const prev = () => setSlide(Math.max(slide - 1, 0));

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Progress bars */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 12px 0', zIndex: 20 }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 2.5, borderRadius: 999,
            background: 'rgba(255,255,255,0.18)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: i < slide ? '100%' : i === slide ? '100%' : '0%',
              background: '#fff',
              transition: i === slide ? 'width 6.5s linear' : 'none',
            }} />
          </div>
        ))}
      </div>

      {/* Close */}
      <button onClick={onExit} className="press" aria-label={t.a11y_close || 'Close'} style={{
        position: 'absolute', top: 16, right: 8, zIndex: 5,
        background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)',
        color: '#fff', border: 'none', width: 44, height: 44,
        borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Tap zones — pure touch convenience, hidden from assistive tech */}
      <div onClick={prev} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 50, bottom: 50, width: '30%', zIndex: 4 }} />
      <div onClick={next} aria-hidden="true" style={{ position: 'absolute', right: 0, top: 50, bottom: 50, width: '70%', zIndex: 4 }} />

      {/* Slide */}
      <div key={`${current}-${selectedAuthor}`} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {current === 'intro' && <SlideIntro a={analytics} t={t} />}
        {current === 'message_count' && <SlideMessageCount a={analytics} u={user} t={t} />}
        {current === 'rank' && <SlideRank a={analytics} u={user} t={t} />}
        {current === 'vs_everyone' && <SlideVsEveryone a={analytics} u={user} t={t} />}
        {current === 'title' && <SlideTitle u={user} t={t} />}
        {current === 'group_describes' && <SlideGroupDescribes u={user} t={t} />}
        {current === 'peak_hour' && <SlidePeakHour a={analytics} u={user} t={t} />}
        {current === 'night' && <SlideNight a={analytics} u={user} t={t} />}
        {current === 'streak' && <SlideStreak u={user} t={t} />}
        {current === 'speed' && <SlideSpeed a={analytics} u={user} t={t} />}
        {current === 'signature_word' && <SlideWord u={user} t={t} />}
        {current === 'top_words' && <SlideTopWords a={analytics} t={t} />}
        {current === 'top_emoji' && <SlideEmoji a={analytics} u={user} t={t} />}
        {current === 'drama_role' && <SlideDramaRole u={user} t={t} />}
        {current === 'roast' && <SlideRoast u={user} profile={profile} t={t} />}
        {current === 'achievements' && <SlideAchievements achievements={userAchievements} t={t} />}
        {current === 'most_likely' && <SlideMostLikely a={analytics} t={t} />}
        {current === 'duo' && <SlideDuo a={analytics} u={user} t={t} />}
        {current === 'eras' && <SlideEras a={analytics} t={t} />}
        {current === 'chaos_moment' && <SlideChaosMoment a={analytics} t={t} />}
        {current === 'group_persona' && <SlideGroupPersona a={analytics} t={t} />}
        {current === 'awards' && <SlideAwards a={analytics} t={t} />}
        {current === 'peak_day' && <SlidePeakDay a={analytics} t={t} />}
        {current === 'finale' && <SlideFinale a={analytics} t={t} onExit={onExit} />}
      </div>
    </div>
  );
}

// ============================================================
// SLIDE SHELL
// ============================================================

function SlideShell({ children, bg, accent = '#a3e635', shake = false }) {
  return (
    <div className={shake ? 'a-shake' : ''} style={{
      position: 'absolute', inset: 0, overflow: 'hidden', background: bg,
    }}>
      <div style={{
        position: 'absolute', top: -80, right: -80, width: 280, height: 280,
        borderRadius: '50%', background: accent, opacity: 0.20,
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, left: -80, width: 240, height: 240,
        borderRadius: '50%', background: accent, opacity: 0.10,
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />
      {children}
    </div>
  );
}

// ============================================================
// SLIDES — ALL data flows from props (no random/inferred fields)
// ============================================================

function SlideIntro({ a, t }) {
  const year = new Date().getFullYear();
  return (
    <SlideShell bg="#0a0a0f" accent="#a3e635">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 21, color: '#a3e635', letterSpacing: '0.3em' }}>
          {t.intro_eyebrow} · {year}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 32 }}>
          <div className="fs-display" style={{ fontSize: 72, lineHeight: 0.88, letterSpacing: '-0.05em' }}>
            {t.intro_get && <span style={{ display: 'block' }}>{t.intro_get}</span>}
            {t.intro_ready && <span style={{ display: 'block', fontStyle: 'italic', color: '#a3e635' }}>{t.intro_ready}</span>}
          </div>
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '0.8s', marginTop: 28, fontSize: 22, color: '#d0d0e0', maxWidth: 260,
        }}>
          {interp(t.intro_summary, {
            msgs: a.totalMessages.toLocaleString(),
            people: a.totalParticipants,
            days: a.durationDays,
          })}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideMessageCount({ a, u, t }) {
  const animatedGroup = useAnimatedNumber(a.totalMessages, 1800, [a.totalMessages]);
  const animatedUser = useAnimatedNumber(u.messageCount, 1600, [u.author]);
  return (
    <SlideShell bg="#0a0a1f" accent="#a3e635">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#a3e635', letterSpacing: '0.3em' }}>
          {t.msg_eyebrow}
        </div>
        <div className="fs-display a-spring a-pulse-glow" style={{
          animationDelay: '0.2s',
          fontSize: a.totalMessages > 99999 ? 80 : a.totalMessages > 9999 ? 96 : 120,
          lineHeight: 1, letterSpacing: '-0.05em', color: '#a3e635',
          marginTop: 8, fontWeight: 400,
        }}>
          {animatedGroup.toLocaleString()}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.6s', fontSize: 32, marginTop: 4, fontStyle: 'italic',
        }}>
          {t.msg_word}
        </div>

        <div className="a-fade-up" style={{
          animationDelay: '1.5s', marginTop: 32,
          paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div className="fs-mono" style={{
            fontSize: 20, color: '#c8c8dc', letterSpacing: '0.25em', marginBottom: 10,
          }}>
            {t.msg_your_share}
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10,
          }}>
            <div className="fs-display" style={{
              fontSize: 44, color: '#fff', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1,
            }}>
              {animatedUser.toLocaleString()}
            </div>
            <div className="fs-mono" style={{ fontSize: 22, color: '#d0d0e0' }}>
              · {u.sharePct.toFixed(1)}%
            </div>
          </div>

          <div style={{
            marginTop: 14, marginInline: 'auto', maxWidth: 240,
            height: 8, borderRadius: 999,
            background: 'rgba(255,255,255,0.10)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${u.sharePct}%`,
              background: '#a3e635', borderRadius: 999,
              transformOrigin: 'left',
              animation: 'barGrow 1.2s cubic-bezier(0.16, 1, 0.3, 1) 1.8s both',
            }} />
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function SlideRank({ a, u, t }) {
  const rank = a.users.findIndex(x => x.author === u.author) + 1;
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const top5 = a.users.slice(0, 5);
  const maxMsgs = top5[0].messageCount;

  return (
    <SlideShell bg="#1f0a2a" accent="#f472b6">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#f472b6', letterSpacing: '0.3em' }}>
          {t.rank_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.2s', fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.04em', marginTop: 14,
        }}>
          {t.rank_finished}<br/>
          <span style={{ color: '#f472b6', fontStyle: 'italic' }}>{ordinal(rank)}</span> {interp(t.rank_of, { n: a.users.length })}
        </div>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {top5.map((row, i) => {
            const isUser = row.author === u.author;
            return (
              <div key={row.author} className="a-slide-right" style={{
                position: 'relative', padding: '10px 12px',
                background: isUser ? 'rgba(244,114,182,0.15)' : 'rgba(255,255,255,0.04)',
                border: isUser ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, overflow: 'hidden',
                animationDelay: `${0.5 + i * 0.1}s`,
              }}>
                <div className="a-bar" style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${(row.messageCount / maxMsgs) * 100}%`,
                  background: isUser ? 'rgba(244,114,182,0.18)' : 'rgba(255,255,255,0.03)',
                  animationDelay: `${0.7 + i * 0.1}s`,
                }} />
                <div style={{
                  position: 'relative', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div className="fs-mono" style={{
                      fontSize: 21, color: isUser ? '#f472b6' : '#c8c8dc',
                      width: 18, fontWeight: 700,
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div style={{
                      fontSize: 22, fontWeight: isUser ? 700 : 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {row.author} {isUser && <span style={{ color: '#f472b6' }}>{t.rank_you}</span>}
                    </div>
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 22, fontWeight: 600,
                    color: isUser ? '#f472b6' : '#d0d0e0',
                  }}>
                    {row.messageCount.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideVsEveryone({ a, u, t }) {
  const rank = a.users.findIndex(x => x.author === u.author) + 1;
  const totalUsers = a.users.length;
  const others = totalUsers - 1;
  const beatCount = a.users.filter(x => x.author !== u.author && x.messageCount < u.messageCount).length;
  const animatedBeat = useAnimatedNumber(beatCount, 1400, [u.author]);
  const animatedTotal = useAnimatedNumber(others, 1400, [u.author]);

  const isFirst = rank === 1;
  const isLast = rank === totalUsers;

  const fastestAvg = a.fastestResponder?.avgRespMin;
  const fastestAvgText = fastestAvg == null ? '' :
    fastestAvg < 1 ? interp(t.vs_avg_s, { s: Math.round(fastestAvg * 60) })
    : fastestAvg < 60 ? interp(t.vs_avg_m, { m: fastestAvg.toFixed(1) })
    : interp(t.vs_avg_h, { h: (fastestAvg / 60).toFixed(1) });

  return (
    <SlideShell bg="#0a1a2a" accent="#60a5fa">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#60a5fa', letterSpacing: '0.3em' }}>
          {t.vs_eyebrow}
        </div>

        <div className="a-spring a-pulse-glow" style={{ animationDelay: '0.2s', marginTop: 16 }}>
          <div className="fs-display" style={{
            fontSize: 132, lineHeight: 1, letterSpacing: '-0.05em',
            color: '#60a5fa',
          }}>
            {animatedBeat}<span style={{ fontSize: 50, color: '#d0d0e0' }}>/{animatedTotal}</span>
          </div>
        </div>

        <div className="a-fade-up" style={{ animationDelay: '0.7s', marginTop: 12 }}>
          <div className="fs-display" style={{
            fontSize: 24, lineHeight: 1.25, fontStyle: 'italic', letterSpacing: '-0.02em',
            whiteSpace: 'pre-line',
          }}>
            {isFirst && others > 0 && t.vs_outsent_all}
            {isLast && others > 0 && t.vs_least}
            {!isFirst && !isLast && interp(t.vs_middle, { beat: beatCount, others })}
            {others === 0 && t.vs_alone}
          </div>
        </div>

        <div className="fs-mono a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 22, fontSize: 21, color: '#d0d0e0', letterSpacing: '0.1em',
        }}>
          {interp(t.vs_ranked, { msgs: u.messageCount.toLocaleString(), rank, total: totalUsers })}
        </div>

        {a.fastestResponder && a.fastestResponder.author !== u.author && a.fastestResponder.avgRespMin != null && (
          <div className="a-fade-up" style={{ animationDelay: '1.3s', marginTop: 28 }}>
            <div className="fs-mono" style={{ fontSize: 21, color: '#c8c8dc', letterSpacing: '0.15em' }}>
              {t.vs_fastest}
            </div>
            <div className="fs-display" style={{
              fontSize: 24, color: '#60a5fa', fontStyle: 'italic',
              marginTop: 8, letterSpacing: '-0.02em',
            }}>
              {a.fastestResponder.author}
            </div>
            <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', marginTop: 2 }}>
              {fastestAvgText}
            </div>
          </div>
        )}
      </div>
    </SlideShell>
  );
}

function SlideTitle({ u, t }) {
  const title = resolveTitle(u, t);
  const evidence = resolveTitleEvidence(u, t);
  return (
    <SlideShell bg="#0a0a0f" accent="#a3e635">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#a3e635', letterSpacing: '0.3em' }}>
          {t.title_eyebrow}
        </div>
        <div className="a-spring a-pulse-glow" style={{ animationDelay: '0.3s', marginTop: 28 }}>
          <div className="fs-display" style={{
            fontSize: title.length > 22 ? 38 : title.length > 16 ? 46 : 60,
            lineHeight: 0.95, letterSpacing: '-0.04em',
            color: '#a3e635', fontStyle: 'italic',
          }}>
            {title}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '1.0s', marginTop: 28 }}>
          <div className="fs-mono" style={{ fontSize: 21, color: '#d0d0e0', letterSpacing: '0.15em' }}>
            {t.title_based_on}
          </div>
          <div className="fs-mono" style={{ fontSize: 23, color: '#fff', marginTop: 6, fontWeight: 600 }}>
            {evidence}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function SlideGroupDescribes({ u, t }) {
  return (
    <SlideShell bg="#1a0a18" accent="#f472b6">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#f472b6', letterSpacing: '0.3em' }}>
          {t.descr_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 24 }}>
          <div className="fs-display" style={{
            fontSize: 52, lineHeight: 0.95, letterSpacing: '-0.04em', fontStyle: 'italic',
          }}>
            "{t[u.groupDescriptionKey] || u.groupDescriptionKey}"
          </div>
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 32, fontSize: 23, lineHeight: 1.6, color: '#d0d0e0',
        }}>
          {t.descr_footnote}
        </div>
      </div>
    </SlideShell>
  );
}

function SlidePeakHour({ a, u, t }) {
  const hour = u.peakHour;
  const hourStr = String(hour).padStart(2, '0');
  const max = Math.max(...a.groupHourly);
  return (
    <SlideShell bg="#1a0a2f" accent="#60a5fa">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#60a5fa', letterSpacing: '0.3em' }}>
          {t.peak_eyebrow}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.2s', fontSize: 140, lineHeight: 1,
          letterSpacing: '-0.05em', marginTop: 12,
        }}>
          {hourStr}<span style={{ color: '#60a5fa' }}>:00</span>
        </div>
        <div className="a-fade-up" style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          gap: 2, marginTop: 24, height: 40,
          animationDelay: '0.7s',
        }}>
          {a.groupHourly.map((c, h) => (
            <div key={h} className="a-bar" style={{
              width: 7, height: `${(c / max) * 40}px`,
              background: h === hour ? '#60a5fa' : 'rgba(255,255,255,0.2)',
              borderRadius: 1,
              animationDelay: `${0.9 + h * 0.02}s`,
            }} />
          ))}
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.2s', marginTop: 28, fontSize: 22, lineHeight: 1.5,
          color: '#d0d0e0', maxWidth: 280, margin: '28px auto 0',
        }}>
          {hour >= 0 && hour < 5 && t.peak_3am}
          {hour >= 5 && hour < 11 && t.peak_morning}
          {hour >= 11 && hour < 17 && t.peak_midday}
          {hour >= 17 && hour < 22 && t.peak_evening}
          {hour >= 22 && t.peak_late}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideNight({ a, u, t }) {
  const pct = useAnimatedNumber(Math.round(u.nightPct), 1400, [u.author]);
  return (
    <SlideShell bg="#0a0418" accent="#a78bfa">
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[20, 50, 80].map((left, i) => (
          <div key={i} className="a-float" style={{
            position: 'absolute', left: `${left}%`, bottom: 100, fontSize: 24,
            animationDelay: `${i * 0.8}s`,
          }}>🌙</div>
        ))}
      </div>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#a3e635', letterSpacing: '0.3em' }}>
          {t.night_eyebrow}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.2s', fontSize: 156, lineHeight: 1,
          letterSpacing: '-0.05em', color: '#a3e635', marginTop: 8,
        }}>
          {pct}<span style={{ fontSize: 60 }}>%</span>
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.6s', fontSize: 24, fontStyle: 'italic', marginTop: 4,
        }}>
          {t.night_of_msgs}
        </div>
        <div className="fs-mono a-fade-up" style={{
          animationDelay: '0.9s', fontSize: 22, color: '#d0d0e0',
          marginTop: 14, letterSpacing: '0.1em',
        }}>
          {interp(t.night_count, {
            night: u.nightMessages.toLocaleString(),
            total: u.messageCount.toLocaleString(),
          })}
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.2s', marginTop: 28, fontSize: 22, lineHeight: 1.5,
          color: '#d0d0e0', maxWidth: 280, margin: '28px auto 0',
        }}>
          {u.nightPct > 30 && t.night_diag_strong}
          {u.nightPct > 15 && u.nightPct <= 30 && t.night_diag_med}
          {u.nightPct <= 15 && u.nightPct > 5 && t.night_diag_low}
          {u.nightPct <= 5 && t.night_diag_none}
        </div>
        {a.nightOwl?.author === u.author && (
          <div className="fs-mono a-fade-up" style={{
            animationDelay: '1.5s', fontSize: 21, color: '#a3e635',
            marginTop: 20, letterSpacing: '0.2em', fontWeight: 700,
          }}>
            {t.night_owl}
          </div>
        )}
      </div>
    </SlideShell>
  );
}

function SlideStreak({ u, t }) {
  const days = useAnimatedNumber(u.longestStreak, 1200, [u.author]);
  const dotCount = Math.min(u.longestStreak, 30);
  return (
    <SlideShell bg="#1a2e0a" accent="#a3e635">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#a3e635', letterSpacing: '0.3em' }}>
          {t.streak_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.2s', marginTop: 16 }}>
          <div className="fs-display" style={{
            fontSize: 180, lineHeight: 1, letterSpacing: '-0.05em',
            color: '#a3e635', fontWeight: 400,
          }}>
            {days}
          </div>
          <div className="fs-display" style={{
            fontSize: 32, fontStyle: 'italic', marginTop: -8,
          }}>
            {u.longestStreak === 1 ? t.streak_day : t.streak_days}
          </div>
        </div>
        <div className="a-fade-up" style={{
          display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap',
          maxWidth: 240, margin: '24px auto 0',
          animationDelay: '0.8s',
        }}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: 2,
              background: '#a3e635',
              opacity: 0.4 + (i / dotCount) * 0.6,
              animation: `scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${1 + i * 0.03}s both`,
            }} />
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideSpeed({ a, u, t }) {
  if (u.avgRespMin == null) return null;
  const respTime = u.avgRespMin;
  const display = respTime < 1 ? `${Math.round(respTime * 60)}s`
    : respTime < 60 ? `${respTime.toFixed(1)}m`
    : `${(respTime / 60).toFixed(1)}h`;
  const pct = u.speedPercentile ?? 50;
  return (
    <SlideShell bg="#0a1f2a" accent="#60a5fa">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#60a5fa', letterSpacing: '0.3em' }}>
          {t.speed_eyebrow}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.2s', fontSize: 110, lineHeight: 1,
          letterSpacing: '-0.05em', color: '#60a5fa', marginTop: 12,
        }}>
          {display}
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.8s', marginTop: 32 }}>
          <div className="fs-display" style={{
            fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontStyle: 'italic',
          }}>
            {t.speed_faster}<br/>
            <span style={{ color: '#60a5fa', fontStyle: 'normal' }}>{pct}%</span> {t.speed_of_group}
          </div>
        </div>
        <div className="fs-mono a-fade-up" style={{
          animationDelay: '1.3s', marginTop: 24, fontSize: 20, color: '#c8c8dc', letterSpacing: '0.15em',
        }}>
          {interp(t.speed_based, { n: u.respSampleSize })}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideWord({ u, t }) {
  const word = u.topWord;
  return (
    <SlideShell bg="#2a0a1a" accent="#f472b6">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#f472b6', letterSpacing: '0.3em' }}>
          {t.word_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 20 }}>
          <div className="fs-display" style={{
            fontSize: word.length > 10 ? 48 : word.length > 6 ? 72 : 92,
            lineHeight: 1, letterSpacing: '-0.04em', color: '#f472b6',
            fontStyle: 'italic', wordBreak: 'break-word',
          }}>
            "{word}"
          </div>
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 36, fontSize: 22, lineHeight: 1.5, color: '#d0d0e0',
        }}>
          {interp(t.word_used, { n: u.topWordCount })}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideTopWords({ a, t }) {
  const words = (a.topWordsGroup || []).slice(0, 5);
  if (words.length === 0) return null;
  const maxCount = words[0].count;

  return (
    <SlideShell bg="#0a1f1a" accent="#2dd4bf">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '50px 20px 30px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          textAlign: 'center', fontSize: 20, color: '#2dd4bf', letterSpacing: '0.3em',
        }}>
          {t.top_words_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 36, lineHeight: 0.95, letterSpacing: '-0.04em',
          marginTop: 12, marginBottom: 22,
        }}>
          {t.top_words_title}<br/><span style={{ fontStyle: 'italic', color: '#2dd4bf' }}>{t.top_words_subtitle}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {words.map((w, i) => {
            const pct = Math.max(8, Math.round((w.count / maxCount) * 100));
            return (
              <div key={w.word} className="a-slide-up-far" style={{
                position: 'relative',
                padding: '12px 14px',
                background: 'rgba(45,212,191,0.08)',
                border: '1px solid rgba(45,212,191,0.22)',
                borderRadius: 14,
                overflow: 'hidden',
                animationDelay: `${0.5 + i * 0.13}s`,
              }}>
                <div className="a-slide-right" style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(90deg, rgba(45,212,191,0.18) 0%, rgba(45,212,191,0.04) 100%)',
                  width: `${pct}%`,
                  animationDelay: `${0.7 + i * 0.13}s`,
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="fs-mono" style={{
                    fontSize: 22, color: '#2dd4bf', fontWeight: 700,
                    width: 28, textAlign: 'center', opacity: 0.85,
                  }}>
                    {i + 1}
                  </div>
                  <div className="fs-display" style={{
                    flex: 1, minWidth: 0,
                    fontSize: w.word.length > 12 ? 22 : w.word.length > 8 ? 28 : 34,
                    lineHeight: 1, letterSpacing: '-0.03em',
                    fontStyle: 'italic', color: '#fff',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    "{w.word}"
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 21, color: '#2dd4bf', fontWeight: 700,
                    letterSpacing: '0.05em', flexShrink: 0,
                  }}>
                    {w.count.toLocaleString()}×
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideEmoji({ a, u, t }) {
  return (
    <SlideShell bg="#1a0a2a" accent="#fbbf24">
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[15, 40, 65, 85].map((left, i) => (
          <div key={i} className="a-float" style={{
            position: 'absolute', left: `${left}%`, bottom: 80, fontSize: 28,
            animationDelay: `${i * 0.6}s`,
          }}>{u.topEmoji}</div>
        ))}
      </div>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#fbbf24', letterSpacing: '0.3em' }}>
          {t.emoji_eyebrow}
        </div>
        <div className="a-spring" style={{
          animationDelay: '0.2s', fontSize: 180, lineHeight: 1, marginTop: 12,
        }}>
          {u.topEmoji}
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '0.8s', marginTop: 24, fontSize: 22, color: '#d0d0e0',
        }}>
          {interp(t.emoji_used, { n: u.topEmojiCount })}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideDramaRole({ u, t }) {
  // Determine role based on actual computed data
  let titleText, count, labelText, copyText, accent, bg;
  if (u.conversationsRevived > u.conversationsKilled && u.conversationsRevived >= 5) {
    titleText = t.drama_defib;
    count = u.conversationsRevived;
    labelText = t.drama_defib_label;
    copyText = t.drama_defib_copy;
    accent = '#34d399';
    bg = '#0a1a14';
  } else if (u.conversationsKilled > u.conversationsRevived && u.conversationsKilled >= 5) {
    titleText = t.drama_killer;
    count = u.conversationsKilled;
    labelText = t.drama_killer_label;
    copyText = t.drama_killer_copy;
    accent = '#ef4444';
    bg = '#1a0a0a';
  } else if (u.replyReceivedRate > 0.5 && u.messageCount >= 20) {
    titleText = t.drama_replied;
    count = Math.round(u.replyReceivedRate * 100);
    labelText = t.drama_replied_label;
    copyText = t.drama_replied_copy;
    accent = '#a3e635';
    bg = '#1a2e0a';
  } else if (u.ignoredRate > 0.25 && u.messageCount >= 20) {
    titleText = t.drama_ignored;
    count = Math.round(u.ignoredRate * 100);
    labelText = t.drama_ignored_label;
    copyText = t.drama_ignored_copy;
    accent = '#94a3b8';
    bg = '#0a0a14';
  } else {
    titleText = t.drama_steady;
    count = u.finalMessagesOfDay;
    labelText = t.drama_steady_label;
    copyText = t.drama_steady_copy;
    accent = '#60a5fa';
    bg = '#0a141f';
  }

  const animated = useAnimatedNumber(count, 1400, [u.author]);
  const isPercent = labelText.startsWith('%');
  const cleanLabel = isPercent ? labelText.slice(1).trim() : labelText;

  return (
    <SlideShell bg={bg} accent={accent}>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: accent, letterSpacing: '0.3em' }}>
          {t.drama_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 22 }}>
          <div className="fs-display" style={{
            fontSize: titleText.length > 20 ? 38 : 48,
            lineHeight: 0.95, letterSpacing: '-0.04em', fontStyle: 'italic', color: accent,
          }}>
            {titleText}
          </div>
        </div>
        <div className="a-spring" style={{ animationDelay: '0.7s', marginTop: 30 }}>
          <div className="fs-display" style={{
            fontSize: 96, lineHeight: 1, letterSpacing: '-0.05em', color: '#fff',
          }}>
            {animated}{isPercent ? '%' : ''}
          </div>
          <div className="fs-mono" style={{
            fontSize: 21, color: '#d0d0e0', letterSpacing: '0.1em', marginTop: 6,
          }}>
            {cleanLabel}
          </div>
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.3s', marginTop: 28, fontSize: 23, lineHeight: 1.5, color: '#d0d0e0',
        }}>
          {copyText}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideRoast({ u, profile, t }) {
  const tone = profile?.tone || 'medium';
  const roasts = u.roasts.slice(0, 2);
  const heading = tone === 'mild' ? t.roast_heading_mild
    : tone === 'spicy' ? t.roast_heading_spicy
    : t.roast_heading_med;
  const eyebrow = tone === 'spicy' ? t.roast_eyebrow_spicy
    : tone === 'mild' ? t.roast_eyebrow_mild
    : t.roast_eyebrow_med;
  return (
    <SlideShell bg="#1a0a14" accent="#f472b6">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 22px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 20, color: '#f472b6', letterSpacing: '0.3em',
        }}>
          {eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.15s', fontSize: 38, lineHeight: 1,
          letterSpacing: '-0.04em', marginTop: 14, fontStyle: 'italic',
        }}>
          {heading}
        </div>
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {roasts.map((roast, i) => (
            <div key={i} className="a-roast-card" style={{
              position: 'relative', overflow: 'hidden',
              padding: '18px 18px 16px',
              background: 'linear-gradient(135deg, rgba(244,114,182,0.14) 0%, rgba(244,114,182,0.04) 100%)',
              border: '1px solid rgba(244,114,182,0.35)',
              borderRadius: 18,
              animationDelay: `${0.5 + i * 0.5}s`,
              boxShadow: '0 8px 24px rgba(244,114,182,0.10)',
            }}>
              <div className="fs-mono" style={{
                fontSize: 20, color: '#f472b6', letterSpacing: '0.2em',
                opacity: 0.55, marginBottom: 8, fontWeight: 700,
              }}>
                #{String(i + 1).padStart(2, '0')}
              </div>
              <div className="fs-display" style={{
                fontSize: 20, lineHeight: 1.25, letterSpacing: '-0.01em',
                color: '#fff', fontWeight: 400,
              }}>
                {interp(t[roast.lineKey] || '', roast.vars || {})}
              </div>
              {tone !== 'mild' && (
                <div className="fs-display" style={{
                  marginTop: 8, fontSize: 17, lineHeight: 1.3, letterSpacing: '-0.01em',
                  color: '#f472b6', fontStyle: 'italic',
                }}>
                  {interp(t[roast.kickerKey] || '', roast.vars || {})}
                </div>
              )}
            </div>
          ))}
        </div>
        {u.roasts.length > 2 && (
          <div className="fs-mono a-fade-up" style={{
            animationDelay: '1.8s', textAlign: 'center', marginTop: 18,
            fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em',
          }}>
            {interp(t.roast_more, { n: u.roasts.length - 2 })}
          </div>
        )}
      </div>
    </SlideShell>
  );
}

function SlideAchievements({ achievements, t }) {
  const top = achievements.slice(0, 3);
  return (
    <SlideShell bg="#0a0a14" accent="#fbbf24">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 20px',
      }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 20, color: '#fbbf24', letterSpacing: '0.3em' }}>
          {t.ach_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.2s', fontSize: 40, lineHeight: 0.95,
          letterSpacing: '-0.04em', marginTop: 14,
        }}>
          {t.ach_earned}<br/>
          <span style={{ fontStyle: 'italic', color: '#fbbf24' }}>{achievements.length}</span>{' '}
          {achievements.length === 1 ? t.ach_badges : t.ach_badges_plural}.
        </div>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {top.map((ach, i) => (
            <div key={i} className="a-spring" style={{
              position: 'relative', overflow: 'hidden', padding: '16px',
              background: `linear-gradient(135deg, ${ach.color}22 0%, ${ach.color}08 100%)`,
              border: `1px solid ${ach.color}40`,
              borderRadius: 16,
              animationDelay: `${0.5 + i * 0.2}s`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 28, lineHeight: 1 }}>🏆</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fs-display" style={{
                    fontSize: 20, lineHeight: 1.1, color: ach.color, letterSpacing: '-0.01em',
                  }}>
                    {t[ach.labelKey] || ach.labelKey}
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 20, color: '#d0d0e0', marginTop: 4, letterSpacing: '0.05em',
                  }}>
                    {interp(t[ach.evidenceKey] || '', ach.vars || {})}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {achievements.length > 3 && (
          <div className="fs-mono a-fade-up" style={{
            animationDelay: '1.5s', textAlign: 'center', marginTop: 14,
            fontSize: 21, color: '#c8c8dc', letterSpacing: '0.15em',
          }}>
            {interp(t.ach_more, { n: achievements.length - 3 })}
          </div>
        )}
      </div>
    </SlideShell>
  );
}

function SlideMostLikely({ a, t }) {
  return (
    <SlideShell bg="#0a1a2a" accent="#60a5fa">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '50px 20px 30px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          textAlign: 'center', fontSize: 20, color: '#60a5fa', letterSpacing: '0.3em',
        }}>
          {t.likely_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 36, lineHeight: 0.95, letterSpacing: '-0.04em',
          marginTop: 12, marginBottom: 20,
        }}>
          {t.likely_title}<br/><span style={{ fontStyle: 'italic', color: '#60a5fa' }}>{t.likely_verdicts}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {a.mostLikely.map((card, i) => (
            <div key={i} className="a-slide-right" style={{
              padding: '12px 14px',
              background: 'rgba(96,165,250,0.10)',
              border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: 14,
              animationDelay: `${0.5 + i * 0.11}s`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 22, lineHeight: 1 }}>{card.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fs-mono" style={{
                    fontSize: 20, color: '#60a5fa', letterSpacing: '0.15em', fontWeight: 700,
                  }}>
                    {t.likely_label}
                  </div>
                  <div style={{ fontSize: 22, color: '#fff', marginTop: 2, fontWeight: 500 }}>
                    {t[card.labelKey] || card.labelKey}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="fs-display" style={{
                    fontSize: 20, color: '#60a5fa', fontStyle: 'italic',
                    letterSpacing: '-0.02em', maxWidth: 100,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {card.winner}
                  </div>
                  <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', marginTop: 2 }}>
                    {card.metric}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideDuo({ a, u, t }) {
  const [n1, n2] = a.topDuo.names;
  const isInDuo = n1 === u.author || n2 === u.author;
  const partner = n1 === u.author ? n2 : n1;
  return (
    <SlideShell bg="#1f0a1a" accent="#f472b6">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 20, color: '#f472b6', letterSpacing: '0.3em',
        }}>
          {t.duo_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 22 }}>
          <div className="fs-display" style={{
            fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.04em',
          }}>
            <span style={{ fontStyle: 'italic', color: '#f472b6' }}>{n1}</span>
            <span style={{ display: 'block', margin: '8px 0', fontSize: 20, color: '#c8c8dc' }}>&</span>
            <span style={{ fontStyle: 'italic', color: '#f472b6' }}>{n2}</span>
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 32 }}>
          <div className="fs-display" style={{
            fontSize: 28, lineHeight: 1.2, letterSpacing: '-0.02em',
          }}>
            {t.duo_traded} <span style={{ color: '#f472b6', fontWeight: 600 }}>{a.topDuo.count.toLocaleString()}</span><br/>
            {t.duo_replies_between}
          </div>
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.4s', marginTop: 26, fontSize: 23,
          color: '#d0d0e0', maxWidth: 280, margin: '26px auto 0',
        }}>
          {isInDuo
            ? interp(t.duo_in_with, { partner })
            : interp(t.duo_share, { pct: a.topDuoShare.toFixed(0) })}
        </div>
      </div>
    </SlideShell>
  );
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function SlideEras({ a, t }) {
  return (
    <SlideShell bg="#0a0418" accent="#a3e635">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '48px 20px 30px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          textAlign: 'center', fontSize: 20, color: '#a3e635', letterSpacing: '0.3em',
        }}>
          {t.eras_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 36, lineHeight: 0.95, letterSpacing: '-0.04em',
          marginTop: 12, marginBottom: 20,
        }}>
          {t.eras_title}<br/><span style={{ fontStyle: 'italic', color: '#a3e635' }}>{t.eras_subtitle}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {a.eras.map((era, i) => {
            const startMonth = MONTH_NAMES[era.startDate.getMonth()];
            const endMonth = MONTH_NAMES[era.endDate.getMonth()];
            const dateRange = startMonth === endMonth
              ? `${startMonth} ${era.startDate.getDate()}–${era.endDate.getDate()}`
              : `${startMonth} ${era.startDate.getDate()} – ${endMonth} ${era.endDate.getDate()}`;
            return (
              <div key={i} className="a-fade-up" style={{
                padding: '14px 16px',
                background: 'rgba(163,230,53,0.08)',
                border: '1px solid rgba(163,230,53,0.20)',
                borderRadius: 14,
                animationDelay: `${0.5 + i * 0.18}s`,
              }}>
                <div className="fs-mono" style={{
                  fontSize: 20, color: '#a3e635', letterSpacing: '0.2em', fontWeight: 700,
                }}>
                  {t.eras_chapter} {String(i + 1).padStart(2, '0')}
                </div>
                <div className="fs-display" style={{
                  fontSize: 22, lineHeight: 1.1, letterSpacing: '-0.02em',
                  marginTop: 4, fontStyle: 'italic',
                }}>
                  {era.name}
                </div>
                <div className="fs-mono" style={{
                  fontSize: 20, color: '#d0d0e0', marginTop: 6, letterSpacing: '0.05em',
                }}>
                  {dateRange} · {era.messageCount.toLocaleString()} {t.eras_msgs} · {interp(t.eras_per_day, { n: era.msgPerDay })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideChaosMoment({ a, t }) {
  const cm = a.chaosMinute;
  const ts = cm.ts;
  const dateStr = `${MONTH_NAMES[ts.getMonth()]} ${ts.getDate()}`;
  const timeStr = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
  const animated = useAnimatedNumber(cm.count, 1100, [ts.getTime()]);

  const bubbles = Array.from({ length: 8 }).map((_, i) => ({
    left: 10 + (i * 11) % 80,
    delay: i * 0.25,
  }));

  return (
    <SlideShell bg="#1a0a14" accent="#f472b6" shake={true}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {bubbles.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${b.left}%`, top: -30,
            width: 60, height: 26, borderRadius: 8,
            background: 'rgba(244,114,182,0.20)',
            border: '1px solid rgba(244,114,182,0.35)',
            animation: `notifRain 3s linear ${b.delay}s infinite`,
          }} />
        ))}
      </div>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 20, color: '#f472b6', letterSpacing: '0.3em',
        }}>
          {t.chaos_eyebrow}
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.3s', marginTop: 20 }}>
          <div className="fs-display" style={{
            fontSize: 38, lineHeight: 0.95, letterSpacing: '-0.03em',
          }}>
            <span style={{ fontStyle: 'italic' }}>{dateStr}</span>
            <span style={{ display: 'block', color: '#f472b6', marginTop: 4 }}>
              {interp(t.chaos_at, { time: timeStr })}
            </span>
          </div>
        </div>
        <div className="a-spring" style={{ animationDelay: '0.8s', marginTop: 32 }}>
          <div className="fs-display" style={{
            fontSize: 110, lineHeight: 1, letterSpacing: '-0.05em', color: '#f472b6',
          }}>
            {animated}
          </div>
          <div className="fs-display" style={{
            fontSize: 22, marginTop: -2, color: '#fff', fontStyle: 'italic',
          }}>
            {t.chaos_msgs_minute}
          </div>
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.6s', marginTop: 28, fontSize: 23, lineHeight: 1.6,
          color: '#d0d0e0', maxWidth: 280, margin: '28px auto 0',
        }}>
          {t.chaos_lost_control}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideGroupPersona({ a, t }) {
  return (
    <SlideShell bg="#0a0a18" accent="#a3e635">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 20, color: '#a3e635', letterSpacing: '0.3em',
        }}>
          {t.persona_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.2s', fontSize: 28, lineHeight: 1,
          letterSpacing: '-0.03em', marginTop: 16, color: '#d0d0e0',
        }}>
          {t.persona_this_group}
        </div>
        <div className="a-spring a-pulse-glow" style={{ animationDelay: '0.5s', marginTop: 20 }}>
          <div className="fs-display" style={{
            fontSize: 56, lineHeight: 0.95, letterSpacing: '-0.04em',
            color: '#a3e635', fontStyle: 'italic',
          }}>
            {a.groupPersonality}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '1.2s', marginTop: 32 }}>
          <div className="fs-mono" style={{
            fontSize: 21, color: '#c8c8dc', letterSpacing: '0.15em', marginBottom: 8,
          }}>
            {t.persona_evidence}
          </div>
          <div style={{ fontSize: 23, color: '#fff', lineHeight: 1.5, fontWeight: 500 }}>
            {a.groupPersonalityReason}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function SlideAwards({ a, t }) {
  // Only include awards with valid winners
  const awards = [
    a.fastestResponder && { trophy: '🏆', label: t.awards_fastest, winner: a.fastestResponder.author,
      sub: interp(t.awards_fastest_sub, { m: a.fastestResponder.avgRespMin.toFixed(1) }), color: '#60a5fa' },
    a.yapper && { trophy: '🎤', label: t.awards_yapper, winner: a.yapper.author,
      sub: interp(t.awards_yapper_sub, { n: a.yapper.messageCount.toLocaleString() }), color: '#f472b6' },
    a.nightOwl && a.nightOwl.nightPct > 5 && { trophy: '🌙', label: t.awards_nightowl,
      winner: a.nightOwl.author, sub: interp(t.awards_nightowl_sub, { pct: a.nightOwl.nightPct.toFixed(0) }), color: '#a78bfa' },
    a.ghost && a.ghost.longestAbsenceDays >= 7 && { trophy: '👻', label: t.awards_ghost,
      winner: a.ghost.author, sub: interp(t.awards_ghost_sub, { n: a.ghost.longestAbsenceDays }), color: '#94a3b8' },
    a.killer && a.killer.conversationsKilled >= 3 && { trophy: '💀', label: t.awards_killer,
      winner: a.killer.author, sub: interp(t.awards_killer_sub, { n: a.killer.conversationsKilled }), color: '#ef4444' },
    a.reviver && a.reviver.conversationsRevived >= 3 && { trophy: '✨', label: t.awards_defib,
      winner: a.reviver.author, sub: interp(t.awards_defib_sub, { n: a.reviver.conversationsRevived }), color: '#34d399' },
  ].filter(Boolean).slice(0, 6);

  return (
    <SlideShell bg="#0a0a14" accent="#fbbf24">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '48px 20px 30px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          textAlign: 'center', fontSize: 20, color: '#fbbf24', letterSpacing: '0.3em',
        }}>
          {t.awards_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 36, lineHeight: 0.95, letterSpacing: '-0.04em',
          marginTop: 10, marginBottom: 18,
        }}>
          {t.awards_title}<br/><span style={{ fontStyle: 'italic', color: '#fbbf24' }}>{t.awards_are}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {awards.map((aw, i) => (
            <div key={aw.label} className="a-slide-up-far" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 13px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              animationDelay: `${0.5 + i * 0.15}s`,
            }}>
              <div style={{ fontSize: 20, lineHeight: 1 }}>{aw.trophy}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fs-mono" style={{
                  fontSize: 20, color: aw.color, letterSpacing: '0.15em',
                  fontWeight: 700, textTransform: 'uppercase',
                }}>
                  {aw.label}
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 700, marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {aw.winner}
                </div>
              </div>
              <div className="fs-mono" style={{
                fontSize: 20, color: '#c8c8dc', textAlign: 'right', flexShrink: 0,
              }}>
                {aw.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function SlidePeakDay({ a, t }) {
  if (!a.peakDay) return null;
  const [date, count] = a.peakDay;
  const [yr, mo, dy] = date.split('-').map(Number);
  const dateObj = new Date(yr, mo - 1, dy);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const animated = useAnimatedNumber(count, 1400, [date]);

  return (
    <SlideShell bg="#2a1a0a" accent="#fbbf24">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 20, color: '#fbbf24', letterSpacing: '0.3em',
        }}>
          {t.peakday_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.3s', fontSize: 38, lineHeight: 0.95,
          letterSpacing: '-0.04em', marginTop: 14,
        }}>
          <span style={{ fontStyle: 'italic' }}>{dayName},</span><br/>{dateStr}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.7s', fontSize: 110, lineHeight: 1,
          letterSpacing: '-0.05em', color: '#fbbf24', marginTop: 16,
        }}>
          {animated}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '1.2s', fontSize: 24, marginTop: -4, fontStyle: 'italic',
        }}>
          {t.peakday_msgs}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideFinale({ a, t, onExit }) {
  return (
    <SlideShell bg="#0a0a0f" accent="#a3e635">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 20, color: '#a3e635', letterSpacing: '0.3em',
        }}>
          {t.finale_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 32 }}>
          <div className="fs-display" style={{
            fontSize: 68, lineHeight: 0.88, letterSpacing: '-0.05em',
          }}>
            <span style={{ display: 'block' }}>{t.finale_see}</span>
            <span style={{ display: 'block' }}>{t.finale_in_the}</span>
            <span style={{ display: 'block', fontStyle: 'italic', color: '#a3e635' }}>{t.finale_chat}</span>
          </div>
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 36, fontSize: 23, color: '#d0d0e0',
        }}>
          {t.finale_now}
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.4s', display: 'flex', gap: 8,
          justifyContent: 'center', marginTop: 28,
        }}>
          <button onClick={onExit} className="press" style={{
            padding: '12px 24px', background: '#a3e635', color: '#0a0a0f',
            border: 'none', borderRadius: 999, fontSize: 23, fontWeight: 700, cursor: 'pointer',
          }}>
            {t.finale_explore}
          </button>
        </div>
      </div>
    </SlideShell>
  );
}

// ============================================================
// POST MENU — secondary, with debug access
// ============================================================

function PostMenu({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, t, onReplay, onReset, onDebug, onRoastMode }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const u = analytics.userMap[selectedAuthor];
  if (!u) return null;
  const rank = analytics.users.findIndex(x => x.author === selectedAuthor) + 1;
  const userAchievements = analytics.achievementsByUser[selectedAuthor] || [];

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', position: 'relative',
    }}>
      <div style={{ padding: '16px 20px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
            chat<span style={{ color: '#a3e635' }}>wrapped</span>
          </div>
          <button onClick={onReset} className="press" aria-label={t.a11y_start_over || 'Start over'} style={{
            background: '#15151d', border: '1px solid #2a2a36', color: '#cfcfdc',
            width: 44, height: 44, borderRadius: 999, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        <div style={{ height: 18 }} />

        {/* CTAs: Replay + Roast Mode side by side */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onReplay} className="a-scale-in press lift" style={{
            flex: 1, position: 'relative', overflow: 'hidden', textAlign: 'left',
            background: 'linear-gradient(135deg, #a3e635 0%, #d4f04a 100%)',
            border: 'none', borderRadius: 18, padding: '18px 16px', cursor: 'pointer',
            color: '#0a0a0f', boxShadow: '0 14px 30px rgba(163,230,53,0.35)',
          }}>
            <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
            <div className="fs-display" style={{
              position: 'absolute', right: -14, top: -10, fontSize: 90,
              opacity: 0.18, lineHeight: 1,
            }}>✦</div>
            <div className="fs-mono" style={{
              fontSize: 20, letterSpacing: '0.22em', opacity: 0.85, fontWeight: 700,
            }}>
              {t.menu_replay}
            </div>
            <div className="fs-display" style={{
              fontSize: 24, lineHeight: 0.95, letterSpacing: '-0.03em', marginTop: 4,
              whiteSpace: 'pre-line',
            }}>
              {t.menu_watch}
            </div>
          </button>

          <button onClick={onRoastMode} className="a-scale-in press lift a-gradient-shift" style={{
            flex: 1, position: 'relative', overflow: 'hidden', textAlign: 'left',
            background: 'linear-gradient(135deg, #f472b6 0%, #ef4444 50%, #f472b6 100%)',
            backgroundSize: '200% 200%',
            border: 'none', borderRadius: 18, padding: '18px 16px', cursor: 'pointer',
            color: '#fff', boxShadow: '0 14px 30px rgba(244,114,182,0.40)',
            animationDelay: '0.05s',
          }}>
            <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
            <div style={{
              position: 'absolute', right: -8, top: -10, fontSize: 70,
              opacity: 0.22, lineHeight: 1,
            }}>🔥</div>
            <div className="fs-mono" style={{
              fontSize: 20, letterSpacing: '0.22em', opacity: 0.95, fontWeight: 700,
            }}>
              {t.menu_roast_mode}
            </div>
            <div className="fs-display" style={{
              fontSize: 24, lineHeight: 0.95, letterSpacing: '-0.03em', marginTop: 4,
              whiteSpace: 'pre-line',
            }}>
              {t.menu_roast_everyone}
            </div>
          </button>
        </div>

        {/* Person picker */}
        <button onClick={() => setPickerOpen(true)} className="press" style={{
          width: '100%', marginTop: 12,
          padding: '14px 16px',
          background: '#15151d', border: '1px solid #2a2a36',
          borderRadius: 14, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', letterSpacing: '0.18em' }}>
              {t.menu_viewing_as}
            </div>
            <div style={{ fontSize: 23, fontWeight: 700, marginTop: 3 }}>{selectedAuthor}</div>
            <div className="fs-mono" style={{
              fontSize: 20, color: '#a3e635', marginTop: 4, fontStyle: 'italic',
            }}>"{resolveTitle(u, t)}"</div>
          </div>
          <div className="fs-mono" style={{ fontSize: 20, color: '#a3e635', letterSpacing: '0.1em' }}>
            {t.menu_switch}
          </div>
        </button>

        {/* Verified data badge */}
        <button onClick={onDebug} className="press" style={{
          width: '100%', textAlign: 'left',
          marginTop: 16, padding: '14px 16px',
          background: diagnostics?.confidence >= 80 ? 'rgba(163,230,53,0.10)' : 'rgba(251,191,36,0.10)',
          border: `1px solid ${diagnostics?.confidence >= 80 ? 'rgba(163,230,53,0.30)' : 'rgba(251,191,36,0.35)'}`,
          borderRadius: 12, cursor: 'pointer', color: '#f4f4f8',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          minHeight: 56,
        }}>
          <div>
            <div className="fs-mono" style={{
              fontSize: 21, color: diagnostics?.confidence >= 80 ? '#bff260' : '#fbbf24',
              letterSpacing: '0.2em', fontWeight: 700,
            }}>
              {interp(t.menu_verified, { n: diagnostics?.confidence ?? 0 })}
            </div>
            <div style={{ fontSize: 22, color: '#dcdcec', marginTop: 5 }}>
              {interp(t.menu_msgs_senders, {
                msgs: diagnostics?.parsedMessages.toLocaleString(),
                senders: Object.keys(diagnostics?.perAuthorCount || {}).length,
              })}
            </div>
            {diagnostics?.warnings.length > 0 && (
              <div style={{ fontSize: 21, color: '#fbbf24', marginTop: 4 }}>
                {diagnostics.warnings[0]}
              </div>
            )}
          </div>
          <div className="fs-mono" style={{ fontSize: 21, color: '#cfcfdc', letterSpacing: '0.1em', fontWeight: 600 }}>
            {t.menu_verify}
          </div>
        </button>

        {/* Group personality */}
        <div style={{
          marginTop: 20, padding: 18,
          background: 'linear-gradient(135deg, #1a1a25 0%, #15151d 100%)',
          border: '1px solid rgba(163,230,53,0.2)', borderRadius: 16,
        }}>
          <div className="fs-mono" style={{
            fontSize: 20, color: '#a3e635', letterSpacing: '0.2em', marginBottom: 8,
          }}>
            {t.menu_this_group_is}
          </div>
          <div className="fs-display" style={{
            fontSize: 26, lineHeight: 1, letterSpacing: '-0.03em',
            fontStyle: 'italic', color: '#a3e635',
          }}>
            {analytics.groupPersonality}
          </div>
          <div style={{ fontSize: 22, color: '#d0d0e0', marginTop: 10, lineHeight: 1.4 }}>
            {analytics.groupPersonalityReason}
          </div>
        </div>

        {/* Eras */}
        {analytics.eras && analytics.eras.length >= 2 && (
          <div style={{ marginTop: 24 }}>
            <div className="fs-mono" style={{
              fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', marginBottom: 10,
            }}>
              {t.menu_eras}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {analytics.eras.map((era, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 13px',
                  background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12,
                }}>
                  <div className="fs-mono" style={{
                    fontSize: 20, color: '#a3e635', fontWeight: 700, width: 24,
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fs-display" style={{
                      fontSize: 16, fontStyle: 'italic', letterSpacing: '-0.01em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {era.name}
                    </div>
                    <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', marginTop: 1 }}>
                      {era.messageCount.toLocaleString()} {t.eras_msgs} · {era.days}d
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        <div style={{ marginTop: 24 }}>
          <div className="fs-mono" style={{
            fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', marginBottom: 10,
          }}>
            {t.menu_highlights}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <HighlightCard value={u.messageCount.toLocaleString()} label={t.menu_hl_messages} accent />
            <HighlightCard value={`#${rank}`} label={interp(t.menu_hl_of, { n: analytics.users.length })} />
            <HighlightCard value={`${u.peakHour}:00`} label={t.menu_hl_peak_hour} />
            <HighlightCard value={`${Math.round(u.nightPct)}%`} label={t.menu_hl_at_night} />
            <HighlightCard value={`${u.longestStreak}d`} label={t.menu_hl_streak} />
            <HighlightCard value={u.topEmoji || '—'} label={t.menu_hl_top_emoji} />
            <HighlightCard value={u.topWord || '—'} label={t.menu_hl_top_word} small />
            <HighlightCard
              value={u.avgRespMin != null
                ? (u.avgRespMin < 60 ? `${u.avgRespMin.toFixed(1)}m` : `${(u.avgRespMin/60).toFixed(1)}h`)
                : '—'}
              label={t.menu_hl_avg_reply} />
          </div>
        </div>

        {/* Achievements */}
        {userAchievements.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="fs-mono" style={{
              fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', marginBottom: 10,
            }}>
              {t.menu_badges} · {userAchievements.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {userAchievements.map((ach, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  background: `${ach.color}10`,
                  border: `1px solid ${ach.color}30`,
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: 18 }}>🏆</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 23, fontWeight: 700, color: ach.color }}>{t[ach.labelKey] || ach.labelKey}</div>
                    <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', marginTop: 1 }}>{interp(t[ach.evidenceKey] || '', ach.vars || {})}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ marginTop: 24 }}>
          <div className="fs-mono" style={{
            fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', marginBottom: 10,
          }}>
            {t.menu_leaderboard}
          </div>
          <div style={{
            overflow: 'hidden', background: '#15151d',
            border: '1px solid #2a2a36', borderRadius: 14,
          }}>
            {analytics.users.map((user, i) => {
              const pct = (user.messageCount / analytics.totalMessages) * 100;
              const isUser = user.author === selectedAuthor;
              return (
                <div key={user.author} style={{
                  position: 'relative', padding: '11px 12px',
                  borderBottom: i < analytics.users.length - 1 ? '1px solid #2a2a36' : 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: 0,
                    width: `${Math.min(pct * 2.5, 100)}%`,
                    background: isUser ? 'rgba(163,230,53,0.10)' : 'rgba(163,230,53,0.04)',
                  }} />
                  <div style={{
                    position: 'relative', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div className="fs-mono" style={{
                        fontSize: 20, color: '#c8c8dc', width: 16, fontWeight: 700,
                      }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 23, fontWeight: isUser ? 700 : 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {user.author}{isUser && <span style={{ color: '#a3e635' }}> {t.rank_you}</span>}
                        </div>
                        <div className="fs-mono" style={{
                          fontSize: 20, color: '#c8c8dc', marginTop: 1, fontStyle: 'italic',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {resolveTitle(user, t)}
                        </div>
                      </div>
                    </div>
                    <div className="fs-mono" style={{
                      fontSize: 21, color: isUser ? '#a3e635' : '#d0d0e0',
                      fontWeight: 600, flexShrink: 0,
                    }}>
                      {user.messageCount.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {pickerOpen && (
        <BottomSheet onClose={() => setPickerOpen(false)} title={t.rm_switch_person}>
          {analytics.users.map(user => (
            <button key={user.author} className="press" onClick={() => {
              setSelectedAuthor(user.author);
              setPickerOpen(false);
            }} style={{
              width: '100%', padding: '16px 8px', minHeight: 56, background: 'transparent',
              border: 'none', borderBottom: '1px solid #2a2a36', color: '#f4f4f8',
              fontSize: 23, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 22, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{user.author}</div>
                <div className="fs-mono" style={{
                  fontSize: 20, color: '#a3e635', marginTop: 2, fontStyle: 'italic',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>"{resolveTitle(user, t)}"</div>
              </div>
              <span className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', flexShrink: 0, marginLeft: 8 }}>
                {user.messageCount.toLocaleString()}
              </span>
            </button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}

function HighlightCard({ value, label, accent, small }) {
  return (
    <div style={{
      background: '#15151d', border: '1px solid #2a2a36', borderRadius: 14,
      padding: 13, minHeight: 86,
    }}>
      <div className="fs-display" style={{
        fontSize: small ? 18 : 28, letterSpacing: '-0.02em', lineHeight: 1,
        color: accent ? '#a3e635' : '#f4f4f8',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</div>
      <div className="fs-mono" style={{
        fontSize: 20, color: '#c8c8dc', letterSpacing: '0.12em', marginTop: 8, textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}

function BottomSheet({ children, onClose, title = 'Switch person' }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60,
      }} />
      <div className="no-sb" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        overflowY: 'auto', background: '#0a0a0f',
        borderRadius: '24px 24px 0 0', zIndex: 61,
        maxHeight: '70%', padding: '12px 18px 32px',
        borderTop: '1px solid #2a2a36',
        animation: 'fadeUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        <div style={{
          margin: '0 auto 16px',
          width: 36, height: 4, background: '#2a2a36', borderRadius: 999,
        }} />
        <div className="fs-display" style={{
          fontSize: 22, letterSpacing: '-0.02em', marginBottom: 8,
        }}>
          {title}
        </div>
        {children}
      </div>
    </>
  );
}

// ============================================================
// VERIFY VIEW — Accuracy first, every number traceable
// ============================================================

function VerifyView({ diagnostics, analytics, fileName, t, onContinue, onReset }) {
  // Compute the line-accounting: how is each raw line classified?
  const accounted =
    diagnostics.parsedMessages +
    diagnostics.continuationLines +
    diagnostics.systemMessages +
    diagnostics.deletedMessages +
    diagnostics.skippedUnparseable;
  const unaccounted = diagnostics.nonEmptyLines - accounted;

  // Build sorted per-author tables for easy comparison
  const perAuthor = Object.keys(diagnostics.perAuthorCount).map(a => ({
    author: a,
    messages: diagnostics.perAuthorCount[a] || 0,
    words: diagnostics.perAuthorWordCount[a] || 0,
    media: diagnostics.perAuthorMediaCount[a] || 0,
    voice: diagnostics.perAuthorVoiceCount[a] || 0,
  })).sort((a, b) => b.messages - a.messages);
  const maxMsgs = perAuthor[0]?.messages || 1;
  const maxWords = Math.max(...perAuthor.map(p => p.words), 1);

  const confidence = diagnostics.confidence;
  const confColor = confidence >= 90 ? '#a3e635' : confidence >= 70 ? '#fbbf24' : '#ef4444';
  const confLabel = confidence >= 90 ? 'High' : confidence >= 70 ? 'Medium' : 'Low';

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', background: '#0a0a0f',
    }}>
      <div style={{ padding: '16px 18px 28px' }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6,
        }}>
          <div className="fs-display" style={{
            fontSize: 32, lineHeight: 1, letterSpacing: '-0.03em', flex: 1,
          }}>
            {t.verify_title} <span style={{ fontStyle: 'italic', color: '#a3e635' }}>{t.verify_right}</span>?
          </div>
          <button onClick={onReset} className="press" style={{
            background: 'transparent', border: 'none',
            color: '#b8b8c8', padding: '10px 10px', minHeight: 44,
            fontSize: 22, cursor: 'pointer', flexShrink: 0,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>{t.verify_reset}</button>
        </div>
        <div style={{ fontSize: 22, color: '#d0d0e0', lineHeight: 1.5, marginBottom: 18 }}>
          {t.verify_sub}
        </div>

        {/* Confidence card */}
        <div style={{
          padding: 16, marginBottom: 18,
          background: `${confColor}10`,
          border: `1px solid ${confColor}40`,
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="fs-display" style={{
              fontSize: 56, lineHeight: 1, letterSpacing: '-0.04em', color: confColor,
            }}>
              {confidence}<span style={{ fontSize: 24 }}>%</span>
            </div>
            <div className="fs-mono" style={{ fontSize: 20, color: confColor, letterSpacing: '0.18em', fontWeight: 700 }}>
              {confLabel.toUpperCase()}
            </div>
          </div>
          {diagnostics.warnings.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {diagnostics.warnings.map((w, i) => (
                <div key={i} style={{
                  fontSize: 21, color: confColor, lineHeight: 1.4,
                  display: 'flex', gap: 6, alignItems: 'flex-start',
                }}>
                  <span>⚠</span>
                  <span style={{ flex: 1 }}>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* (1-4) Line accounting */}
        <SectionTitle label="LINE ACCOUNTING" />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12, overflow: 'hidden',
          marginBottom: 18,
        }}>
          <VRow label="Total raw lines" value={diagnostics.rawLineCount.toLocaleString()} />
          <VRow label="Non-empty lines" value={diagnostics.nonEmptyLines.toLocaleString()} />
          <VRow label="Parsed messages" value={diagnostics.parsedMessages.toLocaleString()} accent />
          <VRow label="Continuation lines" value={diagnostics.continuationLines.toLocaleString()}
            hint="multi-line message bodies" />
          <VRow label="Ignored system messages" value={diagnostics.systemMessages.toLocaleString()}
            hint="join/leave/encryption notices" />
          <VRow label="Deleted messages" value={diagnostics.deletedMessages.toLocaleString()} />
          <VRow label="Media messages" value={diagnostics.mediaMessages.toLocaleString()} />
          <VRow label="Voice messages" value={diagnostics.voiceMessages.toLocaleString()} />
          <VRow label="Unsupported / skipped lines"
            value={diagnostics.skippedUnparseable.toLocaleString()}
            warn={diagnostics.skippedUnparseable > diagnostics.nonEmptyLines * 0.05}
            hint="couldn't attach to a known header" />
          <VRow label="Unaccounted" value={unaccounted.toLocaleString()}
            warn={Math.abs(unaccounted) > 0}
            hint="should be 0 if all lines were classified"
            last />
        </div>

        {/* (5) Detected participants */}
        <SectionTitle label={`DETECTED PARTICIPANTS · ${perAuthor.length}`} />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12,
          padding: '12px 14px', marginBottom: 18,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {perAuthor.map(p => (
              <div key={p.author} className="fs-mono" style={{
                background: '#0a0a0f',
                padding: '5px 10px', borderRadius: 999,
                fontSize: 21, color: '#f4f4f8',
              }}>
                {p.author}
              </div>
            ))}
          </div>
          {perAuthor.length === 1 && (
            <div style={{ marginTop: 10, fontSize: 21, color: '#fbbf24', lineHeight: 1.4 }}>
              ⚠ Only one participant detected. If this is a group chat, the parser may have failed.
            </div>
          )}
        </div>

        {/* (7) Per-user message count table */}
        <SectionTitle label="MESSAGES PER PARTICIPANT" />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12,
          overflow: 'hidden', marginBottom: 18,
        }}>
          {perAuthor.map((p, i) => {
            const pct = (p.messages / diagnostics.parsedMessages) * 100;
            return (
              <div key={p.author} style={{
                position: 'relative', padding: '11px 14px',
                borderBottom: i < perAuthor.length - 1 ? '1px solid #2a2a36' : 'none',
              }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${(p.messages / maxMsgs) * 100}%`,
                  background: 'rgba(163,230,53,0.06)',
                }} />
                <div style={{
                  position: 'relative', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}>
                  <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', width: 18, fontWeight: 700 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{
                    flex: 1, fontSize: 23, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.author}</div>
                  <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', minWidth: 42, textAlign: 'right' }}>
                    {pct.toFixed(1)}%
                  </div>
                  <div className="fs-mono" style={{ fontSize: 22, color: '#a3e635', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                    {p.messages.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{
            padding: '9px 14px', background: '#0a0a0f',
            borderTop: '1px solid #2a2a36',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', letterSpacing: '0.1em' }}>
              TOTAL
            </div>
            <div className="fs-mono" style={{ fontSize: 22, color: '#fff', fontWeight: 700 }}>
              {diagnostics.parsedMessages.toLocaleString()}
            </div>
          </div>
        </div>

        {/* (8) Per-user word count table */}
        <SectionTitle label="WORDS PER PARTICIPANT" />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12,
          overflow: 'hidden', marginBottom: 18,
        }}>
          {perAuthor.map((p, i) => {
            const avg = p.messages > 0 ? p.words / p.messages : 0;
            return (
              <div key={p.author} style={{
                position: 'relative', padding: '11px 14px',
                borderBottom: i < perAuthor.length - 1 ? '1px solid #2a2a36' : 'none',
              }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${(p.words / maxWords) * 100}%`,
                  background: 'rgba(96,165,250,0.06)',
                }} />
                <div style={{
                  position: 'relative', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}>
                  <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', width: 18, fontWeight: 700 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{
                    flex: 1, fontSize: 23, fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.author}</div>
                  <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', minWidth: 42, textAlign: 'right' }}>
                    {avg.toFixed(1)} avg
                  </div>
                  <div className="fs-mono" style={{ fontSize: 22, color: '#60a5fa', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                    {p.words.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Media / voice per user — extra signal */}
        {perAuthor.some(p => p.media > 0 || p.voice > 0) && (
          <>
            <SectionTitle label="MEDIA & VOICE PER PARTICIPANT" />
            <div style={{
              background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12,
              overflow: 'hidden', marginBottom: 18,
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                gap: 12, padding: '9px 14px', borderBottom: '1px solid #2a2a36',
              }}>
                <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', letterSpacing: '0.15em' }}>PARTICIPANT</div>
                <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', letterSpacing: '0.15em', textAlign: 'right' }}>MEDIA</div>
                <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', letterSpacing: '0.15em', textAlign: 'right', minWidth: 36 }}>VOICE</div>
              </div>
              {perAuthor.map((p, i) => (
                <div key={p.author} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto',
                  gap: 12, padding: '10px 14px',
                  borderBottom: i < perAuthor.length - 1 ? '1px solid #2a2a36' : 'none',
                  alignItems: 'center',
                }}>
                  <div style={{
                    fontSize: 23,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.author}</div>
                  <div className="fs-mono" style={{ fontSize: 22, color: p.media > 0 ? '#fbbf24' : '#6a6a7a', textAlign: 'right', fontWeight: 600 }}>
                    {p.media.toLocaleString()}
                  </div>
                  <div className="fs-mono" style={{ fontSize: 22, color: p.voice > 0 ? '#a78bfa' : '#6a6a7a', textAlign: 'right', fontWeight: 600, minWidth: 36 }}>
                    {p.voice.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Parser meta */}
        <SectionTitle label="PARSER META" />
        <div style={{
          background: '#15151d', border: '1px solid #2a2a36', borderRadius: 12, overflow: 'hidden',
          marginBottom: 18,
        }}>
          <VRow label="File" value={fileName} />
          <VRow label="Detected format"
            value={diagnostics.detectedFormat
              ? (diagnostics.detectedFormat === 'ios_bracket' ? 'iOS (bracketed)' : 'Android (dash)')
              : 'none'}
            warn={!diagnostics.detectedFormat}
          />
          <VRow label="BOM" value={diagnostics.hadBOM ? 'present, stripped' : 'none'} />
          <VRow label="RTL marks" value={diagnostics.hadDirectionalMarks ? 'present, stripped' : 'none'} />
          <VRow label="Date range"
            value={`${analytics.start.toLocaleDateString()} → ${analytics.end.toLocaleDateString()}`} />
          <VRow label="Duration" value={`${analytics.durationDays} days`} last />
        </div>

        {/* (6) First 20 parsed messages */}
        <SectionTitle label="FIRST 20 PARSED MESSAGES" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {diagnostics.sample.map((s, i) => (
            <div key={i} style={{
              background: '#15151d', border: '1px solid #2a2a36',
              borderRadius: 10, padding: 10, fontSize: 20, lineHeight: 1.5,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 6,
              }}>
                <div className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc' }}>
                  #{String(i + 1).padStart(2, '0')} · line {s.rawLineIdx}
                </div>
                {s.flags && (
                  <div className="fs-mono" style={{
                    fontSize: 20, color: '#bff260', letterSpacing: '0.1em',
                    background: 'rgba(163,230,53,0.14)', padding: '3px 8px', borderRadius: 4,
                  }}>
                    {s.flags}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 6, fontSize: 20 }}>
                <div className="fs-mono" style={{ color: '#c8c8dc' }}>timestamp</div>
                <div className="fs-mono" style={{ color: '#a3e635' }}>{s.timestamp}</div>
                <div className="fs-mono" style={{ color: '#c8c8dc' }}>sender</div>
                <div style={{ color: '#fff', fontWeight: 600 }}>{s.author}</div>
                <div className="fs-mono" style={{ color: '#c8c8dc' }}>content</div>
                <div style={{ color: '#d0d0e0', wordBreak: 'break-word' }}>{s.contentPreview}</div>
              </div>
              <div className="fs-mono" style={{
                marginTop: 8, paddingTop: 8, borderTop: '1px dashed #2a2a36',
                color: '#8b8b9d', fontSize: 20, wordBreak: 'break-all',
              }}>
                raw: {s.rawLine}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={onContinue} className="press" style={{
          width: '100%', position: 'relative', overflow: 'hidden',
          padding: 18, background: '#a3e635', color: '#0a0a0f',
          border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 800,
          cursor: 'pointer', letterSpacing: '-0.01em',
          boxShadow: '0 12px 28px rgba(163,230,53,0.35)',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          {t.verify_continue}
        </button>
        <button onClick={onReset} className="fs-mono press" style={{
          width: '100%', marginTop: 8, padding: 14, minHeight: 44,
          background: 'transparent', border: '1px solid #3a3a48',
          color: '#cfcfdc', borderRadius: 12, fontSize: 22,
          cursor: 'pointer', letterSpacing: '0.15em', fontWeight: 600,
        }}>
          {t.verify_wrong}
        </button>

      </div>
    </div>
  );
}

function SectionTitle({ label }) {
  return (
    <div className="fs-mono" style={{
      fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', fontWeight: 600,
      marginBottom: 8, marginTop: 4,
    }}>
      {label}
    </div>
  );
}

function VRow({ label, value, accent, warn, hint, last }) {
  const valueColor = warn ? '#ef4444' : accent ? '#a3e635' : '#fff';
  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: last ? 'none' : '1px solid #2a2a36',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div className="fs-mono" style={{ fontSize: 21, color: '#d0d0e0' }}>{label}</div>
        <div className="fs-mono" style={{
          fontSize: 22, color: valueColor, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 180, textAlign: 'right',
        }}>{value}</div>
      </div>
      {hint && (
        <div className="fs-mono" style={{ fontSize: 20, color: '#8b8b9d', marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ROAST MODE — view roasts for any user
// ============================================================

function RoastMode({ analytics, selectedAuthor, setSelectedAuthor, t, onBack }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const u = analytics.userMap[selectedAuthor];
  if (!u) return null;

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', position: 'relative',
      background: 'radial-gradient(ellipse at top right, #2a0a1a 0%, #0a0a0f 60%)',
    }}>
      <div style={{ position: 'relative', padding: '14px 18px 28px', zIndex: 1 }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
        }}>
          <button onClick={onBack} className="press" style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid #2a2a36',
            color: '#cfcfdc', padding: '10px 16px', borderRadius: 999,
            fontSize: 22, fontWeight: 600, cursor: 'pointer', minHeight: 44,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>{t.rm_back}</button>
          <div className="fs-mono" style={{ fontSize: 20, color: '#f472b6', letterSpacing: '0.2em', fontWeight: 700 }}>
            {t.rm_title}
          </div>
        </div>

        {/* Title */}
        <div className="fs-display a-fade-up" style={{
          fontSize: 52, lineHeight: 0.9, letterSpacing: '-0.04em',
          marginTop: 4, marginBottom: 8,
        }}>
          {t.rm_pick}<br/>
          <span style={{ fontStyle: 'italic', color: '#f472b6' }}>{t.rm_victim}</span>
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '0.1s',
          fontSize: 23, color: '#d0d0e0', lineHeight: 1.5, marginBottom: 18,
        }}>
          {t.rm_sub}
        </div>

        {/* Person picker pill */}
        <button onClick={() => setPickerOpen(true)} className="press lift a-pop-in" style={{
          width: '100%', position: 'relative', overflow: 'hidden',
          padding: '16px 18px', cursor: 'pointer',
          background: 'linear-gradient(135deg, #f472b6 0%, #ef4444 100%)',
          border: 'none', borderRadius: 18, color: '#fff',
          boxShadow: '0 14px 30px rgba(244,114,182,0.35)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          textAlign: 'left',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'relative' }}>
            <div className="fs-mono" style={{
              fontSize: 20, opacity: 0.8, letterSpacing: '0.2em', fontWeight: 700,
            }}>
              {t.rm_now}
            </div>
            <div className="fs-display" style={{
              fontSize: 28, lineHeight: 1, letterSpacing: '-0.03em',
              marginTop: 4, fontStyle: 'italic',
            }}>
              {selectedAuthor}
            </div>
            <div className="fs-mono" style={{
              fontSize: 20, opacity: 0.85, marginTop: 4, letterSpacing: '0.05em',
            }}>
              {u.messageCount.toLocaleString()} {t.eras_msgs} · "{resolveTitle(u, t)}"
            </div>
          </div>
          <div style={{ position: 'relative', fontSize: 22 }}>↕</div>
        </button>

        {/* Roast cards */}
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {u.roasts.map((roast, i) => (
            <div key={`${selectedAuthor}-${i}`} className="a-roast-card lift" style={{
              position: 'relative', overflow: 'hidden',
              padding: '20px 20px 18px',
              background: i % 2 === 0
                ? 'linear-gradient(135deg, rgba(244,114,182,0.16) 0%, rgba(244,114,182,0.04) 100%)'
                : 'linear-gradient(135deg, rgba(239,68,68,0.14) 0%, rgba(239,68,68,0.03) 100%)',
              border: `1px solid ${i % 2 === 0 ? 'rgba(244,114,182,0.4)' : 'rgba(239,68,68,0.35)'}`,
              borderRadius: 20,
              animationDelay: `${0.1 + i * 0.12}s`,
              boxShadow: i % 2 === 0
                ? '0 10px 28px rgba(244,114,182,0.12)'
                : '0 10px 28px rgba(239,68,68,0.10)',
            }}>
              <div style={{
                position: 'absolute', top: 14, right: 14,
                fontSize: 22, opacity: 0.5,
              }}>{i === 0 ? '🔥' : i === 1 ? '💀' : i === 2 ? '☠️' : '🫠'}</div>
              <div className="fs-mono" style={{
                fontSize: 20, color: i % 2 === 0 ? '#f472b6' : '#ef4444',
                letterSpacing: '0.22em', opacity: 0.75, marginBottom: 10, fontWeight: 700,
              }}>
                {t.rm_roast} #{String(i + 1).padStart(2, '0')}
              </div>
              <div className="fs-display" style={{
                fontSize: 22, lineHeight: 1.2, letterSpacing: '-0.01em',
                color: '#fff', fontWeight: 400,
              }}>
                {interp(t[roast.lineKey] || '', roast.vars || {})}
              </div>
              <div className="fs-display" style={{
                marginTop: 10, fontSize: 18, lineHeight: 1.3, letterSpacing: '-0.005em',
                color: i % 2 === 0 ? '#f472b6' : '#ef4444', fontStyle: 'italic',
              }}>
                {interp(t[roast.kickerKey] || '', roast.vars || {})}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div style={{
          marginTop: 24, padding: '16px 18px',
          background: '#15151d', border: '1px solid #2a2a36',
          borderRadius: 16, textAlign: 'center',
        }}>
          <div className="fs-mono" style={{
            fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', marginBottom: 6,
          }}>
            {t.rm_hot_take}
          </div>
          <div className="fs-display" style={{
            fontSize: 18, lineHeight: 1.3, letterSpacing: '-0.01em', fontStyle: 'italic',
            whiteSpace: 'pre-line',
          }}>
            {interp(t.rm_screenshot, { name: selectedAuthor }).split(selectedAuthor).reduce((acc, part, idx, arr) => {
              acc.push(part);
              if (idx < arr.length - 1) {
                acc.push(<span key={idx} style={{ color: '#f472b6' }}>{selectedAuthor}</span>);
              }
              return acc;
            }, [])}
          </div>
        </div>

        {/* Other victims */}
        <div style={{ marginTop: 24 }}>
          <div className="fs-mono" style={{
            fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', marginBottom: 10,
          }}>
            {t.rm_others}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analytics.users.filter(x => x.author !== selectedAuthor).map((other, i) => (
              <button key={other.author} onClick={() => setSelectedAuthor(other.author)}
                className="press lift" style={{
                  width: '100%', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px',
                  background: '#15151d', border: '1px solid #2a2a36',
                  borderRadius: 12, cursor: 'pointer', color: '#f4f4f8',
                  animation: `fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.05}s both`,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 22, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {other.author}
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 20, color: '#f472b6', marginTop: 2, fontStyle: 'italic',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {interp(other.roasts.length === 1 ? t.rm_ready : t.rm_ready_plural, { n: other.roasts.length })}
                  </div>
                </div>
                <div className="fs-mono" style={{ fontSize: 20, color: '#a3e635', letterSpacing: '0.1em' }}>
                  {t.rm_btn}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {pickerOpen && (
        <BottomSheet onClose={() => setPickerOpen(false)} title={t.rm_switch_person}>
          {analytics.users.map(user => (
            <button key={user.author} className="press" onClick={() => {
              setSelectedAuthor(user.author);
              setPickerOpen(false);
            }} style={{
              width: '100%', padding: '16px 8px', minHeight: 56, background: 'transparent',
              border: 'none', borderBottom: '1px solid #2a2a36', color: '#f4f4f8',
              fontSize: 23, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 22, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{user.author}</div>
                <div className="fs-mono" style={{
                  fontSize: 20, color: '#f472b6', marginTop: 2, fontStyle: 'italic',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{interp(user.roasts.length === 1 ? t.rm_ready : t.rm_ready_plural, { n: user.roasts.length })}</div>
              </div>
              <span className="fs-mono" style={{
                fontSize: 20, color: '#c8c8dc', flexShrink: 0, marginLeft: 8,
              }}>
                {user.messageCount.toLocaleString()}
              </span>
            </button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}