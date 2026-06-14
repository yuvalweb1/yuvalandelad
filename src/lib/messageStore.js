// Persistent raw-message storage for recap sessions.
//
// History only keeps a computed all-time `stats` snapshot — not the messages.
// To re-scope a past recap to a trailing window (year / season / 4 weeks) we
// need the parsed messages again, so we stash them in IndexedDB keyed by recap
// id. Parsed messages are plain structured-clone-safe objects (Date, strings,
// numbers, arrays/booleans), so unlike media Blobs they need no transform.
//
// All methods are fire-and-forget safe — a quota error or private-browsing
// restriction is swallowed so it never breaks the core flow. A recap saved
// before this feature simply has no entry; loaders return [] and callers fall
// back to the all-time `stats` snapshot.

const DB_NAME = 'recapped_messages';
const DB_VERSION = 1;
const STORE = 'messages';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess  = (e) => resolve(e.target.result);
    req.onerror    = (e) => reject(e.target.error);
    req.onblocked  = ()  => reject(new Error('IDB blocked'));
  });
}

function idbPut(db, record) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const req = t.objectStore(STORE).put(record);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

function idbGet(db, id) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).get(id);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function idbDelete(db, id) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const req = t.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

function idbClear(db) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const req = t.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function saveMessages(recapId, messages) {
  try {
    const db = await openDB();
    await idbPut(db, { id: recapId, messages: messages || [] });
    db.close();
  } catch (e) {
    if (localStorage.getItem('cw_debug') === '1') console.error('[messageStore] save failed', e);
  }
}

export async function loadMessages(recapId) {
  try {
    const db  = await openDB();
    const rec = await idbGet(db, recapId);
    db.close();
    return rec?.messages || [];
  } catch {
    return [];
  }
}

export async function deleteMessages(recapId) {
  try {
    const db = await openDB();
    await idbDelete(db, recapId);
    db.close();
  } catch {}
}

export async function clearAllMessages() {
  try {
    const db = await openDB();
    await idbClear(db);
    db.close();
  } catch {}
}
