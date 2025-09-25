四択問題ジェネレーター＆学習支援アプリ（Next.js + Vercel AI SDK + Drizzle + Postgres）

2025-09-25 時点の概要。ジャンル/サブジャンル管理、バッチ問題生成、キーワード管理、プロンプト管理、チャット、ランダム練習を備えた最小構成の学習アプリです。

## ✅ 機能サマリ

- 2〜8 択・複数正解に対応した問題を AI またはモックで 1〜50 問まとめて生成（正解数の最小/最大を指定可）
- ジャンル / サブジャンル / 任意トピックで範囲指定
- 問題の保存・検索・削除、ランダム 1 問練習
- 学習補助チャット（選択した問題を文脈に Q&A）
- ジャンル / サブジャンルの管理 UI（追加・更新・削除）
- キーワードの生成・管理（ジャンル単位、重複はユニーク制約で抑止）
- プロンプトテンプレートの管理（テンプレートと任意の system プロンプト）
- OPENAI_API_KEY 未設定でもモックで一通り試せます

## 🧱 技術スタック（要点のみ）

- Next.js 15（App Router）+ TypeScript + Tailwind
- Vercel AI SDK（問題生成は JSON オブジェクト生成、チャットはテキスト生成）
- Drizzle ORM + Postgres（docker-compose で同梱の Postgres を利用）
- zod（入出力バリデーション）

## データと契約（ハイレベル）

- 問題オブジェクト: `{ question, choices(2..8), answerIndexes(一意な番号配列), explanations(選択肢ごとの解説) }`
- DB テーブル（抜粋）: `questions`（choices/answers/explanation は JSONB）、`genres`、`subgenres`（複合一意: genreId+name）、`prompts`、`keywords`
- 生成後は選択肢をシャッフルし、`answerIndexes` を再マッピングして整合性を保持

## 🔌 API（主要なもの）

- POST `/api/questions/generate` … 問題をまとめて生成（count, model, minCorrect/maxCorrect, concurrency, choiceCount, promptName 等）
- POST `/api/chat` … チャット回答を返却（JSON で単発応答）
- GET `/api/genres` / `/api/subgenres?genreId=` … 一覧取得
- GET `/api/keywords?genreId=` / POST `/api/keywords` … キーワード一覧 / 生成
- GET `/api/prompts` … プロンプト一覧（UI 側で既定にフォールバック）

※ モックモード（OPENAI_API_KEY 未設定）では、問題生成・チャットともに固定ロジック/メッセージで応答します。

## 📂 主なページ

- `/` … 生成・保存・チャット
- `/saved` … 保存一覧/検索/削除
- `/practice` … ランダム 1 問練習
- `/admin/genres` … ジャンル & サブジャンル管理
- `/admin/keywords` … キーワード管理/生成
- `/admin/prompts` … プロンプト管理

## 🚀 セットアップ（概要）

- 依存関係をインストールし、環境変数 `DATABASE_URL` を設定（docker-compose の Postgres を利用可能）。`OPENAI_API_KEY` は任意。
- Drizzle のマイグレーションを適用してからアプリを起動。
- 開発サーバー起動後はトップページから生成/保存、各管理ページから CRUD が行えます。

## 🔐 環境変数（主要）

- `DATABASE_URL`（必須）: Postgres 接続文字列
- `OPENAI_API_KEY`（任意）: 未設定時はモック

## 👀 ディレクトリ（抜粋）

- `src/app` … ページと API ルート
- `src/lib` … 生成ロジック・スキーマ・プロンプト既定
- `src/db` … Drizzle スキーマとクライアント（postgres-js）
- `src/components` … UI コンポーネント（簡易 shadcn 風）

（この README は全体像の把握を目的とした要約です。詳細実装は各ファイルを参照してください。）
