"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getStore } from "@/lib/storage";
import type { DiaryEntry } from "@/lib/types";
import { weatherMeta, conditionMeta } from "@/lib/types";
import { formatDateTimeJP } from "@/lib/date";
import ConditionDots from "@/components/ConditionDots";

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [entry, setEntry] = useState<DiaryEntry | null | undefined>(undefined);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    getStore()
      .then((s) => s.get(id))
      .then((e) => active && setEntry(e))
      .catch(() => active && setEntry(null));
    return () => {
      active = false;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("この記録を削除しますか？")) return;
    setDeleting(true);
    try {
      const s = await getStore();
      await s.remove(id);
      router.push("/calendar");
    } catch {
      setDeleting(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col px-5 pb-28 pt-5">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 active:bg-slate-200"
          aria-label="戻る"
        >
          ←
        </button>
        {entry ? (
          <div className="flex items-center gap-1">
            <Link
              href={`/entry/${id}/edit`}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-indigo-600 active:bg-indigo-50"
            >
              編集
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-rose-500 active:bg-rose-50 disabled:opacity-50"
            >
              {deleting ? "削除中…" : "削除"}
            </button>
          </div>
        ) : null}
      </header>

      {entry === undefined ? (
        <p className="py-16 text-center text-sm text-slate-400">読み込み中…</p>
      ) : entry === null ? (
        <p className="py-16 text-center text-sm text-slate-400">記録が見つかりませんでした</p>
      ) : (
        <article className="mt-4">
          <p className="text-sm text-slate-500">{formatDateTimeJP(entry.createdAt)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              {weatherMeta(entry.weather).label}
            </span>
            <span className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              体調 {conditionMeta(entry.condition).label}
              <ConditionDots value={entry.condition} />
            </span>
          </div>

          {entry.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.photoUrl}
              alt=""
              className="mt-5 w-full rounded-2xl object-contain"
            />
          ) : null}

          <p className="mt-5 whitespace-pre-wrap break-words text-base leading-relaxed text-slate-800">
            {entry.body || "（本文なし）"}
          </p>
        </article>
      )}
    </main>
  );
}
