// 端末ごとのユーザー設定（クライアントの localStorage に保存）。
// サーバー側では window が無いため、安全に既定値へフォールバックする。

export const START_SCREEN_KEY = "diary.startScreen";

/** アプリ起動時の初期画面の選択肢（現在のタブ構成に対応）。 */
export const START_SCREEN_OPTIONS: { value: string; label: string }[] = [
  { value: "/", label: "ホーム" },
  { value: "/calendar", label: "カレンダー" },
  { value: "/tasks", label: "タスク" },
  { value: "/review", label: "振り返り" },
];

const DEFAULT_START = "/";

export function isValidStartScreen(v: string | null | undefined): v is string {
  return Boolean(v) && START_SCREEN_OPTIONS.some((o) => o.value === v);
}

/** 保存済みの初期画面パスを返す。未設定・不正値は既定（ホーム "/"）。 */
export function getStartScreen(): string {
  if (typeof window === "undefined") return DEFAULT_START;
  try {
    const v = window.localStorage.getItem(START_SCREEN_KEY);
    return isValidStartScreen(v) ? v : DEFAULT_START;
  } catch {
    return DEFAULT_START;
  }
}

/** 初期画面パスを保存する。 */
export function setStartScreen(value: string): void {
  if (typeof window === "undefined") return;
  try {
    if (isValidStartScreen(value)) window.localStorage.setItem(START_SCREEN_KEY, value);
  } catch {
    /* ストレージ無効時は黙って無視 */
  }
}
