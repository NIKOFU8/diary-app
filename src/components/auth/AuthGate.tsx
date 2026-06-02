"use client";

import { useAuth } from "./AuthProvider";
import LoginScreen from "./LoginScreen";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { configured, loading, session } = useAuth();

  // Local (IndexedDB) mode: no Supabase configured -> no login required.
  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">読み込み中…</p>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return <>{children}</>;
}
