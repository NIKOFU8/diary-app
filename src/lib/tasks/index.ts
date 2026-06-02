// Task storage abstraction. Mirrors the diary store: Supabase when configured,
// otherwise IndexedDB.

import { isSupabaseConfigured } from "@/lib/storage";

export type TaskSource = "manual" | "ai";

export interface Task {
  id: string;
  createdAt: string;
  content: string;
  done: boolean;
  doneAt: string | null;
  dueDate: string | null; // YYYY-MM-DD
  notifyDaysBefore: number | null;
  source: TaskSource;
  entryId: string | null;
}

export interface NewTaskInput {
  content: string;
  dueDate?: string | null;
  notifyDaysBefore?: number | null;
  source?: TaskSource;
  entryId?: string | null;
}

export interface TaskUpdate {
  content?: string;
  done?: boolean;
  dueDate?: string | null;
  notifyDaysBefore?: number | null;
}

export interface TaskStore {
  list(): Promise<Task[]>;
  create(input: NewTaskInput): Promise<Task>;
  update(id: string, patch: TaskUpdate): Promise<Task>;
  remove(id: string): Promise<void>;
  removeCompleted(): Promise<void>;
}

/**
 * 並び順: 未完了→完了 の順。未完了は期日昇順（未設定は最後）→作成順。
 * 完了は完了時刻の新しい順。チェックすると自然と一番下へ移動する。
 */
export function compareTasks(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (!a.done) {
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  const aDone = a.doneAt ?? a.createdAt;
  const bDone = b.doneAt ?? b.createdAt;
  return aDone < bDone ? 1 : -1;
}

let storePromise: Promise<TaskStore> | null = null;

export function getTaskStore(): Promise<TaskStore> {
  if (!storePromise) {
    storePromise = isSupabaseConfigured()
      ? import("./supabase").then((m) => m.createSupabaseTaskStore())
      : import("./local").then((m) => m.createLocalTaskStore());
  }
  return storePromise;
}
