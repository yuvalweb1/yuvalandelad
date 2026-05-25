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

// Strip name back to a friendly title — drop .txt/.zip, drop the
// "WhatsApp Chat with " prefix that exports use.
export function chatNameFromFile(name) {
  if (!name) return '';
  let n = name.replace(/\.(txt|zip)$/i, '');
  n = n.replace(/^WhatsApp Chat with\s*/i, '');
  n = n.replace(/^_chat$/i, 'Chat');
  return n.trim() || 'Chat';
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
