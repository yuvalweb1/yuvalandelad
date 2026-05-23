import { EMOJI_RE, LINK_RE } from '../parser/index.js';

export const STOPWORDS = new Set([
  // Hebrew
  'אני','אתה','את','הוא','היא','אנחנו','אתם','הם','הן','זה','זאת','של','על','אל','עם','לא','כן','אם','או','גם','רק','כל','יש','אין','היה','כי','אבל','מה','מי','איך','איפה','מתי','למה','כמה','איזה','עוד','כבר','אז','פה','שם','ככה','אוקיי','אוקי','אהה','נו','טוב','הי','היי','שלום','תודה','סבבה','באמת','בטח','אולי','כאילו','יותר','פחות','הכי','מאוד','ממש','די','קצת','הרבה','בכלל','אחרי','לפני','בין','בלי','עד','אמר','אומר','יודע','חושב','רוצה','עושה','בא','באה','שלי','שלך','שלו','שלה','הזה','הזאת','כן','לאן','משהו','כלום','אחד','אחת','כאשר','עכשיו',
  // media-omission noise (safety net — these lines should be flagged as media,
  // but never let the "omitted" word become a signature/top word)
  'הושמט','הושמטה','הושמטו','נכללה',
  // English
  'the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','could','can','may','might','must','i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','this','that','these','those','and','or','but','if','then','so','for','of','at','by','with','from','to','in','on','as','no','yes','not','just','very','too','also','only','all','some','any','more','most','lol','omg','idk','tbh','btw','oh','ah','hmm','yeah','yep','ok','okay','like','one','two','get','got','going','gonna','wanna','what','when','where','why','how','who','which','because','about','out','up','down','here','there','omitted',
]);

// Returns the [key, count] entry with the highest count without sorting.
export function maxEntry(freq) {
  let bestKey = null, bestVal = 0;
  for (const key in freq) {
    if (freq[key] > bestVal) { bestVal = freq[key]; bestKey = key; }
  }
  return bestKey === null ? undefined : [bestKey, bestVal];
}

// Returns the top-N [key, count] pairs from a freq map without a full sort.
// Maintains a size-N buffer; heap[0] is always the current minimum.
export function topNEntries(freq, n) {
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

export function argmax(arr, fn) {
  let best, bestVal = -Infinity;
  for (const item of arr) {
    const v = fn(item);
    if (v > bestVal) { bestVal = v; best = item; }
  }
  return best;
}

export function argmaxArr(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

// Deterministic string hash → stable pick. Lets the same stat land a different
// roast for different people WITHOUT randomness (same author → same joke).
export function rHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}
export function rPick(seed, keys) {
  // Salt with the first key so the same author varies across different tiers
  // (not always "variant #0"), while staying fully deterministic.
  return keys[rHash(seed + '|' + keys[0]) % keys.length];
}

export function computeAll(messages) {
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
