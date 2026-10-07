import type { Book, BookNote, ReadingSession, StoredBook } from "./types";

const DB_NAME = "readflow-local";
const DB_VERSION = 1;
const BOOKS = "books";
const NOTES = "notes";
const SESSIONS = "sessions";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS)) db.createObjectStore(BOOKS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(NOTES)) db.createObjectStore(NOTES, { keyPath: "bookId" });
      if (!db.objectStoreNames.contains(SESSIONS)) {
        const sessions = db.createObjectStore(SESSIONS, { keyPath: "id" });
        sessions.createIndex("startedAt", "startedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir le stockage local."));
  });
}

async function requestResult<T>(store: string, mode: IDBTransactionMode, action: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Erreur de stockage local."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("La transaction locale a échoué."));
  });
}

export const storage = {
  listBooks: () => requestResult<StoredBook[]>(BOOKS, "readonly", (store) => store.getAll()),
  getBook: (id: string) => requestResult<StoredBook | undefined>(BOOKS, "readonly", (store) => store.get(id)),
  saveBook: async (book: StoredBook) => { await requestResult(BOOKS, "readwrite", (store) => store.put(book)); },
  saveProgress: async (book: Book) => {
    const existing = await storage.getBook(book.id);
    if (!existing) throw new Error("Ce livre n'est plus présent dans la bibliothèque.");
    await storage.saveBook({ ...existing, ...book });
  },
  deleteBook: async (id: string) => {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([BOOKS, NOTES], "readwrite");
      transaction.objectStore(BOOKS).delete(id);
      transaction.objectStore(NOTES).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Suppression impossible."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Suppression annulée."));
    });
    db.close();
  },
  getNote: (bookId: string) => requestResult<BookNote | undefined>(NOTES, "readonly", (store) => store.get(bookId)),
  saveNote: async (note: BookNote) => { await requestResult(NOTES, "readwrite", (store) => store.put(note)); },
  listSessions: () => requestResult<ReadingSession[]>(SESSIONS, "readonly", (store) => store.getAll()),
  saveSession: async (session: ReadingSession) => { await requestResult(SESSIONS, "readwrite", (store) => store.put(session)); },
};
