-- まいにち日記 / Supabase schema
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
-- 「本人のみ」を満たすため Supabase Auth + Row Level Security 前提の設計です。

create extension if not exists "pgcrypto";

-- 日記本体
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  weather text not null check (weather in ('sunny', 'cloudy', 'rainy', 'snowy')),
  condition smallint not null check (condition between 1 and 5),
  body text not null default '',
  photo_url text
);

create index if not exists entries_user_created_idx
  on public.entries (user_id, created_at desc);

-- 本文のキーワード検索（ILIKE）を高速化する全文検索インデックス
create extension if not exists pg_trgm;
create index if not exists entries_body_trgm_idx
  on public.entries using gin (body gin_trgm_ops);

-- RLS: 自分の行だけ読み書きできる
alter table public.entries enable row level security;

create policy "entries_select_own" on public.entries
  for select using (auth.uid() = user_id);
create policy "entries_insert_own" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "entries_update_own" on public.entries
  for update using (auth.uid() = user_id);
create policy "entries_delete_own" on public.entries
  for delete using (auth.uid() = user_id);

-- 写真用ストレージバケット（公開URLで参照する想定）
insert into storage.buckets (id, name, public)
values ('diary-photos', 'diary-photos', true)
on conflict (id) do nothing;

create policy "photos_insert_own" on storage.objects
  for insert with check (bucket_id = 'diary-photos' and auth.uid() = owner);
create policy "photos_select_all" on storage.objects
  for select using (bucket_id = 'diary-photos');
create policy "photos_delete_own" on storage.objects
  for delete using (bucket_id = 'diary-photos' and auth.uid() = owner);
