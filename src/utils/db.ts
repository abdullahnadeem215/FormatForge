// src/utils/db.ts
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'FormatForgeDB';
const STORE_NAME = 'files';
const VERSION = 1;

interface FileStore {
  id: string;
  blob: Blob;
  name: string;
  timestamp: string;
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

/**
 * Save a blob to IndexedDB
 */
export const storeFileBlob = async (id: string, blob: Blob, name: string) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  await store.put({
    id,
    blob,
    name,
    timestamp: new Date().toISOString()
  });
  
  await tx.done;
};

/**
 * Get a blob from IndexedDB
 */
export const getFileBlob = async (id: string): Promise<Blob | null> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const result = await store.get(id);
  return result ? result.blob : null;
};

/**
 * Delete a blob from IndexedDB
 */
export const deleteFileBlob = async (id: string) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.delete(id);
  await tx.done;
};

/**
 * Clear all blobs from IndexedDB
 */
export const clearFileBlobs = async () => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.clear();
  await tx.done;
};
