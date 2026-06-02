"use client";

import { WEATHERS, type Weather } from "@/lib/types";
import StepShell from "./StepShell";

export default function WeatherStep({
  step,
  total,
  onBack,
  onPick,
}: {
  step: number;
  total: number;
  onBack: () => void;
  onPick: (w: Weather) => void;
}) {
  return (
    <StepShell step={step} total={total} title="今の天気は？" onBack={onBack}>
      <div className="grid grid-cols-2 gap-3">
        {WEATHERS.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => onPick(w.value)}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white active:scale-[0.98] active:bg-indigo-50"
          >
            <span className="text-5xl">{w.emoji}</span>
            <span className="text-sm font-medium text-slate-700">{w.label}</span>
          </button>
        ))}
      </div>
    </StepShell>
  );
}
