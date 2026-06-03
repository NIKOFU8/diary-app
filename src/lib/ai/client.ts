// Browser-side wrappers that call the AI route handlers. Components use these,
// so swapping the server implementation never touches the UI.

import type { DiaryEntry } from "@/lib/types";
import type { Summary } from "./types";

export async function correctTextRemote(text: string): Promise<string> {
  const res = await fetch("/api/ai/correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("文章の補正に失敗しました");
  const json = (await res.json()) as { text: string };
  return json.text;
}

export async function summarizeRemote(entries: DiaryEntry[]): Promise<Summary> {
  const res = await fetch("/api/ai/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) throw new Error("まとめの生成に失敗しました");
  return (await res.json()) as Summary;
}
