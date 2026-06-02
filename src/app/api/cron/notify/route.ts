import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface TaskRow {
  id: string;
  user_id: string;
  content: string;
  due_date: string | null;
  notify_days_before: number | null;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth_key: string;
  user_id: string;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Vercel Cron がGETで叩く。CRON_SECRET があれば Authorization: Bearer で検証。
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    return Response.json({ error: "VAPID keys are not set" }, { status: 500 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);

  const sb = getSupabaseAdmin();

  // 通知対象候補: 未完了 / 未通知 / 期日あり / 通知設定あり
  const { data: tasks, error } = await sb
    .from("tasks")
    .select("id, user_id, content, due_date, notify_days_before")
    .eq("done", false)
    .is("notified_at", null)
    .not("due_date", "is", null)
    .not("notify_days_before", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const todayKey = dayKey(new Date());
  // 「通知日(= 期日 - 通知日数)」が今日以前になったものを対象にする
  const due = (tasks as TaskRow[]).filter((t) => {
    if (!t.due_date || t.notify_days_before == null) return false;
    const notifyDate = new Date(`${t.due_date}T00:00:00Z`);
    notifyDate.setUTCDate(notifyDate.getUTCDate() - t.notify_days_before);
    return dayKey(notifyDate) <= todayKey;
  });

  if (due.length === 0) return Response.json({ due: 0, sent: 0 });

  const userIds = [...new Set(due.map((t) => t.user_id))];
  const { data: subsData } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key, user_id")
    .in("user_id", userIds);

  const subsByUser = new Map<string, SubRow[]>();
  for (const s of (subsData as SubRow[]) ?? []) {
    const arr = subsByUser.get(s.user_id);
    if (arr) arr.push(s);
    else subsByUser.set(s.user_id, [s]);
  }

  let sent = 0;
  for (const t of due) {
    const payload = JSON.stringify({
      title: "タスクの期日が近づいています",
      body: t.content,
      url: "/tasks",
      tag: `task-${t.id}`,
    });
    for (const s of subsByUser.get(t.user_id) ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          payload,
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
  }

  // 通知は1回限り。対象タスクを通知済みにする。
  await sb
    .from("tasks")
    .update({ notified_at: new Date().toISOString() })
    .in(
      "id",
      due.map((t) => t.id),
    );

  return Response.json({ due: due.length, sent });
}
