"use client";

import { CONDITIONS, type Condition } from "@/lib/types";
import StepShell from "./StepShell";

export default function ConditionStep({
  step,
  total,
  onBack,
  onPick,
}: {
  step: number;
  total: number;
  onBack: () => void;
  onPick: (c: Condition) => void;
}) {
  return (
    <StepShell
      step={step}
      total={total}
      title="今の体調はどう？"
      hint="1（悪い）〜 5（絶好調）"
      onBack={onBack}
    >
      <div className="flex flex-col gap-2.5">
        {[...CONDITIONS].reverse().map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onPick(c.value)}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 active:bg-indigo-50"
          >
            <span className="text-3xl">{c.emoji}</span>
            <span className="flex-1 text-left font-medium text-slate-700">
              {c.label}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
              {c.value}
            </span>
          </button>
        ))}
      </div>
    </StepShell>
  );
}
