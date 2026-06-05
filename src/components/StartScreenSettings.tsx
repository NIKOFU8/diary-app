"use client";

import { useState } from "react";
import { START_SCREEN_OPTIONS, getStartScreen, setStartScreen } from "@/lib/settings";

/**
 * 歯車ボタン＋モーダルで「アプリ起動時の初期画面」を選択・保存する。
 * 保存先は端末ごとの localStorage（@/lib/settings）。
 */
export default function StartScreenSettings() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("/");
  const [saved, setSaved] = useState(false);

  const openModal = () => {
    setValue(getStartScreen());
    setSaved(false);
    setOpen(true);
  };

  const save = () => {
    setStartScreen(value);
    setSaved(true);
    window.setTimeout(() => {
      setSaved(false);
      setOpen(false);
    }, 800);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label="設定"
        className="mt-1.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
      >
        <GearIcon />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">起動時の初期画面</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-400 active:bg-slate-100"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              アプリを開いたときに最初に表示する画面を選べます（この端末に保存されます）。
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {START_SCREEN_OPTIONS.map((o) => {
                const selected = value === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setValue(o.value)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${
                      selected
                        ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-700"
                        : "border-slate-200 text-slate-700 active:bg-slate-50"
                    }`}
                  >
                    <span>{o.label}</span>
                    {selected ? <Check /> : null}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={save}
              className="mt-5 w-full rounded-2xl bg-indigo-600 py-3 font-bold text-white active:bg-indigo-700"
            >
              {saved ? "保存しました" : "保存する"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V20a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 flex-none text-indigo-600"
    >
      <path d="m5 12 5 5L20 6" />
    </svg>
  );
}
