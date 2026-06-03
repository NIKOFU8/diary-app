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

// 年間サマリー（Reduce段）用。月次サマリーを統合して年間を俯瞰する。
// 月次と同一の厳格な定義・除外基準（主観の排除・一過性の排除）を維持する。
const YEAR_REDUCE_SYSTEM = `あなたはユーザーのパーソナルAIアシスタントです。以下には「各月ごとに先に要約された振り返り（学び・決断と事実・興味と熱中）」が時系列で与えられます。これらの月次サマリーを統合し、1年間を俯瞰した最終的な振り返りを生成してください。生データではなく要約済みの素材を扱うため、年間を通した傾向や反復性を重視して取捨選択します。

各カテゴリの厳格な定義・除外基準（月次と同一）:

1. "lessons" (学びと次回への教訓):
定義: ユーザーが得た新しい知識、失敗からの反省、気づき、そこで得た未来への具体的な改善策や教訓。
- 年間で繰り返し現れた学びや特に重要度の高い教訓を優先し、似た項目は1つに統合してください。

2. "decisions" (重要な決断と事実の記録):
定義: 人生や生活における「重要な決定」、高額・特別な買い物の事実、参加した特別なイベントなど、完全なる客観的事実の記録。
【除外基準】:
- 「明日は買い物に行く」「今日は〇〇を食べた」などの日常的で些細な予定や決断は絶対に除外してください。
- 「〜と思った」「〜と感じた」などの主観的な感想や感情は事実ではないため、絶対に除外してください。年間で振り返る価値のある客観的事実・決断のみに絞ってください。

3. "trends" (興味、関心と熱中したことの変遷):
定義: その年に夢中になっていた趣味、新しく興味を持った分野、継続して調べていたこと。
【除外基準】: 年間を通して1〜2ヶ月程度しか登場しない一過性の事象は「熱中した」とは言えないため除外してください。複数の月にまたがって反復・継続して現れる事柄のみを抽出し、可能であれば年間での変遷（始まり・盛り上がり・移り変わり）が分かるようにまとめてください。

【出力時の厳格なルール】
- 月をまたいだ重複は1つに統合し、基準を満たさないノイズは確実に弾いてください。
- 各項目の文字列は「純粋な日本語のみ」とし、英語の併記や謎の記号(??&??等)は絶対に含めないでください。
- 各項目は簡潔な日本語の1文。各カテゴリ最大12項目。基準を満たす項目が無いカテゴリは空配列にしてください。
- 出力は次の形式のJSONのみ。前後に説明・コードブロック・英語ラベルを一切付けないこと:
{"lessons": ["..."], "decisions": ["..."], "trends": ["..."]}`;

export interface SummarizeOptions {
  /**
   * 年間など長期間の振り返りで階層的要約（各月→年間の Map-Reduce）を使うか。
   * 未指定の場合は対象期間の長さ（日数）から自動判定する。
   */
  longRange?: boolean;
}

/**
 * Summarize a period into the 3 categories. Falls back to the rule-based mock.
 * 長期間（年間など）は、生データを一括投入せず「各月の要約 → 年間へ統合」する
 * 階層的要約（Map-Reduce）で精度を確保する。
 */
export async function summarize(
  entries: DiaryEntry[],
  opts: SummarizeOptions = {},
): Promise<Summary> {
  const count = entries.length;
  const hasContent = entries.some((e) => e.body && e.body.trim());
  if (!hasContent) return { count, lessons: [], decisions: [], trends: [] };
  if (!isGeminiConfigured()) return summarizeMock(entries);

  const longRange = opts.longRange ?? spansLongPeriod(entries);
  if (longRange) {
    try {
      return await summarizeHierarchical(entries);
    } catch (e) {
      console.warn("[ai] hierarchical summarize fell back to flat:", (e as Error).message);
      // 階層的処理が失敗したら、従来のフラット要約に委ねる（下へフォールスルー）
    }
  }

  try {
    return await summarizeFlatGemini(entries);
  } catch (e) {
    console.warn("[ai] summarize fell back to mock:", (e as Error).message);
    return summarizeMock(entries);
  }
}

// --- 階層的要約（Map-Reduce）------------------------------------------------

/** およそ300日以上にまたがるなら「年間相当の長期間」とみなす。 */
function spansLongPeriod(entries: DiaryEntry[]): boolean {
  if (entries.length < 2) return false;
  let min = Infinity;
  let max = -Infinity;
  for (const e of entries) {
    const t = new Date(e.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
  return (max - min) / 86400000 >= 300;
}

/** JSTでの「YYYY-MM」。月境界のズレを避けるため +9h して判定する。 */
function monthKeyJST(iso: string): string {
  const t = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}`;
}

function emptySummary(count: number): Summary {
  return { count, lessons: [], decisions: [], trends: [] };
}

/** 同時実行数を制限しながら非同期処理する（Geminiのレート制限・負荷／タイムアウト対策）。 */
async function runPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

/** Map: 各月を個別に要約 → Reduce: 月次サマリーを統合して年間サマリーを生成。 */
async function summarizeHierarchical(entries: DiaryEntry[]): Promise<Summary> {
  const count = entries.length;

  // 1) 月ごとにグループ化（JST）
  const groups = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    const k = monthKeyJST(e.createdAt);
    const arr = groups.get(k);
    if (arr) arr.push(e);
    else groups.set(k, [e]);
  }
  const months = [...groups.keys()].sort();
  const monthsWithContent = months.filter((m) =>
    (groups.get(m) ?? []).some((e) => e.body && e.body.trim()),
  );
  // 実質1ヶ月以下ならフラット要約で十分（階層化の意味がない）
  if (monthsWithContent.length < 2) return summarizeFlatGemini(entries);

  // 2) Map: 各月を要約（同時実行数を絞る。月単位の失敗はその月だけ mock にフォールバック）
  const monthly = await runPool(months, 3, async (mk) => {
    const monthEntries = groups.get(mk) ?? [];
    if (!monthEntries.some((e) => e.body && e.body.trim())) {
      return { month: mk, summary: emptySummary(monthEntries.length) };
    }
    try {
      return { month: mk, summary: await summarizeFlatGemini(monthEntries) };
    } catch {
      return { month: mk, summary: summarizeMock(monthEntries) };
    }
  });

  // 3) Reduce: 月次サマリーを統合して年間サマリー
  const out = await generate(buildYearReducePrompt(monthly), {
    system: YEAR_REDUCE_SYSTEM,
    json: true,
    temperature: 0.2,
  });
  const parsed = JSON.parse(stripFences(out)) as Record<string, unknown>;
  return {
    count,
    lessons: sanitizeList(parsed.lessons, 12),
    decisions: sanitizeList(parsed.decisions, 12),
    trends: sanitizeList(parsed.trends, 12),
  };
}

function buildYearReducePrompt(monthly: { month: string; summary: Summary }[]): string {
  const fmt = (items: string[]) =>
    items.length ? items.map((x) => `  - ${x}`).join("\n") : "  - （なし）";
  const sections = monthly
    .filter(
      (m) =>
        m.summary.lessons.length || m.summary.decisions.length || m.summary.trends.length,
    )
    .map((m) =>
      [
        `## ${m.month}（記録${m.summary.count}件）`,
        `学びと次回への教訓:`,
        fmt(m.summary.lessons),
        `重要な決断と事実の記録:`,
        fmt(m.summary.decisions),
        `興味・関心と熱中したことの変遷:`,
        fmt(m.summary.trends),
      ].join("\n"),
    )
    .join("\n\n");
  return `以下は、対象期間を月ごとに先に要約した「月次サマリー」です（時系列）。\n\n${sections}\n\nこれらの月次サマリーを統合し、1年間を俯瞰した最終的な振り返りを、指定のJSON形式で3カテゴリにまとめてください。`;
}

// --- flat（単一プロンプト）要約 --------------------------------------------

/** 単一プロンプトでGeminiに要約させる（失敗時は例外を投げ、呼び出し側でフォールバックする）。 */
async function summarizeFlatGemini(entries: DiaryEntry[]): Promise<Summary> {
  const out = await generate(buildSummaryPrompt(entries), {
    system: SUMMARY_SYSTEM,
    json: true,
    temperature: 0.2,
  });
  const parsed = JSON.parse(stripFences(out)) as Record<string, unknown>;
  return {
    count: entries.length,
    lessons: sanitizeList(parsed.lessons),
    decisions: sanitizeList(parsed.decisions),
    trends: sanitizeList(parsed.trends),
  };
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
