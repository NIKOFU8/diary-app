// 保存済み自動レポートの読み出し/削除（Supabase・本人のみRLS）。
// クラウド機能のため、Supabase未設定（ローカルモード）では使用しない。

import { getSupabaseClient } from "@/lib/supabase/client";

export interface ReportSummary {
  lessons: string[];
  decisions: string[];
  trends: string[];
}

export interface Report {
  id: string;
  createdAt: string;
  periodType: "week" | "month" | "year";
  periodStart: string;
  periodEnd: string;
  label: string;
  entryCount: number;
  summary: ReportSummary;
}

interface Row {
  id: string;
  created_at: string;
  period_type: "week" | "month" | "year";
  period_start: string;
  period_end: string;
  label: string;
  entry_count: number;
  summary: Partial<ReportSummary> | null;
}

function toReport(r: Row): Report {
  return {
    id: r.id,
    createdAt: r.created_at,
    periodType: r.period_type,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    label: r.label,
    entryCount: r.entry_count,
    summary: {
      lessons: r.summary?.lessons ?? [],
      decisions: r.summary?.decisions ?? [],
      trends: r.summary?.trends ?? [],
    },
  };
}

export async function listReports(): Promise<Report[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toReport);
}

export async function deleteReport(id: string): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb.from("reports").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteReports(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const sb = getSupabaseClient();
  const { error } = await sb.from("reports").delete().in("id", ids);
  if (error) throw error;
}
