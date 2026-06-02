import { correctText } from "@/lib/ai/engine";

export async function POST(request: Request) {
  const { text } = (await request.json()) as { text?: string };
  return Response.json({ text: await correctText(text ?? "") });
}
