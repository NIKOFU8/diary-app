"use client";

import { useEffect, useState } from "react";
import { pushSupported, enablePushNotifications } from "@/lib/push/client";
import { isSupabaseConfigured } from "@/lib/storage";

// タスクの期日通知（Web Push）を有効化するUI。
// 対応端末 かつ Supabase設定済み のときだけ表示する。
export default function NotificationToggle() {
  const [show, setShow] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (pushSupported() && isSupabaseConfigured()) {
      setShow(true);
      setPerm(Notification.permission);
    }
  }, []);

  if (!show) return null;

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    const res = await enablePushNotifications();
    setBusy(false);
    setPerm(Notification.permission);
    if (!res.ok) setMsg(res.message ?? "通知を有効にできませんでした。");
  };

  if (perm === "granted") {
    return (
      <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        タスクの期日通知はオンです。
      </p>
    );
  }

  if (perm === "denied") {
    return (
      <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
        通知がブロックされています。ブラウザ／端末の設定から許可してください。
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-indigo-800">
          タスクの期日が近づいたら通知を受け取れます
        </p>
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="flex-none rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white active:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "設定中…" : "通知をオンにする"}
        </button>
      </div>
      {msg ? <p className="mt-1.5 text-[11px] text-rose-600">{msg}</p> : null}
    </div>
  );
}
