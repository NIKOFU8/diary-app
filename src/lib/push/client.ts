// Browser-side helpers to enable Web Push notifications and store the
// subscription in Supabase (the authenticated client inserts under RLS).

import { getSupabaseClient } from "@/lib/supabase/client";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export interface EnableResult {
  ok: boolean;
  message?: string;
}

export async function enablePushNotifications(): Promise<EnableResult> {
  if (!pushSupported()) {
    return { ok: false, message: "この端末/ブラウザは通知に対応していません。" };
  }
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) {
    return { ok: false, message: "通知用のVAPID公開鍵が設定されていません。" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "通知が許可されませんでした。" };
  }

  // 本番ではServiceWorkerRegisterが登録済み。未登録なら登録する（開発時など）。
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, message: "購読情報の取得に失敗しました。" };
  }

  const sb = getSupabaseClient();
  const { error } = await sb.from("push_subscriptions").upsert(
    { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth_key: json.keys.auth },
    { onConflict: "endpoint", ignoreDuplicates: true },
  );
  if (error) return { ok: false, message: "購読情報の保存に失敗しました。" };

  return { ok: true };
}
