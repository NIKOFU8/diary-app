"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStore } from "@/lib/storage";
import type { DiaryEntry } from "@/lib/types";
import EntryCard from "@/components/EntryCard";
import { useAuth } from "@/components/auth/AuthProvider";
import StartScreenSettings from "@/components/StartScreenSettings";
import { getStartScreen } from "@/lib/settings";

// この「アプリ起動セッション」で初期画面リダイレクトを実施済みかのフラグ。
// sessionStorage はタブ/PWAウィンドウ単位で、コールド起動ごとにリセットされる。
const LAUNCH_FLAG = "diary.launchHandled";

export default function HomePage() {
  const router = useRouter();
  // ready=false の間はスプラッシュを描画する。SSRと初回クライアント描画を一致させ、
  // ハイドレーション不一致とホーム内容のチラつき（FOUC）を防ぐ。
  const [ready, setReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const { configured, session, signOut } = useAuth();

  // 起動時の初期画面リダイレクト（このアプリ起動につき一度だけ）
  useEffect(() => {
    let alreadyHandled = false;
    try {
      alreadyHandled = sessionStorage.getItem(LAUNCH_FLAG) === "1";
      sessionStorage.setItem(LAUNCH_FLAG, "1");
    } catch {
      /* sessionStorage 無効時はそのまま続行 */
    }
    // PWA起動（start_url=/?from=pwa）か、このセッション初回の "/" アクセス時に振り分ける
    const fromLaunch = (() => {
      try {
        return new URLSearchParams(window.location.search).has("from");
      } catch {
        return false;
      }
    })();

    const target = getStartScreen();
    if ((fromLaunch || !alreadyHandled) && target && target !== "/") {
      setRedirecting(true);
      router.replace(target);
      return; // ホームは描画せず遷移
    }
    setReady(true);
  }, [router]);

  // ホーム表示が確定してから記録を読み込む
  useEffect(() => {
    if (!ready) return;
    let active = true;
    getStore()
      .then((s) => s.listAll())
      .then((all) => active && setEntries(all))
      .catch(() => active && setEntries([]));
    return () => {
      active = false;
    };
  }, [ready]);

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center px-5">
        <p className="text-sm text-slate-400">{redirecting ? "移動中…" : "読み込み中…"}</p>
      </main>
    );
  }

  const recent = entries?.slice(0, 5) ?? [];

  return (
    <main className="flex flex-1 flex-col px-5 pb-28 pt-10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {/* タイトル左の控えめな設定ボタン（起動時の初期画面を選択） */}
          <StartScreenSettings />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">まいにち日記</h1>
            <p className="mt-2 text-sm text-slate-500">今日はどんな一日でしたか？</p>
          </div>
        </div>
        {configured && session ? (
          <button
            type="button"
            onClick={signOut}
            className="mt-1 flex-none rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 active:bg-slate-100"
          >
            ログアウト
          </button>
        ) : null}
      </div>

      <Link
        href="/record"
        className="mt-6 flex items-center justify-center gap-2 rounded-3xl bg-indigo-600 py-5 text-lg font-bold text-white shadow-lg shadow-indigo-600/20 active:bg-indigo-700"
      >
        ＋ 今日の記録をはじめる
      </Link>

      <section className="mt-9">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">最近の記録</h2>
          <Link href="/calendar" className="text-xs font-medium text-indigo-600">
            すべて見る →
          </Link>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {entries === null ? (
            <p className="py-8 text-center text-sm text-slate-400">読み込み中…</p>
          ) : recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
              まだ記録がありません。
              <br />
              最初の一歩を記録してみましょう。
            </div>
          ) : (
            recent.map((e) => <EntryCard key={e.id} entry={e} showDate />)
          )}
        </div>
      </section>
    </main>
  );
}
