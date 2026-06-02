import { summarize } from "@/lib/ai/engine";
import type { DiaryEntry } from "@/lib/types";

export async function POST(request: Request) {
  const { entries } = (await request.json()) as { entries?: DiaryEntry[] };
  return Response.json(await summarize(entries ?? []));
}
