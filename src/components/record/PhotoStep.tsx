"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { fileToResizedDataUrl } from "@/lib/image";
import StepShell from "./StepShell";

export default function PhotoStep({
  step,
  total,
  value,
  onChange,
  onBack,
  onNext,
  onSkip,
}: {
  step: number;
  total: number;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setLoading(true);
    try {
      onChange(await fileToResizedDataUrl(file));
    } finally {
      setLoading(false);
    }
  };

  return (
    <StepShell
      step={step}
      total={total}
      title="写真を添付しますか？"
      hint="任意です。カメラロールから選べます。"
      onBack={onBack}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 rounded-2xl border border-slate-300 bg-white py-4 text-center font-semibold text-slate-600 active:bg-slate-100"
          >
            スキップ
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 rounded-2xl bg-indigo-600 py-4 text-center font-bold text-white active:bg-indigo-700"
          >
            次へ
          </button>
        </div>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

      {value ? (
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="添付プレビュー"
            className="max-h-72 w-full rounded-2xl object-contain"
          />
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
              onClick={() => onChange(null)}
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
          disabled={loading}
          className="flex min-h-44 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500 disabled:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-9 w-9 text-slate-400"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="m21 15-5-5L5 20" />
          </svg>
          <span className="text-sm font-medium">
            {loading ? "読み込み中…" : "画像を選択"}
          </span>
        </button>
      )}
    </StepShell>
  );
}
