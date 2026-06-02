// IndexedDB-backed store. Runs entirely in the browser, no setup required.

import type { DiaryEntry, NewEntryInput } from "@/lib/types";
import type { DiaryStore } from "./index";

const DB_NAME = "diary-app";
const DB_VERSION = 1;
const STORE = "entries";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function store(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function toPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function allEntries(): Promise<DiaryEntry[]> {
  const db = await openDB();
  try {
    const result = await toPromise(
      store(db, "readonly").getAll() as IDBRequest<DiaryEntry[]>,
    );
    return result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } finally {
    db.close();
  }
}

export function createLocalStore(): DiaryStore {
  return {
    async create(input: NewEntryInput) {
      const entry: DiaryEntry = {
        id: genId(),
        createdAt: input.createdAt ?? new Date().toISOString(),
        weather: input.weather,
        condition: input.condition,
        body: input.body,
        photoUrl: input.photoDataUrl ?? null,
      };
      const db = await openDB();
      try {
        await toPromise(store(db, "readwrite").put(entry));
      } finally {
        db.close();
      }
      return entry;
    },

    listAll() {
      return allEntries();
    },

    async listBetween(startISO, endISO) {
      const all = await allEntries();
      return all.filter((e) => e.createdAt >= startISO && e.createdAt <= endISO);
    },

    async get(id) {
      const db = await openDB();
      try {
        const result = await toPromise(
          store(db, "readonly").get(id) as IDBRequest<DiaryEntry | undefined>,
        );
        return result ?? null;
      } finally {
        db.close();
      }
    },

    async remove(id) {
      const db = await openDB();
      try {
        await toPromise(store(db, "readwrite").delete(id));
      } finally {
        db.close();
      }
    },

    async search(query) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const all = await allEntries();
      return all.filter((e) => e.body.toLowerCase().includes(q));
    },
  };
}
