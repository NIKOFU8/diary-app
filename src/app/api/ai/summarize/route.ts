import { summarize } from "@/lib/ai/engine";
import type { DiaryEntry } from "@/lib/types";

// 長期間（年間など）は月ごとの要約→統合（Map-Reduce）で複数回AIを呼ぶため、実行時間を長めに確保する
export const maxDuration = 60;

/** start/end（YYYY-MM-DD）が約300日以上離れていれば「年間相当の長期間」とみなす。 */
function isLongRange(start?: string, end?: string): boolean | undefined {
  if (!start || !end) return undefined; // 不明なら engine 側で entries から自動判定させる
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return undefined;
  return (e - s) / 86400000 >= 300;
}

export async function POST(request: Request) {
  const { entries, start, end } = (await request.json()) as {
    entries?: DiaryEntry[];
    start?: string;
    end?: string;
  };
  const longRange = isLongRange(start, end);
  return Response.json(
    await summarize(entries ?? [], longRange === undefined ? {} : { longRange }),
  );
}
