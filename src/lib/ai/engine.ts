// Server-side AI logic. Uses Google Gemini when GEMINI_API_KEY is set, and
// gracefully falls back to a rule-based mock otherwise (or on any API error).
// Called only from the /api/ai/* route handlers, so the key stays server-side.

import type { DiaryEntry } from "@/lib/types";
import type { Summary } from "./types";
import { generate, isGeminiConfigured } from "./gemini";

// ===========================================================================
// Public API (async). The route handlers await these.
// ===========================================================================

const CORRECT_SYSTEM = `あなたは日本語の文章エディターです。入力は音声認識された日記の下書きです。次の編集だけを行ってください。
- 「えーっと」「あのー」「えー」などのフィラーや言い淀みを削除する
- 明らかな誤変換・誤字脱字を修正する
- 読みやすくなるよう句読点・改行を自然に整える
内容・意味・事実・ニュアンスは変えないこと。要約・脚色・新情報の追加はしないこと。一人称の語り口は保つこと。
出力は整えた本文のみ。前置き・説明・引用符・コードブロックは付けないこと。`;

/** Clean up a voice-dictated draft. Falls back to the rule-based mock. */
export async function correctText(input: string): Promise<string> {
  const text = (input ?? "").trim();
  if (!text) return "";
  if (!isGeminiConfigured()) return correctTextMock(input);
  try {
    const out = await generate(text, { system: CORRECT_SYSTEM, temperature: 0.2 });
    const cleaned = stripFences(out).trim();
    return cleaned || correctTextMock(input);
  } catch (e) {
    console.warn("[ai] correctText fell back to mock:", (e as Error).message);
    return correctTextMock(input);
  }
}

const SUMMARY_SYSTEM = `あなたはユーザーのパーソナルAIアシスタントです。提供された日記の記録から、以下の3つの明確な定義と【除外基準】に従って情報を深く推論し、分類・抽出してください。

1. "lessons" (学びと次回への教訓):
定義: ユーザーが得た新しい知識、失敗からの反省、気づき、そこで得た未来への具体的な改善策や教訓。
例: 「〇〇のやり方を覚えた」「〇〇で失敗したので次は〇〇に気を付ける」

2. "decisions" (重要な決断と事実の記録):
定義: ユーザーが下した人生や生活における「重要な決定」、高額・特別な買い物の事実、参加した特別なイベントなど、完全なる客観的事実の記録。
【除外基準】:
- 「明日は買い物に行く」「今日は〇〇を食べた」などの日常的で些細な予定や決断は絶対に除外してください。
- 「〜と思った」「〜と感じた」などの主観的な感想や感情は事実ではないため、絶対に除外してください。振り返る価値のある「重要な客観的事実と決断」のみに絞ってください。

3. "trends" (興味、関心と熱中したことの変遷):
定義: その期間にユーザーが夢中になっていた趣味、新しく興味を持った分野、継続して調べていること。
【除外基準】: 特に月間や年間など長期間の振り返りにおいて、その期間中に1回程度しか言及されていないもの（一過性の事象）は「熱中した」とは言えないため除外してください。反復して登場するもの、継続性が感じられる事柄のみを抽出してください。

【出力時の厳格なルール】
- 対象期間の記述から上記に値する要素を抽出しつつ、基準を満たさない些細なノイズは確実に弾いてください。
- 各項目の文字列は「純粋な日本語のみ」とし、英語の併記や謎の記号(??&??等)は絶対に含めないでください。
- 各項目は簡潔な日本語の1文とし、基準を満たす項目が1つも無いカテゴリは空配列にしてください。
- 出力は次の形式のJSONのみ。前後に説明・コードブロック・英語ラベルを一切付けないこと:
{"lessons": ["..."], "decisions": ["..."], "trends": ["..."]}`;

/** Summarize a period into the 3 categories. Falls back to the rule-based mock. */
export async function summarize(entries: DiaryEntry[]): Promise<Summary> {
  const count = entries.length;
  const hasContent = entries.some((e) => e.body && e.body.trim());
  if (!hasContent) return { count, lessons: [], decisions: [], trends: [] };
  if (!isGeminiConfigured()) return summarizeMock(entries);
  try {
    const out = await generate(buildSummaryPrompt(entries), {
      system: SUMMARY_SYSTEM,
      json: true,
      temperature: 0.2,
    });
    const parsed = JSON.parse(stripFences(out)) as Record<string, unknown>;
    return {
      count,
      lessons: sanitizeList(parsed.lessons),
      decisions: sanitizeList(parsed.decisions),
      trends: sanitizeList(parsed.trends),
    };
  } catch (e) {
    console.warn("[ai] summarize fell back to mock:", (e as Error).message);
    return summarizeMock(entries);
  }
}

// --- helpers for the Gemini path ------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildSummaryPrompt(entries: DiaryEntry[]): string {
  const lines = entries
    .filter((e) => e.body && e.body.trim())
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map((e) => {
      const d = new Date(e.createdAt);
      const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      return `- ${date}（体調${e.condition}/5）: ${e.body.replace(/\s+/g, " ").trim()}`;
    });
  let joined = lines.join("\n");
  const MAX = 60000;
  if (joined.length > MAX) joined = joined.slice(joined.length - MAX); // keep most recent
  return `以下は期間内の日記の記録です。\n\n${joined}\n\nこれを分析し、指定のJSON形式で3カテゴリにまとめてください。`;
}

function sanitizeList(v: unknown, cap = 10): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : String(x ?? "")))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, cap);
}

function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// ===========================================================================
// Rule-based mock — used when GEMINI_API_KEY is absent or on API errors.
// ===========================================================================

const FILLERS = [
  "えーっと", "えーと", "ええっと", "ええと", "えっと", "えーっ",
  "あのー", "あのう", "あの〜", "あのですね",
  "そのー", "えっとー", "うーんと", "うーん", "んーと", "んー",
  "えー", "あー", "なんていうか", "なんていうの",
];

export function correctTextMock(input: string): string {
  let t = input ?? "";
  t = t.replace(/　/g, " ");
  for (const f of FILLERS) t = t.split(f).join("");
  t = t.replace(/なんか、/g, "").replace(/その、/g, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/、{2,}/g, "、").replace(/。{2,}/g, "。");
  t = t
    .split("\n")
    .map((line) => line.replace(/^[\s、。]+/, "").replace(/\s+$/, ""))
    .join("\n")
    .trim();
  if (t && !/[。.!?！？\n]$/.test(t)) t += "。";
  return t;
}

const LESSON_CUES = [
  "ればよかった", "れば良かった", "ばよかった", "ば良かった", "べきだった",
  "反省", "改善", "もっと", "教訓", "学んだ", "学び", "気づいた", "気付いた",
  "後悔", "次に活か", "工夫すれ", "次は", "次回は", "今度は",
];

const DECISION_CUES = [
  "決めた", "決断", "決定", "初めて", "はじめて", "始めた", "はじめた",
  "契約", "入会", "入部", "購入", "買った", "合格", "受かった", "内定",
  "達成", "完成", "提出した", "リリース", "引っ越", "転職", "参加し", "登壇", "発表した",
];

const TOPICS: { label: string; words: string[] }[] = [
  { label: "技術学習・プログラミング", words: ["python", "プログラ", "コード", "開発", "実装", "バグ", "デバッグ", "アルゴリズム", "機械学習", "エンジニア", "リファクタ", "関数", "コンパイル"] },
  { label: "研究・学業", words: ["研究", "論文", "実験", "ゼミ", "講義", "勉強", "学習", "レポート", "課題"] },
  { label: "投資・市場分析", words: ["投資", "株", "米国株", "日本株", "市場", "相場", "トレード", "為替", "暗号資産", "仮想通貨", "ポートフォリオ", "損益", "決算"] },
  { label: "音楽活動", words: ["音楽", "オーケストラ", "演奏", "楽器", "ギター", "ピアノ", "バイオリン", "ライブ", "作曲", "合奏", "練習"] },
  { label: "ゲーム", words: ["ゲーム", "プレイ", "クリア", "攻略", "eスポーツ"] },
  { label: "運動・健康", words: ["運動", "ジム", "ランニング", "筋トレ", "走っ", "ヨガ", "トレーニング"] },
  { label: "グルメ・食", words: ["ラーメン", "食べ", "料理", "カフェ", "レストラン", "グルメ", "ランチ", "ディナー"] },
  { label: "仕事・キャリア", words: ["仕事", "就職", "面接", "インターン", "バイト", "キャリア", "会議", "プロジェクト"] },
  { label: "読書", words: ["読書", "読んだ", "小説", "書籍"] },
];

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function splitSentences(body: string): string[] {
  return body
    .split(/[。．.!?！？\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pushUnique(arr: string[], value: string) {
  const v = value.trim();
  if (v && !arr.includes(v)) arr.push(v);
}

export function summarizeMock(entries: DiaryEntry[]): Summary {
  const ordered = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const lessons: string[] = [];
  const decisions: string[] = [];

  for (const e of ordered) {
    const body = e.body ?? "";
    if (!body.trim()) continue;
    const date = shortDate(e.createdAt);
    for (const s of splitSentences(body)) {
      if (LESSON_CUES.some((m) => s.includes(m))) pushUnique(lessons, `${date} ${clip(s, 60)}`);
      if (DECISION_CUES.some((m) => s.includes(m))) pushUnique(decisions, `${date} ${clip(s, 60)}`);
    }
  }

  if (decisions.length === 0) {
    [...ordered]
      .filter((e) => e.body.trim())
      .sort((a, b) => b.body.length - a.body.length)
      .slice(0, 3)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .forEach((e) => pushUnique(decisions, `${shortDate(e.createdAt)} ${clip(e.body, 70)}`));
  }

  const topicCounts = new Map<string, number>();
  for (const e of ordered) {
    const lc = (e.body ?? "").toLowerCase();
    if (!lc.trim()) continue;
    for (const t of TOPICS) {
      if (t.words.some((w) => lc.includes(w))) {
        topicCounts.set(t.label, (topicCounts.get(t.label) ?? 0) + 1);
      }
    }
  }
  const trends = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, n]) => `${label}（${n}件の記録）`);

  const cap = (arr: string[], n: number) => arr.slice(0, n);
  return {
    count: entries.length,
    lessons: cap(lessons, 12),
    decisions: cap(decisions, 12),
    trends,
  };
}
