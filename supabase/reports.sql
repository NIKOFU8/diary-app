-- まいにち日記 / 追加マイグレーション: 自動振り返りレポートの履歴保存
-- Supabase の SQL Editor で実行（schema.sql / tasks.sql 実行済みが前提）。
-- 手動の振り返りは保存しない。Cronが自動生成した定期レポートだけをここに保存する。

create extension if not exists "pgcrypto";

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  period_type text not null check (period_type in ('week', 'month', 'year')),
  period_start date not null,          -- 対象期間の開始日
  period_end date not null,            -- 対象期間の終了日
  label text not null,                 -- 表示用ラベル（例: 2026年5月のまとめ / 2026年 第23週のまとめ）
  entry_count integer not null default 0,
  -- 3カテゴリのサマリー: { "lessons": [...], "decisions": [...], "trends": [...] }
  summary jsonb not null,
  notified_at timestamptz,             -- 「作成されました」通知を送った日時
  -- 同じ期間のレポートを重複生成しない（cronの再実行に対して冪等）
  unique (user_id, period_type, period_start)
);

create index if not exists reports_user_start_idx
  on public.reports (user_id, period_start desc);

alter table public.reports enable row level security;

-- 閲覧・削除は本人のみ。挿入は通常 cron(service_role) が行う（RLSをバイパス）が、
-- 念のため本人insert/updateも許可しておく。
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = user_id);
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = user_id);
create policy "reports_update_own" on public.reports
  for update using (auth.uid() = user_id);
create policy "reports_delete_own" on public.reports
  for delete using (auth.uid() = user_id);
