"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getStore } from "@/lib/storage";
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

  const grid = useMemo(() => monthGrid(year, month0), [year, month0]);
  const todayKey = dateKey(today);
  const selectedEntries = (byDate.get(selected) ?? [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

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
        <h1 className="text-lg font-bold text-slate-900">
          {year}年{month0 + 1}月
        </h1>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 active:bg-slate-200"
          aria-label="次の月"
        >
          ›
        </button>
      </header>

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
              {has ? (
                <span
                  className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${
                    isSel ? "bg-white" : "bg-indigo-500"
                  }`}
                />
              ) : null}
            </button>
          );
        })}
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
