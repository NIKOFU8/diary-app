import type { Task, TaskStore } from "./index";
import { compareTasks } from "./index";
import { openDB, idbRequest, genId, TASKS } from "@/lib/idb";

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(TASKS, mode).objectStore(TASKS);
}

async function allTasks(): Promise<Task[]> {
  const db = await openDB();
  try {
    const rows = await idbRequest(tx(db, "readonly").getAll() as IDBRequest<Task[]>);
    return rows.sort(compareTasks);
  } finally {
    db.close();
  }
}

export function createLocalTaskStore(): TaskStore {
  return {
    list() {
      return allTasks();
    },

    async create(input) {
      const task: Task = {
        id: genId(),
        createdAt: new Date().toISOString(),
        content: input.content,
        done: false,
        doneAt: null,
        dueDate: input.dueDate ?? null,
        notifyDaysBefore: input.notifyDaysBefore ?? null,
        source: input.source ?? "manual",
        entryId: input.entryId ?? null,
        // 新規は末尾側に来るよう大きめの値（手動並び替え時に 0..n へ振り直す）
        sortOrder: Date.now(),
      };
      const db = await openDB();
      try {
        await idbRequest(tx(db, "readwrite").put(task));
      } finally {
        db.close();
      }
      return task;
    },

    async update(id, patch) {
      const db = await openDB();
      try {
        const existing = await idbRequest(
          tx(db, "readonly").get(id) as IDBRequest<Task | undefined>,
        );
        if (!existing) throw new Error("task not found");
        const updated: Task = {
          ...existing,
          content: patch.content ?? existing.content,
          dueDate: patch.dueDate === undefined ? existing.dueDate : patch.dueDate,
          notifyDaysBefore:
            patch.notifyDaysBefore === undefined
              ? existing.notifyDaysBefore
              : patch.notifyDaysBefore,
          done: patch.done === undefined ? existing.done : patch.done,
          doneAt:
            patch.done === undefined
              ? existing.doneAt
              : patch.done
                ? new Date().toISOString()
                : null,
        };
        await idbRequest(tx(db, "readwrite").put(updated));
        return updated;
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

    async removeCompleted() {
      const db = await openDB();
      try {
        const rows = await idbRequest(tx(db, "readonly").getAll() as IDBRequest<Task[]>);
        const store = tx(db, "readwrite");
        await Promise.all(
          rows.filter((t) => t.done).map((t) => idbRequest(store.delete(t.id))),
        );
      } finally {
        db.close();
      }
    },

    async reorder(orderedIds) {
      const db = await openDB();
      try {
        const rows = await idbRequest(tx(db, "readonly").getAll() as IDBRequest<Task[]>);
        const byId = new Map(rows.map((r) => [r.id, r]));
        // 同一トランザクション内で全 put を同期的に発行（await を挟むと自動コミットされるため）
        const store = tx(db, "readwrite");
        const puts: Promise<unknown>[] = [];
        orderedIds.forEach((id, i) => {
          const existing = byId.get(id);
          if (existing) puts.push(idbRequest(store.put({ ...existing, sortOrder: i })));
        });
        await Promise.all(puts);
      } finally {
        db.close();
      }
    },
  };
}
