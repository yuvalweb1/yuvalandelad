// Persistent media storage for recap sessions.
// Blob URLs die with the page; we keep the raw Blobs in IndexedDB so that
// loading a past recap restores photos / voice / videos / stickers.
// All methods are fire-and-forget safe — failures are silently swallowed so
// a quota error or private-browsing restriction never breaks the core flow.

const DB_NAME = 'recapped_media';
const DB_VERSION = 1;
const STORE = 'media';

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

// Strip `url` (session-only) and `blob` (object reference — IDB stores it
// natively); keep all other fields as metadata alongside the blob.
function toStorable(items) {
  if (!items?.length) return [];
  return items.map(({ url: _url, blob, ...meta }) => ({ ...meta, blob }));
}

// Re-create a live object URL from the stored blob so the item is
// immediately usable as an <img src> / <audio src> / <video src>.
function fromStorable(items) {
  if (!items?.length) return [];
  return items.map(m => ({ ...m, url: URL.createObjectURL(m.blob) }));
}

const EMPTY = { photos: [], voice: [], videos: [], stickers: [] };

export async function saveMedia(recapId, media) {
  try {
    const db = await openDB();
    await idbPut(db, {
      id:       recapId,
      photos:   toStorable(media.photos),
      voice:    toStorable(media.voice),
      videos:   toStorable(media.videos),
      stickers: toStorable(media.stickers),
    });
    db.close();
  } catch (e) {
    if (localStorage.getItem('cw_debug') === '1') console.error('[mediaStore] save failed', e);
  }
}

export async function loadMedia(recapId) {
  try {
    const db  = await openDB();
    const rec = await idbGet(db, recapId);
    db.close();
    if (!rec) return EMPTY;
    return {
      photos:   fromStorable(rec.photos),
      voice:    fromStorable(rec.voice),
      videos:   fromStorable(rec.videos),
      stickers: fromStorable(rec.stickers),
    };
  } catch {
    return EMPTY;
  }
}

export async function deleteMedia(recapId) {
  try {
    const db = await openDB();
    await idbDelete(db, recapId);
    db.close();
  } catch {}
}

export async function clearAllMedia() {
  try {
    const db = await openDB();
    await idbClear(db);
    db.close();
  } catch {}
}
