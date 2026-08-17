// Client-side-only persistence for Radio Hub's custom playlists (BROWSE
// panel). localStorage alone can't hold this — it only stores strings, not
// the actual uploaded audio bytes — so this uses IndexedDB instead, which
// natively supports storing File/Blob objects via structured clone. No
// network calls anywhere in here; everything lives in the browser only.
const DB_NAME = 'cosmic_clock_playlists';
const DB_VERSION = 1;
const STORE_NAME = 'playlists';

export interface StoredTrack {
  id: string;
  title: string;
  blob: Blob;
}

export interface StoredPlaylist {
  id: string;
  name: string;
  tracks: StoredTrack[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Never throws — a user's custom playlists not loading/saving shouldn't
// break the rest of Radio Hub, so failures fall back to "no stored
// playlists" (read) or a logged no-op (write) rather than propagating.
export async function getAllStoredPlaylists(): Promise<StoredPlaylist[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as StoredPlaylist[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load stored playlists (starting with none):', err);
    return [];
  }
}

export async function saveStoredPlaylist(playlist: StoredPlaylist): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(playlist);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save playlist locally (it still works for this session):', err);
  }
}

export async function deleteStoredPlaylist(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to delete stored playlist:', err);
  }
}
