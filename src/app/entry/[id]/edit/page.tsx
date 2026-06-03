"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { getStore } from "@/lib/storage";
import type { DiaryEntry, Weather, Condition } from "@/lib/types";
import { WEATHERS, CONDITIONS } from "@/lib/types";
import { dateKey, dayRange, formatTimeJP } from "@/lib/date";
import { fileToResizedDataUrl } from "@/lib/image";
import { correctTextRemote } from "@/lib/ai/client";
import { authAwareError } from "@/lib/errors";

export default function EditEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<DiaryEntry | null | undefined>(undefined);
  const [siblingIds, setSiblingIds] = useState<string[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [dateValue, setDateValue] = useState(""); // YYYY-MM-DD
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const s = await getStore();
      const e = await s.get(id);
      if (!active) return;
      if (!e) {
        setEntry(null);
        return;
      }
      setEntry(e);
      setWeather(e.weather);
      setCondition(e.condition);
      setDateValue(dateKey(e.createdAt));
      setBody(e.body);
      setPhoto(e.photoUrl);
      // 同じ日の他の記録（天気・体調を揃える対象）
      const { startISO, endISO } = dayRange(dateKey(e.createdAt));
      const day = await s.listBetween(startISO, endISO);
      if (active) setSiblingIds(day.filter((x) => x.id !== e.id).map((x) => x.id));
    })().catch(() => active && setEntry(null));
    return () => {
      active = false;
    };
  }, [id]);

  const handleFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setPhoto(await fileToResizedDataUrl(file));
  };

  const handleCorrect = async () => {
    if (!body.trim() || correcting) return;
    setCorrecting(true);
    setError(null);
    try {
      setBody(await correctTextRemote(body));
    } catch {
      setError("整形に失敗しました。");
    } finally {
      setCorrecting(false);
    }
  };

  const handleSave = async () => {
    if (weather === null || condition === null || !entry) return;
    setSaving(true);
    setError(null);
    try {
      const s = await getStore();
      // 日付が変更された場合は、元の時刻を保ったまま対象日だけを差し替える
      let createdAt: string | undefined;
      if (dateValue && dateValue !== dateKey(entry.createdAt)) {
        const [y, m, d] = dateValue.split("-").map(Number);
        const orig = new Date(entry.createdAt);
        createdAt = new Date(
          y,
          m - 1,
          d,
          orig.getHours(),
          orig.getMinutes(),
          orig.getSeconds(),
          orig.getMilliseconds(),
        ).toISOString();
      }
      await s.update(id, {
        weather,
        condition,
        body: body.trim(),
        photoDataUrl: photo,
        ...(createdAt ? { createdAt } : {}),
      });
      // 天気・体調を変更した場合は、同じ日の他の記録にも反映（その日の値を揃える）
      const metaChanged = weather !== entry.weather || condition !== entry.condition;
      if (metaChanged && siblingIds.length > 0) {
        await Promise.all(siblingIds.map((sid) => s.update(sid, { weather, condition })));
      }
      router.push(`/entry/${id}`);
    } catch (e) {
      setError(authAwareError(e, "更新に失敗しました。"));
      setSaving(false);
    }
  };

  if (entry === undefined) return <Center>読み込み中…</Center>;
  if (entry === null) return <Center>記録が見つかりませんでした</Center>;

  return (
    <main className="flex min-h-dvh flex-col bg-slate-50 px-5 pb-28 pt-5">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 active:bg-slate-200"
        >
          ←
        </button>
        <span className="text-sm font-semibold text-slate-700">記録を編集</span>
        <span className="w-9" />
      </header>

      {/* 日付 */}
      <section className="mt-4">
        <p className="mb-2 text-xs font-semibold text-slate-500">日付</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
          />
          <span className="flex-none text-xs text-slate-400">{formatTimeJP(entry.createdAt)}</span>
        </div>
      </section>

      {/* 天気 */}
      <section className="mt-5">
        <p className="mb-2 text-xs font-semibold text-slate-500">天気</p>
        <div className="grid grid-cols-4 gap-2">
          {WEATHERS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => setWeather(w.value)}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-3 ${
                weather === w.value
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span className="text-2xl">{w.emoji}</span>
              <span className="text-xs text-slate-600">{w.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 体調 */}
      <section className="mt-4">
        <p className="mb-2 text-xs font-semibold text-slate-500">体調</p>
        <div className="grid grid-cols-5 gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCondition(c.value)}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 ${
                condition === c.value
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span className="text-xl">{c.emoji}</span>
              <span className="text-[10px] text-slate-500">{c.value}</span>
            </button>
          ))}
        </div>
        {siblingIds.length > 0 ? (
          <p className="mt-2 text-[11px] text-slate-400">
            この日には他の記録もあります。天気・体調を変更すると、その日のすべての記録に反映されます。
          </p>
        ) : null}
      </section>

      {/* 本文 */}
      <section className="mt-4">
        <p className="mb-2 text-xs font-semibold text-slate-500">本文</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="今日はどんな一日でしたか？"
          className="min-h-40 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-base leading-relaxed text-slate-800 outline-none focus:border-indigo-400"
        />
        <button
          type="button"
          onClick={handleCorrect}
          disabled={!body.trim() || correcting}
          className="mt-2 w-full rounded-2xl border border-indigo-200 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-700 disabled:opacity-50"
        >
          {correcting ? "整形中…" : "AIで整形"}
        </button>
      </section>

      {/* 写真 */}
      <section className="mt-4">
        <p className="mb-2 text-xs font-semibold text-slate-500">写真</p>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        {photo ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="max-h-60 w-full rounded-2xl object-contain" />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600"
              >
                変更
              </button>
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600"
              >
                削除
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-slate-400"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="m21 15-5-5L5 20" />
            </svg>
            <span className="text-sm font-medium">画像を選択</span>
          </button>
        )}
      </section>

      <div className="mt-6">
        {error ? <p className="mb-2 text-center text-xs text-rose-600">{error}</p> : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl bg-indigo-600 py-4 text-center font-bold text-white active:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "更新中…" : "更新する"}
        </button>
      </div>
    </main>
  );
}

function Center({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
      <p className="text-sm text-slate-400">{children}</p>
    </main>
  );
}
