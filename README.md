四択問題ジェネレーター＆学習支援アプリ（Next.js + Vercel AI SDK + Drizzle + Postgres）

2025-09-26 時点の概要。ジャンル管理、バッチ問題生成、キーワード管理、プロンプト管理、チャット、ランダム練習を備えた最小構成の学習アプリです。サブジャンル/トピック機能は撤廃しました（詳細は下記）。

## ✅ 機能サマリ

- 2〜8 択・複数正解に対応した問題を AI またはモックで 1〜50 問まとめて生成（正解数の最小/最大を指定可）
- ジャンルで範囲指定（サブジャンル/トピックは撤廃）
- 問題の保存・検索・削除、ランダム 1 問練習
- 学習補助チャット（選択した問題を文脈に Q&A）
- ジャンルの管理 UI（追加・更新・削除）
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
- DB テーブル（抜粋）: `questions`（choices/answers/explanation は JSONB）、`genres`、`prompts`、`keywords`
- 生成後は選択肢をシャッフルし、`answerIndexes` を再マッピングして整合性を保持

## 🔌 API（主要なもの）

- POST `/api/questions/generate` … 問題をまとめて生成（count, model, minCorrect/maxCorrect, concurrency, choiceCount, promptName 等）
- POST `/api/chat` … チャット回答を返却（JSON で単発応答）
- GET `/api/genres` … 一覧取得
- GET `/api/keywords?genreId=` / POST `/api/keywords` … キーワード一覧 / 生成
- GET `/api/prompts` … プロンプト一覧（UI 側で既定にフォールバック）

※ モックモード（OPENAI_API_KEY 未設定）では、問題生成・チャットともに固定ロジック/メッセージで応答します。

## 📂 主なページ

- `/` … 生成・保存・チャット
- `/saved` … 保存一覧/検索/削除
- `/practice` … ランダム 1 問練習
- `/admin/genres` … ジャンル管理
- `/admin/keywords` … キーワード管理/生成
- `/admin/prompts` … プロンプト管理

## 🚀 セットアップ（概要）

- 依存関係をインストールし、環境変数 `DATABASE_URL` を設定（docker-compose の Postgres を利用可能）。`OPENAI_API_KEY` は任意。
- Drizzle のマイグレーションを適用してからアプリを起動。
- 開発サーバー起動後はトップページから生成/保存、各管理ページから CRUD が行えます。

### 仕様変更（2025-09-26）
- サブジャンル機能を完全削除（テーブル・API・UI）。
- questions テーブルから topic 列を削除。トピックの概念も撤廃。
- トップページの「トピック」は検索ボックスとしてのみ残し、キーワード候補のフィルタに利用。生成のテンプレ置換やAPI送信は行いません。

## 🔐 環境変数（主要）

- `DATABASE_URL`（必須）: Postgres 接続文字列
- `OPENAI_API_KEY`（任意）: 未設定時はモック

## 👀 ディレクトリ（抜粋）

- `src/app` … ページと API ルート
- `src/lib` … 生成ロジック・スキーマ・プロンプト既定
- `src/db` … Drizzle スキーマとクライアント（postgres-js）
- `src/components` … UI コンポーネント（簡易 shadcn 風）

（この README は全体像の把握を目的とした要約です。詳細実装は各ファイルを参照してください。）

## 📝 模擬試験ページ（/mock-exam）

新しく追加された模擬試験ページは、ジャンル直下のキーワードごとにAIに問題を生成させ、まとめて解答・採点・保存できるワークフローです。開発中の機能のため簡易的なUIですが、実用に耐える基本機能を備えています。

主な特徴
- ジャンルを選択すると、そのジャンル直下（親が NULL）のキーワード一覧を取得して表示します。
- キーワードはチェックで対象/除外を切り替え可能。全選択・全解除ボタンもあります。
- 生成時のパラメータとしてモデルを選べます（gpt-5 / gpt-5-mini / gpt-4.1 / gpt40 のうち一つ）。
- 各キーワードごとにユーザが指定した件数だけ問題を生成（バックエンドの `/api/questions/generate` をキーワード毎に呼び出します）。
- 生成ルール（現状）: 6択、ちょうど 3 正解（choiceCount=6, minCorrect=3, maxCorrect=3）。重複回避は「同一キーワード内」の生成文脈で行われます。

解答と採点
- ページに「解答」ボタンを1つだけ配置。これを押すと全問の正誤表示と各選択肢の解説が展開されます。
- まとめセクションはキーワードごとの集計を表示します。集計は「選んだ正解選択肢の数」/「そのキーワード内の正解選択肢の総数」です。
	例: あるキーワードで 3 問生成され、各問が 3 正解なら分母は 3×3=9。ユーザが重複なく正しい選択肢を 6 個選んでいたら 6/9 と表示します。

保存
- 「保存」ボタンを押すと、現在表示されている問題をまとめて `POST /api/mock-exams` に送信し、新設の `mock_exam_sets` テーブルに1セットとして保存します（保存は解答後に有効化されます）。保存名は任意入力でき、未入力の場合はジャンル名と時刻から自動生成します。
- 保存済みセットはドロップダウンから選択して読み込みでき、同ページ上で問題一覧を再表示できます。

実装ノート（開発者向け）
- コンポーネント: `src/components/mock-exam.tsx`（主要ロジック）
- ルート: `src/app/mock-exam/page.tsx`
- 模擬試験セット API: `src/app/api/mock-exams/route.ts` と `src/app/api/mock-exams/[id]/route.ts`
- 生成 API: `src/app/api/questions/generate/route.ts`（既存）
- キーワード取得: `GET /api/keywords?genreId=<id>&parentId=null`
- 選択肢のシャッフルと answerIndexes の再マップはクライアント側で行い、採点は original index（シャッフル前のインデックス）で判定します。

注意点
- OPENAI API キーが未設定の場合、生成はモック出力になります（デモ用）。
- 生成時にモデルや生成数を高めにすると時間と API コストが増えます。必要に応じて `concurrency` や件数を調整してください。

今後の改善案
- 生成ジョブのキャンセル、部分保存（キーワード単位）
- 選択状態の URL 共有（クエリ）やローカル保存
- まとめに「完全正解した設問数 / 設問数」などの指標を併記

