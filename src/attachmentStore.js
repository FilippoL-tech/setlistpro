/* attachmentStore.js
   I byte di PDF/MP3 non stanno più in localStorage (che su mobile satura la quota),
   ma in IndexedDB, indicizzati per id del brano.
   In localStorage resta solo la parte leggera (titolo, tonalità, pdfName, mp3Name, ...). */

const DB_NAME = "setlistpro";
const STORE   = "attachments";
const VERSION = 1;

let _dbPromise = null;
function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB non disponibile")); return; }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return _dbPromise;
}

function idbSet(id, att) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(att, id);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  }));
}
function idbGet(id) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror   = () => reject(r.error);
  }));
}
function idbDelete(id) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  }));
}
function idbAllKeys() {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).getAllKeys();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror   = () => reject(r.error);
  }));
}

/* ── helper a livello di struttura dati ─────────────────────────────────────── */

function stripSong(s){ const { pdfData, mp3Data, ...rest } = s; return rest; }

// Rimuove i byte dai brani: è la versione da scrivere in localStorage.
export function stripBytes(data){
  return {
    setlists: (data.setlists||[]).map(sl => ({ ...sl, songs:(sl.songs||[]).map(stripSong) })),
    library:  (data.library ||[]).map(stripSong),
  };
}

function allSongs(data){
  const out = [];
  (data.setlists||[]).forEach(sl => (sl.songs||[]).forEach(s => s && out.push(s)));
  (data.library ||[]).forEach(s => s && out.push(s));
  return out;
}

// Reinnesta i byte da IndexedDB sui brani (per id). Non tocca i brani già pieni.
export async function hydrateAttachments(data){
  const graftSong = async (s) => {
    if(!s || !s.id) return s;
    if(!s.pdfName && !s.mp3Name) return s;      // niente allegato: nessuna lettura
    if(s.pdfData || s.mp3Data) return s;        // byte già presenti in memoria
    let att = null;
    try { att = await idbGet(s.id); } catch { att = null; }
    if(!att) return s;
    return {
      ...s,
      pdfData: att.pdfData || s.pdfData || null,
      mp3Data: att.mp3Data || s.mp3Data || null,
      pdfName: s.pdfName || att.pdfName || null,
      mp3Name: s.mp3Name || att.mp3Name || null,
    };
  };
  const graftArr = (arr) => Promise.all((arr||[]).map(graftSong));
  const setlists = await Promise.all(
    (data.setlists||[]).map(async sl => ({ ...sl, songs: await graftArr(sl.songs) }))
  );
  const library = await graftArr(data.library);
  return { setlists, library };
}

// Scrive i byte presenti in memoria su IndexedDB e ripulisce gli orfani.
// La cancellazione è basata su pdfName/mp3Name (metadati), MAI sulla presenza
// dei byte: così un brano allegato ma non ancora idratato non viene cancellato.
export async function persistAttachments(data){
  const meta = new Map(); // id -> true se ha un allegato dichiarato
  for (const s of allSongs(data)) {
    if(!s.id) continue;
    meta.set(s.id, !!(s.pdfName || s.mp3Name));
    if (s.pdfData || s.mp3Data) {
      try {
        await idbSet(s.id, {
          pdfData: s.pdfData || null, pdfName: s.pdfName || null,
          mp3Data: s.mp3Data || null, mp3Name: s.mp3Name || null,
        });
      } catch {}
    }
  }
  let keys = [];
  try { keys = await idbAllKeys(); } catch { keys = []; }
  for (const k of keys) {
    if (!meta.has(k))          { try { await idbDelete(k); } catch {} continue; } // brano rimosso
    if (meta.get(k) === false) { try { await idbDelete(k); } catch {} }           // allegato tolto
  }
}
