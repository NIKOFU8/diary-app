"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Weather, Condition } from "@/lib/types";
import { getStore } from "@/lib/storage";
import { getTaskStore } from "@/lib/tasks";
import { extractTasksRemote } from "@/lib/ai/client";
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
}

// 日記本文からタスクを抽出して追加（ベストエフォート：失敗しても保存は成功扱い）。
async function autoExtractTasks(entryId: string, body: string) {
  if (!body.trim()) return;
  try {
    const texts = await extractTasksRemote(body);
    if (texts.length === 0) return;
    const taskStore = await getTaskStore();
    const existing = await taskStore.list();
    const existingContents = new Set(existing.map((t) => t.content.trim()));
    for (const text of texts) {
      const content = text.trim();
      if (content && !existingContents.has(content)) {
        await taskStore.create({ content, source: "ai", entryId });
      }
    }
  } catch {
    // 抽出は付加機能。失敗しても日記の保存自体は成功とする。
  }
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
      const entry = await store.create({
        weather: draft.weather,
        condition: draft.condition,
        body: draft.body.trim(),
        photoDataUrl: draft.photoDataUrl,
      });
      await autoExtractTasks(entry.id, entry.body);
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
          saving={saving}
          error={error}
          onBack={back}
          onSave={handleSave}
        />
      );
  }
}
