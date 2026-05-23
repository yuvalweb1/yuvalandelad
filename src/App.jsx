import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { parseChat } from './parser/client.js';
import { EMOJI_RE, LINK_RE } from './parser/index.js';
import { RTL_LANGS, detectLang, buildT, interp, resolveTitle, resolveTitleEvidence } from './i18n';

// ============================================================
// PARSER + ZIP — extracted to ./parser (open-source: whatsapp-wrapped-parser).
// parseWhatsApp + readZipText now run off the main thread in a Web Worker,
// driven by parseChat() from ./parser/client.js. EMOJI_RE / LINK_RE are
// re-imported above for the analytics tokenizer in computeAll below.
// ============================================================

// ============================================================
// ANALYTICS — every output derived strictly from parsed messages
// Each field has a "source" comment showing how it's computed.
// ============================================================

const STOPWORDS = new Set([
  // Hebrew
  'אני','אתה','את','הוא','היא','אנחנו','אתם','הם','הן','זה','זאת','של','על','אל','עם','לא','כן','אם','או','גם','רק','כל','יש','אין','היה','כי','אבל','מה','מי','איך','איפה','מתי','למה','כמה','איזה','עוד','כבר','אז','פה','שם','ככה','אוקיי','אוקי','אהה','נו','טוב','הי','היי','שלום','תודה','סבבה','באמת','בטח','אולי','כאילו','יותר','פחות','הכי','מאוד','ממש','די','קצת','הרבה','בכלל','אחרי','לפני','בין','בלי','עד','אמר','אומר','יודע','חושב','רוצה','עושה','בא','באה','שלי','שלך','שלו','שלה','הזה','הזאת','כן','לאן','משהו','כלום','אחד','אחת','כאשר','עכשיו',
  // media-omission noise (safety net — these lines should be flagged as media,
  // but never let the "omitted" word become a signature/top word)
  'הושמט','הושמטה','הושמטו','נכללה',
  // English
  'the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','could','can','may','might','must','i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','this','that','these','those','and','or','but','if','then','so','for','of','at','by','with','from','to','in','on','as','no','yes','not','just','very','too','also','only','all','some','any','more','most','lol','omg','idk','tbh','btw','oh','ah','hmm','yeah','yep','ok','okay','like','one','two','get','got','going','gonna','wanna','what','when','where','why','how','who','which','because','about','out','up','down','here','there','omitted',
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

function argmaxArr(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

// Deterministic string hash → stable pick. Lets the same stat land a different
// roast for different people WITHOUT randomness (same author → same joke).
function rHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}
function rPick(seed, keys) {
  // Salt with the first key so the same author varies across different tiers
  // (not always "variant #0"), while staying fully deterministic.
  return keys[rHash(seed + '|' + keys[0]) % keys.length];
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
      charCount: 0,              // SOURCE: sum of m.contentLength (drives "The Novelist")
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
      respSum: 0,
      respCount: 0,
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
    acc.charCount += m.contentLength;
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
      // Skip LINK_RE scan (costly global regex) when content has no URL prefix
      const text = m.content.includes('http')
        ? m.content.replace(LINK_RE, '').replace(EMOJI_RE, '').toLowerCase()
        : m.content.replace(EMOJI_RE, '').toLowerCase();
      const rawTokens = text.split(/[\s\.,!\?;:()"'\[\]\{\}…—–\-_/\\]+/u);
      for (const t of rawTokens) {
        // replace() can only shorten a string, so skip it for tokens already too short
        if (t.length < 3) continue;
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
        acc.respSum += diffMin;
        acc.respCount++;
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
    const dayTs = days.map(d => new Date(d).getTime());
    let longestStreak = dayTs.length > 0 ? 1 : 0;
    let curStreak = dayTs.length > 0 ? 1 : 0;
    for (let i = 1; i < dayTs.length; i++) {
      const diff = (dayTs[i] - dayTs[i - 1]) / 86400000;
      if (Math.round(diff) === 1) {
        curStreak++;
        if (curStreak > longestStreak) longestStreak = curStreak;
      } else {
        curStreak = 1;
      }
    }

    const longestAbsenceDays = acc.longestAbsenceDays;

    const avgRespMin = acc.respCount > 0 ? acc.respSum / acc.respCount : null;

    const topWordEntry = maxEntry(acc.wordFreq);
    const topEmojiEntry = maxEntry(acc.emojiFreq);

    // Vibe Check — top 5 words + emojis for THIS participant (not the group)
    const top5Words = topNEntries(acc.wordFreq, 5).map(([word, count]) => ({ word, count }));
    const top5Emojis = topNEntries(acc.emojiFreq, 5).map(([emoji, count]) => ({ emoji, count }));

    const peakHour = argmaxArr(acc.hourCounts);
    const peakWeekday = argmaxArr(acc.weekdayCounts);

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
      respSampleSize: acc.respCount,
      topWord: topWordEntry ? topWordEntry[0] : null,
      topWordCount: topWordEntry ? topWordEntry[1] : 0,
      topEmoji: topEmojiEntry ? topEmojiEntry[0] : null,
      topEmojiCount: topEmojiEntry ? topEmojiEntry[1] : 0,
      top5Words, top5Emojis,
      peakHour, peakWeekday,
      nightPct, sharePct,
      questionRate, mediaRate, voiceRate,
      avgWordsPerMsg: acc.wordCount / acc.messageCount,
      avgCharsPerMsg: acc.charCount / acc.messageCount,
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
  // the ui presents this as the share of *others* you outrank, not "all 5 incl you".
  //
  // arr is the full population including the user themselves. val is their own value.
  // We remove exactly one occurrence of val (the user) before counting who they beat.
  function pctRank(arr, val, higherIsBetter) {
    if (arr.length <= 1) return null;
    let removedSelf = false;
    let othersLen = 0;
    let countWorse = 0;
    for (const v of arr) {
      if (!removedSelf && v === val) { removedSelf = true; continue; }
      othersLen++;
      if (higherIsBetter ? v < val : v > val) countWorse++;
    }
    if (othersLen === 0) return null;
    return Math.round((countWorse / othersLen) * 100);
  }

  // Hoist arrays that are identical for every user in the loop.
  const allMessageCounts = userList.map(x => x.messageCount);
  const speedEligible = userList.filter(x => x.respSampleSize >= 5 && x.avgRespMin != null);
  const allRespMins = speedEligible.map(x => x.avgRespMin);

  for (const user of userList) {
    user.messagesPercentile = pctRank(allMessageCounts, user.messageCount, true);
    if (user.respSampleSize >= 5) {
      user.speedPercentile = speedEligible.length > 1
        ? pctRank(allRespMins, user.avgRespMin, false)
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
  // The Ghoster — slowest average reply (highest avgRespMin). Distinct from
  // `ghost` (longest disappearance). Needs >= 2 eligible responders so the
  // slowest isn't just the only person who ever replied.
  const slowResponder = eligibleResponders.length >= 2
    ? argmax(eligibleResponders, u => u.avgRespMin)
    : null;
  // The Novelist — longest average message by character count. Require a
  // minimum sample so one long one-off message can't crown someone.
  const eligibleNovelists = userList.filter(x => x.messageCount >= 20);
  const novelist = (eligibleNovelists.length > 0
    ? argmax(eligibleNovelists, u => u.avgCharsPerMsg)
    : argmax(userList, u => u.avgCharsPerMsg)) || null;
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
    // Single pass instead of four separate filter passes over the same array
    let nightCount = 0, mediaCount = 0, voiceCount = 0, questionCount = 0;
    for (const m of slice) {
      if (m.hour < 6) nightCount++;
      if (m.hasMedia) mediaCount++;
      if (m.isVoice) voiceCount++;
      if (m.isQuestion) questionCount++;
    }
    const eraNightPct = (nightCount / slice.length) * 100;
    const eraMediaPct = (mediaCount / slice.length) * 100;
    const eraVoicePct = (voiceCount / slice.length) * 100;
    const eraQuestionPct = (questionCount / slice.length) * 100;
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
    if (user.nightPct > 30) acks.push({ labelKey: 'st_ach_night', evidenceKey: 'st_ach_ev_night', vars: { pct: user.nightPct.toFixed(0) }, color: '#277da1' });
    if (user.maxBurst >= 12) acks.push({ labelKey: 'st_ach_sprint', evidenceKey: 'st_ach_ev_sprint', vars: { n: user.maxBurst }, color: '#f3722c' });
    if (user.voiceCount >= 30) acks.push({ labelKey: 'st_ach_voice', evidenceKey: 'st_ach_ev_voice', vars: { n: user.voiceCount }, color: '#f9c74f' });
    if (user.longestAbsenceDays >= 21) acks.push({ labelKey: 'st_ach_ghost', evidenceKey: 'st_ach_ev_ghost', vars: { n: user.longestAbsenceDays }, color: '#2a0645' });
    if (user.longestStreak >= 30) acks.push({ labelKey: 'st_ach_iron', evidenceKey: 'st_ach_ev_iron', vars: { n: user.longestStreak }, color: '#f9c74f' });
    if (user.conversationsRevived >= 8) acks.push({ labelKey: 'st_ach_defib', evidenceKey: 'st_ach_ev_defib', vars: { n: user.conversationsRevived }, color: '#277da1' });
    if (user.conversationsKilled >= 8) acks.push({ labelKey: 'st_ach_assassin', evidenceKey: 'st_ach_ev_assassin', vars: { n: user.conversationsKilled }, color: '#f3722c' });
    if (user.emojiCount >= 500) acks.push({ labelKey: 'st_ach_emoji_hof', evidenceKey: 'st_ach_ev_emoji_hof', vars: { n: user.emojiCount }, color: '#f9c74f' });
    if (user.avgRespMin !== null && user.avgRespMin < 1.5 && user.respSampleSize >= 50)
      acks.push({ labelKey: 'st_ach_submin', evidenceKey: 'st_ach_ev_submin', vars: { s: (user.avgRespMin*60).toFixed(0), n: user.respSampleSize }, color: '#277da1' });
    if (user.sharePct > 40) acks.push({ labelKey: 'st_ach_solo', evidenceKey: 'st_ach_ev_solo', vars: { pct: user.sharePct.toFixed(0) }, color: '#f3722c' });
    if (user.finalMessagesOfDay >= durationDays * 0.3)
      acks.push({ labelKey: 'st_ach_lastword', evidenceKey: 'st_ach_ev_lastword', vars: { n: user.finalMessagesOfDay }, color: '#f9c74f' });
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
  // Each matched trigger yields a CANDIDATE with its variant pool + a `metric`
  // (how extreme this person is at that trait). A group pass then makes roasts
  // UNIQUE per person: for each trait, people are ranked by metric and the
  // most-guilty ones get DISTINCT punchlines; only the top few keep a trait, so
  // every person is roasted mainly for what they personally lead the group in.
  const V = (...n) => n; // tiny helper for readability
  function roastCandidates(user) {
    const out = [];

    // ===== TIER 1: Speed-based =====
    if (user.avgRespMin !== null && user.avgRespMin < 0.5 && user.respSampleSize >= 30) {
      out.push({ lineKey: 'st_r_speed_blink_l', kvars: V('st_r_speed_blink_k', 'st_r_speed_blink_k2', 'st_r_speed_blink_k3'), vars: { s: Math.round(user.avgRespMin * 60) }, metric: -user.avgRespMin });
    } else if (user.avgRespMin !== null && user.avgRespMin < 2 && user.respSampleSize >= 30) {
      out.push({ lineKey: 'st_r_speed_flat_l', kvars: V('st_r_speed_flat_k', 'st_r_speed_flat_k2', 'st_r_speed_flat_k3'), vars: { m: user.avgRespMin.toFixed(1) }, metric: -user.avgRespMin });
    } else if (user.avgRespMin !== null && user.avgRespMin > 240 && user.respSampleSize >= 10) {
      out.push({ lineKey: 'st_r_speed_slow_l', kvars: V('st_r_speed_slow_k', 'st_r_speed_slow_k2', 'st_r_speed_slow_k3'), vars: { h: (user.avgRespMin / 60).toFixed(1) }, metric: user.avgRespMin });
    }

    // ===== TIER 2: Volume-based =====
    if (user.sharePct > 40) {
      out.push({ lineKey: 'st_r_vol_pod_l', kvars: V('st_r_vol_pod_k', 'st_r_vol_pod_k2', 'st_r_vol_pod_k3'), vars: { pct: user.sharePct.toFixed(0) }, metric: user.sharePct });
    } else if (user.sharePct > 30) {
      out.push({ lineKey: 'st_r_vol_dom_l', kvars: V('st_r_vol_dom_k', 'st_r_vol_dom_k2', 'st_r_vol_dom_k3'), vars: { pct: user.sharePct.toFixed(0) }, metric: user.sharePct });
    } else if (user.sharePct < 2 && user.messageCount >= 5) {
      out.push({ lineKey: 'st_r_vol_tiny_l', kvars: V('st_r_vol_tiny_k', 'st_r_vol_tiny_k2', 'st_r_vol_tiny_k3'), vars: { pct: user.sharePct.toFixed(1), n: user.messageCount }, metric: -user.sharePct });
    } else if (user.sharePct < 5 && user.messageCount >= 10) {
      out.push({ lineKey: 'st_r_vol_watch_l', kvars: V('st_r_vol_watch_k', 'st_r_vol_watch_k2', 'st_r_vol_watch_k3'), vars: { pct: user.sharePct.toFixed(1) }, metric: -user.sharePct });
    }

    // ===== TIER 3: Spam bursts =====
    if (user.maxBurst >= 20) {
      out.push({ lineKey: 'st_r_burst_hostage_l', kvars: V('st_r_burst_hostage_k', 'st_r_burst_hostage_k2', 'st_r_burst_hostage_k3'), vars: { n: user.maxBurst }, metric: user.maxBurst });
    } else if (user.maxBurst >= 12) {
      out.push({ lineKey: 'st_r_burst_uninterr_l', kvars: V('st_r_burst_uninterr_k', 'st_r_burst_uninterr_k2', 'st_r_burst_uninterr_k3'), vars: { n: user.maxBurst }, metric: user.maxBurst });
    } else if (user.maxBurst >= 8) {
      out.push({ lineKey: 'st_r_burst_record_l', kvars: V('st_r_burst_record_k', 'st_r_burst_record_k2', 'st_r_burst_record_k3'), vars: { n: user.maxBurst }, metric: user.maxBurst });
    }

    // ===== TIER 4: Night activity =====
    if (user.nightPct > 45) {
      out.push({ lineKey: 'st_r_night_tab_l', kvars: V('st_r_night_tab_k', 'st_r_night_tab_k2', 'st_r_night_tab_k3'), vars: { pct: user.nightPct.toFixed(0) }, metric: user.nightPct });
    } else if (user.nightPct > 30) {
      out.push({ lineKey: 'st_r_night_close_l', kvars: V('st_r_night_close_k', 'st_r_night_close_k2', 'st_r_night_close_k3'), vars: { pct: user.nightPct.toFixed(0) }, metric: user.nightPct });
    } else if (user.peakHour === 3 || user.peakHour === 4) {
      out.push({ lineKey: 'st_r_night_crisis_l', kvars: V('st_r_night_crisis_k', 'st_r_night_crisis_k2', 'st_r_night_crisis_k3'), vars: { h: user.peakHour }, metric: user.nightMessages });
    }

    // ===== TIER 5: Ghosting =====
    if (user.longestAbsenceDays >= 60 && user.messageCount >= 30) {
      out.push({ lineKey: 'st_r_ghost_iconic_l', kvars: V('st_r_ghost_iconic_k', 'st_r_ghost_iconic_k2', 'st_r_ghost_iconic_k3'), vars: { n: user.longestAbsenceDays }, metric: user.longestAbsenceDays });
    } else if (user.longestAbsenceDays >= 21 && user.messageCount >= 20) {
      out.push({ lineKey: 'st_r_ghost_vanish_l', kvars: V('st_r_ghost_vanish_k', 'st_r_ghost_vanish_k2', 'st_r_ghost_vanish_k3'), vars: { n: user.longestAbsenceDays }, metric: user.longestAbsenceDays });
    }

    // ===== TIER 6: Voice notes =====
    if (user.voiceCount >= 50) {
      out.push({ lineKey: 'st_r_voice_beg_l', kvars: V('st_r_voice_beg_k', 'st_r_voice_beg_k2', 'st_r_voice_beg_k3'), vars: { n: user.voiceCount }, metric: user.voiceCount });
    } else if (user.voiceCount >= 25) {
      out.push({ lineKey: 'st_r_voice_mono_l', kvars: V('st_r_voice_mono_k', 'st_r_voice_mono_k2', 'st_r_voice_mono_k3'), vars: { n: user.voiceCount }, metric: user.voiceCount });
    }

    // ===== TIER 7: Questions =====
    if (user.questionRate > 0.35) {
      out.push({ lineKey: 'st_r_q_google_l', kvars: V('st_r_q_google_k', 'st_r_q_google_k2', 'st_r_q_google_k3'), vars: { pct: Math.round(user.questionRate * 100) }, metric: user.questionRate });
    } else if (user.questionRate > 0.25) {
      out.push({ lineKey: 'st_r_q_tired_l', kvars: V('st_r_q_tired_k', 'st_r_q_tired_k2', 'st_r_q_tired_k3'), vars: {}, metric: user.questionRate });
    }

    // ===== TIER 8: Media spam =====
    if (user.mediaRate > 0.35) {
      out.push({ lineKey: 'st_r_media_fwd_l', kvars: V('st_r_media_fwd_k', 'st_r_media_fwd_k2', 'st_r_media_fwd_k3'), vars: { pct: Math.round(user.mediaRate * 100) }, metric: user.mediaRate });
    } else if (user.mediaRate > 0.25) {
      out.push({ lineKey: 'st_r_media_redist_l', kvars: V('st_r_media_redist_k', 'st_r_media_redist_k2', 'st_r_media_redist_k3'), vars: { pct: Math.round(user.mediaRate * 100), rest: Math.round((1 - user.mediaRate) * 100) }, metric: user.mediaRate });
    }

    // ===== TIER 9: Being ignored =====
    if (user.ignoredRate > 0.40 && user.messageCount >= 30) {
      out.push({ lineKey: 'st_r_ign_thumb_l', kvars: V('st_r_ign_thumb_k', 'st_r_ign_thumb_k2', 'st_r_ign_thumb_k3'), vars: { pct: Math.round(user.ignoredRate * 100) }, metric: user.ignoredRate });
    } else if (user.ignoredRate > 0.25 && user.messageCount >= 30) {
      out.push({ lineKey: 'st_r_ign_said_l', kvars: V('st_r_ign_said_k', 'st_r_ign_said_k2', 'st_r_ign_said_k3'), vars: { pct: Math.round(user.ignoredRate * 100) }, metric: user.ignoredRate });
    }

    // ===== TIER 10: Conversation killing =====
    if (user.conversationsKilled >= 15) {
      out.push({ lineKey: 'st_r_kill_arg_l', kvars: V('st_r_kill_arg_k', 'st_r_kill_arg_k2', 'st_r_kill_arg_k3'), vars: { n: user.conversationsKilled }, metric: user.conversationsKilled });
    } else if (user.conversationsKilled >= 8) {
      out.push({ lineKey: 'st_r_kill_susp_l', kvars: V('st_r_kill_susp_k', 'st_r_kill_susp_k2', 'st_r_kill_susp_k3'), vars: { n: user.conversationsKilled }, metric: user.conversationsKilled });
    }

    // ===== TIER 11: Emoji abuse =====
    if (user.emojiCount >= 1000) {
      out.push({ lineKey: 'st_r_emoji_help_l', kvars: V('st_r_emoji_help_k', 'st_r_emoji_help_k2', 'st_r_emoji_help_k3'), vars: { n: user.emojiCount.toLocaleString(), per: Math.round(user.emojiCount / user.messageCount) }, metric: user.emojiCount });
    } else if (user.emojiCount >= 500) {
      out.push({ lineKey: 'st_r_emoji_words_l', kvars: V('st_r_emoji_words_k', 'st_r_emoji_words_k2', 'st_r_emoji_words_k3'), vars: { n: user.emojiCount }, metric: user.emojiCount });
    } else if (user.emojiCount === 0 && user.messageCount >= 50) {
      out.push({ lineKey: 'st_r_emoji_zero_l', kvars: V('st_r_emoji_zero_k', 'st_r_emoji_zero_k2', 'st_r_emoji_zero_k3'), vars: { n: user.messageCount }, metric: user.messageCount });
    }

    // ===== TIER 12: Length =====
    if (user.avgWordsPerMsg > 40) {
      out.push({ lineKey: 'st_r_len_ted_l', kvars: V('st_r_len_ted_k', 'st_r_len_ted_k2', 'st_r_len_ted_k3'), vars: { n: user.avgWordsPerMsg.toFixed(0) }, metric: user.avgWordsPerMsg });
    } else if (user.avgWordsPerMsg > 25) {
      out.push({ lineKey: 'st_r_len_tldr_l', kvars: V('st_r_len_tldr_k', 'st_r_len_tldr_k2', 'st_r_len_tldr_k3'), vars: { n: user.avgWordsPerMsg.toFixed(0) }, metric: user.avgWordsPerMsg });
    } else if (user.avgWordsPerMsg < 2 && user.messageCount >= 50) {
      out.push({ lineKey: 'st_r_len_poem_l', kvars: V('st_r_len_poem_k', 'st_r_len_poem_k2', 'st_r_len_poem_k3'), vars: { n: user.avgWordsPerMsg.toFixed(1) }, metric: user.messageCount });
    }

    // ===== TIER 13: Reviver =====
    if (user.conversationsRevived >= 15) {
      out.push({ lineKey: 'st_r_rev_bless_l', kvars: V('st_r_rev_bless_k', 'st_r_rev_bless_k2', 'st_r_rev_bless_k3'), vars: { n: user.conversationsRevived }, metric: user.conversationsRevived });
    }

    // ===== TIER 14: Streak =====
    if (user.longestStreak >= 60) {
      out.push({ lineKey: 'st_r_streak_grass_l', kvars: V('st_r_streak_grass_k', 'st_r_streak_grass_k2', 'st_r_streak_grass_k3'), vars: { n: user.longestStreak }, metric: user.longestStreak });
    } else if (user.longestStreak >= 30) {
      out.push({ lineKey: 'st_r_streak_love_l', kvars: V('st_r_streak_love_k', 'st_r_streak_love_k2', 'st_r_streak_love_k3'), vars: { n: user.longestStreak }, metric: user.longestStreak });
    }

    // ===== TIER 15: Novelist (longest messages by characters) =====
    if (user.avgCharsPerMsg > 160) {
      out.push({ lineKey: 'st_r_novel_l', kvars: V('st_r_novel_k', 'st_r_novel_k2', 'st_r_novel_k3'), vars: { n: Math.round(user.avgCharsPerMsg) }, metric: user.avgCharsPerMsg });
    }

    // ===== TIER 16: Link spammer =====
    if (user.linkCount >= 30) {
      out.push({ lineKey: 'st_r_link_l', kvars: V('st_r_link_k', 'st_r_link_k2', 'st_r_link_k3'), vars: { n: user.linkCount.toLocaleString() }, metric: user.linkCount });
    }

    // ===== TIER 17: Last-word obsession =====
    if (user.finalMessagesOfDay >= 30) {
      out.push({ lineKey: 'st_r_last_l', kvars: V('st_r_last_k', 'st_r_last_k2', 'st_r_last_k3'), vars: { n: user.finalMessagesOfDay }, metric: user.finalMessagesOfDay });
    }

    // ===== TIER 18: Main character (gets replies) =====
    if (user.replyReceivedRate > 0.6 && user.messageCount >= 30) {
      out.push({ lineKey: 'st_r_loved_l', kvars: V('st_r_loved_k', 'st_r_loved_k2', 'st_r_loved_k3'), vars: { pct: Math.round(user.replyReceivedRate * 100) }, metric: user.replyReceivedRate });
    }

    // ===== TIER 19: Early bird =====
    if (user.peakHour >= 5 && user.peakHour <= 9 && user.messageCount >= 20) {
      out.push({ lineKey: 'st_r_morn_l', kvars: V('st_r_morn_k', 'st_r_morn_k2', 'st_r_morn_k3'), vars: { h: user.peakHour }, metric: user.messageCount });
    }

    // ===== TIER 20: One-trick vocabulary =====
    if (user.topWord && user.topWordCount >= 80) {
      out.push({ lineKey: 'st_r_oneword_l', kvars: V('st_r_oneword_k', 'st_r_oneword_k2', 'st_r_oneword_k3'), vars: { word: user.topWord, n: user.topWordCount.toLocaleString() }, metric: user.topWordCount });
    }

    return out;
  }

  // --- Group pass: assign UNIQUE roasts so no two people share a punchline ---
  const byTrait = {}; // lineKey -> [{ user, cand }]
  for (const user of userList) {
    user._cands = roastCandidates(user);
    for (const cand of user._cands) (byTrait[cand.lineKey] = byTrait[cand.lineKey] || []).push({ user, cand });
  }
  for (const lineKey in byTrait) {
    // most-guilty first; tiebreak by name hash so it's stable but not alphabetical
    const matchers = byTrait[lineKey].sort((a, b) =>
      (b.cand.metric - a.cand.metric) || (rHash(a.user.author) - rHash(b.user.author)));
    matchers.forEach((m, rank) => {
      if (rank < m.cand.kvars.length) {
        m.cand.kickerKey = m.cand.kvars[rank]; // distinct punchline per person
        m.cand.rank = rank;                    // 0 = they own this trait
      }
      // beyond the variant pool → leave unresolved so the trait isn't reused
    });
  }
  // Filler pool for "normies" who don't lead any trait — assigned with global
  // de-dup so even the unremarkable people each get a DIFFERENT generic burn.
  const FALLBACK_KEYS = V('st_r_fallback_k', 'st_r_fallback_k2', 'st_r_fallback_k3', 'st_r_fallback_k4', 'st_r_fallback_k5', 'st_r_fallback_k6', 'st_r_fallback_k7', 'st_r_fallback_k8');
  const fbUsed = new Set();
  for (const user of userList) {
    const roasts = user._cands
      .filter(c => c.kickerKey)
      .sort((a, b) => a.rank - b.rank) // lead with the traits they top the group in
      .map(c => ({ lineKey: c.lineKey, kickerKey: c.kickerKey, vars: c.vars }));
    if (roasts.length === 0) {
      const start = rHash(user.author) % FALLBACK_KEYS.length;
      let chosen = FALLBACK_KEYS[start];
      for (let o = 0; o < FALLBACK_KEYS.length; o++) {
        const k = FALLBACK_KEYS[(start + o) % FALLBACK_KEYS.length];
        if (!fbUsed.has(k)) { chosen = k; break; }
      }
      fbUsed.add(chosen);
      roasts.push({ lineKey: 'st_r_fallback_l', kickerKey: chosen, vars: { n: user.messageCount } });
    }
    user.roasts = roasts;
    delete user._cands;
  }

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
    slowResponder, novelist,
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
          <div style={{ color: '#f3722c', fontWeight: 700, marginBottom: 12 }}>
            ChatWrapped hit an unexpected error.
          </div>
          <div style={{ marginBottom: 6 }}>{String(this.state.error)}</div>
          <div style={{ color: '#c8c8dc', marginTop: 12 }}>
            {this.state.error?.stack?.slice(0, 800)}
          </div>
          <button onClick={() => this.setState({ error: null })} style={{
            marginTop: 20, padding: '8px 14px', background: '#f9c74f',
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
// I18N — UI strings extracted to ./i18n (one file per language).
// LANGUAGES below is the picker metadata (display name + flag).
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

function ChatWrappedApp() {
  // First visit shows the how-to-export guide before the home screen; returning
  // visitors skip straight to home (the guide stays reachable from the home link).
  const [stage, setStage] = useState(() => {
    try { return localStorage.getItem('cw_seen_guide') ? 'landing' : 'howto'; } catch { return 'howto'; }
  });
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
    const lname = file.name.toLowerCase();
    if (!lname.endsWith('.zip') && !lname.endsWith('.txt')) {
      setParseError('Upload a .txt or .zip from WhatsApp export.');
      setStage('landing');
      return;
    }
    try {
      // ZIP inflate + parse run in a Web Worker so a huge export never
      // freezes the UI. Progress phases drive the cinematic stage meter.
      const { messages: parsed, diagnostics: diag, media } = await parseChat({
        file,
        onProgress: (phase) => setParsingStage(phase === 'unzip' ? 1 : 2),
      });
      setDiagnostics(diag);
      if (parsed.length === 0) {
        setParseError(t.err_no_msgs);
        setStage('landing');
        return;
      }
      setParsingStage(3);
      await new Promise(r => setTimeout(r, 400));
      const a = computeAll(parsed);
      a.photos = media || [];   // real images from a "with media" .zip (blob URLs)
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
    const text = generateSampleText();
    const { messages: parsed, diagnostics: diag } = await parseChat({
      text,
      onProgress: () => setParsingStage(2),
    });
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
    // Free any object URLs created for chat photos before dropping analytics.
    if (analytics && analytics.photos) {
      for (const p of analytics.photos) { try { URL.revokeObjectURL(p.url); } catch {} }
    }
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
        fontFamily: '"DM Sans", "Comix CLM", -apple-system, sans-serif',
        isolation: 'isolate',
      }}>
        <BlobBackground />
        <StatusBar />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} dir={isRTL ? 'rtl' : 'auto'}>
          {stage === 'howto' && (
            <HowToGuide
              t={t}
              onStart={() => {
                try { localStorage.setItem('cw_seen_guide', '1'); } catch {}
                setStage('landing');
              }}
            />
          )}
          {stage === 'landing' && (
            <Landing
              onFile={handleFile}
              onDemo={loadDemo}
              parseError={parseError}
              t={t}
              lang={lang}
              setLang={setLang}
              onHowTo={() => setStage('howto')}
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
              onExit={() => setStage('landing')}
              onMenu={() => setStage('menu')}
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
// BLOB BACKGROUND
// ============================================================

function BlobBackground() {
  const reducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const blob = (name, dur, reverse = false) =>
    reducedMotion ? 'none' : `${name} ${dur}s ease-in-out infinite${reverse ? ' reverse' : ''}`;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', width: 280, height: 280, borderRadius: '50%',
        background: 'var(--neon-pink)', opacity: 0.35, filter: 'blur(80px)',
        top: '-60px', left: '-60px', animation: blob('blobDrift1', 18),
      }} />
      <div style={{
        position: 'absolute', width: 320, height: 260, borderRadius: '50%',
        background: 'var(--blue-violet)', opacity: 0.35, filter: 'blur(80px)',
        top: '30%', right: '-80px', animation: blob('blobDrift2', 22),
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'var(--amber-gold)', opacity: 0.35, filter: 'blur(80px)',
        bottom: '-40px', left: '10%', animation: blob('blobDrift3', 25),
      }} />
      <div style={{
        position: 'absolute', width: 200, height: 200, borderRadius: '50%',
        background: 'var(--azure-blue)', opacity: 0.35, filter: 'blur(80px)',
        top: '15%', left: '-20px', animation: blob('blobDrift1', 20, true),
      }} />
      <div style={{
        position: 'absolute', width: 250, height: 220, borderRadius: '50%',
        background: 'var(--blaze-orange)', opacity: 0.35, filter: 'blur(80px)',
        top: '55%', right: '-30px', animation: blob('blobDrift2', 15, true),
      }} />
    </div>
  );
}

// ============================================================
// SLIDES BLOB BACKGROUND
// ============================================================

function SlidesBlobBackground() {
  const containerRef = useRef(null);
  const b1 = useRef(null), b2 = useRef(null), b3 = useRef(null), b4 = useRef(null);

  useEffect(() => {
    const blobRefs = [b1, b2, b3, b4];
    // cx/cy = center as fraction of container size; spread across all 4 quadrants
    const configs = [
      { cx: 0.18, cy: 0.20, ax1: 55, ay1: 50, ax2: 30, ay2: 35, fx1: 0.00071, fy1: 0.00053, fx2: 0.00041, fy2: 0.00067, px1: 0.0, py1: 1.2, px2: 2.1, py2: 0.5 },
      { cx: 0.78, cy: 0.30, ax1: 50, ay1: 60, ax2: 35, ay2: 28, fx1: 0.00059, fy1: 0.00079, fx2: 0.00037, fy2: 0.00043, px1: 3.1, py1: 0.8, px2: 1.5, py2: 2.7 },
      { cx: 0.22, cy: 0.72, ax1: 65, ay1: 42, ax2: 28, ay2: 50, fx1: 0.00083, fy1: 0.00047, fx2: 0.00061, fy2: 0.00031, px1: 1.7, py1: 3.4, px2: 0.9, py2: 1.1 },
      { cx: 0.74, cy: 0.76, ax1: 45, ay1: 55, ax2: 40, ay2: 32, fx1: 0.00049, fy1: 0.00073, fx2: 0.00081, fy2: 0.00057, px1: 2.3, py1: 0.6, px2: 0.4, py2: 2.9 },
    ];
    let rafId;
    const animate = (t) => {
      const container = containerRef.current;
      const W = container ? container.offsetWidth : 380;
      const H = container ? container.offsetHeight : 820;
      blobRefs.forEach((ref, i) => {
        if (!ref.current) return;
        const c = configs[i];
        const el = ref.current;
        const x = c.cx * W + Math.sin(t * c.fx1 + c.px1) * c.ax1 + Math.sin(t * c.fx2 + c.px2) * c.ax2;
        const y = c.cy * H + Math.sin(t * c.fy1 + c.py1) * c.ay1 + Math.sin(t * c.fy2 + c.py2) * c.ay2;
        el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${y - el.offsetHeight / 2}px)`;
      });
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div ref={b1} style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', willChange: 'transform', background: 'radial-gradient(circle, #f94144 0%, #f3722c 45%, transparent 70%)', opacity: 0.45 }} />
      <div ref={b2} style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', willChange: 'transform', background: 'radial-gradient(circle, #577590 0%, #277da1 45%, transparent 70%)', opacity: 0.40 }} />
      <div ref={b3} style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', willChange: 'transform', background: 'radial-gradient(circle, #f9c74f 0%, #f3722c 45%, transparent 70%)', opacity: 0.42 }} />
      <div ref={b4} style={{ position: 'absolute', width: 130, height: 130, borderRadius: '50%', willChange: 'transform', background: 'radial-gradient(circle, #277da1 0%, #577590 50%, transparent 70%)', opacity: 0.38 }} />
    </div>
  );
}

// ============================================================
// GLOBAL STYLES
// ============================================================

function GlobalStyles() {
  return (
    <style>{`
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
      .fs-display { font-family: 'Bricolage Grotesque', 'Rubik Black', 'Comix CLM', serif; }
      .fs-mono { font-family: 'Inter Tight', 'DM Sans', 'Comix CLM', -apple-system, sans-serif; font-feature-settings: 'tnum' on; font-variant-numeric: tabular-nums; font-weight: 500; }
      .fs-sans { font-family: 'DM Sans', 'Comix CLM', -apple-system, sans-serif; }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleSpring { 0% { opacity: 0; transform: scale(0.5); } 60% { transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      @keyframes slideRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes slideUpFar { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes spin360 { to { transform: rotate(360deg); } }
      @keyframes pulseGlow {
        0%, 100% { filter: drop-shadow(0 0 14px rgba(249,199,79,0.45)); }
        50% { filter: drop-shadow(0 0 30px rgba(249,199,79,0.9)); }
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
      @keyframes blobDrift1 {
        0%, 100% { transform: translate(0px, 0px) scale(1); }
        33% { transform: translate(40px, -30px) scale(1.08); }
        66% { transform: translate(-20px, 20px) scale(0.96); }
      }
      @keyframes blobDrift2 {
        0%, 100% { transform: translate(0px, 0px) scale(1); }
        40% { transform: translate(-35px, 25px) scale(1.06); }
        70% { transform: translate(25px, -15px) scale(0.94); }
      }
      @keyframes blobDrift3 {
        0%, 100% { transform: translate(0px, 0px) scale(1); }
        30% { transform: translate(20px, 30px) scale(1.1); }
        60% { transform: translate(-30px, -20px) scale(0.92); }
      }
      .slide-content { color: #2a0645; }
      .slide-content * { text-shadow: 0 1px 8px rgba(255,255,255,0.8); }
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
      @keyframes slideEnterRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes slideEnterLeft  { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      .slide-in-right { animation: slideEnterRight 350ms cubic-bezier(0.4, 0, 0.2, 1) both; }
      .slide-in-left  { animation: slideEnterLeft  350ms cubic-bezier(0.4, 0, 0.2, 1) both; }
      .slide-content  { animation: fadeIn 0.4s ease 0.12s both; }
      .no-sb::-webkit-scrollbar { display: none; }
      .no-sb { scrollbar-width: none; }
      .press { transition: transform 0.1s; }
      .press:active { transform: scale(0.94); }
      .lift { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s; }
      .lift:active { transform: scale(0.97) translateY(2px); }
      .cw-frame * { box-sizing: border-box; }

      /* ===== Ultra-Pop "Roast Cards" — high-contrast, rounded, floating ===== */
      .roast-card {
        background: var(--card-bg);
        color: #fff;
        border-radius: 28px;
        padding: 20px 22px;
        border: 3px solid rgba(255,255,255,0.07);
        box-shadow: 0 10px 0 rgba(74,14,78,0.22), 0 22px 45px -8px rgba(74,14,78,0.45);
      }
      .roast-card.is-navy {
        background: var(--card-bg-alt);
        box-shadow: 0 10px 0 rgba(10,25,47,0.25), 0 22px 45px -8px rgba(10,25,47,0.5);
      }
      .roast-card.is-floating { animation: popFloat 4.5s ease-in-out infinite; }
      @keyframes popFloat {
        0%, 100% { transform: translateY(0) rotate(-0.6deg); }
        50%      { transform: translateY(-9px) rotate(0.6deg); }
      }

      /* ===== Ultra-Pop CTA buttons — chunky, game-UI press ===== */
      .pop-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        background: var(--cta); color: var(--ink-alt);
        border: none; border-radius: 999px;
        padding: 15px 30px; font-weight: 800; font-size: 17px;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        box-shadow: 0 6px 0 rgba(0,0,0,0.2), 0 12px 26px -4px rgba(0,191,255,0.5);
        transition: transform 0.08s ease, box-shadow 0.08s ease;
      }
      .pop-btn.is-pink {
        background: var(--cta-2); color: #fff;
        box-shadow: 0 6px 0 rgba(0,0,0,0.2), 0 12px 26px -4px rgba(255,105,180,0.5);
      }
      .pop-btn:active {
        transform: translateY(4px);
        box-shadow: 0 2px 0 rgba(0,0,0,0.2), 0 6px 14px -4px rgba(0,0,0,0.35);
      }

      /* Keyboard focus indicator — does not appear on mouse/touch click. */
      .cw-frame :focus { outline: none; }
      .cw-frame :focus-visible {
        outline: 2px solid #f9c74f;
        outline-offset: 2px;
        border-radius: 4px;
      }
      .cw-frame button:focus-visible,
      .cw-frame [role="button"]:focus-visible {
        outline: 2px solid #f9c74f;
        outline-offset: 3px;
        box-shadow: 0 0 0 4px rgba(249,199,79,0.18);
      }

      /* Respect reduced-motion preference: stop infinite/decorative animations. */
      @media (prefers-reduced-motion: reduce) {
        .a-pulse-glow, .a-spin, .a-shine, .a-shimmer-flash,
        .a-gradient-shift, .a-shake, .a-wobble, .a-float {
          animation: none !important;
        }
        .a-fade-up, .a-fade-in, .a-scale-in, .a-spring,
        .a-slide-right, .a-slide-up-far, .a-bar,
        .a-pop-in, .a-roast-card,
        .slide-in-right, .slide-in-left, .slide-content {
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

// ============================================================
// HOW-TO GUIDE — step-by-step "export your WhatsApp chat", shown first.
// Illustrations are inline WhatsApp-UI mockups (no external images), so it
// stays 100% on-device and matches the app's style.
// ============================================================
function MiniPhone({ children }) {
  return (
    <div style={{
      width: 128, height: 200, borderRadius: 18, background: '#ECE5DD',
      border: '5px solid #15151d', overflow: 'hidden', flexShrink: 0,
      position: 'relative', boxShadow: '0 10px 22px -8px rgba(74,14,78,0.45)',
    }}>{children}</div>
  );
}
function HandPointer({ style }) {
  return <div className="a-float" style={{ position: 'absolute', fontSize: 22, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))', pointerEvents: 'none', ...style }}>👆</div>;
}
const HL = { background: '#FFD700', color: '#15151d', borderRadius: 4, boxShadow: '0 0 0 2px #FF69B4' };
function WaHeader({ name, highlightName, highlightDots }) {
  return (
    <div style={{ height: 30, background: '#075E54', display: 'flex', alignItems: 'center', gap: 5, padding: '0 7px', color: '#fff' }}>
      <span style={{ fontSize: 12 }}>‹</span>
      <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#25D366', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: highlightName ? '1px 3px' : 0, ...(highlightName ? HL : {}) }}>{name}</div>
        <div style={{ fontSize: 6.5, opacity: 0.85 }}>online</div>
      </div>
      <span style={{ fontSize: 14, lineHeight: 1, padding: highlightDots ? '0 2px' : 0, ...(highlightDots ? HL : {}) }}>⋮</span>
    </div>
  );
}
function WaMock({ kind, t }) {
  const bubble = (txt, mine) => (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', background: mine ? '#DCF8C6' : '#fff', borderRadius: 8, padding: '4px 6px', fontSize: 7.5, color: '#222', boxShadow: '0 1px 1px rgba(0,0,0,0.12)' }} dir="auto">{txt}</div>
  );
  const chatBody = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 8 }}>
      {bubble('היי מה קורה 😄', false)}{bubble('סבבה, ואצלך?', true)}{bubble('בואו ניפגש מחר 🔥', false)}
    </div>
  );
  if (kind === 'chat') return <MiniPhone><WaHeader name={t.howto_mock_group} />{chatBody}</MiniPhone>;
  if (kind === 'name') return <MiniPhone><WaHeader name={t.howto_mock_group} highlightName />{chatBody}<HandPointer style={{ top: 22, insetInlineStart: 38 }} /></MiniPhone>;
  if (kind === 'dots') return <MiniPhone><WaHeader name={t.howto_mock_group} highlightDots />{chatBody}<HandPointer style={{ top: 22, insetInlineEnd: 2 }} /></MiniPhone>;
  if (kind === 'export') {
    const rows = [
      { label: t.howto_mock_row_media, hl: false },
      { label: t.howto_mock_row_mute, hl: false },
      { label: t.howto_mock_export, hl: true },
      { label: t.howto_mock_row_clear, hl: false },
    ];
    return (
      <MiniPhone>
        <div style={{ height: 26, background: '#075E54' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => (
            <div key={i} dir="auto" style={{ fontSize: 8.5, padding: '8px 8px', borderBottom: '1px solid #eee', color: r.hl ? '#15151d' : '#444', fontWeight: r.hl ? 800 : 500, ...(r.hl ? { background: '#FFD700', boxShadow: 'inset 0 0 0 2px #FF69B4' } : { background: '#fff' }) }}>{r.label}</div>
          ))}
        </div>
        <HandPointer style={{ top: 78, insetInlineEnd: 8 }} />
      </MiniPhone>
    );
  }
  if (kind === 'media') {
    return (
      <MiniPhone>
        <div style={{ height: '100%', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          <div style={{ background: '#fff', borderRadius: 10, width: '100%', padding: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.3)' }}>
            <div dir="auto" style={{ fontSize: 8, color: '#666', marginBottom: 6 }}>{t.howto_mock_export}?</div>
            <div dir="auto" style={{ fontSize: 9, fontWeight: 800, color: '#15151d', padding: 7, borderRadius: 6, background: '#FFD700', boxShadow: '0 0 0 2px #FF69B4', textAlign: 'center', marginBottom: 5 }}>📸 {t.howto_mock_media}</div>
            <div dir="auto" style={{ fontSize: 9, fontWeight: 600, color: '#444', padding: 7, borderRadius: 6, background: '#f0f0f0', textAlign: 'center' }}>{t.howto_mock_nomedia}</div>
          </div>
        </div>
        <HandPointer style={{ top: 70, insetInlineStart: 26 }} />
      </MiniPhone>
    );
  }
  // upload
  return (
    <MiniPhone>
      <div style={{ height: '100%', background: 'linear-gradient(180deg,#FFF6D6,#FDE6F1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 }}>
        <div style={{ fontSize: 42 }}>📤</div>
        <div dir="auto" style={{ fontSize: 9.5, fontWeight: 800, color: '#4A0E4E', textAlign: 'center', lineHeight: 1.3 }}>{t.howto_mock_upload}</div>
      </div>
    </MiniPhone>
  );
}

function HowToGuide({ t, onStart }) {
  const [platform, setPlatform] = useState('ios');
  const steps = platform === 'ios'
    ? [{ k: 'chat', b: t.howto_ios_1 }, { k: 'name', b: t.howto_ios_2 }, { k: 'export', b: t.howto_ios_3 }, { k: 'media', b: t.howto_ios_4 }, { k: 'upload', b: t.howto_ios_5 }]
    : [{ k: 'chat', b: t.howto_and_1 }, { k: 'dots', b: t.howto_and_2 }, { k: 'export', b: t.howto_and_3 }, { k: 'media', b: t.howto_and_4 }, { k: 'upload', b: t.howto_and_5 }];
  const Tab = ({ id, label }) => (
    <button onClick={() => setPlatform(id)} className="press" style={{
      flex: 1, padding: '10px', borderRadius: 14, border: 'none', cursor: 'pointer',
      fontSize: 15, fontWeight: 800,
      background: platform === id ? '#4A0E4E' : 'transparent',
      color: platform === id ? '#fff' : 'rgba(74,14,78,0.6)',
      transition: 'background 0.15s',
    }}>{label}</button>
  );
  return (
    <div className="no-sb" style={{ position: 'relative', height: '100%', overflowY: 'auto', background: 'linear-gradient(180deg,#FFF6D6 0%,#FFF0E2 46%,#FDE6F1 100%)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -70, right: -70, width: 220, height: 220, borderRadius: '50%', background: '#FFD700', opacity: 0.5, filter: 'blur(72px)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -60, width: 200, height: 200, borderRadius: '50%', background: '#FF69B4', opacity: 0.32, filter: 'blur(70px)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, padding: '22px 18px 22px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 11, color: '#FF8C00', letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}>✦ {t.howto_eyebrow}</div>
        <h1 className="fs-display a-fade-up" style={{ animationDelay: '0.08s', fontSize: 34, lineHeight: 1.04, letterSpacing: '-0.04em', fontWeight: 800, color: '#4A0E4E', margin: '8px 0 6px' }}>{t.howto_title}</h1>
        <p className="fs-sans a-fade-up" style={{ animationDelay: '0.14s', margin: 0, fontSize: 15, color: 'rgba(74,14,78,0.65)', fontWeight: 500 }}>{t.howto_sub}</p>

        {/* platform toggle */}
        <div className="a-fade-up" style={{ animationDelay: '0.2s', display: 'flex', gap: 4, marginTop: 16, padding: 4, background: 'rgba(74,14,78,0.07)', borderRadius: 16 }}>
          <Tab id="ios" label={`🍏 ${t.howto_ios}`} />
          <Tab id="android" label={`🤖 ${t.howto_android}`} />
        </div>

        {/* steps */}
        <div key={platform} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {steps.map((s, i) => (
            <div key={i} className="a-slide-up-far" style={{
              display: 'flex', gap: 12, alignItems: 'center',
              background: '#fff', borderRadius: 22, padding: 12,
              border: '2px solid rgba(255,255,255,0.8)',
              boxShadow: '0 7px 0 rgba(74,14,78,0.07), 0 16px 30px -12px rgba(74,14,78,0.3)',
              animationDelay: `${0.25 + i * 0.08}s`,
            }}>
              <WaMock kind={s.k} t={t} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: '#FFD700', color: '#4A0E4E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, boxShadow: '0 3px 0 #E0A800' }} className="fs-display">{i + 1}</div>
                <div className="fs-sans" dir="auto" style={{ marginTop: 8, fontSize: 16, lineHeight: 1.35, fontWeight: 700, color: '#4A0E4E' }}>{s.b}</div>
              </div>
            </div>
          ))}
        </div>

        {/* tip */}
        <div className="a-fade-up" dir="auto" style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(0,191,255,0.12)', borderRadius: 16, fontSize: 13, lineHeight: 1.45, color: '#0A4A66', fontWeight: 600 }}>{t.howto_tip}</div>

        {/* CTA */}
        <button onClick={onStart} className="press a-gradient-shift" style={{
          marginTop: 18, width: '100%', position: 'relative', overflow: 'hidden',
          padding: '18px', color: '#4A0E4E',
          background: 'linear-gradient(135deg, #FFE45C 0%, #FFD700 50%, #FFB800 100%)',
          backgroundSize: '200% 200%', border: '2px solid rgba(255,255,255,0.7)', borderRadius: 22,
          fontSize: 19, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 8px 0 #E0A800, 0 18px 34px -6px rgba(224,168,0,0.6)',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <span className="fs-display" style={{ position: 'relative' }}>{t.howto_cta}</span>
        </button>
      </div>
    </div>
  );
}

function Landing({ onFile, onDemo, parseError, t, lang, setLang, onHowTo }) {
  const fileInputRef = useRef(null);
  const [langOpen, setLangOpen] = useState(false);
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  const featureCards = [
    { icon: '📊', label: t.feat_stats_t || 'STATS', q: t.feat_stats_q || 'Who talked the most?', bg: '#DAF3FF', accent: '#00BFFF', deep: '#0089C4' },
    { icon: '🔥', label: t.feat_roasts_t || 'ROASTS', q: t.feat_roasts_q || 'AI roasts everyone', bg: '#FFE1EE', accent: '#FF69B4', deep: '#D63384' },
    { icon: '🎭', label: t.feat_drama_t || 'DRAMA', q: t.feat_drama_q || 'Who started the chaos?', bg: '#FFEFC2', accent: '#FF8C00', deep: '#D17000' },
  ];

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      padding: '18px 20px 22px', height: '100%',
      background: 'linear-gradient(180deg, #FFF6D6 0%, #FFF0E2 46%, #FDE6F1 100%)',
      overflow: 'hidden',
    }}>
      {/* ===== Decorative energy layer (gradient blobs + chat bubbles + emoji stickers) ===== */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* gradient blobs */}
        <div style={{ position: 'absolute', top: -70, right: -70, width: 240, height: 240, borderRadius: '50%', background: '#FFD700', opacity: 0.55, filter: 'blur(72px)' }} />
        <div style={{ position: 'absolute', top: 90, left: -90, width: 210, height: 210, borderRadius: '50%', background: '#FF69B4', opacity: 0.35, filter: 'blur(74px)' }} />
        <div style={{ position: 'absolute', bottom: 70, right: -60, width: 210, height: 210, borderRadius: '50%', background: '#00BFFF', opacity: 0.40, filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -50, width: 190, height: 190, borderRadius: '50%', background: '#FF8C00', opacity: 0.34, filter: 'blur(64px)' }} />

        {/* floating chat bubbles */}
        <div className="a-float" style={{ position: 'absolute', top: 150, left: 16, width: 58, height: 38, background: '#fff', borderRadius: '18px 18px 18px 4px', boxShadow: '0 8px 20px rgba(74,14,78,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, animationDelay: '0.2s' }}>
          {[0, 1, 2].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: 999, background: '#FF69B4' }} />)}
        </div>
        <div className="a-float" style={{ position: 'absolute', top: 232, right: 14, width: 46, height: 32, background: '#4A0E4E', borderRadius: '16px 16px 4px 16px', boxShadow: '0 8px 18px rgba(74,14,78,0.22)', animationDelay: '1.1s' }} />

        {/* emoji stickers */}
        {[
          { e: '😂', top: 116, right: 26, rot: -14, size: 30, delay: '0s' },
          { e: '🔥', top: 300, left: 22, rot: 12, size: 26, delay: '0.7s' },
          { e: '👀', top: 360, right: 30, rot: -8, size: 24, delay: '1.4s' },
          { e: '💀', bottom: 168, left: 30, rot: 10, size: 24, delay: '0.4s' },
          { e: '✨', top: 88, left: 96, rot: 0, size: 20, delay: '1.8s' },
        ].map((s, i) => (
          <span key={i} className="a-float" style={{
            position: 'absolute', top: s.top, bottom: s.bottom, left: s.left, right: s.right,
            fontSize: s.size, transform: `rotate(${s.rot}deg)`,
            filter: 'drop-shadow(0 4px 6px rgba(74,14,78,0.28))', animationDelay: s.delay, opacity: 0.92,
          }}>{s.e}</span>
        ))}
      </div>

      {/* Top row: eyebrow + language picker */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 11, color: '#f06449', letterSpacing: '0.22em',
          fontWeight: 700, textTransform: 'uppercase',
        }}>
          ✦ {t.landing_eyebrow}
        </div>
        <button onClick={() => setLangOpen(true)} className="press" aria-label={t.a11y_change_language || `Change language. Current: ${currentLang.name}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 999,
          background: 'rgba(87,50,128,0.08)', border: '1px solid rgba(87,50,128,0.18)',
          color: '#573280', fontSize: 18, cursor: 'pointer',
        }}>
          {currentLang.flag}
        </button>
      </div>

      {/* Scrollable middle — hero + cards. Keeps the CTA pinned & always visible. */}
      <div className="no-sb" style={{ position: 'relative', zIndex: 10, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Hero — emotional promise + subtitle */}
      <div className="a-fade-up" style={{
        position: 'relative', zIndex: 10,
        marginTop: 26,
        animationDelay: '0.12s',
      }}>
        <h1 className="fs-display" style={{
          fontSize: 54, lineHeight: 0.98, letterSpacing: '-0.045em',
          fontWeight: 800, margin: 0, color: '#4A0E4E',
          textShadow: '0 2px 0 rgba(255,255,255,0.6)',
        }}>
          {t.landing_h1_a}{' '}
          <span style={{ fontStyle: 'italic', color: '#FF8C00' }}>{t.landing_h1_b}</span>{' '}
          {t.landing_h1_c}<br/>
          <span style={{ fontStyle: 'italic', color: '#FF69B4' }}>{t.landing_h1_d}</span>
          {t.landing_h1_e ? <> {t.landing_h1_e}</> : null}
        </h1>
        <p className="fs-sans" style={{
          margin: '14px 0 0', maxWidth: 300,
          fontSize: 16, lineHeight: 1.45, fontWeight: 500,
          color: 'rgba(74,14,78,0.66)',
        }}>
          {t.landing_promise_sub}
        </p>
      </div>

      {/* Feature cards — big, colorful, sticker-like */}
      <div className="a-fade-up" style={{
        position: 'relative', zIndex: 10,
        marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12,
        animationDelay: '0.25s',
      }}>
        {featureCards.map((card, i) => (
          <button key={i} type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={`${card.label} — ${card.q}`}
            className="a-slide-right press lift" style={{
            width: '100%', textAlign: 'start', font: 'inherit', appearance: 'none',
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 18px',
            background: card.bg,
            borderRadius: 24,
            border: '2px solid rgba(255,255,255,0.7)',
            boxShadow: `0 7px 0 ${card.deep}33, 0 16px 30px -8px ${card.deep}55`,
            animationDelay: `${0.35 + i * 0.1}s`,
            cursor: 'pointer',
          }}>
            {/* icon sticker badge */}
            <div style={{
              flexShrink: 0, width: 52, height: 52, borderRadius: 16,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, boxShadow: `0 4px 0 ${card.deep}22`, transform: 'rotate(-4deg)',
            }}>{card.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fs-mono" style={{
                fontSize: 11, fontWeight: 700, color: card.deep,
                letterSpacing: '0.14em', textTransform: 'uppercase',
              }}>{card.label}</div>
              <div className="fs-display" style={{
                fontSize: 20, fontWeight: 800, color: '#4A0E4E',
                letterSpacing: '-0.02em', lineHeight: 1.12, marginTop: 2,
              }}>{card.q}</div>
            </div>
            <div style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: 999,
              background: card.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, fontWeight: 800, boxShadow: `0 3px 0 ${card.deep}55`,
            }}>←</div>
          </button>
        ))}
      </div>

      {parseError && (
        <div role="alert" className="a-scale-in" style={{
          position: 'relative', zIndex: 10,
          display: 'flex', gap: 10, marginTop: 12,
          background: 'rgba(240,100,73,0.10)', border: '1px solid rgba(240,100,73,0.35)',
          borderRadius: 14, padding: 14,
        }}>
          <div style={{ flexShrink: 0, marginTop: 2, color: '#f06449' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: '#2a0645' }}>{parseError}</div>
        </div>
      )}
      </div>

      <div className="a-fade-up" style={{ position: 'relative', zIndex: 10, flexShrink: 0, paddingTop: 16, animationDelay: '0.45s' }}>
        <input ref={fileInputRef} type="file" accept=".txt,.zip,application/zip,text/plain"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        {/* Main CTA — big, exciting, the obvious next action */}
        <button onClick={() => fileInputRef.current?.click()} className="press a-gradient-shift" style={{
          width: '100%', position: 'relative', overflow: 'hidden',
          padding: '20px 18px', color: '#4A0E4E',
          background: 'linear-gradient(135deg, #FFE45C 0%, #FFD700 50%, #FFB800 100%)',
          backgroundSize: '200% 200%',
          border: '2px solid rgba(255,255,255,0.7)', borderRadius: 22,
          fontSize: 20, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.01em',
          boxShadow: '0 8px 0 #E0A800, 0 18px 34px -6px rgba(224,168,0,0.6)',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <span className="fs-display" style={{ position: 'relative' }}>{t.landing_cta}</span>
        </button>
        {/* Secondary actions — demo + how-to guide */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 12 }}>
          <button onClick={onDemo} className="press fs-sans" style={{
            padding: '8px 4px', background: 'transparent', border: 'none',
            color: 'rgba(74,14,78,0.55)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            {t.landing_demo_soft}
          </button>
          {onHowTo && (
            <button onClick={onHowTo} className="press fs-sans" style={{
              padding: '8px 4px', background: 'transparent', border: 'none',
              color: 'rgba(74,14,78,0.55)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
              {t.howto_link}
            </button>
          )}
        </div>

        {/* Trust footer */}
        <div className="fs-sans" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          textAlign: 'center', marginTop: 12,
          fontSize: 11.5, color: 'rgba(74,14,78,0.45)', lineHeight: 1.4,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {t.landing_trust}
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
                <span style={{ color: '#f9c74f', fontSize: 18 }}>✓</span>
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
      background: '#faf6f0',
    }}>
      {/* Background blobs matching landing page */}
      <div style={{
        position: 'absolute', top: -60, right: -70, width: 230, height: 230,
        borderRadius: '50%', background: '#ffd972', opacity: 0.55,
        filter: 'blur(72px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 80, left: -80, width: 200, height: 200,
        borderRadius: '50%', background: '#f06449', opacity: 0.25,
        filter: 'blur(72px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 60, right: -50, width: 200, height: 200,
        borderRadius: '50%', background: '#9cf6f6', opacity: 0.50,
        filter: 'blur(68px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -40, left: -40, width: 180, height: 180,
        borderRadius: '50%', background: '#f1e4f3', opacity: 0.70,
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 10 }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 11, color: '#f06449', letterSpacing: '0.22em',
          fontWeight: 700, textTransform: 'uppercase',
        }}>
          ✦ {t.parsing_msg_parsed}
        </div>
        <div className="fs-mono a-fade-in" style={{
          fontSize: 13, color: '#573280', marginTop: 6, wordBreak: 'break-all',
          opacity: 0.7, animationDelay: '0.2s',
        }}>
          {fileName}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
        <div className="fs-display a-spring" style={{
          fontSize: 96, lineHeight: 1, letterSpacing: '-0.05em', color: '#573280',
        }}>
          {fakeCount.toLocaleString()}
        </div>
        <div className="fs-mono" style={{
          fontSize: 13, color: '#573280', marginTop: 8, letterSpacing: '0.15em',
          opacity: 0.6, fontWeight: 700, textTransform: 'uppercase',
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
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: done ? '#f06449' : 'transparent',
                border: done ? 'none' : `2px solid ${active ? '#f06449' : 'rgba(87,50,128,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff"
                    strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                {active && (
                  <div className="a-spin" style={{
                    position: 'absolute', inset: -2,
                    border: '2px solid transparent', borderTopColor: '#f06449',
                    borderRadius: '50%',
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: active ? 700 : 500, color: done || active ? '#2a0645' : '#573280' }}>
                  {s.label}
                </div>
                {active && (
                  <div className="fs-mono a-fade-in" style={{
                    fontSize: 11, color: '#f06449', marginTop: 2,
                    letterSpacing: '0.08em', fontWeight: 700,
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

// Tight, group-first deck (~8 slides). Verified group data first, ending on
// teaser/unlock cards so the user finishes wanting more. The older per-user
// slides (night, speed, streak, vibe_check, eras, …) stay registered in
// SLIDE_COMPONENTS and remain reachable from the post-Wrapped menu / "full
// stats" — they're just no longer part of the main auto-play story.
const SLIDES_DEF = [
  'group_overview',   // total messages, participants, date range, peak hour + busiest day
  'leaderboard',      // full ranking by messages, quietest flagged
  'per_person',       // messages, % of total, words, avg words/msg
  'signature_words',  // one meaningful word per person
  'group_top',        // group's top emoji + top meaningful word
  'photos',           // real photos from a "with media" export (skipped if none)
  'awards',           // superlatives from real stats
  'drama_role',       // your role in the group
  'teaser',           // locked cards: roast / duo / profile / chaos → want more
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
        { value: 'mild', label: t.q_tone_mild, desc: t.q_tone_mild_d, color: '#277da1', icon: '😊' },
        { value: 'medium', label: t.q_tone_medium, desc: t.q_tone_medium_d, color: '#f9c74f', icon: '😏' },
        { value: 'spicy', label: t.q_tone_spicy, desc: t.q_tone_spicy_d, color: '#f3722c', icon: '🔥' },
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
      background: 'radial-gradient(ellipse at top, #577590 0%, #050507 70%)',
    }}>
      <div style={{ position: 'absolute', top: 60, right: -80, width: 220, height: 220,
        borderRadius: '50%', background: '#f9c74f', opacity: 0.15, filter: 'blur(80px)',
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
                background: i <= step ? '#f9c74f' : 'rgba(255,255,255,0.18)',
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
                  <button key={u.author} dir="auto" onClick={() => setDraft({ ...draft, self: u.author })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'start',
                      padding: '14px 16px', cursor: 'pointer',
                      background: selected
                        ? 'linear-gradient(135deg, rgba(249,199,79,0.18), rgba(249,199,79,0.04))'
                        : '#15151d',
                      border: `1px solid ${selected ? '#f9c74f' : '#2a2a36'}`,
                      borderRadius: 14, color: '#f4f4f8',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`,
                    }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div dir="auto" style={{
                        fontSize: 23, fontWeight: selected ? 800 : 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {u.author}
                      </div>
                    </div>
                    {selected && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#f9c74f',
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
                  <button key={opt.value} dir="auto" onClick={() => setDraft({ ...draft, [currentStep.key]: opt.value })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'start',
                      padding: '16px 18px', cursor: 'pointer',
                      background: selected
                        ? 'linear-gradient(135deg, rgba(249,199,79,0.18), rgba(249,199,79,0.04))'
                        : '#15151d',
                      border: `1px solid ${selected ? '#f9c74f' : '#2a2a36'}`,
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
                        width: 22, height: 22, borderRadius: '50%', background: '#f9c74f',
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
                  <button key={opt.value} dir="auto" onClick={() => setDraft({ ...draft, tone: opt.value })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'start',
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
              ? 'linear-gradient(135deg, #f9c74f 0%, #ffd340 50%, #d4a820 100%)'
              : '#3a3a48',
            backgroundSize: '200% 200%',
            color: canContinue ? '#0a0a0f' : '#d6d6e0',
            border: 'none', borderRadius: 16,
            fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            boxShadow: canContinue ? '0 12px 32px rgba(249,199,79,0.40)' : 'none',
          }}>
          {canContinue && <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />}
          {isLast ? t.onboard_done : t.onboard_continue}
        </button>
      </div>
    </div>
  );
}

function Wrapped({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, slide, setSlide, profile, t, onExit, onMenu }) {
  const user = analytics.userMap[selectedAuthor];
  if (!user) return null;
  const userAchievements = analytics.achievementsByUser[selectedAuthor] || [];

  const slides = useMemo(() => SLIDES_DEF.filter(s => {
    // Group-first deck: skip a slide only when its verified data is missing.
    if (s === 'signature_words' && !analytics.users.some(x => x.topWord)) return false;
    if (s === 'group_top' && !((analytics.topWordsGroup && analytics.topWordsGroup.length) || (analytics.topEmojisGroup && analytics.topEmojisGroup.length))) return false;
    if (s === 'photos' && (!analytics.photos || analytics.photos.length === 0)) return false;
    if (s === 'drama_role' && !user) return false;
    return true;
  }), [selectedAuthor, userAchievements.length, user, analytics, profile]);

  const total = slides.length;
  const current = slides[slide];
  const SlideComp = SLIDE_COMPONENTS[current];

  const dirRef = useRef(1);

  useEffect(() => {
    if (slide >= total - 1) return;
    const id = setTimeout(() => {
      dirRef.current = 1;
      setSlide(s => Math.min(s + 1, total - 1));
    }, 6500);
    return () => clearTimeout(id);
  }, [slide, total, setSlide]);

  const next = () => { dirRef.current = 1;  setSlide(Math.min(slide + 1, total - 1)); };
  const prev = () => { dirRef.current = -1; setSlide(Math.max(slide - 1, 0)); };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff5f7' }}>
      <SlidesBlobBackground />
      {/* Close */}
      <button onClick={onExit} className="press" aria-label={t.a11y_close || 'Close'} style={{
        position: 'absolute', top: 16, right: 16, zIndex: 5,
        background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)',
        color: '#fff', border: 'none', width: 40, height: 40,
        borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Tap zones — pure touch convenience, hidden from assistive tech */}
      <div onClick={prev} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', zIndex: 4 }} />
      {slide < total - 1 && <div onClick={next} aria-hidden="true" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '70%', zIndex: 4 }} />}

      {/* Slide with directional transition */}
      <div key={`${current}-${selectedAuthor}`}
        className={dirRef.current >= 0 ? 'slide-in-right' : 'slide-in-left'}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        {SlideComp && <SlideComp a={analytics} u={user} t={t} profile={profile} achievements={userAchievements} onExit={onExit} onMenu={onMenu} />}
      </div>
    </div>
  );
}

// ============================================================
// SLIDE SHELL
// ============================================================

const SlideShell = React.memo(function SlideShell({ children, bg, accent = '#f9c74f', shake = false }) {
  return (
    <div className={shake ? 'a-shake' : ''} style={{
      position: 'absolute', inset: 0, overflow: 'hidden', background: 'transparent',
    }}>
      <div style={{
        position: 'absolute', top: -80, right: -80, width: 300, height: 300,
        borderRadius: '50%', background: accent, opacity: 0.22,
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, left: -80, width: 260, height: 260,
        borderRadius: '50%', background: accent, opacity: 0.12,
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div className="slide-content" style={{ height: '100%' }}>
        {children}
      </div>
    </div>
  );
})

// ============================================================
// SLIDES — ALL data flows from props (no random/inferred fields)
// ============================================================

const SlideIntro = React.memo(function SlideIntro({ a, t }) {
  const year = new Date().getFullYear();
  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.intro_eyebrow} · {year}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{ fontSize: 56, lineHeight: 1.1, letterSpacing: '-0.04em', fontWeight: 800, color: '#2a0645' }}>
            {t.intro_get && <span style={{ display: 'block' }}>{t.intro_get}</span>}
            {t.intro_ready && <span style={{ display: 'block', fontStyle: 'italic', color: '#f9c74f' }}>{t.intro_ready}</span>}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '0.8s', marginTop: 32, fontSize: 18, color: 'rgba(42,6,69,0.85)', maxWidth: 280, lineHeight: 1.45,
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
})

const SlideMessageCount = React.memo(function SlideMessageCount({ a, u, t }) {
  const animatedGroup = useAnimatedNumber(a.totalMessages, 1800, [a.totalMessages]);
  const animatedUser = useAnimatedNumber(u.messageCount, 1600, [u.author]);
  return (
    <SlideShell bg="#f3722c" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.msg_eyebrow}
        </div>
        <div className="fs-display a-spring a-pulse-glow" style={{
          animationDelay: '0.2s',
          fontSize: a.totalMessages > 99999 ? 56 : a.totalMessages > 9999 ? 60 : 64,
          lineHeight: 1.1, letterSpacing: '-0.04em', color: '#f94144',
          marginTop: 48, fontWeight: 800,
        }}>
          {animatedGroup.toLocaleString()}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.6s', fontSize: 20, marginTop: 8, fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
        }}>
          {t.msg_word}
        </div>

        <div className="a-fade-up" style={{
          animationDelay: '1.5s', marginTop: 48,
        }}>
          <div className="fs-sans" style={{
            fontSize: 12, color: 'rgba(42,6,69,0.78)', letterSpacing: '0.15em', marginBottom: 12, fontWeight: 500, textTransform: 'uppercase',
          }}>
            {t.msg_your_share}
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10,
          }}>
            <div className="fs-display" style={{
              fontSize: 48, color: '#2a0645', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1,
            }}>
              {animatedUser.toLocaleString()}
            </div>
            <div className="fs-mono" style={{ fontSize: 18, color: 'rgba(42,6,69,0.82)' }}>
              · {u.sharePct.toFixed(1)}%
            </div>
          </div>

          <div style={{
            marginTop: 14, marginInline: 'auto', maxWidth: 240,
            height: 10, borderRadius: 999,
            background: 'rgba(255,255,255,0.40)', overflow: 'hidden',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              height: '100%', minWidth: 16, width: `${u.sharePct}%`,
              background: '#f9c74f', borderRadius: 999,
              transformOrigin: 'left',
              animation: 'barGrow 1.2s cubic-bezier(0.16, 1, 0.3, 1) 1.8s both',
              boxShadow: '0 0 8px rgba(249,199,79,0.6)',
            }} />
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

const SlideRank = React.memo(function SlideRank({ a, u, t }) {
  const rank = a.users.findIndex(x => x.author === u.author) + 1;
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const top5 = a.users.slice(0, 5);
  const maxMsgs = top5[0].messageCount;

  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.rank_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.2s', fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.03em', marginTop: 16, fontWeight: 700, color: '#2a0645',
        }}>
          {t.rank_finished}<br/>
          <span style={{ color: '#f9c74f', fontStyle: 'italic' }}>{ordinal(rank)}</span> {interp(t.rank_of, { n: a.users.length })}
        </div>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {top5.map((row, i) => {
            const isUser = row.author === u.author;
            const isFirst = i === 0;
            return (
              <div key={row.author} dir="auto" className="a-slide-right" style={{
                position: 'relative',
                padding: '14px 20px',
                background: isFirst ? 'rgba(249,199,79,0.22)' : isUser ? 'rgba(42,6,69,0.08)' : 'rgba(42,6,69,0.05)',
                borderRadius: 18, overflow: 'hidden',
                animationDelay: `${0.45 + i * 0.1}s`,
              }}>
                <div className="a-bar" style={{
                  position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
                  width: `${(row.messageCount / maxMsgs) * 100}%`,
                  background: isFirst ? 'rgba(249,199,79,0.12)' : 'rgba(42,6,69,0.04)',
                  animationDelay: `${0.65 + i * 0.1}s`,
                }} />
                <div style={{
                  position: 'relative', display: 'flex',
                  alignItems: 'center', gap: 14,
                }}>
                  <div className="fs-display" style={{
                    fontSize: 28, fontWeight: 800, lineHeight: 1,
                    color: isFirst ? '#f9c74f' : 'rgba(42,6,69,0.25)',
                    width: 36, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{
                    flex: 1, minWidth: 0,
                    fontSize: 16, fontWeight: isUser || isFirst ? 700 : 500,
                    color: isFirst ? '#f9c74f' : '#fff1f5',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.author} {isUser && <span style={{ color: '#f9c74f', fontSize: 13, fontWeight: 600 }}>{t.rank_you}</span>}
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 15, fontWeight: 600,
                    color: isFirst ? '#f9c74f' : 'rgba(42,6,69,0.78)',
                    flexShrink: 0,
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
})

const SlideVsEveryone = React.memo(function SlideVsEveryone({ a, u, t }) {
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
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.vs_eyebrow}
        </div>

        <div className="a-spring a-pulse-glow" style={{ animationDelay: '0.2s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 64, lineHeight: 1.1, letterSpacing: '-0.04em',
            color: '#277da1', fontWeight: 800,
          }}>
            {animatedBeat}<span style={{ fontSize: 36, color: 'rgba(42,6,69,0.62)' }}>/{animatedTotal}</span>
          </div>
        </div>

        <div className="a-fade-up" style={{ animationDelay: '0.7s', marginTop: 20 }}>
          <div className="fs-display" style={{
            fontSize: 20, lineHeight: 1.35, fontStyle: 'italic', fontWeight: 700, letterSpacing: '-0.02em',
            whiteSpace: 'pre-line',
          }}>
            {isFirst && others > 0 && t.vs_outsent_all}
            {isLast && others > 0 && t.vs_least}
            {!isFirst && !isLast && interp(t.vs_middle, { beat: beatCount, others })}
            {others === 0 && t.vs_alone}
          </div>
        </div>

        <div className="fs-mono a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 20, fontSize: 16, color: 'rgba(42,6,69,0.82)', letterSpacing: '0.08em',
        }}>
          {interp(t.vs_ranked, { msgs: u.messageCount.toLocaleString(), rank, total: totalUsers })}
        </div>

        {a.fastestResponder && a.fastestResponder.author !== u.author && a.fastestResponder.avgRespMin != null && (
          <div className="a-fade-up" style={{ animationDelay: '1.3s', marginTop: 24 }}>
            <div className="fs-sans" style={{ fontSize: 12, color: 'rgba(42,6,69,0.75)', letterSpacing: '0.12em', fontWeight: 500, textTransform: 'uppercase' }}>
              {t.vs_fastest}
            </div>
            <div className="fs-display" style={{
              fontSize: 20, color: '#277da1', fontStyle: 'italic', fontWeight: 700,
              marginTop: 6, letterSpacing: '-0.02em',
            }}>
              {a.fastestResponder.author}
            </div>
            <div className="fs-mono" style={{ fontSize: 16, color: 'rgba(42,6,69,0.75)', marginTop: 2 }}>
              {fastestAvgText}
            </div>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

const SlideTitle = React.memo(function SlideTitle({ u, t }) {
  const title = resolveTitle(u, t);
  const evidence = resolveTitleEvidence(u, t);
  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.title_eyebrow}
        </div>
        <div className="a-spring a-pulse-glow" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: title.length > 22 ? 32 : title.length > 16 ? 40 : 52,
            lineHeight: 1.1, letterSpacing: '-0.03em',
            color: '#f9c74f', fontStyle: 'italic', fontWeight: 800,
          }}>
            {title}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '1.0s', marginTop: 40 }}>
          <div className="fs-sans" style={{ fontSize: 12, color: 'rgba(42,6,69,0.75)', letterSpacing: '0.12em', fontWeight: 500, textTransform: 'uppercase' }}>
            {t.title_based_on}
          </div>
          <div className="fs-sans" style={{ fontSize: 18, color: '#2a0645', marginTop: 8, fontWeight: 500, lineHeight: 1.4 }}>
            {evidence}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

const SlideGroupDescribes = React.memo(function SlideGroupDescribes({ u, t }) {
  return (
    <SlideShell bg="#f9c74f" accent="#577590">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#577590', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.descr_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 36, lineHeight: 1.2, letterSpacing: '-0.03em', fontStyle: 'italic', fontWeight: 700, color: '#1a1a2e',
          }}>
            "{t[u.groupDescriptionKey] || u.groupDescriptionKey}"
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 40, fontSize: 18, lineHeight: 1.5, color: 'rgba(87,117,144,0.88)',
        }}>
          {t.descr_footnote}
        </div>
      </div>
    </SlideShell>
  );
})

const SlidePeakHour = React.memo(function SlidePeakHour({ a, u, t }) {
  const hour = u.peakHour;
  const hourStr = String(hour).padStart(2, '0');
  const max = Math.max(...a.groupHourly);
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.peak_eyebrow}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.2s', fontSize: 64, lineHeight: 1.1,
          letterSpacing: '-0.04em', marginTop: 48, fontWeight: 800, color: '#2a0645',
        }}>
          {hourStr}<span style={{ color: '#277da1' }}>:00</span>
        </div>
        <div className="a-fade-up" style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          gap: 2, marginTop: 32, height: 56,
          animationDelay: '0.7s',
        }}>
          {a.groupHourly.map((c, h) => (
            <div key={h} className="a-bar" style={{
              width: 7, height: `${(c / max) * 56}px`,
              background: h === hour ? '#277da1' : 'rgba(42,6,69,0.12)',
              borderRadius: 1,
              animationDelay: `${0.9 + h * 0.02}s`,
            }} />
          ))}
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.2s', marginTop: 32, fontSize: 18, lineHeight: 1.5,
          color: 'rgba(42,6,69,0.85)', maxWidth: 280, margin: '32px auto 0',
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
})

const SlideNight = React.memo(function SlideNight({ a, u, t }) {
  const pct = useAnimatedNumber(Math.round(u.nightPct), 1400, [u.author]);
  return (
    <SlideShell bg="#577590" accent="#277da1">
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
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.night_eyebrow}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.2s', fontSize: 64, lineHeight: 1.1,
          letterSpacing: '-0.04em', color: '#277da1', marginTop: 48, fontWeight: 800,
        }}>
          {pct}<span style={{ fontSize: 32 }}>%</span>
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.6s', fontSize: 20, fontStyle: 'italic', marginTop: 10, fontWeight: 700, color: '#2a0645',
        }}>
          {t.night_of_msgs}
        </div>
        <div className="fs-mono a-fade-up" style={{
          animationDelay: '0.9s', fontSize: 16, color: 'rgba(42,6,69,0.82)',
          marginTop: 16, letterSpacing: '0.08em',
        }}>
          {interp(t.night_count, {
            night: u.nightMessages.toLocaleString(),
            total: u.messageCount.toLocaleString(),
          })}
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.2s', marginTop: 32, fontSize: 18, lineHeight: 1.5,
          color: 'rgba(42,6,69,0.85)', maxWidth: 280, margin: '32px auto 0',
        }}>
          {u.nightPct > 30 && t.night_diag_strong}
          {u.nightPct > 15 && u.nightPct <= 30 && t.night_diag_med}
          {u.nightPct <= 15 && u.nightPct > 5 && t.night_diag_low}
          {u.nightPct <= 5 && t.night_diag_none}
        </div>
        {a.nightOwl?.author === u.author && (
          <div className="fs-sans a-fade-up" style={{
            animationDelay: '1.5s', fontSize: 12, color: '#f9c74f',
            marginTop: 20, letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
          }}>
            {t.night_owl}
          </div>
        )}
      </div>
    </SlideShell>
  );
})

const SlideStreak = React.memo(function SlideStreak({ u, t }) {
  const days = useAnimatedNumber(u.longestStreak, 1200, [u.author]);
  const dotCount = Math.min(u.longestStreak, 30);
  return (
    <SlideShell bg="#f3722c" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.streak_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.2s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 64, lineHeight: 1.1, letterSpacing: '-0.04em',
            color: '#f9c74f', fontWeight: 800,
          }}>
            {days}
          </div>
          <div className="fs-display" style={{
            fontSize: 20, fontStyle: 'italic', marginTop: 10, fontWeight: 700, color: '#2a0645',
          }}>
            {u.longestStreak === 1 ? t.streak_day : t.streak_days}
          </div>
        </div>
        <div className="a-fade-up" style={{
          display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap',
          maxWidth: 240, margin: '40px auto 0',
          animationDelay: '0.8s',
        }}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: 2,
              background: '#fff',
              opacity: 0.3 + (i / dotCount) * 0.7,
              animation: `scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${1 + i * 0.03}s both`,
            }} />
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideSpeed = React.memo(function SlideSpeed({ a, u, t }) {
  if (u.avgRespMin == null) return null;
  const respTime = u.avgRespMin;
  const display = respTime < 1 ? `${Math.round(respTime * 60)}s`
    : respTime < 60 ? `${respTime.toFixed(1)}m`
    : `${(respTime / 60).toFixed(1)}h`;
  const pct = u.speedPercentile ?? 50;
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.speed_eyebrow}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.2s', fontSize: 56, lineHeight: 1.1,
          letterSpacing: '-0.04em', color: '#277da1', marginTop: 48, fontWeight: 800,
        }}>
          {display}
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.8s', marginTop: 40 }}>
          <div className="fs-display" style={{
            fontSize: 28, lineHeight: 1.2, letterSpacing: '-0.02em', fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
          }}>
            {t.speed_faster}<br/>
            <span style={{ color: '#277da1', fontStyle: 'normal' }}>{pct}%</span> {t.speed_of_group}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.3s', marginTop: 24, fontSize: 12, color: 'rgba(42,6,69,0.75)', letterSpacing: '0.12em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {interp(t.speed_based, { n: u.respSampleSize })}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideWord = React.memo(function SlideWord({ u, t }) {
  const word = u.topWord;
  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.word_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: word.length > 10 ? 40 : word.length > 6 ? 56 : 64,
            lineHeight: 1.1, letterSpacing: '-0.03em', color: '#f9c74f',
            fontStyle: 'italic', wordBreak: 'break-word', fontWeight: 800,
          }}>
            "{word}"
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 40, fontSize: 18, lineHeight: 1.5, color: 'rgba(42,6,69,0.85)',
        }}>
          {interp(t.word_used, { n: u.topWordCount })}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideTopWords = React.memo(function SlideTopWords({ a, t }) {
  const words = (a.topWordsGroup || []).slice(0, 5);
  if (words.length === 0) return null;
  const maxCount = words[0].count;

  return (
    <SlideShell bg="#f9c74f" accent="#577590">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#577590', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.top_words_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#1a1a2e',
          marginTop: 12, marginBottom: 20,
        }}>
          {t.top_words_title}<br/><span style={{ fontStyle: 'italic', color: '#577590' }}>{t.top_words_subtitle}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {words.map((w, i) => {
            const pct = Math.max(8, Math.round((w.count / maxCount) * 100));
            return (
              <div key={w.word} dir="auto" className="a-slide-up-far" style={{
                position: 'relative',
                padding: '16px 20px',
                background: 'rgba(87,117,144,0.08)',
                borderRadius: 18,
                overflow: 'hidden',
                animationDelay: `${0.5 + i * 0.13}s`,
              }}>
                <div className="a-slide-right" style={{
                  position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
                  background: 'linear-gradient(90deg, rgba(87,117,144,0.14) 0%, rgba(87,117,144,0.02) 100%)',
                  width: `${pct}%`,
                  animationDelay: `${0.7 + i * 0.13}s`,
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="fs-display" style={{
                    fontSize: 24, fontWeight: 800, color: i === 0 ? '#577590' : 'rgba(87,117,144,0.35)',
                    width: 28, flexShrink: 0, lineHeight: 1,
                  }}>
                    {i + 1}
                  </div>
                  <div className="fs-display" style={{
                    flex: 1, minWidth: 0,
                    fontSize: w.word.length > 12 ? 18 : w.word.length > 8 ? 22 : 28,
                    lineHeight: 1.1, letterSpacing: '-0.02em',
                    fontStyle: 'italic', color: '#1a1a2e', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    "{w.word}"
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 16, color: '#577590', fontWeight: 700,
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
})

const SlideEmoji = React.memo(function SlideEmoji({ a, u, t }) {
  return (
    <SlideShell bg="#f3722c" accent="#f9c74f">
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
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.emoji_eyebrow}
        </div>
        <div className="a-spring" style={{
          animationDelay: '0.2s', fontSize: 100, lineHeight: 1, marginTop: 48,
        }}>
          {u.topEmoji}
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '0.8s', marginTop: 40, fontSize: 18, color: 'rgba(42,6,69,0.88)', lineHeight: 1.4,
        }}>
          {interp(t.emoji_used, { n: u.topEmojiCount })}
        </div>
      </div>
    </SlideShell>
  );
})

// The Novelist — group reveal of the longest-average-message writer (by chars)
const SlideNovelist = React.memo(function SlideNovelist({ a, t }) {
  const n = a.novelist;
  if (!n) return null;
  const chars = Math.round(n.avgCharsPerMsg);
  const name = n.author;
  return (
    <SlideShell bg="#577590" accent="#8338ec">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="a-spring" style={{ animationDelay: '0.1s', fontSize: 64, lineHeight: 1, marginBottom: 8 }}>✍️</div>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#8338ec', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.novelist_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 24 }}>
          <div className="fs-display" dir="auto" style={{
            fontSize: name.length > 10 ? 40 : name.length > 6 ? 52 : 60,
            lineHeight: 1.05, letterSpacing: '-0.03em', color: '#8338ec',
            fontStyle: 'italic', wordBreak: 'break-word', fontWeight: 800,
          }}>
            {name}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 36 }}>
          <div className="fs-display" style={{ fontSize: 48, fontWeight: 800, color: '#2a0645', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {chars.toLocaleString()}
          </div>
          <div className="fs-sans" style={{ marginTop: 8, fontSize: 16, color: 'rgba(42,6,69,0.85)', lineHeight: 1.4 }}>
            {interp(t.novelist_chars, { n: chars, words: Math.round(n.avgWordsPerMsg) })}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

// The Ghoster — group reveal of the slowest average replier
const SlideGhoster = React.memo(function SlideGhoster({ a, t }) {
  const g = a.slowResponder;
  if (!g || g.avgRespMin == null) return null;
  const rt = g.avgRespMin;
  const display = rt < 60 ? `${rt.toFixed(0)}m`
    : rt < 1440 ? `${(rt / 60).toFixed(1)}h`
    : `${(rt / 1440).toFixed(1)}d`;
  const name = g.author;
  return (
    <SlideShell bg="#2a0645" accent="#577590">
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[20, 55, 82].map((left, i) => (
          <div key={i} className="a-float" style={{
            position: 'absolute', left: `${left}%`, bottom: 90, fontSize: 30,
            opacity: 0.5, animationDelay: `${i * 0.7}s`,
          }}>👻</div>
        ))}
      </div>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="a-spring" style={{ animationDelay: '0.1s', fontSize: 72, lineHeight: 1, marginBottom: 8 }}>👻</div>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#577590', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.ghoster_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 24 }}>
          <div className="fs-display" dir="auto" style={{
            fontSize: name.length > 10 ? 40 : name.length > 6 ? 52 : 60,
            lineHeight: 1.05, letterSpacing: '-0.03em', color: '#577590',
            fontStyle: 'italic', wordBreak: 'break-word', fontWeight: 800,
          }}>
            {name}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 36 }}>
          <div className="fs-display" style={{ fontSize: 48, fontWeight: 800, color: '#2a0645', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {display}
          </div>
          <div className="fs-sans" style={{ marginTop: 8, fontSize: 16, color: 'rgba(42,6,69,0.85)', lineHeight: 1.4 }}>
            {interp(t.ghoster_reply, { n: g.respSampleSize })}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

// Vibe Check — the SELECTED participant's top-5 words + most-used emojis
const SlideVibeCheck = React.memo(function SlideVibeCheck({ u, t }) {
  const words = (u.top5Words || []).filter(w => w.count > 0);
  const emojis = (u.top5Emojis || []).filter(e => e.count > 0);
  if (words.length === 0 && emojis.length === 0) return null;
  const maxCount = words.length ? words[0].count : 1;
  return (
    <SlideShell bg="#f94144" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.vibe_eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 30, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 800, color: '#1a1a2e',
          marginTop: 10, marginBottom: 16,
        }}>
          {interp(t.vibe_title, { name: u.author })}
        </div>
        {emojis.length > 0 && (
          <div className="a-fade-up" style={{ animationDelay: '0.4s', display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            {emojis.map((e, i) => (
              <div key={e.emoji} className="a-spring" style={{ animationDelay: `${0.5 + i * 0.1}s`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: i === 0 ? 40 : 30, lineHeight: 1 }}>{e.emoji}</div>
                <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(26,26,46,0.6)', fontWeight: 700 }}>{e.count}×</div>
              </div>
            ))}
          </div>
        )}
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {words.map((w, i) => {
            const pct = Math.max(8, Math.round((w.count / maxCount) * 100));
            return (
              <div key={w.word} dir="auto" className="a-slide-up-far" style={{
                position: 'relative', padding: '13px 18px',
                background: 'rgba(249,65,68,0.08)', borderRadius: 16,
                overflow: 'hidden', animationDelay: `${0.7 + i * 0.12}s`,
              }}>
                <div className="a-slide-right" style={{
                  position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
                  background: 'linear-gradient(90deg, rgba(249,65,68,0.16) 0%, rgba(249,65,68,0.02) 100%)',
                  width: `${pct}%`, animationDelay: `${0.9 + i * 0.12}s`, pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="fs-display" style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? '#f94144' : 'rgba(249,65,68,0.4)', width: 24, flexShrink: 0, lineHeight: 1 }}>
                    {i + 1}
                  </div>
                  <div className="fs-display" style={{
                    flex: 1, minWidth: 0,
                    fontSize: w.word.length > 12 ? 17 : w.word.length > 8 ? 20 : 24,
                    lineHeight: 1.1, letterSpacing: '-0.02em',
                    fontStyle: 'italic', color: '#1a1a2e', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    "{w.word}"
                  </div>
                  <div className="fs-mono" style={{ fontSize: 14, color: '#f94144', fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0 }}>
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
})

const SlideDramaRole = React.memo(function SlideDramaRole({ u, t }) {
  // Determine role based on actual computed data
  let titleText, count, labelText, copyText, accent, bg;
  if (u.conversationsRevived > u.conversationsKilled && u.conversationsRevived >= 5) {
    titleText = t.drama_defib;
    count = u.conversationsRevived;
    labelText = t.drama_defib_label;
    copyText = t.drama_defib_copy;
    accent = '#277da1';
    bg = '#577590';
  } else if (u.conversationsKilled > u.conversationsRevived && u.conversationsKilled >= 5) {
    titleText = t.drama_killer;
    count = u.conversationsKilled;
    labelText = t.drama_killer_label;
    copyText = t.drama_killer_copy;
    accent = '#f3722c';
    bg = '#577590';
  } else if (u.replyReceivedRate > 0.5 && u.messageCount >= 20) {
    titleText = t.drama_replied;
    count = Math.round(u.replyReceivedRate * 100);
    labelText = t.drama_replied_label;
    copyText = t.drama_replied_copy;
    accent = '#f9c74f';
    bg = '#f3722c';
  } else if (u.ignoredRate > 0.25 && u.messageCount >= 20) {
    titleText = t.drama_ignored;
    count = Math.round(u.ignoredRate * 100);
    labelText = t.drama_ignored_label;
    copyText = t.drama_ignored_copy;
    accent = '#577590';
    bg = '#f9c74f';
  } else {
    titleText = t.drama_steady;
    count = u.finalMessagesOfDay;
    labelText = t.drama_steady_label;
    copyText = t.drama_steady_copy;
    accent = '#277da1';
    bg = '#577590';
  }

  const animated = useAnimatedNumber(count, 1400, [u.author]);
  const isPercent = labelText.startsWith('%');
  const cleanLabel = isPercent ? labelText.slice(1).trim() : labelText;
  const isLightBg = bg === '#f9c74f';
  const bodyColor = isLightBg ? 'rgba(87,117,144,0.88)' : 'rgba(42,6,69,0.85)';
  const heroColor = isLightBg ? '#1a1a2e' : '#2a0645';

  return (
    <SlideShell bg={bg} accent={accent}>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: accent, letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.drama_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 32 }}>
          <div className="fs-display" style={{
            fontSize: titleText.length > 20 ? 28 : 36,
            lineHeight: 1.15, letterSpacing: '-0.03em', fontStyle: 'italic', color: accent, fontWeight: 700,
          }}>
            {titleText}
          </div>
        </div>
        <div className="a-spring" style={{ animationDelay: '0.7s', marginTop: 40 }}>
          <div className="fs-display" style={{
            fontSize: 56, lineHeight: 1.1, letterSpacing: '-0.04em', color: heroColor, fontWeight: 800,
          }}>
            {animated}{isPercent ? '%' : ''}
          </div>
          <div className="fs-mono" style={{
            fontSize: 16, color: bodyColor, letterSpacing: '0.08em', marginTop: 8,
          }}>
            {cleanLabel}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.3s', marginTop: 32, fontSize: 18, lineHeight: 1.5, color: bodyColor,
        }}>
          {copyText}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideRoast = React.memo(function SlideRoast({ u, profile, t }) {
  const tone = profile?.tone || 'medium';
  const roasts = u.roasts.slice(0, 2);
  const heading = tone === 'mild' ? t.roast_heading_mild
    : tone === 'spicy' ? t.roast_heading_spicy
    : t.roast_heading_med;
  const eyebrow = tone === 'spicy' ? t.roast_eyebrow_spicy
    : tone === 'mild' ? t.roast_eyebrow_mild
    : t.roast_eyebrow_med;
  return (
    <SlideShell bg="#577590" accent="#f3722c">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 22px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f3722c', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.15s', fontSize: 32, lineHeight: 1.15,
          letterSpacing: '-0.03em', marginTop: 16, fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
        }}>
          {heading}
        </div>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {roasts.map((roast, i) => (
            <div key={i} className="a-roast-card" style={{
              position: 'relative', overflow: 'hidden',
              padding: '20px 22px 18px',
              background: 'rgba(42,6,69,0.06)',
              borderRadius: 20,
              animationDelay: `${0.5 + i * 0.5}s`,
            }}>
              <div className="fs-sans" style={{
                fontSize: 12, color: '#f3722c', letterSpacing: '0.15em',
                opacity: 0.70, marginBottom: 10, fontWeight: 500, textTransform: 'uppercase',
              }}>
                #{String(i + 1).padStart(2, '0')}
              </div>
              <div className="fs-sans" style={{
                fontSize: 18, lineHeight: 1.45, letterSpacing: '-0.01em',
                color: '#2a0645', fontWeight: 400,
              }}>
                {interp(t[roast.lineKey] || '', roast.vars || {})}
              </div>
              {tone !== 'mild' && (
                <div className="fs-display" style={{
                  marginTop: 10, fontSize: 16, lineHeight: 1.4, letterSpacing: '-0.01em',
                  color: '#f3722c', fontStyle: 'italic', fontWeight: 700,
                }}>
                  {interp(t[roast.kickerKey] || '', roast.vars || {})}
                </div>
              )}
            </div>
          ))}
        </div>
        {u.roasts.length > 2 && (
          <div className="fs-sans a-fade-up" style={{
            animationDelay: '1.8s', textAlign: 'center', marginTop: 16,
            fontSize: 12, color: 'rgba(42,6,69,0.75)', letterSpacing: '0.12em', fontWeight: 500,
          }}>
            {interp(t.roast_more, { n: u.roasts.length - 2 })}
          </div>
        )}
      </div>
    </SlideShell>
  );
})

const SlideAchievements = React.memo(function SlideAchievements({ achievements, t }) {
  const top = achievements.slice(0, 3);
  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.ach_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.2s', fontSize: 32, lineHeight: 1.15,
          letterSpacing: '-0.03em', marginTop: 20, fontWeight: 700, color: '#2a0645',
        }}>
          {t.ach_earned}<br/>
          <span style={{ fontStyle: 'italic', color: '#f94144' }}>{achievements.length}</span>{' '}
          {achievements.length === 1 ? t.ach_badges : t.ach_badges_plural}.
        </div>
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {top.map((ach, i) => (
            <div key={i} className="a-spring" style={{
              position: 'relative', overflow: 'hidden', padding: '20px 22px',
              background: `linear-gradient(135deg, ${ach.color}25 0%, ${ach.color}08 100%)`,
              borderRadius: 20,
              animationDelay: `${0.5 + i * 0.2}s`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 28, lineHeight: 1 }}>🏆</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fs-display" style={{
                    fontSize: 18, lineHeight: 1.2, color: ach.color, letterSpacing: '-0.01em', fontWeight: 700,
                  }}>
                    {t[ach.labelKey] || ach.labelKey}
                  </div>
                  <div className="fs-sans" style={{
                    fontSize: 16, color: 'rgba(42,6,69,0.82)', marginTop: 6, lineHeight: 1.4,
                  }}>
                    {interp(t[ach.evidenceKey] || '', ach.vars || {})}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {achievements.length > 3 && (
          <div className="fs-sans a-fade-up" style={{
            animationDelay: '1.5s', textAlign: 'center', marginTop: 16,
            fontSize: 12, color: 'rgba(42,6,69,0.72)', letterSpacing: '0.12em', fontWeight: 500,
          }}>
            {interp(t.ach_more, { n: achievements.length - 3 })}
          </div>
        )}
      </div>
    </SlideShell>
  );
})

const SlideMostLikely = React.memo(function SlideMostLikely({ a, t }) {
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.likely_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#2a0645',
          marginTop: 12, marginBottom: 20,
        }}>
          {t.likely_title}<br/><span style={{ fontStyle: 'italic', color: '#277da1' }}>{t.likely_verdicts}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {a.mostLikely.map((card, i) => (
            <div key={i} className="a-slide-right" style={{
              padding: '16px 20px',
              background: 'rgba(39,125,161,0.08)',
              borderRadius: 18,
              animationDelay: `${0.5 + i * 0.11}s`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 22, lineHeight: 1 }}>{card.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fs-sans" style={{
                    fontSize: 12, color: '#277da1', letterSpacing: '0.12em', fontWeight: 500, textTransform: 'uppercase',
                  }}>
                    {t.likely_label}
                  </div>
                  <div className="fs-sans" style={{ fontSize: 16, color: '#2a0645', marginTop: 4, fontWeight: 500, lineHeight: 1.3 }}>
                    {t[card.labelKey] || card.labelKey}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="fs-display" style={{
                    fontSize: 18, color: '#277da1', fontStyle: 'italic', fontWeight: 700,
                    letterSpacing: '-0.02em', maxWidth: 100,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {card.winner}
                  </div>
                  <div className="fs-mono" style={{ fontSize: 14, color: 'rgba(42,6,69,0.72)', marginTop: 4 }}>
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
})

const SlideDuo = React.memo(function SlideDuo({ a, u, t }) {
  const [n1, n2] = a.topDuo.names;
  const isInDuo = n1 === u.author || n2 === u.author;
  const partner = n1 === u.author ? n2 : n1;
  return (
    <SlideShell bg="#f3722c" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.duo_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 40 }}>
          <div className="fs-display" style={{
            fontSize: 36, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700,
          }}>
            <span style={{ fontStyle: 'italic', color: '#f94144' }}>{n1}</span>
            <span style={{ display: 'block', margin: '12px 0', fontSize: 16, color: 'rgba(42,6,69,0.75)' }}>&</span>
            <span style={{ fontStyle: 'italic', color: '#f94144' }}>{n2}</span>
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 24, lineHeight: 1.3, letterSpacing: '-0.02em', fontWeight: 700, color: '#2a0645',
          }}>
            {t.duo_traded} <span style={{ color: '#f94144' }}>{a.topDuo.count.toLocaleString()}</span><br/>
            {t.duo_replies_between}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.4s', marginTop: 32, fontSize: 18,
          color: 'rgba(42,6,69,0.85)', maxWidth: 280, margin: '32px auto 0', lineHeight: 1.45,
        }}>
          {isInDuo
            ? interp(t.duo_in_with, { partner })
            : interp(t.duo_share, { pct: a.topDuoShare.toFixed(0) })}
        </div>
      </div>
    </SlideShell>
  );
})

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SlideEras = React.memo(function SlideEras({ a, t }) {
  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.eras_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#2a0645',
          marginTop: 12, marginBottom: 20,
        }}>
          {t.eras_title}<br/><span style={{ fontStyle: 'italic', color: '#f9c74f' }}>{t.eras_subtitle}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {a.eras.map((era, i) => {
            const startMonth = MONTH_NAMES[era.startDate.getMonth()];
            const endMonth = MONTH_NAMES[era.endDate.getMonth()];
            const dateRange = startMonth === endMonth
              ? `${startMonth} ${era.startDate.getDate()}–${era.endDate.getDate()}`
              : `${startMonth} ${era.startDate.getDate()} – ${endMonth} ${era.endDate.getDate()}`;
            return (
              <div key={i} className="a-fade-up" style={{
                padding: '16px 20px',
                background: 'rgba(249,199,79,0.08)',
                borderRadius: 18,
                animationDelay: `${0.5 + i * 0.18}s`,
              }}>
                <div className="fs-sans" style={{
                  fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
                }}>
                  {t.eras_chapter} {String(i + 1).padStart(2, '0')}
                </div>
                <div className="fs-display" style={{
                  fontSize: 20, lineHeight: 1.2, letterSpacing: '-0.02em',
                  marginTop: 4, fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
                }}>
                  {era.name}
                </div>
                <div className="fs-mono" style={{
                  fontSize: 14, color: 'rgba(42,6,69,0.75)', marginTop: 6, letterSpacing: '0.03em',
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
})

const SlideChaosMoment = React.memo(function SlideChaosMoment({ a, t }) {
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
    <SlideShell bg="#f3722c" accent="#f94144" shake={true}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {bubbles.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${b.left}%`, top: -30,
            width: 60, height: 26, borderRadius: 8,
            background: 'rgba(255,255,255,0.18)',
            animation: `notifRain 3s linear ${b.delay}s infinite`,
          }} />
        ))}
      </div>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.chaos_eyebrow}
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.3s', marginTop: 24 }}>
          <div className="fs-display" style={{
            fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#2a0645',
          }}>
            <span style={{ fontStyle: 'italic' }}>{dateStr}</span>
            <span style={{ display: 'block', color: '#f94144', marginTop: 6 }}>
              {interp(t.chaos_at, { time: timeStr })}
            </span>
          </div>
        </div>
        <div className="a-spring" style={{ animationDelay: '0.8s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 56, lineHeight: 1.1, letterSpacing: '-0.04em', color: '#2a0645', fontWeight: 800,
          }}>
            {animated}
          </div>
          <div className="fs-display" style={{
            fontSize: 20, marginTop: 8, color: '#f94144', fontStyle: 'italic', fontWeight: 700,
          }}>
            {t.chaos_msgs_minute}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.6s', marginTop: 32, fontSize: 18, lineHeight: 1.5,
          color: 'rgba(42,6,69,0.85)', maxWidth: 280, margin: '32px auto 0',
        }}>
          {t.chaos_lost_control}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideGroupPersona = React.memo(function SlideGroupPersona({ a, t }) {
  return (
    <SlideShell bg="#f9c74f" accent="#577590">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#577590', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.persona_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.2s', fontSize: 20, lineHeight: 1.2,
          letterSpacing: '-0.02em', marginTop: 20, color: 'rgba(87,117,144,0.85)', fontWeight: 500,
        }}>
          {t.persona_this_group}
        </div>
        <div className="a-spring a-pulse-glow" style={{ animationDelay: '0.5s', marginTop: 24 }}>
          <div className="fs-display" style={{
            fontSize: 48, lineHeight: 1.1, letterSpacing: '-0.03em',
            color: '#577590', fontStyle: 'italic', fontWeight: 800,
          }}>
            {a.groupPersonality}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '1.2s', marginTop: 48 }}>
          <div className="fs-sans" style={{
            fontSize: 12, color: 'rgba(87,117,144,0.78)', letterSpacing: '0.12em', marginBottom: 10, fontWeight: 500, textTransform: 'uppercase',
          }}>
            {t.persona_evidence}
          </div>
          <div className="fs-sans" style={{ fontSize: 18, color: '#1a1a2e', lineHeight: 1.5, fontWeight: 400 }}>
            {a.groupPersonalityReason}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

const SlideAwards = React.memo(function SlideAwards({ a, t }) {
  // Only include awards with valid winners
  const awards = [
    a.fastestResponder && { trophy: '🏆', label: t.awards_fastest, winner: a.fastestResponder.author,
      sub: interp(t.awards_fastest_sub, { m: a.fastestResponder.avgRespMin.toFixed(1) }), color: '#277da1' },
    a.yapper && { trophy: '🎤', label: t.awards_yapper, winner: a.yapper.author,
      sub: interp(t.awards_yapper_sub, { n: a.yapper.messageCount.toLocaleString() }), color: '#f3722c' },
    a.nightOwl && a.nightOwl.nightPct > 5 && { trophy: '🌙', label: t.awards_nightowl,
      winner: a.nightOwl.author, sub: interp(t.awards_nightowl_sub, { pct: a.nightOwl.nightPct.toFixed(0) }), color: '#277da1' },
    a.ghost && a.ghost.longestAbsenceDays >= 7 && { trophy: '👻', label: t.awards_ghost,
      winner: a.ghost.author, sub: interp(t.awards_ghost_sub, { n: a.ghost.longestAbsenceDays }), color: '#2a0645' },
    a.killer && a.killer.conversationsKilled >= 3 && { trophy: '💀', label: t.awards_killer,
      winner: a.killer.author, sub: interp(t.awards_killer_sub, { n: a.killer.conversationsKilled }), color: '#f3722c' },
    a.reviver && a.reviver.conversationsRevived >= 3 && { trophy: '✨', label: t.awards_defib,
      winner: a.reviver.author, sub: interp(t.awards_defib_sub, { n: a.reviver.conversationsRevived }), color: '#277da1' },
  ].filter(Boolean).slice(0, 6);

  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.awards_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#2a0645',
          marginTop: 10, marginBottom: 18,
        }}>
          {t.awards_title}<br/><span style={{ fontStyle: 'italic', color: '#f94144' }}>{t.awards_are}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {awards.map((aw, i) => (
            <div key={aw.label} className="a-slide-up-far" style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px',
              background: 'rgba(42,6,69,0.06)',
              borderRadius: 18,
              animationDelay: `${0.5 + i * 0.15}s`,
            }}>
              <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{aw.trophy}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fs-sans" style={{
                  fontSize: 12, color: aw.color, letterSpacing: '0.12em',
                  fontWeight: 500, textTransform: 'uppercase',
                }}>
                  {aw.label}
                </div>
                <div className="fs-sans" style={{
                  fontSize: 16, fontWeight: 700, marginTop: 3, lineHeight: 1.2, color: '#2a0645',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {aw.winner}
                </div>
              </div>
              <div className="fs-mono" style={{
                fontSize: 14, color: 'rgba(42,6,69,0.72)', textAlign: 'right', flexShrink: 0, lineHeight: 1.4,
              }}>
                {aw.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

const SlidePeakDay = React.memo(function SlidePeakDay({ a, t }) {
  if (!a.peakDay) return null;
  const [date, count] = a.peakDay;
  const [yr, mo, dy] = date.split('-').map(Number);
  const dateObj = new Date(yr, mo - 1, dy);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const animated = useAnimatedNumber(count, 1400, [date]);

  return (
    <SlideShell bg="#f3722c" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.peakday_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.3s', fontSize: 32, lineHeight: 1.15,
          letterSpacing: '-0.03em', marginTop: 20, fontWeight: 700, color: '#2a0645',
        }}>
          <span style={{ fontStyle: 'italic' }}>{dayName},</span><br/>{dateStr}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.7s', fontSize: 64, lineHeight: 1.1,
          letterSpacing: '-0.04em', color: '#f9c74f', marginTop: 40, fontWeight: 800,
        }}>
          {animated}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '1.2s', fontSize: 20, marginTop: 10, fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
        }}>
          {t.peakday_msgs}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideFinale = React.memo(function SlideFinale({ a, t, onExit, onMenu }) {
  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.finale_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 52, lineHeight: 1.1, letterSpacing: '-0.04em', fontWeight: 800, color: '#2a0645',
          }}>
            <span style={{ display: 'block' }}>{t.finale_see}</span>
            <span style={{ display: 'block' }}>{t.finale_in_the}</span>
            <span style={{ display: 'block', fontStyle: 'italic', color: '#f94144' }}>{t.finale_chat}</span>
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 40, fontSize: 18, color: 'rgba(42,6,69,0.85)', lineHeight: 1.45,
        }}>
          {t.finale_now}
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.4s', display: 'flex', gap: 8,
          justifyContent: 'center', marginTop: 32,
        }}>
          <button onClick={onMenu || onExit} className="press fs-sans" style={{
            padding: '14px 28px', background: '#f9c74f', color: '#0a0a0f',
            border: 'none', borderRadius: 999, fontSize: 18, fontWeight: 700, cursor: 'pointer',
          }}>
            {t.finale_explore}
          </button>
        </div>
      </div>
    </SlideShell>
  );
})

// ============================================================
// GROUP-FIRST TIGHT DECK — short, data-dense, screenshot-worthy.
// Every number comes from verified parsed analytics (no AI text).
// ============================================================

// 1) Group overview — totals, people, span, peak hour + busiest day
const SlideGroupOverview = React.memo(function SlideGroupOverview({ a, t }) {
  const peakHour = (a.groupHourly && a.groupHourly.length)
    ? a.groupHourly.indexOf(Math.max(...a.groupHourly)) : null;
  const fmt = (d) => { try { return new Date(d).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); } catch { return ''; } };
  const range = `${fmt(a.start)} – ${fmt(a.end)}`;
  let peakDayStr = null, peakDayCount = null;
  if (a.peakDay) {
    const [date, count] = a.peakDay;
    const [yr, mo, dy] = date.split('-').map(Number);
    peakDayStr = new Date(yr, mo - 1, dy).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    peakDayCount = count;
  }
  const tiles = [
    { big: a.totalMessages.toLocaleString(), label: t.go_messages, color: '#573280' },
    { big: String(a.totalParticipants), label: t.go_people, color: '#f3722c' },
    { big: String(a.durationDays), label: t.go_days, sub: range, color: '#277da1' },
    { big: peakHour != null ? `${String(peakHour).padStart(2, '0')}:00` : '—', label: t.go_peakhour, color: '#8338ec' },
  ];
  return (
    <SlideShell bg="#577590" accent="#573280">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '36px 24px 24px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#573280', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.go_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 18 }}>{t.go_title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {tiles.map((tile, i) => (
            <div key={i} className="a-slide-up-far" style={{ background: 'rgba(42,6,69,0.06)', borderRadius: 18, padding: '18px 16px', textAlign: 'center', animationDelay: `${0.4 + i * 0.12}s` }}>
              <div className="fs-display" style={{ fontSize: tile.big.length > 6 ? 28 : 34, fontWeight: 800, color: tile.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{tile.big}</div>
              <div className="fs-sans" style={{ marginTop: 6, fontSize: 12, color: 'rgba(42,6,69,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>{tile.label}</div>
              {tile.sub && <div className="fs-mono" style={{ marginTop: 4, fontSize: 11, color: 'rgba(42,6,69,0.55)' }}>{tile.sub}</div>}
            </div>
          ))}
        </div>
        {peakDayStr && (
          <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 14, textAlign: 'center', background: 'rgba(243,114,44,0.1)', borderRadius: 16, padding: '14px 16px' }}>
            <span className="fs-sans" style={{ fontSize: 12, color: '#f3722c', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>{t.go_busiest} </span>
            <span className="fs-display" style={{ fontSize: 18, fontWeight: 800, color: '#2a0645' }}>{peakDayStr}</span>
            <span className="fs-mono" style={{ fontSize: 13, color: 'rgba(42,6,69,0.6)' }}> · {interp(t.go_busiest_msgs, { n: peakDayCount.toLocaleString() })}</span>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

// 2) Leaderboard — full ranking by messages, quietest flagged
const SlideLeaderboard = React.memo(function SlideLeaderboard({ a, t }) {
  const users = a.users || [];
  if (users.length === 0) return null;
  const max = users[0].messageCount || 1;
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <SlideShell bg="#f3722c" accent="#f3722c">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#f3722c', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.lb_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16 }}>{t.lb_title}</div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((usr, i) => {
            const pct = Math.max(6, Math.round((usr.messageCount / max) * 100));
            const last = i === users.length - 1 && users.length > 1;
            return (
              <div key={usr.author} dir="auto" className="a-slide-up-far" style={{ position: 'relative', padding: '12px 16px', background: last ? 'rgba(87,117,144,0.12)' : 'rgba(243,114,44,0.08)', borderRadius: 14, overflow: 'hidden', animationDelay: `${0.4 + i * 0.08}s` }}>
                <div className="a-slide-right" style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, background: 'linear-gradient(90deg, rgba(243,114,44,0.16) 0%, rgba(243,114,44,0.02) 100%)', width: `${pct}%`, animationDelay: `${0.6 + i * 0.08}s`, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="fs-display" style={{ width: 26, flexShrink: 0, fontSize: i < 3 ? 20 : 14, textAlign: 'center', color: 'rgba(42,6,69,0.5)' }}>{i < 3 ? medals[i] : (i + 1)}</div>
                  <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: '#2a0645', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {usr.author}{last && <span style={{ fontSize: 11, color: '#577590', fontWeight: 600 }}> · {t.lb_least}</span>}
                  </div>
                  <div className="fs-mono" style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, color: '#f3722c' }}>{usr.messageCount.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
})

// 3) Per-person — messages, share %, words, avg words/msg
const SlidePerPerson = React.memo(function SlidePerPerson({ a, t }) {
  const users = a.users || [];
  if (users.length === 0) return null;
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.pp_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 14 }}>{t.pp_title}</div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((usr, i) => (
            <div key={usr.author} dir="auto" className="a-slide-up-far" style={{ padding: '12px 16px', background: 'rgba(42,6,69,0.06)', borderRadius: 14, animationDelay: `${0.4 + i * 0.08}s` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: '#2a0645', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.author}</div>
                <div className="fs-display" style={{ fontSize: 18, fontWeight: 800, color: '#277da1' }}>{usr.messageCount.toLocaleString()}</div>
                <div className="fs-mono" style={{ fontSize: 12, color: 'rgba(42,6,69,0.55)', width: 46, textAlign: 'right' }}>{usr.sharePct.toFixed(1)}%</div>
              </div>
              <div className="fs-mono" style={{ marginTop: 4, fontSize: 11, color: 'rgba(42,6,69,0.6)' }}>
                {interp(t.pp_row, { words: usr.wordCount.toLocaleString(), avg: usr.avgWordsPerMsg.toFixed(1) })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

// 4) Signature words — one meaningful word per person (stopwords already excluded)
const SlideSignatureWords = React.memo(function SlideSignatureWords({ a, t }) {
  const rows = (a.users || []).filter(usr => usr.topWord);
  if (rows.length === 0) return null;
  return (
    <SlideShell bg="#577590" accent="#8338ec">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#8338ec', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.sw_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16 }}>{t.sw_title}</div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((usr, i) => (
            <div key={usr.author} dir="auto" className="a-slide-up-far" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(131,56,236,0.07)', borderRadius: 16, animationDelay: `${0.4 + i * 0.1}s` }}>
              <div className="fs-sans" style={{ width: '34%', flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'rgba(42,6,69,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.author}</div>
              <div className="fs-display" style={{ flex: 1, minWidth: 0, fontSize: usr.topWord.length > 10 ? 18 : 24, fontStyle: 'italic', fontWeight: 700, color: '#8338ec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{usr.topWord}"</div>
              <div className="fs-mono" style={{ flexShrink: 0, fontSize: 12, color: 'rgba(42,6,69,0.5)' }}>{usr.topWordCount}×</div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

// 5) Group top — most-used emoji + most-used meaningful word
const SlideGroupTop = React.memo(function SlideGroupTop({ a, t }) {
  const word = (a.topWordsGroup && a.topWordsGroup[0]) || null;
  const emoji = (a.topEmojisGroup && a.topEmojisGroup[0]) || null;
  if (!word && !emoji) return null;
  return (
    <SlideShell bg="#f9c74f" accent="#f9c74f">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', padding: '0 24px', gap: 8 }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f3722c', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.gt_eyebrow}</div>
        {emoji && (
          <div className="a-spring" style={{ animationDelay: '0.2s', marginTop: 16 }}>
            <div style={{ fontSize: 84, lineHeight: 1 }}>{emoji.emoji}</div>
            <div className="fs-mono" style={{ marginTop: 4, fontSize: 13, color: 'rgba(42,6,69,0.6)' }}>{interp(t.gt_emoji, { n: emoji.count.toLocaleString() })}</div>
          </div>
        )}
        {word && (
          <div className="a-fade-up" style={{ animationDelay: '0.7s', marginTop: 24 }}>
            <div className="fs-display" dir="auto" style={{ fontSize: word.word.length > 10 ? 34 : 46, fontStyle: 'italic', fontWeight: 800, color: '#2a0645', letterSpacing: '-0.03em', lineHeight: 1.05, wordBreak: 'break-word' }}>"{word.word}"</div>
            <div className="fs-mono" style={{ marginTop: 8, fontSize: 13, color: 'rgba(42,6,69,0.6)' }}>{interp(t.gt_word, { n: word.count.toLocaleString() })}</div>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

// Photos — real images extracted on-device from the "with media" .zip
const SlidePhotos = React.memo(function SlidePhotos({ a, t }) {
  const photos = a.photos || [];
  if (photos.length === 0) return null;
  const shown = photos.slice(0, 9);
  const tilts = [-3, 2, -2, 3, -1, 2, -3, 1, -2];
  return (
    <SlideShell bg="#f3722c" accent="#FF8C00">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#FF8C00', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.photos_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 4 }}>
          {interp(t.photos_title, { n: photos.length.toLocaleString() })}
        </div>
        <div className="fs-mono a-fade-up" style={{ textAlign: 'center', animationDelay: '0.2s', fontSize: 11, color: 'rgba(42,6,69,0.5)', marginBottom: 14 }}>
          {t.photos_sub}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {shown.map((p, i) => (
              <div key={p.url} className="a-spring" style={{
                aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
                background: '#fff', padding: 3, transform: `rotate(${tilts[i % tilts.length]}deg)`,
                boxShadow: '0 6px 14px -4px rgba(74,14,78,0.4)', animationDelay: `${0.3 + i * 0.07}s`,
              }}>
                <img src={p.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9, display: 'block' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

// 9) Teaser — locked cards that make users want more (Step 4 hook)
const SlideTeaser = React.memo(function SlideTeaser({ t, onMenu, onExit }) {
  const cards = [
    { icon: '🔥', label: t.tz_roast },
    { icon: '👯', label: t.tz_duo },
    { icon: '👤', label: t.tz_profile },
    { icon: '🌪️', label: t.tz_chaos },
  ];
  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.tz_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16 }}>{t.tz_title}</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.map((c, i) => (
            <div key={i} className="a-slide-up-far" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'rgba(42,6,69,0.06)', borderRadius: 16, animationDelay: `${0.4 + i * 0.12}s` }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{c.icon}</div>
              <div className="fs-sans" dir="auto" style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#2a0645' }}>{c.label}</div>
              <div style={{ flexShrink: 0, fontSize: 16, opacity: 0.55 }}>🔒</div>
            </div>
          ))}
        </div>
        <button onClick={onMenu || onExit} className="press fs-sans" style={{ marginTop: 16, padding: '15px', background: '#f94144', color: '#fff', border: 'none', borderRadius: 999, fontSize: 17, fontWeight: 800, cursor: 'pointer', width: '100%' }}>
          {t.tz_cta}
        </button>
      </div>
    </SlideShell>
  );
})

const SLIDE_COMPONENTS = {
  intro:           SlideIntro,
  group_overview:  SlideGroupOverview,
  leaderboard:     SlideLeaderboard,
  per_person:      SlidePerPerson,
  signature_words: SlideSignatureWords,
  group_top:       SlideGroupTop,
  photos:          SlidePhotos,
  teaser:          SlideTeaser,
  message_count:   SlideMessageCount,
  rank:            SlideRank,
  vs_everyone:     SlideVsEveryone,
  novelist:        SlideNovelist,
  title:           SlideTitle,
  group_describes: SlideGroupDescribes,
  peak_hour:       SlidePeakHour,
  night:           SlideNight,
  streak:          SlideStreak,
  speed:           SlideSpeed,
  ghoster:         SlideGhoster,
  signature_word:  SlideWord,
  top_words:       SlideTopWords,
  top_emoji:       SlideEmoji,
  vibe_check:      SlideVibeCheck,
  drama_role:      SlideDramaRole,
  roast:           SlideRoast,
  achievements:    SlideAchievements,
  most_likely:     SlideMostLikely,
  duo:             SlideDuo,
  eras:            SlideEras,
  chaos_moment:    SlideChaosMoment,
  group_persona:   SlideGroupPersona,
  awards:          SlideAwards,
  peak_day:        SlidePeakDay,
  finale:          SlideFinale,
};

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
      background: '#faf6f0',
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'fixed', top: -50, right: -60, width: 200, height: 200,
        borderRadius: '50%', background: '#ffd972', opacity: 0.50,
        filter: 'blur(65px)', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: 80, left: -50, width: 180, height: 180,
        borderRadius: '50%', background: '#9cf6f6', opacity: 0.45,
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', top: '40%', left: -70, width: 160, height: 160,
        borderRadius: '50%', background: '#f1e4f3', opacity: 0.70,
        filter: 'blur(55px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ padding: '16px 20px 32px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: '#2a0645' }}>
            chat<span style={{ color: '#f06449' }}>wrapped</span>
          </div>
          <button onClick={onReset} className="press" aria-label={t.a11y_start_over || 'Start over'} style={{
            background: 'rgba(87,50,128,0.08)', border: '1px solid rgba(87,50,128,0.18)', color: '#573280',
            width: 40, height: 40, borderRadius: 999, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        <div style={{ height: 14 }} />

        {/* CTAs: Replay + Roast Mode side by side */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onReplay} className="a-scale-in press lift" style={{
            flex: 1, position: 'relative', overflow: 'hidden', textAlign: 'left',
            background: 'linear-gradient(135deg, #ffd972 0%, #f9c74f 100%)',
            border: 'none', borderRadius: 18, padding: '16px 14px', cursor: 'pointer',
            color: '#2a0645', boxShadow: '0 8px 24px rgba(255,217,114,0.50)',
          }}>
            <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
            <div className="fs-display" style={{
              position: 'absolute', right: -14, top: -10, fontSize: 80,
              opacity: 0.15, lineHeight: 1,
            }}>✦</div>
            <div className="fs-mono" style={{
              fontSize: 10, letterSpacing: '0.22em', opacity: 0.70, fontWeight: 700,
            }}>
              {t.menu_replay}
            </div>
            <div className="fs-display" style={{
              fontSize: 21, lineHeight: 1.0, letterSpacing: '-0.03em', marginTop: 4,
              whiteSpace: 'pre-line', fontWeight: 800,
            }}>
              {t.menu_watch}
            </div>
          </button>

          <button onClick={onRoastMode} className="a-scale-in press lift" style={{
            flex: 1, position: 'relative', overflow: 'hidden', textAlign: 'left',
            background: 'linear-gradient(135deg, #f06449 0%, #e8533a 100%)',
            border: 'none', borderRadius: 18, padding: '16px 14px', cursor: 'pointer',
            color: '#fff', boxShadow: '0 8px 24px rgba(240,100,73,0.40)',
            animationDelay: '0.05s',
          }}>
            <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
            <div style={{
              position: 'absolute', right: -8, top: -8, fontSize: 60,
              opacity: 0.20, lineHeight: 1,
            }}>🔥</div>
            <div className="fs-mono" style={{
              fontSize: 10, letterSpacing: '0.22em', opacity: 0.90, fontWeight: 700,
            }}>
              {t.menu_roast_mode}
            </div>
            <div className="fs-display" style={{
              fontSize: 21, lineHeight: 1.0, letterSpacing: '-0.03em', marginTop: 4,
              whiteSpace: 'pre-line', fontWeight: 800,
            }}>
              {t.menu_roast_everyone}
            </div>
          </button>
        </div>

        {/* Person picker */}
        <button onClick={() => setPickerOpen(true)} className="press" style={{
          width: '100%', marginTop: 10,
          padding: '13px 16px',
          background: 'rgba(241,228,243,0.60)', border: '1px solid rgba(87,50,128,0.15)',
          borderRadius: 16, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 2px 10px rgba(87,50,128,0.06)',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(42,6,69,0.50)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              {t.menu_viewing_as}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3, color: '#2a0645' }}>{selectedAuthor}</div>
            <div className="fs-mono" style={{
              fontSize: 11, color: '#573280', marginTop: 3, fontStyle: 'italic',
            }}>"{resolveTitle(u, t)}"</div>
          </div>
          <div className="fs-mono" style={{ fontSize: 12, color: '#f06449', letterSpacing: '0.1em', fontWeight: 700 }}>
            {t.menu_switch}
          </div>
        </button>

        {/* Verified data badge */}
        <button onClick={onDebug} className="press" style={{
          width: '100%', textAlign: 'left',
          marginTop: 10, padding: '13px 16px',
          background: 'rgba(255,217,114,0.20)',
          border: '1px solid rgba(255,217,114,0.45)',
          borderRadius: 14, cursor: 'pointer', color: '#2a0645',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          minHeight: 52, boxShadow: '0 2px 10px rgba(255,217,114,0.15)',
        }}>
          <div>
            <div className="fs-mono" style={{
              fontSize: 11, color: '#573280', letterSpacing: '0.2em', fontWeight: 700,
            }}>
              {interp(t.menu_verified, { n: diagnostics?.confidence ?? 0 })}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(42,6,69,0.70)', marginTop: 4 }}>
              {interp(t.menu_msgs_senders, {
                msgs: diagnostics?.parsedMessages.toLocaleString(),
                senders: Object.keys(diagnostics?.perAuthorCount || {}).length,
              })}
            </div>
            {diagnostics?.warnings.length > 0 && (
              <div style={{ fontSize: 11, color: '#f06449', marginTop: 3 }}>
                {diagnostics.warnings[0]}
              </div>
            )}
          </div>
          <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(42,6,69,0.40)', letterSpacing: '0.1em', fontWeight: 600 }}>
            {t.menu_verify}
          </div>
        </button>

        {/* Group personality */}
        <div style={{
          marginTop: 14, padding: 16,
          background: 'rgba(87,50,128,0.07)',
          border: '1px solid rgba(87,50,128,0.14)', borderRadius: 16,
          boxShadow: '0 2px 12px rgba(87,50,128,0.06)',
        }}>
          <div className="fs-mono" style={{
            fontSize: 10, color: '#f06449', letterSpacing: '0.2em', marginBottom: 6,
            fontWeight: 700, textTransform: 'uppercase',
          }}>
            ✦ {t.menu_this_group_is}
          </div>
          <div className="fs-display" style={{
            fontSize: 22, lineHeight: 1.05, letterSpacing: '-0.03em',
            fontStyle: 'italic', color: '#573280', fontWeight: 800,
          }}>
            {analytics.groupPersonality}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(42,6,69,0.65)', marginTop: 8, lineHeight: 1.5 }}>
            {analytics.groupPersonalityReason}
          </div>
        </div>

        {/* Eras */}
        {analytics.eras && analytics.eras.length >= 2 && (
          <div style={{ marginTop: 20 }}>
            <div className="fs-mono" style={{
              fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.2em', marginBottom: 8,
              fontWeight: 700, textTransform: 'uppercase',
            }}>
              {t.menu_eras}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {analytics.eras.map((era, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  background: i === 0 ? 'rgba(255,217,114,0.22)' : 'rgba(241,228,243,0.50)',
                  border: '1px solid rgba(87,50,128,0.10)',
                  borderRadius: 14,
                  boxShadow: '0 1px 6px rgba(87,50,128,0.05)',
                }}>
                  <div className="fs-mono" style={{
                    fontSize: 13, color: i === 0 ? '#f06449' : 'rgba(87,50,128,0.50)', fontWeight: 700, width: 22,
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fs-display" style={{
                      fontSize: 15, fontStyle: 'italic', letterSpacing: '-0.01em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: '#2a0645', fontWeight: 700,
                    }}>
                      {era.name}
                    </div>
                    <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(42,6,69,0.50)', marginTop: 1 }}>
                      {era.messageCount.toLocaleString()} {t.eras_msgs} · {era.days}d
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        <div style={{ marginTop: 20 }}>
          <div className="fs-mono" style={{
            fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.2em', marginBottom: 8,
            fontWeight: 700, textTransform: 'uppercase',
          }}>
            {t.menu_highlights}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
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
          <div style={{ marginTop: 20 }}>
            <div className="fs-mono" style={{
              fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.2em', marginBottom: 8,
              fontWeight: 700, textTransform: 'uppercase',
            }}>
              {t.menu_badges} · {userAchievements.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {userAchievements.map((ach, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 13px',
                  background: `${ach.color}18`,
                  border: `1px solid ${ach.color}30`,
                  borderRadius: 13,
                }}>
                  <div style={{ fontSize: 16 }}>🏆</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ach.color }}>{t[ach.labelKey] || ach.labelKey}</div>
                    <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(42,6,69,0.50)', marginTop: 1 }}>{interp(t[ach.evidenceKey] || '', ach.vars || {})}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ marginTop: 20 }}>
          <div className="fs-mono" style={{
            fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.2em', marginBottom: 8,
            fontWeight: 700, textTransform: 'uppercase',
          }}>
            {t.menu_leaderboard}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {analytics.users.map((user, i) => {
              const isUser = user.author === selectedAuthor;
              const isFirst = i === 0;
              return (
                <div key={user.author} dir="auto" style={{
                  padding: '12px 14px',
                  background: isFirst ? 'rgba(255,217,114,0.28)' : isUser ? 'rgba(241,228,243,0.60)' : 'rgba(241,228,243,0.35)',
                  border: `1px solid ${isFirst ? 'rgba(255,217,114,0.40)' : 'rgba(87,50,128,0.10)'}`,
                  borderRadius: 16,
                  boxShadow: '0 1px 6px rgba(87,50,128,0.05)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div className="fs-mono" style={{
                        fontSize: 12, color: isFirst ? '#f06449' : 'rgba(87,50,128,0.35)', width: 18, fontWeight: 700,
                      }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 14, fontWeight: isUser || isFirst ? 700 : 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: '#2a0645',
                        }}>
                          {user.author}{isUser && <span style={{ color: '#f06449', fontSize: 11 }}> {t.rank_you}</span>}
                        </div>
                        <div className="fs-mono" style={{
                          fontSize: 11, color: 'rgba(42,6,69,0.45)', marginTop: 1, fontStyle: 'italic',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {resolveTitle(user, t)}
                        </div>
                      </div>
                    </div>
                    <div className="fs-mono" style={{
                      fontSize: 13, color: isFirst ? '#f06449' : 'rgba(42,6,69,0.60)',
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
                  fontSize: 20, color: '#f9c74f', marginTop: 2, fontStyle: 'italic',
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
      background: accent ? 'rgba(255,217,114,0.22)' : 'rgba(241,228,243,0.50)',
      border: `1px solid ${accent ? 'rgba(255,217,114,0.40)' : 'rgba(87,50,128,0.10)'}`,
      borderRadius: 14, padding: 13, minHeight: 80,
      boxShadow: '0 1px 6px rgba(87,50,128,0.05)',
    }}>
      <div className="fs-display" style={{
        fontSize: small ? 16 : 24, letterSpacing: '-0.02em', lineHeight: 1,
        color: accent ? '#f06449' : '#2a0645',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontWeight: 800,
      }}>{value}</div>
      <div className="fs-mono" style={{
        fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.12em', marginTop: 7,
        textTransform: 'uppercase',
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
  const confColor = confidence >= 90 ? '#f9c74f' : confidence >= 70 ? '#f9c74f' : '#f3722c';
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
            {t.verify_title} <span style={{ fontStyle: 'italic', color: '#f9c74f' }}>{t.verify_right}</span>?
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
            <div style={{ marginTop: 10, fontSize: 21, color: '#f9c74f', lineHeight: 1.4 }}>
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
                  background: 'rgba(249,199,79,0.06)',
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
                  <div className="fs-mono" style={{ fontSize: 22, color: '#f9c74f', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
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
                  background: 'rgba(39,125,161,0.06)',
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
                  <div className="fs-mono" style={{ fontSize: 22, color: '#277da1', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
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
                  <div className="fs-mono" style={{ fontSize: 22, color: p.media > 0 ? '#f9c74f' : '#6a6a7a', textAlign: 'right', fontWeight: 600 }}>
                    {p.media.toLocaleString()}
                  </div>
                  <div className="fs-mono" style={{ fontSize: 22, color: p.voice > 0 ? '#277da1' : '#6a6a7a', textAlign: 'right', fontWeight: 600, minWidth: 36 }}>
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
                    fontSize: 20, color: '#f9c74f', letterSpacing: '0.1em',
                    background: 'rgba(249,199,79,0.14)', padding: '3px 8px', borderRadius: 4,
                  }}>
                    {s.flags}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 6, fontSize: 20 }}>
                <div className="fs-mono" style={{ color: '#c8c8dc' }}>timestamp</div>
                <div className="fs-mono" style={{ color: '#f9c74f' }}>{s.timestamp}</div>
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
          padding: 18, background: '#f9c74f', color: '#0a0a0f',
          border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 800,
          cursor: 'pointer', letterSpacing: '-0.01em',
          boxShadow: '0 12px 28px rgba(249,199,79,0.35)',
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
  const valueColor = warn ? '#f3722c' : accent ? '#f9c74f' : '#fff';
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
            background: 'rgba(42,6,69,0.05)', border: '1px solid #2a2a36',
            color: '#cfcfdc', padding: '10px 16px', borderRadius: 999,
            fontSize: 22, fontWeight: 600, cursor: 'pointer', minHeight: 44,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>{t.rm_back}</button>
          <div className="fs-mono" style={{ fontSize: 20, color: '#f3722c', letterSpacing: '0.2em', fontWeight: 700 }}>
            {t.rm_title}
          </div>
        </div>

        {/* Title */}
        <div className="fs-display a-fade-up" style={{
          fontSize: 52, lineHeight: 0.9, letterSpacing: '-0.04em',
          marginTop: 4, marginBottom: 8,
        }}>
          {t.rm_pick}<br/>
          <span style={{ fontStyle: 'italic', color: '#f3722c' }}>{t.rm_victim}</span>
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
          background: 'linear-gradient(135deg, #f3722c 0%, #f3722c 100%)',
          border: 'none', borderRadius: 18, color: '#fff',
          boxShadow: '0 14px 30px rgba(243,114,44,0.35)',
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
                ? 'linear-gradient(135deg, rgba(243,114,44,0.16) 0%, rgba(243,114,44,0.04) 100%)'
                : 'linear-gradient(135deg, rgba(243,114,44,0.14) 0%, rgba(243,114,44,0.03) 100%)',
              border: `1px solid ${i % 2 === 0 ? 'rgba(243,114,44,0.4)' : 'rgba(243,114,44,0.35)'}`,
              borderRadius: 20,
              animationDelay: `${0.1 + i * 0.12}s`,
              boxShadow: i % 2 === 0
                ? '0 10px 28px rgba(243,114,44,0.12)'
                : '0 10px 28px rgba(243,114,44,0.10)',
            }}>
              <div style={{
                position: 'absolute', top: 14, right: 14,
                fontSize: 22, opacity: 0.5,
              }}>{i === 0 ? '🔥' : i === 1 ? '💀' : i === 2 ? '☠️' : '🫠'}</div>
              <div className="fs-mono" style={{
                fontSize: 20, color: i % 2 === 0 ? '#f3722c' : '#f3722c',
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
                color: i % 2 === 0 ? '#f3722c' : '#f3722c', fontStyle: 'italic',
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
                acc.push(<span key={idx} style={{ color: '#f3722c' }}>{selectedAuthor}</span>);
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
                    fontSize: 20, color: '#f3722c', marginTop: 2, fontStyle: 'italic',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {interp(other.roasts.length === 1 ? t.rm_ready : t.rm_ready_plural, { n: other.roasts.length })}
                  </div>
                </div>
                <div className="fs-mono" style={{ fontSize: 20, color: '#f9c74f', letterSpacing: '0.1em' }}>
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
                  fontSize: 20, color: '#f3722c', marginTop: 2, fontStyle: 'italic',
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
