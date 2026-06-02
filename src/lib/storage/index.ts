// Storage abstraction. The app talks to `DiaryStore`; the concrete backend is
// chosen at runtime: Supabase when its env vars are present, otherwise the
// browser's IndexedDB so the app works with zero configuration.

import type { DiaryEntry, NewEntryInput } from "@/lib/types";

export interface DiaryStore {
  create(input: NewEntryInput): Promise<DiaryEntry>;
  listAll(): Promise<DiaryEntry[]>;
  listBetween(startISO: string, endISO: string): Promise<DiaryEntry[]>;
  get(id: string): Promise<DiaryEntry | null>;
  remove(id: string): Promise<void>;
  search(query: string): Promise<DiaryEntry[]>;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function storageBackend(): "supabase" | "local" {
  return isSupabaseConfigured() ? "supabase" : "local";
}

let storePromise: Promise<DiaryStore> | null = null;

/** Lazily resolve the active store (singleton). */
export function getStore(): Promise<DiaryStore> {
  if (!storePromise) {
    storePromise = isSupabaseConfigured()
      ? import("./supabase").then((m) => m.createSupabaseStore())
      : import("./local").then((m) => m.createLocalStore());
  }
  return storePromise;
}
