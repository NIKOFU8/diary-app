"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getStore } from "@/lib/storage";
import { getTaskStore } from "@/lib/tasks";
import type { Task } from "@/lib/tasks";
import type { DiaryEntry } from "@/lib/types";
import {
  monthGrid,
  monthRange,
  dateKey,
  formatDateJP,
  WEEK_LABELS,
} from "@/lib/date";
import EntryCard from "@/components/EntryCard";

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(dateKey(today));
  const [dueTasks, setDueTasks] = useState<Task[]>([]);

  const monthInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const { startISO, endISO } = monthRange(year, month0);
    getStore()
      .then((s) => s.listBetween(startISO, endISO))
      .then((list) => {
        if (!active) return;
        setEntries(list);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setEntries([]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year, month0]);

  const loadTasks = async () => {
    const s = await getTaskStore();
    const tasks = await s.list();
    setDueTasks(tasks.filter((t) => !t.done && t.dueDate));
  };

  // 期日が設定された未完了タスク（カレンダーの赤ドット用）
  useEffect(() => {
    loadTasks().catch(() => {});
  }, []);

  // カレンダー上からタスクを完了 → 一覧と赤ドットから消える（Tasksタブにも反映）
  const completeTask = async (id: string) => {
    const s = await getTaskStore();
    await s.update(id, { done: true });
    await loadTasks();
  };

  // 年月クイックジャンプ（ネイティブの月ピッカー）
  const openMonthPicker = () => {
    const el = monthInputRef.current as
      | (HTMLInputElement & { showPicker?: () => void })
      | null;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else el.click();
    } catch {
      el.click();
    }
  };
  const onMonthChange = (v: string) => {
    const m = /^(\d{4})-(\d{2})$/.exec(v);
    if (!m) return;
    setYear(Number(m[1]));
    setMonth0(Number(m[2]) - 1);
  };

  const byDate = useMemo(() => {
    const m = new Map<string, DiaryEntry[]>();
    for (const e of entries) {
      const k = dateKey(e.createdAt);
      const arr = m.get(k);
      if (arr) arr.push(e);
      else m.set(k, [e]);
    }
    return m;
  }, [entries]);

  const dueByDate = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of dueTasks) {
      if (!t.dueDate) continue;
      const arr = m.get(t.dueDate);
      if (arr) arr.push(t);
      else m.set(t.dueDate, [t]);
    }
    return m;
  }, [dueTasks]);

  const grid = useMemo(() => monthGrid(year, month0), [year, month0]);
  const todayKey = dateKey(today);
  const selectedEntries = (byDate.get(selected) ?? [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const selectedTasks = dueByDate.get(selected) ?? [];

  const prevMonth = () =>
    month0 === 0 ? (setYear((y) => y - 1), setMonth0(11)) : setMonth0((m) => m - 1);
  const nextMonth = () =>
    month0 === 11 ? (setYear((y) => y + 1), setMonth0(0)) : setMonth0((m) => m + 1);

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 active:bg-slate-200"
          aria-label="前の月"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={openMonthPicker}
          aria-label="年月を選択"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-lg font-bold text-slate-900 active:bg-slate-100"
        >
          {year}年{month0 + 1}月
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-slate-400"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 active:bg-slate-200"
          aria-label="次の月"
        >
          ›
        </button>
      </header>
      <input
        ref={monthInputRef}
        type="month"
        aria-hidden
        tabIndex={-1}
        value={`${year}-${String(month0 + 1).padStart(2, "0")}`}
        onChange={(e) => onMonthChange(e.target.value)}
        className="sr-only"
      />

      <div className="mt-4 grid grid-cols-7 text-center text-xs text-slate-400">
        {WEEK_LABELS.map((d, i) => (
          <div key={d} className={i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : ""}>
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const k = dateKey(d);
          const inMonth = d.getMonth() === month0;
          const has = byDate.has(k);
          const hasTask = dueByDate.has(k);
          const isSel = k === selected;
          const isToday = k === todayKey;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(k)}
              className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-sm ${
                isSel
                  ? "bg-indigo-600 font-bold text-white"
                  : inMonth
                    ? "text-slate-800 active:bg-slate-100"
                    : "text-slate-300"
              } ${isToday && !isSel ? "ring-1 ring-inset ring-indigo-300" : ""}`}
            >
              <span>{d.getDate()}</span>
              {has || hasTask ? (
                <span className="absolute bottom-1 flex gap-0.5">
                  {has ? (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-white" : "bg-indigo-500"}`}
                    />
                  ) : null}
                  {hasTask ? (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-rose-200" : "bg-rose-500"}`}
                    />
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          日記
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          タスク期日
        </span>
      </div>

      <section className="mt-6 flex-1">
        <h2 className="text-sm font-bold text-slate-700">{formatDateJP(selected)}</h2>
        <div className="mt-3 flex flex-col gap-2.5">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">読み込み中…</p>
          ) : selectedEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-8 text-center text-sm text-slate-400">
              この日の記録はありません
            </div>
          ) : (
            selectedEntries.map((e) => <EntryCard key={e.id} entry={e} />)
          )}
        </div>

        {selectedTasks.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-xs font-semibold text-rose-500">この日が期日のタスク</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {selectedTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2.5 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-sm text-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => completeTask(t.id)}
                    aria-label="完了にする"
                    className="h-5 w-5 flex-none rounded-md border border-rose-300 bg-white active:bg-rose-100"
                  />
                  <span className="break-words">{t.content}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 mx-auto flex w-full max-w-md justify-end px-5">
        <Link
          href="/record"
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-3xl text-white shadow-lg shadow-indigo-600/30 active:bg-indigo-700"
          aria-label="記録する"
        >
          ＋
        </Link>
      </div>
    </main>
  );
}