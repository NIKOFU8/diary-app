# まいにち日記

1問1答（ウィザード形式）で気軽に続けられる、スマホ最適化の個人用日記アプリ（PWA）。

- **記録**: 天気 → 体調 → 本文（音声入力＋AI整形）→ 写真（任意）→ 確認 → 保存
- **閲覧**: カレンダー（記録のある日にマーク／同日複数件も一覧）、本文キーワード検索
- **振り返り**: 期間を指定してAIが ①学びと次回への教訓 ②重要な決断と事実の記録 ③興味・関心と熱中したことの変遷 の3カテゴリに整理（ノイズとなる日々のタスク・一時的な感情は出力しない）
- **デザイン**: シンプル＆スタイリッシュ。絵文字は「天気選択」「体調選択」「音声入力ボタン」のみに限定
- **PWA**: iPhone の「ホーム画面に追加」でアプリのように使用可能

## 技術構成

| 項目 | 採用 |
| --- | --- |
| フレームワーク | Next.js 16 (App Router) / React 19 / TypeScript |
| スタイル | Tailwind CSS v4 |
| 保存先 | Supabase（設定時）／ IndexedDB（未設定時に自動フォールバック） |
| AI | 文章補正・期間要約は**差し替え可能なモック**（後で Claude / Gemini に接続） |

> 必要環境: **Node.js 20.9 以上**（Next.js 16 の要件）。Safari は 16.4 以上。

## セットアップ & 起動

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開きます。
**この時点ですべての機能が動作します**（保存先は端末内 IndexedDB）。

iPhone 実機で確認する場合は、PC と同じ Wi-Fi に接続し
`http://<PCのIP>:3000` を Safari で開いてください（`npm run dev -- -H 0.0.0.0`）。

本番ビルド:

```bash
npm run build
npm start
```

## データの保存先

`getStore()`（`src/lib/storage/index.ts`）が環境変数を見て自動で切り替えます。

- `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` の**両方**があれば Supabase
- どちらか欠ければ **IndexedDB**（設定不要・端末内のみ）

### Supabase で「認証 + クラウド保存」を有効化する（ステップ1・実装済み）

認証は **メールのワンタイムコード（6桁OTP）/ マジックリンク** によるパスワードレス方式。
`shouldCreateUser: false` により、**事前に作成した自分のアカウント以外はログイン不可**。
データは RLS（`auth.uid() = user_id`）で **DBレベルで本人の行だけ** に限定される。

1. **プロジェクト作成**: [supabase.com](https://supabase.com) で新規プロジェクトを作成。
2. **スキーマ適用**: SQL Editor で [`supabase/schema.sql`](supabase/schema.sql) を実行
   （`entries` テーブル / RLS / 検索用 `pg_trgm` インデックス / 画像バケット `diary-photos`）。
3. **自分のユーザーを作成**: Authentication → Users → **Add user** → 自分のメール＋任意のパスワード＋
   **「Auto Confirm User」にチェック**。（OTPログインなのでパスワードは実際には使いません）
4. **新規登録の無効化（推奨）**: Authentication → Sign In / Providers → Email を有効化し、
   **"Allow new users to sign up" をオフ**。アプリ側も `shouldCreateUser:false` なので二重に安全。
5. **6桁コードのメール設定**: Authentication → Email Templates → **Magic Link** の本文に
   `{{ .Token }}` を含める。例:
   ```html
   <h2>まいにち日記 ログイン</h2>
   <p>ログインコード: <strong>{{ .Token }}</strong></p>
   <p>または<a href="{{ .ConfirmationURL }}">このリンク</a>からログイン</p>
   ```
   （メール内リンクのクリックだけで良ければ変更不要。ただしPWAインストール後はコード入力の方が安定）
6. **リダイレクトURL（リンク併用時）**: Authentication → URL Configuration の Site URL / Redirect URLs に
   `http://localhost:3000` と本番URLを追加。
7. **環境変数**: Project Settings → API の Project URL と anon public key を `.env.local` に設定:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   ```
8. **再起動**: `npm run dev` を再起動。起動時にログイン画面が表示され、ログイン後は
   日記データが Supabase、写真が Storage に永続保存される。

> - anon key は公開前提のキー。秘匿不要で、データ保護は **RLS** が担保する。
> - `.env.local` 未設定なら自動で **IndexedDB（ログイン不要・開発用）** にフォールバック。
> - ローカル(IndexedDB)の既存データは Supabase へ自動移行されない（開発用データのため）。

## AI（Google Gemini 接続済み）

音声補正・サマリー生成は **Google Gemini** に接続済み。`GEMINI_API_KEY` があれば Gemini を使い、
未設定または API エラー時は **ルールベースのモックに自動フォールバック**する。

セットアップ:

1. [Google AI Studio](https://aistudio.google.com/apikey) で API キーを発行
2. `.env.local` に追加（**サーバー専用**。`NEXT_PUBLIC_` は付けない）:
   ```bash
   GEMINI_API_KEY=AIza...
   GEMINI_MODEL=gemini-2.5-flash   # 任意。未指定なら gemini-2.5-flash
   ```
3. `npm run dev` を再起動

仕組み:

- キーはサーバー側のルートハンドラ（`/api/ai/correct`・`/api/ai/summarize`）でのみ使用 → ブラウザに露出しない。
- ロジックは `src/lib/ai/engine.ts`（`correctText` / `summarize`）、Gemini 呼び出しは `src/lib/ai/gemini.ts`。
- Gemini が使えなかった場合はサーバーログに `[ai] ... fell back to mock: ...` が出る（キー/モデルの確認用）。
- モデル変更は `GEMINI_MODEL`（例: `gemini-2.0-flash`）。

> デプロイ時の堅牢化: `/api/ai/*` は現状認証なし。本番公開時は Supabase セッション検証やレート制限を加え、
> API キー濫用（Gemini クォータ消費）を防ぐのが望ましい。

## ディレクトリ構成

```
src/
  app/
    page.tsx              ホーム（記録ボタン＋最近の記録）
    record/page.tsx       記録ウィザード
    calendar/page.tsx     カレンダー＋その日の記録
    entry/[id]/page.tsx   記録の詳細／削除
    search/page.tsx       キーワード検索
    review/page.tsx       期間サマリー（AIモック）
    api/ai/{correct,summarize}/route.ts   AI ルートハンドラ
    manifest.ts / apple-icon.tsx          PWA メタデータ
  components/
    record/               ウィザードのステップ群
    BottomNav / EntryCard / ServiceWorkerRegister
  lib/
    storage/              データ層（local / supabase / 切替）
    ai/                   AI ロジック（engine=サーバー, client=ブラウザ）
    types.ts / date.ts / image.ts
public/
  sw.js                   サービスワーカー（オフライン対応）
  icon.svg                アプリアイコン
supabase/
  schema.sql              テーブル・RLS・ストレージ
```

## iPhone へのインストール（PWA）

1. Safari で本番URL（HTTPS）を開く
2. 共有メニュー →「ホーム画面に追加」
3. ホームから起動すると全画面のアプリとして使えます

## 実装ロードマップ

- **ステップ1: 認証 + クラウド保存** … ✅ 実装済み（Supabase Auth: メールOTP / RLS / Storage）
- **ステップ2: 実AIの接続** … ✅ 実装済み（Google Gemini。`GEMINI_API_KEY` 設定で有効、未設定時はモック）
- **ステップ3: 本番デプロイ（PWA）** … ⏳ Vercel 等へデプロイし iPhone でホーム画面追加
補足（その他の改善候補）:

- **リマインダー（Web Push）**: iOS 16.4+ かつ「ホーム画面に追加」が前提。VAPID + サービスワーカーで実装予定。
- **音声認識**: 現在は Web Speech API。Safari で不安定な場合は録音→クラウド文字起こし（Whisper 等）へ切り替え。
