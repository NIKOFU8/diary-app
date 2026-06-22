"use client";

import { useState } from "react";
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex gap-3 p-3.5">
        {/* 本文部: タップで詳細ページへ遷移（従来通り。全文＋写真は別ページ） */}
        <Link href={`/entry/${entry.id}`} className="flex min-w-0 flex-1 gap-3 transition active:opacity-60">
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
            <p
              className={`mt-1.5 text-sm leading-relaxed text-slate-700 ${
                expanded ? "whitespace-pre-wrap break-words" : "line-clamp-2"
              }`}
            >
              {entry.body || "（本文なし）"}
            </p>
          </div>
        </Link>

        {/* 矢印: 押すとその場で全文を開閉（遷移しない） */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "本文を閉じる" : "本文を全文表示"}
          aria-expanded={expanded}
          className="-mr-1 -mt-1 flex h-8 w-8 flex-none items-center justify-center self-start rounded-full text-slate-400 active:bg-slate-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
