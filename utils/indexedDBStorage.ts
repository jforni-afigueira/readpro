import { ReadingHistoryItem } from '../types';

const DB_NAME = 'LeitorProDB_v1';
const DB_VERSION = 1;
const STORE_NAME = 'reading_history';
const LAST_ACTIVE_KEY = 'leitor_pro_last_active_book_id';

interface StoredBookRecord {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'epub';
  fileSize: number;
  fileBlob: Blob;
  currentPage: number;
  totalPages: number;
  lastReadAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB não é suportado neste navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastReadAt', 'lastReadAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves or updates a book in IndexedDB and marks it as the last active book.
 */
export async function saveBookToHistory(
  file: File,
  currentPage: number,
  totalPages: number
): Promise<void> {
  try {
    const db = await openDB();
    const id = file.name;
    const fileType = file.name.split('.').pop()?.toLowerCase() === 'epub' ? 'epub' : 'pdf';

    const record: StoredBookRecord = {
      id,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      fileBlob: file, // File implements Blob and can be stored in IndexedDB
      currentPage: Math.max(1, currentPage),
      totalPages: Math.max(0, totalPages),
      lastReadAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    try {
      localStorage.setItem(LAST_ACTIVE_KEY, id);
    } catch {
      // Ignore localStorage errors
    }
  } catch (err) {
    console.warn('Erro ao salvar livro no IndexedDB:', err);
  }
}

/**
 * Updates just the current page and timestamp for an already saved book.
 */
export async function updateReadingProgress(
  fileName: string,
  currentPage: number,
  totalPages?: number
): Promise<void> {
  if (!fileName) return;
  try {
    const db = await openDB();
    const id = fileName;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const existing = getReq.result as StoredBookRecord | undefined;
        if (existing) {
          existing.currentPage = Math.max(1, currentPage);
          if (totalPages && totalPages > 0) {
            existing.totalPages = totalPages;
          }
          existing.lastReadAt = Date.now();
          const putReq = store.put(existing);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };

      getReq.onerror = () => reject(getReq.error);
    });

    try {
      localStorage.setItem(LAST_ACTIVE_KEY, id);
    } catch {}
  } catch (err) {
    console.warn('Erro ao atualizar progresso de leitura:', err);
  }
}

/**
 * Retrieves the last active book or the most recently read book from IndexedDB.
 */
export async function getLastReadBook(): Promise<{ file: File; meta: ReadingHistoryItem } | null> {
  try {
    const db = await openDB();
    let targetId = '';
    try {
      targetId = localStorage.getItem(LAST_ACTIVE_KEY) || '';
    } catch {}

    const allRecords = await new Promise<StoredBookRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (allRecords.length === 0) return null;

    let target = targetId ? allRecords.find(r => r.id === targetId) : null;
    if (!target) {
      // Fallback to most recently read
      target = allRecords.sort((a, b) => b.lastReadAt - a.lastReadAt)[0];
    }

    if (!target || !target.fileBlob) return null;

    const file = new File([target.fileBlob], target.fileName, {
      type: target.fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip',
      lastModified: target.lastReadAt,
    });

    const meta: ReadingHistoryItem = {
      id: target.id,
      fileName: target.fileName,
      fileType: target.fileType,
      fileSize: target.fileSize,
      currentPage: target.currentPage,
      totalPages: target.totalPages,
      lastReadAt: target.lastReadAt,
    };

    return { file, meta };
  } catch (err) {
    console.warn('Erro ao recuperar último livro do IndexedDB:', err);
    return null;
  }
}

/**
 * Retrieves all reading history metadata sorted by most recent.
 */
export async function getAllHistory(): Promise<ReadingHistoryItem[]> {
  try {
    const db = await openDB();
    const allRecords = await new Promise<StoredBookRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    return allRecords
      .map(r => ({
        id: r.id,
        fileName: r.fileName,
        fileType: r.fileType,
        fileSize: r.fileSize,
        currentPage: r.currentPage,
        totalPages: r.totalPages,
        lastReadAt: r.lastReadAt,
      }))
      .sort((a, b) => b.lastReadAt - a.lastReadAt);
  } catch (err) {
    console.warn('Erro ao listar histórico:', err);
    return [];
  }
}

/**
 * Loads a specific book by its ID.
 */
export async function loadBookFromHistory(id: string): Promise<{ file: File; meta: ReadingHistoryItem } | null> {
  try {
    const db = await openDB();
    const record = await new Promise<StoredBookRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!record || !record.fileBlob) return null;

    const file = new File([record.fileBlob], record.fileName, {
      type: record.fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip',
      lastModified: record.lastReadAt,
    });

    const meta: ReadingHistoryItem = {
      id: record.id,
      fileName: record.fileName,
      fileType: record.fileType,
      fileSize: record.fileSize,
      currentPage: record.currentPage,
      totalPages: record.totalPages,
      lastReadAt: record.lastReadAt,
    };

    try {
      localStorage.setItem(LAST_ACTIVE_KEY, id);
    } catch {}

    return { file, meta };
  } catch (err) {
    console.warn('Erro ao carregar livro do histórico:', err);
    return null;
  }
}

/**
 * Deletes a book record from IndexedDB.
 */
export async function deleteBookFromHistory(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    try {
      const active = localStorage.getItem(LAST_ACTIVE_KEY);
      if (active === id) {
        localStorage.removeItem(LAST_ACTIVE_KEY);
      }
    } catch {}
  } catch (err) {
    console.warn('Erro ao deletar livro do histórico:', err);
  }
}

/**
 * Clears the entire reading history.
 */
export async function clearAllHistory(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    try {
      localStorage.removeItem(LAST_ACTIVE_KEY);
    } catch {}
  } catch (err) {
    console.warn('Erro ao limpar histórico:', err);
  }
}
