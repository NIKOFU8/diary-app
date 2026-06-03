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
  /**
   * 「期日なし」グループ内での手動並び替え順（小さいほど上）。
   * 既存データは null になり得るため、比較時は createdAt にフォールバックする。
   */
  sortOrder: number | null;
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
  /**
   * 「期日なし」タスクの手動並び替えを保存する。
   * 引数は表示順に並べたタスクIDの配列。先頭が一番上（sortOrder=0,1,2,…）。
   */
  reorder(orderedIds: string[]): Promise<void>;
}

/**
 * 並び順:
 *  1. 未完了 → 完了 の順（完了は常に下へ）。
 *  2. 未完了のうち「期日なし」を最優先で上に表示する。
 *     - 期日なし同士: 手動並び替え順(sortOrder)の昇順。未設定は作成日時の古い順にフォールバック。
 *     - 期日あり同士: 期日の早い順（昇順）、同日なら作成日時の古い順。
 *  3. 完了は完了時刻の新しい順。
 */
export function compareTasks(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (!a.done) {
    const aHasDue = Boolean(a.dueDate);
    const bHasDue = Boolean(b.dueDate);
    // 期日なしを期日ありより常に上に
    if (aHasDue !== bHasDue) return aHasDue ? 1 : -1;
    if (!aHasDue) {
      // どちらも期日なし → 手動並び替え順(sortOrder)、未設定は作成日時の古い順
      const ao = a.sortOrder;
      const bo = b.sortOrder;
      if (ao != null && bo != null && ao !== bo) return ao < bo ? -1 : 1;
      if (ao != null && bo == null) return -1; // 並び替え済みを未設定より上に
      if (ao == null && bo != null) return 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    }
    // どちらも期日あり → 期日昇順（同日は作成日時の古い順）
    if (a.dueDate !== b.dueDate) return a.dueDate! < b.dueDate! ? -1 : 1;
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
