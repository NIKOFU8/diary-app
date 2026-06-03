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
  // 日付依存の描画はマウント後だけ行う（サーバーUTC×クライアントJSTのズレ／ハイドレーション崩れを回避）
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month0, setMonth0] = useState(() => new Date().getMonth());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [dueTasks, setDueTasks] = useState<Task[]>([]);

  // 選択日への手動タスク追加用
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // カレンダー上からタスクを完了 → 一覧と赤ドットから消える（Tasksタブにも反映）
  const completeTask = async (id: string) => {
    const s = await getTaskStore();
    await s.update(id, { done: true });
    await loadTasks();
  };

  // 年月クイックジャンプ用の年の選択肢（現在年の前後を中心に、選択中の年も必ず含める）
  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    const min = Math.min(cur - 10, year);
    const max = Math.max(cur + 1, year);
    const ys: number[] = [];
    for (let y = min; y <= max; y++) ys.push(y);
    return ys;
  }, [year]);

  // 選択中の日付を期日として手動タスクを追加し、即座に一覧へ反映する
  const addTaskForSelected = async () => {
    const content = newTaskContent.trim();
    if (!content || taskBusy) return;
    setTaskBusy(true);
    try {
      const s = await getTaskStore();
      await s.create({ content, dueDate: selected });
      setNewTaskContent("");
      setAddingTask(false);
      await loadTasks();
    } finally {
      setTaskBusy(false);
    }
  };

  const prevMonth = () =>
    month0 === 0 ? (setYear((y) => y - 1), setMonth0(11)) : setMonth0((m) => m - 1);
  const nextMonth = () =>
    month0 === 11 ? (setYear((y) => y + 1), setMonth0(0)) : setMonth0((m) => m + 1);

  // カレンダー領域の左右スワイプで月移動（iOS Safari のネイティブ戻る/進むと競合しないよう
  // 画面端ではなくカレンダー内のタッチのみを対象にする）
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 横方向が十分大きく、かつ縦方向より明確に大きいときだけ月移動（縦スクロールと区別）
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) nextMonth(); // 左へスワイプ → 翌月
      else prevMonth(); // 右へスワイプ → 先月
    }
  };

  if (!mounted) {
    return (
      <main className="flex flex-1 flex-col px-4 pb-28 pt-6">
        <p className="py-16 text-center text-sm text-slate-400">読み込み中…</p>
      </main>
    );
  }

  const todayKey = dateKey(new Date());
  const selectedEntries = (byDate.get(selected) ?? [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const selectedTasks = dueByDate.get(selected) ?? [];

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
        {/* 年月ジャンプ: ネイティブの<select>で確実に動作（iOS Safari含む） */}
        <div className="flex items-center gap-1 text-lg font-bold text-slate-900">
          <span className="relative inline-flex items-center rounded-lg active:bg-slate-100">
            <select
              aria-label="年を選択"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="cursor-pointer appearance-none bg-transparent py-1 pl-2 pr-1 text-lg font-bold text-slate-900 outline-none"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </span>
          <span className="relative inline-flex items-center rounded-lg active:bg-slate-100">
            <select
              aria-label="月を選択"
              value={month0}
              onChange={(e) => setMonth0(Number(e.target.value))}
              className="cursor-pointer appearance-none bg-transparent py-1 pl-1 pr-6 text-lg font-bold text-slate-900 outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}月
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute right-1 h-4 w-4 text-slate-400"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 active:bg-slate-200"
          aria-label="次の月"
        >
          ›
        </button>
      </header>

      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="touch-pan-y">
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
      </div>

      <section className="mt-6 flex-1">
        <h2 className="text-sm font-bold text-slate-700">{formatDateJP(selected)}</h2>

        {/* 1. この日が期日のタスク */}
        <div className="mt-3">
          <h3 className="text-xs font-semibold text-rose-500">この日が期日のタスク</h3>
          {selectedTasks.length > 0 ? (
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
          ) : (
            <p className="mt-2 text-xs text-slate-400">この日が期日のタスクはありません</p>
          )}

          {/* 2. タスクを追加（控えめ・インライン） */}
          {addingTask ? (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={newTaskContent}
                onChange={(e) => setNewTaskContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTaskForSelected();
                }}
                placeholder="この日が期日のタスク"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={addTaskForSelected}
                disabled={!newTaskContent.trim() || taskBusy}
                className="flex-none rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white active:bg-indigo-700 disabled:opacity-50"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingTask(false);
                  setNewTaskContent("");
                }}
                aria-label="キャンセル"
                className="flex-none rounded-xl px-2 text-sm text-slate-400 active:bg-slate-100"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingTask(true)}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 active:bg-slate-100"
            >
              <span className="text-sm leading-none">＋</span>
              タスクを追加
            </button>
          )}
        </div>

        {/* 3. この日の記録（日記） */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-slate-500">この日の記録</h3>
          <div className="mt-2 flex flex-col gap-2.5">
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
        </div>
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
