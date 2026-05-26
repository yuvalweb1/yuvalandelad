// Past recap history — persisted to localStorage, capped at 10 entries.
// `stats` is the full analytics object minus session-only fields (blob URLs).
// Stored shape: { id, date, chatName, stats }

const KEY = 'recapped_history';
const MAX_ENTRIES = 10;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

// WhatsApp's exported filenames are localized to the device language.
// Strip the "WhatsApp Chat with " preamble across the languages this app supports.
const FILENAME_PREFIX_PATTERNS = [
  /^WhatsApp\s+Chat\s+(?:with|-)\s*/i,             // en  (iOS + Android)
  /^WhatsApp\s+צ['׳']?אט\s+עם\s*/i,                // he
  /^Chat\s+de\s+WhatsApp\s+con\s*/i,               // es
  /^Discussion\s+WhatsApp\s+avec\s*/i,             // fr
  /^WhatsApp[-\s]Chat\s+mit\s*/i,                  // de
  /^Conversa\s+do\s+WhatsApp\s+com\s*/i,           // pt
  /^Chat\s+WhatsApp\s+con\s*/i,                    // it
  /^Чат\s+WhatsApp\s+с\s*/i,                       // ru
  /^محادثة\s+WhatsApp\s+مع\s*/i,                    // ar
  /^WhatsApp\s+Sohbeti[-:\s]+/i,                   // tr
];

// Friendly chat name from an export filename — last-resort fallback when the
// parser couldn't detect the group's own subject from the chat content.
export function chatNameFromFile(name) {
  if (!name) return '';
  let n = name.replace(/\.(txt|zip)$/i, '').trim();
  if (/^_chat$/i.test(n)) return 'Chat';
  for (const re of FILENAME_PREFIX_PATTERNS) {
    if (re.test(n)) { n = n.replace(re, ''); break; }
  }
  return n.trim() || 'Chat';
}

// Prefer the in-chat group subject (the actual chat name) when the parser
// detected it; otherwise derive a clean name from the filename.
export function deriveChatName({ diagnostics, fileName }) {
  const detected = diagnostics?.detectedGroupName;
  if (detected) {
    // detectedGroupName may join multiple subjects with ", " if the title
    // changed during the chat's lifetime — keep the most recent one.
    const parts = detected.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return chatNameFromFile(fileName);
}

export function saveRecap({ chatName, stats }) {
  const list = loadHistory();
  const entry = {
    id: (crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    date: Date.now(),
    chatName: chatName || 'Chat',
    stats,
  };
  const next = [entry, ...list].slice(0, MAX_ENTRIES);
  persist(next);
  return entry;
}

export function removeRecap(id) {
  const next = loadHistory().filter(r => r.id !== id);
  persist(next);
  return next;
}

export function clearHistory() {
  try { localStorage.removeItem(KEY); } catch {}
}

// "2 days ago", "just now", etc. — localized via Intl when available.
export function relativeTime(ts, lang = 'en') {
  const diffMs = Date.now() - ts;
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr  = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const mon = Math.round(day / 30);
  const yr  = Math.round(day / 365);

  let value, unit;
  if (sec < 45)       { return tryRTF(0, 'second', lang) || 'just now'; }
  else if (min < 60)  { value = -min; unit = 'minute'; }
  else if (hr  < 24)  { value = -hr;  unit = 'hour';   }
  else if (day < 30)  { value = -day; unit = 'day';    }
  else if (mon < 12)  { value = -mon; unit = 'month';  }
  else                { value = -yr;  unit = 'year';   }

  const rtf = tryRTF(value, unit, lang);
  if (rtf) return rtf;
  // English fallback
  const abs = Math.abs(value);
  return `${abs} ${unit}${abs === 1 ? '' : 's'} ago`;
}

function tryRTF(value, unit, lang) {
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    return rtf.format(value, unit);
  } catch {
    return null;
  }
}
