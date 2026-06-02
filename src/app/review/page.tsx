"use client";

import { useState } from "react";
import { getStore } from "@/lib/storage";
import { summarizeRemote } from "@/lib/ai/client";
import type { Summary } from "@/lib/ai/types";
import { dateKey, dayRange } from "@/lib/date";

export default function ReviewPage() {
  const today = new Date();
  const [start, setStart] = useState(
    dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
  );
  const [end, setEnd] = useState(dateKey(today));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const setThisMonth = () => {
    const t = new Date();
    setStart(dateKey(new Date(t.getFullYear(), t.getMonth(), 1)));
    setEnd(dateKey(t));
  };
  const setLastMonth = () => {
    const t = new Date();
    setStart(dateKey(new Date(t.getFullYear(), t.getMonth() - 1, 1)));
    setEnd(dateKey(new Date(t.getFullYear(), t.getMonth(), 0)));
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getStore();
      const entries = await s.listBetween(dayRange(start).startISO, dayRange(end).endISO);
      setSummary(await summarizeRemote(entries));
    } catch {
      setError("まとめの生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col px-5 pb-28 pt-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">振り返り</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            指定した期間の日記から、客観的な事実と実践的な教訓をAIが抽出します
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          aria-label="振り返りの使い方"
          className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border border-slate-300 text-sm font-bold text-slate-500 active:bg-slate-100"
        >
          ?
        </button>
      </div>

      {showHelp ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">振り返りについて</h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                aria-label="閉じる"
                className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-400 active:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-4 text-sm leading-relaxed">
              <section>
                <h3 className="font-bold text-slate-800">振り返りの仕組み</h3>
                <p className="mt-1 text-slate-600">
                  カレンダーで指定した期間（初期設定は今月の1日〜今日）の日記をAIが読み込み、「この期間をまとめる」を押すと、内容を分析して「学びと次回への教訓」「重要な決断と事実の記録」「興味・関心と熱中したことの変遷」の3つに整理します。期間は自由に変更でき、「今月」「先月」のショートカットも使えます。
                </p>
              </section>
              <section>
                <h3 className="font-bold text-slate-800">使用しているAI</h3>
                <p className="mt-1 text-slate-600">
                  本機能にはGoogleのAI「Gemini 2.5 Flash」を使用しています。
                </p>
              </section>
              <section>
                <h3 className="font-bold text-slate-800">プライバシーについて</h3>
                <p className="mt-1 text-slate-600">
                  入力された日記やタスクのデータは、振り返りの生成のためにのみ使用されます。AIの学習データとして利用されることはありませんのでご安心ください。
                </p>
              </section>
              <section>
                <h3 className="font-bold text-slate-800">ご注意</h3>
                <p className="mt-1 text-slate-600">
                  AIが生成する文章は完璧ではないため、あくまで日々の振り返りの参考としてお楽しみください。
                </p>
              </section>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-2xl bg-indigo-600 py-3 font-bold text-white active:bg-indigo-700"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <span className="text-slate-400">〜</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={setThisMonth}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 active:bg-slate-100"
          >
            今月
          </button>
          <button
            type="button"
            onClick={setLastMonth}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 active:bg-slate-100"
          >
            先月
          </button>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="mt-4 w-full rounded-2xl bg-indigo-600 py-3.5 font-bold text-white active:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "生成中…" : "この期間をまとめる"}
        </button>
        {error ? <p className="mt-2 text-center text-xs text-rose-600">{error}</p> : null}
      </div>

      {summary ? (
        <div className="mt-5 flex flex-col gap-4">
          <p className="text-xs text-slate-400">対象 {summary.count} 件</p>

          <SectionCard accent="bg-indigo-500" title="学びと次回への教訓" subtitle="Insight & Lesson">
            <Bullets items={summary.lessons} />
          </SectionCard>

          <SectionCard
            accent="bg-emerald-500"
            title="重要な決断と事実の記録"
            subtitle="Decisions & Milestones"
          >
            <Bullets items={summary.decisions} />
          </SectionCard>

          <SectionCard
            accent="bg-amber-500"
            title="興味・関心と熱中したことの変遷"
            subtitle="Trends & Passions"
          >
            <Bullets items={summary.trends} emptyText="傾向を抽出できる記録がありません" />
          </SectionCard>
        </div>
      ) : null}
    </main>
  );
}

function SectionCard({
  accent,
  title,
  subtitle,
  children,
}: {
  accent: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span className={`h-4 w-1 rounded-full ${accent}`} />
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-300">
          {subtitle}
        </span>
      </div>
      <div className="px-4 pb-4 pt-2.5">{children}</div>
    </section>
  );
}

function Bullets({
  items,
  emptyText = "該当なし",
}: {
  items: string[];
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate-700">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-slate-300" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
