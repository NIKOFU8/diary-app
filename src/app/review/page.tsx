"use client";

import { useEffect, useRef, useState } from "react";
import { getStore, isSupabaseConfigured } from "@/lib/storage";
import { summarizeRemote } from "@/lib/ai/client";
import type { Summary } from "@/lib/ai/types";
import { dateKey, dayRange } from "@/lib/date";
import { listReports, deleteReport, deleteReports, type Report } from "@/lib/reports/store";

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
  const [manualOpen, setManualOpen] = useState(false);

  const [reports, setReports] = useState<Report[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [jumpNote, setJumpNote] = useState<string | null>(null);

  const reportRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const cloud = isSupabaseConfigured();

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
      setSummary(await summarizeRemote(entries, { start, end }));
    } catch {
      setError("まとめの生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!cloud) return;
    let active = true;
    listReports()
      .then((r) => active && setReports(r))
      .catch(() => active && setReports([]));
    return () => {
      active = false;
    };
  }, [cloud]);

  const removeReport = async (id: string) => {
    if (!window.confirm("このまとめを削除しますか？")) return;
    try {
      await deleteReport(id);
      setReports((p) => (p ?? []).filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      /* ignore */
    }
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => setSelectedIds(new Set((reports ?? []).map((r) => r.id)));
  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`選択した${selectedIds.size}件のまとめを削除しますか？`)) return;
    try {
      await deleteReports([...selectedIds]);
      setReports((p) => (p ?? []).filter((r) => !selectedIds.has(r.id)));
    } catch {
      /* ignore */
    }
    exitSelect();
  };

  const jumpToDate = (d: string) => {
    if (!d || !reports) return;
    const r = reports.find((rep) => rep.periodStart <= d && d <= rep.periodEnd);
    if (!r) {
      setJumpNote("その日を含む自動まとめはまだありません");
      setTimeout(() => setJumpNote(null), 2500);
      return;
    }
    setJumpNote(null);
    setExpandedId(r.id);
    reportRefs.current.get(r.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="flex flex-1 flex-col px-5 pb-28 pt-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">振り返り</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            日記から、客観的な事実と実践的な教訓をAIがまとめます
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
                  「自動」は週・月・年ごとに対象期間の日記をAIが分析し、「学びと次回への教訓」「重要な決断と事実の記録」「興味・関心と熱中したことの変遷」の3つに整理して履歴に保存します。「手動」は期間を指定してその場で生成します（履歴には残りません）。
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

      {/* 手動（コンパクトな折りたたみ） */}
      <button
        type="button"
        onClick={() => setManualOpen((o) => !o)}
        className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left active:bg-slate-50"
      >
        <span className="text-sm font-bold text-slate-700">手動で振り返る</span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          期間を指定して生成
          <Chevron open={manualOpen} />
        </span>
      </button>

      {manualOpen ? (
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <span className="text-slate-400">〜</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
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
            className="mt-4 w-full rounded-2xl bg-indigo-600 py-3 font-bold text-white active:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "生成中…" : "この期間をまとめる"}
          </button>
          {error ? <p className="mt-2 text-center text-xs text-rose-600">{error}</p> : null}
          <p className="mt-2 text-center text-[11px] text-slate-400">
            ※ 手動の結果は履歴に保存されません
          </p>

          {summary ? (
            <div className="mt-4 flex flex-col gap-4">
              <p className="text-xs text-slate-400">対象 {summary.count} 件</p>
              <SectionCard accent="bg-indigo-500" title="学びと次回への教訓">
                <Bullets items={summary.lessons} />
              </SectionCard>
              <SectionCard accent="bg-emerald-500" title="重要な決断と事実の記録">
                <Bullets items={summary.decisions} />
              </SectionCard>
              <SectionCard accent="bg-amber-500" title="興味・関心と熱中したことの変遷">
                <Bullets items={summary.trends} emptyText="傾向を抽出できる記録がありません" />
              </SectionCard>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 自動で作成されたまとめ（メイン・新しい順） */}
      {cloud ? (
        <section className="mt-7 flex-1">
          <div className="flex items-center justify-between gap-2">
            {/* 左端: タイトル＋日付ジャンプ（カレンダーマーク） */}
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-slate-700">自動で作成されたまとめ</h2>
              {!selectMode ? (
                <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <CalendarGlyph />
                  <input
                    type="date"
                    aria-label="日付から探す"
                    onChange={(e) => jumpToDate(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </span>
              ) : null}
            </div>

            {/* 右端: 選択（誤操作防止のためカレンダーマークと十分に離す） */}
            {selectMode ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 active:bg-slate-100"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={bulkDelete}
                  disabled={selectedIds.size === 0}
                  className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white active:bg-rose-700 disabled:opacity-40"
                >
                  削除{selectedIds.size > 0 ? `（${selectedIds.size}）` : ""}
                </button>
                <button
                  type="button"
                  onClick={exitSelect}
                  className="rounded-full px-2 py-1 text-xs text-slate-400"
                >
                  キャンセル
                </button>
              </div>
            ) : (reports?.length ?? 0) > 0 ? (
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 active:bg-slate-100"
              >
                選択
              </button>
            ) : null}
          </div>
          {jumpNote ? <p className="mt-1 text-[11px] text-amber-600">{jumpNote}</p> : null}

          <div className="mt-3 flex flex-col gap-2">
            {reports === null ? (
              <p className="py-4 text-center text-sm text-slate-400">読み込み中…</p>
            ) : reports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-8 text-center text-xs text-slate-400">
                まだ自動レポートはありません。週初め・月初などに自動で作成されます。
              </div>
            ) : (
              reports.map((r) => {
                const open = expandedId === r.id;
                const checked = selectedIds.has(r.id);
                return (
                  <div
                    key={r.id}
                    ref={(el) => {
                      if (el) reportRefs.current.set(r.id, el);
                    }}
                    className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    {selectMode ? (
                      <button
                        type="button"
                        onClick={() => toggleSelect(r.id)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50"
                      >
                        <span
                          className={`flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
                            checked
                              ? "border-rose-500 bg-rose-500 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {checked ? <Check /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-800">
                            {r.label}
                          </span>
                          <span className="text-[11px] text-slate-400">{r.entryCount}件の記録</span>
                        </span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : r.id)}
                          className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left active:bg-slate-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-800">
                              {r.label}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {r.entryCount}件の記録
                            </span>
                          </span>
                          <Chevron open={open} />
                        </button>
                        {open ? (
                          <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                            <div className="flex flex-col gap-4">
                              <SectionCard accent="bg-indigo-500" title="学びと次回への教訓">
                                <Bullets items={r.summary.lessons} />
                              </SectionCard>
                              <SectionCard accent="bg-emerald-500" title="重要な決断と事実の記録">
                                <Bullets items={r.summary.decisions} />
                              </SectionCard>
                              <SectionCard accent="bg-amber-500" title="興味・関心と熱中したことの変遷">
                                <Bullets
                                  items={r.summary.trends}
                                  emptyText="傾向を抽出できる記録がありません"
                                />
                              </SectionCard>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeReport(r.id)}
                              className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600"
                            >
                              このまとめを削除
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 flex-none text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

function Check() {
  return (
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
  );
}

function SectionCard({
  accent,
  title,
  children,
}: {
  accent: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span className={`h-4 w-1 rounded-full ${accent}`} />
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      <div className="px-4 pb-4 pt-2.5">{children}</div>
    </section>
  );
}

function Bullets({ items, emptyText = "該当なし" }: { items: string[]; emptyText?: string }) {
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
