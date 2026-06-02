"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Weather, Condition } from "@/lib/types";
import { getStore } from "@/lib/storage";
import WeatherStep from "./WeatherStep";
import ConditionStep from "./ConditionStep";
import DiaryStep from "./DiaryStep";
import PhotoStep from "./PhotoStep";
import ReviewStep from "./ReviewStep";

const TOTAL = 5;

interface Draft {
  weather: Weather | null;
  condition: Condition | null;
  body: string;
  photoDataUrl: string | null;
}

export default function RecordWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    weather: null,
    condition: null,
    body: "",
    photoDataUrl: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const back = () => (step === 0 ? router.push("/") : setStep((s) => s - 1));

  const handleSave = async () => {
    if (draft.weather === null || draft.condition === null) return;
    setSaving(true);
    setError(null);
    try {
      const store = await getStore();
      await store.create({
        weather: draft.weather,
        condition: draft.condition,
        body: draft.body.trim(),
        photoDataUrl: draft.photoDataUrl,
      });
      router.push("/calendar");
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
      setSaving(false);
    }
  };

  switch (step) {
    case 0:
      return (
        <WeatherStep
          step={0}
          total={TOTAL}
          onBack={back}
          onPick={(w) => {
            update({ weather: w });
            setStep(1);
          }}
        />
      );
    case 1:
      return (
        <ConditionStep
          step={1}
          total={TOTAL}
          onBack={back}
          onPick={(c) => {
            update({ condition: c });
            setStep(2);
          }}
        />
      );
    case 2:
      return (
        <DiaryStep
          step={2}
          total={TOTAL}
          value={draft.body}
          onChange={(t) => update({ body: t })}
          onBack={back}
          onNext={() => setStep(3)}
        />
      );
    case 3:
      return (
        <PhotoStep
          step={3}
          total={TOTAL}
          value={draft.photoDataUrl}
          onChange={(d) => update({ photoDataUrl: d })}
          onBack={back}
          onNext={() => setStep(4)}
          onSkip={() => {
            update({ photoDataUrl: null });
            setStep(4);
          }}
        />
      );
    default:
      return (
        <ReviewStep
          step={4}
          total={TOTAL}
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
