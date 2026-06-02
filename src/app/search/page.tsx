"use client";

import { useEffect, useState } from "react";
import { getStore } from "@/lib/storage";
import type { DiaryEntry } from "@/lib/types";
import EntryCard from "@/components/EntryCard";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DiaryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      getStore()
        .then((s) => s.search(query))
        .then((r) => {
          if (!active) return;
          setResults(r);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setResults([]);
          setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <main className="flex flex-1 flex-col px-5 pb-28 pt-6">
      <h1 className="text-lg font-bold text-slate-900">検索</h1>

      <div className="sticky top-2 z-10 mt-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="キーワード（例：ラーメン、エラー）"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-indigo-400"
        />
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {results === null ? (
          <p className="py-10 text-center text-sm text-slate-400">
            本文からキーワードを検索します
          </p>
        ) : loading ? (
          <p className="py-10 text-center text-sm text-slate-400">検索中…</p>
        ) : results.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            「{q}」に一致する記録はありません
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-400">{results.length}件の記録</p>
            {results.map((e) => (
              <EntryCard key={e.id} entry={e} showDate />
            ))}
          </>
        )}
      </div>
    </main>
  );
}
