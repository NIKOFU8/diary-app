// 保存系エラーをユーザー向けの分かりやすい文言に変換する。
// 特にSupabaseのセッション切れ（RLS/認証エラー）を検知して再ログインを促す。
export function authAwareError(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/jwt|auth|row-level|rls|permission|denied|401|403|expired|session|not.*authenticat/i.test(msg)) {
    return "ログインの有効期限が切れている可能性があります。一度ログアウトして再ログインしてからお試しください。";
  }
  return msg ? `${fallback}（${msg}）` : fallback;
}
