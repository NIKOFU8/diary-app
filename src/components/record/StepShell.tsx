"use client";

import type { ReactNode } from "react";

export default function StepShell({
  step,
  total,
  title,
  hint,
  onBack,
  children,
  footer,
}: {
  step: number;
  total: number;
  title: string;
  hint?: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="flex items-center gap-3 px-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="戻る"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-xl text-slate-500 active:bg-slate-200"
        >
          ←
        </button>
        <div className="flex flex-1 gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? "bg-indigo-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>
        <span className="w-8 flex-none text-right text-xs text-slate-400">
          {step + 1}/{total}
        </span>
      </header>

      <div className="flex flex-1 flex-col px-5 pt-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
        <div className="mt-7 flex flex-1 flex-col">{children}</div>
      </div>

      {footer ? (
        <div className="pb-safe sticky bottom-0 border-t border-slate-200 bg-slate-50/95 px-5 py-4 backdrop-blur">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
