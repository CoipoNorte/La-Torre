const DB_NAME = 'TorreFalsaDeidad';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('gameData')) {
        db.createObjectStore('gameData', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { dbInstance = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

export async function saveData(id: string, data: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('gameData', 'readwrite');
    tx.objectStore('gameData').put({ id, data, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadData<T>(id: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('gameData', 'readonly');
    const req = tx.objectStore('gameData').get(id);
    req.onsuccess = () => resolve(req.result ? req.result.data as T : null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteData(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('gameData', 'readwrite');
    tx.objectStore('gameData').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
