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

const SUMMARY_SYSTEM = `あなたはユーザー専属のリフレクション・コーチです。期間内の日記から、将来の本人にとって価値のある「客観的な事実」と「実践的な教訓」だけを抽出します。日々の細かいタスクや一時的な感情の揺れはノイズとして除外してください。
次の3カテゴリに分類し、それぞれ簡潔な日本語の箇条書き（各項目は1文、最大8項目）でまとめます。
- lessons（学びと次回への教訓）: 「もっとこうすれば良かった」「次はこうしよう」という具体的な改善点・反省点。
- decisions（重要な決断と事実の記録）: 主な出来事・新しい経験・キャリアや生活上の重要な判断の客観的なまとめ。
- trends（興味・関心と熱中したことの変遷）: その期間に最も時間や思考を割いた対象の傾向（例: 技術学習、投資分析、音楽活動、ゲームなど）。
該当が無いカテゴリは空配列にすること。創作や推測で埋めないこと。
出力は次の形式のJSONのみ（前後に説明やコードブロックを付けない）:
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
      temperature: 0.3,
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

// ===========================================================================
// タスク抽出（フェーズ3）— 日記保存時に「やりたいこと・やるべきこと・目標」を抽出
// ===========================================================================

const EXTRACT_SYSTEM = `あなたは、日記（音声入力された雑多な独り言を含む）から「実行可能なタスク」だけを厳密に抽出するフィルターです。音声入力では感情・願望・決意・状態がそのまま口に出されるため、それらを確実に除外してください。

# タスクの厳密な定義（次の条件を「すべて」満たすものだけを抽出する）
1. 物理的・具体的な「行動」であること（例: 買う / 行く / 予約する / 提出する / 作成する / 返信する / 解く など）。
2. 「完了したかどうか」が客観的に白黒はっきり判断できること。
3. 単なる「習慣化」「心がけ」「決意表明」「感情・状態の希望」ではないこと。

# 思考プロセス（出力前に各候補へ内部で必ず適用する。思考そのものは出力しない）
テキストから候補を見つけたら、出力前に内部でこのテストを行う:
「これは『明日やること』としてToDoリストに具体的に書き込めるアクションか？」
- 結果が No（ただの感情・継続的な目標・抽象的な意志・心がけ）であれば破棄する。
- 結果が Yes のものだけを残す。

# 出力ルール
- タスク名は簡潔な行動で表す。相対的な日付・期限の表現（今日/明日/明後日/来週/〜までに 等）はタスク名に含めない。
- 重複は避け、最大5件。
- 該当する具体的なタスクが1つも見つからない場合は、無理に捻出せず、必ず空配列 [] を返す。
- 出力はJSON配列のみ（前後に説明・コードブロック・思考過程を一切付けない）。

# 判定例
[NG例 — 抽出しない]
- 「これからも第一級陸上無線技士の勉強を頑張るぞ」（理由: 抽象的な決意表明）
- 「もっと野菜を食べるように意識する」（理由: 継続的な心がけであり単発の行動ではない）
- 「今日はすごく疲れたから明日はゆっくり休もう」（理由: 感情と状態の希望）
→ これらだけの入力に対する出力: []

[OK例 — 抽出する]
- 「明日、無線の過去問を2年分解く」 → ["無線の過去問を2年分解く"]（完了条件が明確な具体的行動）
- 「帰りにスーパーでキャベツを買う」 → ["スーパーでキャベツを買う"]（具体的なタスク）
- 「来週水曜までに〇〇株式会社にメールを返信する」 → ["〇〇株式会社にメールを返信する"]（期限とアクションが明確）`;

const INTENT_MARKERS = [
  "したい", "しよう", "する予定", "やりたい", "やらなきゃ", "やらないと",
  "しなきゃ", "しないと", "つもり", "目標", "終わらせる", "予定", "ねば",
  "買う", "行く", "までに",
];

/** 日記からタスク候補を抽出。Gemini優先、未設定/失敗時はルールベース。 */
export async function extractTasks(text: string): Promise<string[]> {
  const body = (text ?? "").trim();
  if (!body) return [];
  if (!isGeminiConfigured()) return extractTasksMock(body);
  try {
    const out = await generate(`次の日記からタスクを抽出してください。\n\n${body}`, {
      system: EXTRACT_SYSTEM,
      json: true,
      temperature: 0.1,
    });
    return sanitizeList(JSON.parse(stripFences(out)), 5);
  } catch (e) {
    console.warn("[ai] extractTasks fell back to mock:", (e as Error).message);
    return extractTasksMock(body);
  }
}

export function extractTasksMock(text: string): string[] {
  const out: string[] = [];
  for (const s of splitSentences(text)) {
    if (out.length >= 5) break;
    if (INTENT_MARKERS.some((m) => s.includes(m))) pushUnique(out, clip(s, 40));
  }
  return out;
}
