// IndexedDB-backed diary store. Runs entirely in the browser, no setup required.

import type { DiaryEntry, NewEntryInput } from "@/lib/types";
import type { DiaryStore } from "./index";
import { openDB, idbRequest, genId, ENTRIES } from "@/lib/idb";

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(ENTRIES, mode).objectStore(ENTRIES);
}

async function allEntries(): Promise<DiaryEntry[]> {
  const db = await openDB();
  try {
    const result = await idbRequest(tx(db, "readonly").getAll() as IDBRequest<DiaryEntry[]>);
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
        await idbRequest(tx(db, "readwrite").put(entry));
      } finally {
        db.close();
      }
      return entry;
    },

    async update(id, patch) {
      const db = await openDB();
      try {
        const existing = await idbRequest(
          tx(db, "readonly").get(id) as IDBRequest<DiaryEntry | undefined>,
        );
        if (!existing) throw new Error("entry not found");
        const updated: DiaryEntry = {
          ...existing,
          weather: patch.weather ?? existing.weather,
          condition: patch.condition ?? existing.condition,
          body: patch.body ?? existing.body,
          photoUrl:
            patch.photoDataUrl === undefined ? existing.photoUrl : patch.photoDataUrl,
        };
        await idbRequest(tx(db, "readwrite").put(updated));
        return updated;
      } finally {
        db.close();
      }
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
        const result = await idbRequest(
          tx(db, "readonly").get(id) as IDBRequest<DiaryEntry | undefined>,
        );
        return result ?? null;
      } finally {
        db.close();
      }
    },

    async remove(id) {
      const db = await openDB();
      try {
        await idbRequest(tx(db, "readwrite").delete(id));
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
