"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Weather, Condition } from "@/lib/types";
import { getStore } from "@/lib/storage";
import { dateKey, dayRange } from "@/lib/date";
import { authAwareError } from "@/lib/errors";
import WeatherStep from "./WeatherStep";
import ConditionStep from "./ConditionStep";
import DiaryStep from "./DiaryStep";
import PhotoStep from "./PhotoStep";
import ReviewStep from "./ReviewStep";

type StepKey = "weather" | "condition" | "diary" | "photo" | "review";

interface Draft {
  weather: Weather | null;
  condition: Condition | null;
  body: string;
  photoDataUrl: string | null;
  dateKey: string; // YYYY-MM-DD（記入対象の日付。既定は今日）
}

export default function RecordWizard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [lockMeta, setLockMeta] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    weather: null,
    condition: null,
    body: "",
    photoDataUrl: null,
    dateKey: dateKey(new Date()),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当日に既存記録があれば、その天気・体調を流用して入力ステップを省略する。
  useEffect(() => {
    let active = true;
    const { startISO, endISO } = dayRange(dateKey(new Date()));
    getStore()
      .then((s) => s.listBetween(startISO, endISO))
      .then((list) => {
        if (!active) return;
        if (list.length > 0) {
          const base = list[list.length - 1]; // その日の最初の記録
          setDraft((d) => ({ ...d, weather: base.weather, condition: base.condition }));
          setLockMeta(true);
        }
        setReady(true);
      })
      .catch(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  const steps: StepKey[] = lockMeta
    ? ["diary", "photo", "review"]
    : ["weather", "condition", "diary", "photo", "review"];
  const total = steps.length;
  const key = steps[Math.min(step, total - 1)];

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const back = () => (step === 0 ? router.push("/") : setStep((s) => s - 1));
  const next = () => setStep((s) => Math.min(s + 1, total - 1));

  const handleSave = async () => {
    if (draft.weather === null || draft.condition === null) return;
    setSaving(true);
    setError(null);
    try {
      const store = await getStore();
      // 選んだ日付＋現在時刻で createdAt を組み立てる（今日のままなら now と同義）
      const now = new Date();
      const [y, m, d] = draft.dateKey.split("-").map(Number);
      const createdAt = new Date(
        y,
        m - 1,
        d,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      ).toISOString();
      await store.create({
        weather: draft.weather,
        condition: draft.condition,
        body: draft.body.trim(),
        photoDataUrl: draft.photoDataUrl,
        createdAt,
      });
      router.push("/calendar");
    } catch (e) {
      setError(authAwareError(e, "保存に失敗しました。もう一度お試しください。"));
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">読み込み中…</p>
      </div>
    );
  }

  switch (key) {
    case "weather":
      return (
        <WeatherStep
          step={step}
          total={total}
          onBack={back}
          onPick={(w) => {
            update({ weather: w });
            next();
          }}
        />
      );
    case "condition":
      return (
        <ConditionStep
          step={step}
          total={total}
          onBack={back}
          onPick={(c) => {
            update({ condition: c });
            next();
          }}
        />
      );
    case "diary":
      return (
        <DiaryStep
          step={step}
          total={total}
          value={draft.body}
          onChange={(t) => update({ body: t })}
          dateKey={draft.dateKey}
          onDateChange={(k) => update({ dateKey: k })}
          onBack={back}
          onNext={next}
        />
      );
    case "photo":
      return (
        <PhotoStep
          step={step}
          total={total}
          value={draft.photoDataUrl}
          onChange={(d) => update({ photoDataUrl: d })}
          onBack={back}
          onNext={next}
          onSkip={() => {
            update({ photoDataUrl: null });
            next();
          }}
        />
      );
    default:
      return (
        <ReviewStep
          step={step}
          total={total}
          weather={draft.weather as Weather}
          condition={draft.condition as Condition}
          body={draft.body}
          photoDataUrl={draft.photoDataUrl}
          dateKey={draft.dateKey}
          onDateChange={(k) => update({ dateKey: k })}
          saving={saving}
          error={error}
          onBack={back}
          onSave={handleSave}
        />
      );
  }
}
