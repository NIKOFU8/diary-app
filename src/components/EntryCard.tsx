"use client";

import Link from "next/link";
import type { DiaryEntry } from "@/lib/types";
import { weatherMeta } from "@/lib/types";
import { formatTimeJP, formatDateJP } from "@/lib/date";
import ConditionDots from "./ConditionDots";

export default function EntryCard({
  entry,
  showDate = false,
}: {
  entry: DiaryEntry;
  showDate?: boolean;
}) {
  const w = weatherMeta(entry.weather);
  return (
    <Link
      href={`/entry/${entry.id}`}
      className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition active:bg-slate-50"
    >
      {entry.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.photoUrl}
          alt=""
          className="h-16 w-16 flex-none rounded-xl object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">
            {showDate ? formatDateJP(entry.createdAt) : formatTimeJP(entry.createdAt)}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{w.label}</span>
            <ConditionDots value={entry.condition} />
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-700">
          {entry.body || "（本文なし）"}
        </p>
      </div>
    </Link>
  );
}
