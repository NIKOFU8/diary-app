import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { summarize } from "@/lib/ai/engine";
import { duePeriods, jstPeriodRangeISO } from "@/lib/reports/period";
import type { DiaryEntry, Condition, Weather } from "@/lib/types";

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth_key: string;
  user_id: string;
}

interface TaskRow {
  id: string;
  user_id: string;
  content: string;
  due_date: string | null;
  notify_days_before: number | null;
}

interface EntryRow {
  id: string;
  user_id: string;
  created_at: string;
  weather: Weather;
  condition: number;
  body: string;
  photo_url: string | null;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function sendPush(
  sb: SupabaseClient,
  subs: SubRow[],
  payload: string,
): Promise<number> {
  let sent = 0;
  for (const s of subs) {
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
  return sent;
}

// --- タスクの期日通知 -------------------------------------------------------
async function runTaskNotifications(sb: SupabaseClient): Promise<{ due: number; sent: number }> {
  const { data: tasks, error } = await sb
    .from("tasks")
    .select("id, user_id, content, due_date, notify_days_before")
    .eq("done", false)
    .is("notified_at", null)
    .not("due_date", "is", null)
    .not("notify_days_before", "is", null);
  if (error) throw error;

  const todayKey = dayKey(new Date());
  const due = (tasks as TaskRow[]).filter((t) => {
    if (!t.due_date || t.notify_days_before == null) return false;
    const notifyDate = new Date(`${t.due_date}T00:00:00Z`);
    notifyDate.setUTCDate(notifyDate.getUTCDate() - t.notify_days_before);
    return dayKey(notifyDate) <= todayKey;
  });
  if (due.length === 0) return { due: 0, sent: 0 };

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
    sent += await sendPush(sb, subsByUser.get(t.user_id) ?? [], payload);
  }
  await sb
    .from("tasks")
    .update({ notified_at: new Date().toISOString() })
    .in(
      "id",
      due.map((t) => t.id),
    );
  return { due: due.length, sent };
}

// --- 定期レポートの自動生成 -------------------------------------------------
async function runReportGeneration(sb: SupabaseClient): Promise<{ generated: number }> {
  const periods = duePeriods(new Date());
  if (periods.length === 0) return { generated: 0 };

  let generated = 0;
  for (const period of periods) {
    const { startISO, endISO } = jstPeriodRangeISO(period);
    const { data: entriesData } = await sb
      .from("entries")
      .select("id, user_id, created_at, weather, condition, body, photo_url")
      .gte("created_at", startISO)
      .lte("created_at", endISO);
    const rows = (entriesData as EntryRow[]) ?? [];
    if (rows.length === 0) continue;

    const byUser = new Map<string, EntryRow[]>();
    for (const e of rows) {
      const arr = byUser.get(e.user_id);
      if (arr) arr.push(e);
      else byUser.set(e.user_id, [e]);
    }

    for (const [userId, userRows] of Array.from(byUser.entries())) {
      // 既に生成済みならスキップ（冪等・AI呼び出しの無駄も防ぐ）
      const { data: existing } = await sb
        .from("reports")
        .select("id")
        .eq("user_id", userId)
        .eq("period_type", period.type)
        .eq("period_start", period.start)
        .maybeSingle();
      if (existing) continue;

      const entries: DiaryEntry[] = userRows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        weather: r.weather,
        condition: r.condition as Condition,
        body: r.body,
        photoUrl: r.photo_url,
      }));
      const summary = await summarize(entries);

      const { data: inserted, error: insErr } = await sb
        .from("reports")
        .insert({
          user_id: userId,
          period_type: period.type,
          period_start: period.start,
          period_end: period.end,
          label: period.label,
          entry_count: summary.count,
          summary: {
            lessons: summary.lessons,
            decisions: summary.decisions,
            trends: summary.trends,
          },
        })
        .select("id")
        .single();
      if (insErr || !inserted) continue;
      generated++;

      const { data: subs } = await sb
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth_key, user_id")
        .eq("user_id", userId);
      const payload = JSON.stringify({
        title: "振り返りができました",
        body: `${period.label}が作成されました`,
        url: "/review",
        tag: `report-${inserted.id}`,
      });
      await sendPush(sb, (subs as SubRow[]) ?? [], payload);
      await sb
        .from("reports")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", inserted.id);
    }
  }
  return { generated };
}

// Vercel Cron がGETで叩く。CRON_SECRET があれば Authorization: Bearer で検証。
// 1本のcronでタスク通知と定期レポート生成の両方を実行する。
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
  const tasks = await runTaskNotifications(sb);
  const reports = await runReportGeneration(sb);
  return Response.json({ tasks, reports });
}
