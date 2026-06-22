"use client";

import { weatherMeta, conditionMeta, type Weather, type Condition } from "@/lib/types";
import { formatTimeJP } from "@/lib/date";
import StepShell from "./StepShell";

export default function ReviewStep({
  step,
  total,
  weather,
  condition,
  body,
  photoDataUrl,
  dateKey,
  onDateChange,
  saving,
  error,
  onBack,
  onSave,
}: {
  step: number;
  total: number;
  weather: Weather;
  condition: Condition;
  body: string;
  photoDataUrl: string | null;
  dateKey: string;
  onDateChange: (key: string) => void;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSave: () => void;
}) {
  const w = weatherMeta(weather);
  const c = conditionMeta(condition);

  return (
    <StepShell
      step={step}
      total={total}
      title="この内容で保存します"
      onBack={onBack}
      footer={
        <>
          {error ? <p className="mb-2 text-center text-xs text-rose-600">{error}</p> : null}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full rounded-2xl bg-indigo-600 py-4 text-center font-bold text-white active:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">日付</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateKey}
              onChange={(e) => onDateChange(e.target.value)}
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-indigo-400"
            />
            <span className="flex-none text-sm text-slate-400">{formatTimeJP(new Date())}</span>
          </div>
        </div>
        <Row label="天気" value={w.label} />
        <Row label="体調" value={`${c.label}（${c.value}）`} />
        <div>
          <p className="text-xs text-slate-400">本文</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
            {body.trim() || "（本文なし）"}
          </p>
        </div>
        {photoDataUrl ? (
          <div>
            <p className="text-xs text-slate-400">写真</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoDataUrl}
              alt="添付プレビュー"
              className="mt-1 max-h-60 w-full rounded-xl object-contain"
            />
          </div>
        ) : null}
      </div>
    </StepShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}
