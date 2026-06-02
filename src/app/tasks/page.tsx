"use client";

import { Fragment, useEffect, useState } from "react";
import { getTaskStore } from "@/lib/tasks";
import type { Task } from "@/lib/tasks";

const NOTIFY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "通知なし" },
  { value: 0, label: "当日" },
  { value: 1, label: "1日前" },
  { value: 3, label: "3日前" },
  { value: 7, label: "1週間前" },
];

function mdLabel(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [newContent, setNewContent] = useState("");
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [eContent, setEContent] = useState("");
  const [eDue, setEDue] = useState("");
  const [eNotify, setENotify] = useState<number | null>(null);

  const reload = async () => {
    const s = await getTaskStore();
    setTasks(await s.list());
  };

  useEffect(() => {
    reload().catch(() => setTasks([]));
  }, []);

  const add = async () => {
    const content = newContent.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const s = await getTaskStore();
      await s.create({ content });
      setNewContent("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = async (t: Task) => {
    const s = await getTaskStore();
    await s.update(t.id, { done: !t.done });
    await reload();
  };

  const openEditor = (t: Task) => {
    setEditingId(t.id);
    setEContent(t.content);
    setEDue(t.dueDate ?? "");
    setENotify(t.notifyDaysBefore);
  };

  const saveEditor = async () => {
    const content = eContent.trim();
    if (!editingId || !content) return;
    const s = await getTaskStore();
    await s.update(editingId, { content, dueDate: eDue || null, notifyDaysBefore: eNotify });
    setEditingId(null);
    await reload();
  };

  const removeTask = async (id: string) => {
    const s = await getTaskStore();
    await s.remove(id);
    if (editingId === id) setEditingId(null);
    await reload();
  };

  const clearDone = async () => {
    if (!window.confirm("完了済みのタスクをすべて削除しますか？")) return;
    const s = await getTaskStore();
    await s.removeCompleted();
    await reload();
  };

  return (
    <main className="flex flex-1 flex-col px-5 pb-28 pt-6">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">タスク</h1>
      <p className="mt-1 text-xs text-slate-400">
        日記から自動で追加されるほか、手動でも追加できます
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="新しいタスクを入力"
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-indigo-400"
        />
        <button
          type="button"
          onClick={add}
          disabled={!newContent.trim() || busy}
          className="flex-none rounded-2xl bg-indigo-600 px-5 font-bold text-white active:bg-indigo-700 disabled:opacity-50"
        >
          追加
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {tasks === null ? (
          <p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
            タスクはまだありません
          </div>
        ) : (
          tasks.map((t, i) => {
            const showDoneHeader = t.done && (i === 0 || !tasks[i - 1].done);
            return (
              <Fragment key={t.id}>
                {showDoneHeader ? (
                  <div className="mb-1 mt-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">完了済み</span>
                    <button
                      type="button"
                      onClick={clearDone}
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 active:bg-rose-50"
                    >
                      完了済みを削除
                    </button>
                  </div>
                ) : null}

                {editingId === t.id ? (
                  <div className="rounded-2xl border border-indigo-200 bg-white p-4">
                    <input
                      value={eContent}
                      onChange={(e) => setEContent(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-indigo-400"
                    />
                    <div className="mt-3 flex items-center gap-2">
                      <label className="w-14 flex-none text-xs text-slate-500">期日</label>
                      <input
                        type="date"
                        value={eDue}
                        onChange={(e) => setEDue(e.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                      />
                      {eDue ? (
                        <button
                          type="button"
                          onClick={() => setEDue("")}
                          className="flex-none text-xs text-slate-400 underline"
                        >
                          クリア
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="w-14 flex-none text-xs text-slate-500">通知</label>
                      <select
                        value={eNotify === null ? "" : String(eNotify)}
                        onChange={(e) =>
                          setENotify(e.target.value === "" ? null : Number(e.target.value))
                        }
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                      >
                        {NOTIFY_OPTIONS.map((o) => (
                          <option key={String(o.value)} value={o.value === null ? "" : String(o.value)}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeTask(t.id)}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600"
                      >
                        削除
                      </button>
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={saveEditor}
                        disabled={!eContent.trim()}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white active:bg-indigo-700 disabled:opacity-50"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
                    <button
                      type="button"
                      onClick={() => toggleDone(t)}
                      aria-label={t.done ? "未完了に戻す" : "完了にする"}
                      className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
                        t.done ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
                      }`}
                    >
                      {t.done ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3 w-3"
                        >
                          <path d="m5 12 5 5L20 6" />
                        </svg>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(t)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span
                        className={`block break-words text-sm ${
                          t.done ? "text-slate-400 line-through" : "text-slate-800"
                        }`}
                      >
                        {t.content}
                      </span>
                      {t.dueDate || t.notifyDaysBefore !== null ? (
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          {t.dueDate ? (
                            <span className={!t.done && t.dueDate < todayKey() ? "text-rose-500" : ""}>
                              期日 {mdLabel(t.dueDate)}
                            </span>
                          ) : null}
                          {t.notifyDaysBefore !== null ? (
                            <span>
                              {t.notifyDaysBefore === 0 ? "当日通知" : `${t.notifyDaysBefore}日前通知`}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </button>
                  </div>
                )}
              </Fragment>
            );
          })
        )}
      </div>
    </main>
  );
}
