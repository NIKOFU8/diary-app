-- まいにち日記 / 追加マイグレーション: tasks + push_subscriptions
-- Supabase ダッシュボードの SQL Editor で実行してください（schema.sql 実行済みが前提）。
-- 「本人のみ」を満たすため Row Level Security 前提。

create extension if not exists "pgcrypto";

-- =========================================================================
-- タスク
-- =========================================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  content text not null check (char_length(content) between 1 and 1000),
  done boolean not null default false,
  done_at timestamptz,                                  -- 完了時刻（完了を末尾に並べる用）
  due_date date,                                        -- 期日（任意。過ぎてもペナルティなし）
  notify_days_before smallint check (notify_days_before between 0 and 365), -- 〇日前に通知（null=通知なし）
  notified_at timestamptz,                              -- 通知済み記録（重複通知防止）
  source text not null default 'manual' check (source in ('manual', 'ai')), -- 手動 / AI抽出
  entry_id uuid references public.entries (id) on delete set null           -- 抽出元の日記（任意）
);

create index if not exists tasks_user_done_due_idx on public.tasks (user_id, done, due_date);
create index if not exists tasks_user_due_idx on public.tasks (user_id, due_date);

alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id);
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- Web Push の購読情報（PWA プッシュ通知用）
-- 1ユーザーが複数端末を持てるよう endpoint 単位で保存する。
-- =========================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,        -- 購読の公開鍵（subscription.keys.p256dh）
  auth_key text not null,      -- 認証シークレット（subscription.keys.auth）
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- 備考:
-- ・通知を送るバッチ（Vercel Cron → API）は service_role キーで実行し RLS をバイパスして
--   「(due_date - notify_days_before) <= 今日 かつ notified_at is null かつ done=false」のタスクを抽出して送信する。
-- ・done_at / notified_at はアプリ側で更新する。
