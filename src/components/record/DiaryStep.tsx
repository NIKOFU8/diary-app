"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import { correctTextRemote } from "@/lib/ai/client";
import StepShell from "./StepShell";

export default function DiaryStep({
  step,
  total,
  value,
  onChange,
  dateKey,
  onDateChange,
  onBack,
  onNext,
}: {
  step: number;
  total: number;
  value: string;
  onChange: (text: string) => void;
  dateKey: string;
  onDateChange: (key: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const baseRef = useRef("");

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(Boolean(SR));
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const toggleListen = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.continuous = true;
    baseRef.current = value ? `${value.replace(/\s*$/, "")}\n` : "";
    rec.onresult = (e: any) => {
      let session = "";
      for (let i = 0; i < e.results.length; i++) {
        session += e.results[i][0].transcript;
      }
      onChange(baseRef.current + session);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  };

  const handleCorrect = async () => {
    if (!value.trim() || correcting) return;
    setCorrecting(true);
    setError(null);
    try {
      onChange(await correctTextRemote(value));
    } catch {
      setError("補正に失敗しました。もう一度お試しください。");
    } finally {
      setCorrecting(false);
    }
  };

  return (
    <StepShell
      step={step}
      total={total}
      title="今あったことを教えてください"
      hint={
        supported
          ? "マイクで話すか、直接入力できます。AI整形でフィラーを除去して読みやすく整えます。"
          : "テキストで入力してください。AI整形で読みやすく整えます。"
      }
      onBack={onBack}
      footer={
        <button
          type="button"
          onClick={onNext}
          className="w-full rounded-2xl bg-indigo-600 py-4 text-center font-bold text-white active:bg-indigo-700"
        >
          次へ
        </button>
      }
    >
      <label className="mb-3 flex items-center gap-2">
        <span className="flex-none text-xs font-semibold text-slate-500">日付</span>
        <input
          type="date"
          value={dateKey}
          onChange={(e) => onDateChange(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
      </label>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="今日はどんな一日でしたか？"
        className="min-h-44 flex-1 resize-none rounded-2xl border border-slate-200 bg-white p-4 text-base leading-relaxed text-slate-800 outline-none focus:border-indigo-400"
      />

      <div className="mt-3 flex items-center gap-3">
        {supported ? (
          <button
            type="button"
            onClick={toggleListen}
            className={`flex h-12 w-12 flex-none items-center justify-center rounded-full text-xl text-white ${
              listening ? "animate-pulse bg-rose-500" : "bg-indigo-600"
            }`}
            aria-label={listening ? "音声入力を停止" : "音声入力を開始"}
          >
            {listening ? "■" : "🎤"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleCorrect}
          disabled={!value.trim() || correcting}
          className="flex-1 rounded-2xl border border-indigo-200 bg-indigo-50 py-3 text-sm font-semibold text-indigo-700 disabled:opacity-50"
        >
          {correcting ? "整形中…" : "AIで整形"}
        </button>
      </div>

      {listening ? (
        <p className="mt-2 text-xs text-rose-500">● 録音中… 話し終えたら停止を押してください</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </StepShell>
  );
}
