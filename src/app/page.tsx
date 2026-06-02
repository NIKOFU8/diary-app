"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStore } from "@/lib/storage";
import type { DiaryEntry } from "@/lib/types";
import EntryCard from "@/components/EntryCard";
import { useAuth } from "@/components/auth/AuthProvider";

export default function HomePage() {
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const { configured, session, signOut } = useAuth();

  useEffect(() => {
    let active = true;
    getStore()
      .then((s) => s.listAll())
      .then((all) => active && setEntries(all))
      .catch(() => active && setEntries([]));
    return () => {
      active = false;
    };
  }, []);

  const recent = entries?.slice(0, 5) ?? [];

  return (
    <main className="flex flex-1 flex-col px-5 pb-28 pt-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">まいにち日記</h1>
          <p className="mt-2 text-sm text-slate-500">今日はどんな一日でしたか？</p>
        </div>
        {configured && session ? (
          <button
            type="button"
            onClick={signOut}
            className="mt-1 flex-none rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 active:bg-slate-100"
          >
            ログアウト
          </button>
        ) : null}
      </div>

      <Link
        href="/record"
        className="mt-6 flex items-center justify-center gap-2 rounded-3xl bg-indigo-600 py-5 text-lg font-bold text-white shadow-lg shadow-indigo-600/20 active:bg-indigo-700"
      >
        ＋ 今日の記録をはじめる
      </Link>

      <section className="mt-9">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">最近の記録</h2>
          <Link href="/calendar" className="text-xs font-medium text-indigo-600">
            すべて見る →
          </Link>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {entries === null ? (
            <p className="py-8 text-center text-sm text-slate-400">読み込み中…</p>
          ) : recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
              まだ記録がありません。
              <br />
              最初の一歩を記録してみましょう。
            </div>
          ) : (
            recent.map((e) => <EntryCard key={e.id} entry={e} showDate />)
          )}
        </div>
      </section>
    </main>
  );
}
