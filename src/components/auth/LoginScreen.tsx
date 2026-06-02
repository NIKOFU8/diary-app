"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const sendCode = async () => {
    const addr = email.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await getSupabaseClient().auth.signInWithOtp({
        email: addr,
        options: {
          // 事前に作成した自分のアカウント以外はログイン不可
          shouldCreateUser: false,
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      setStage("code");
      setInfo("メールを送信しました。届いた6桁コードを入力するか、メール内のリンクを開いてください。");
    } catch {
      setError("送信に失敗しました。登録済みのメールアドレスかご確認ください。");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    const token = code.trim();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await getSupabaseClient().auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (error) throw error;
      // onAuthStateChange が発火してゲートが自動で開く
    } catch {
      setError("コードが正しくないか、期限切れです。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-8">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">まいにち日記</h1>
        <p className="mt-2 text-sm text-slate-500">
          {stage === "email"
            ? "登録済みのメールアドレスでログインします。"
            : "メールに届いた6桁のコードを入力してください。"}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={stage === "code"}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-indigo-400 disabled:bg-slate-100"
          />

          {stage === "email" ? (
            <button
              type="button"
              onClick={sendCode}
              disabled={loading || !email.trim()}
              className="w-full rounded-2xl bg-indigo-600 py-3.5 font-bold text-white active:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "送信中…" : "ログインコードを送る"}
            </button>
          ) : (
            <>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={verify}
                disabled={loading || !code.trim()}
                className="w-full rounded-2xl bg-indigo-600 py-3.5 font-bold text-white active:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "確認中…" : "ログイン"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage("email");
                  setCode("");
                  setError(null);
                  setInfo(null);
                }}
                className="self-start text-xs text-slate-400 underline"
              >
                メールアドレスを変更する
              </button>
            </>
          )}

          {info ? <p className="text-xs text-slate-500">{info}</p> : null}
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
