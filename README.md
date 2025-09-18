四択問題ジェネレーター＆学習支援アプリ（Next.js + Vercel AI SDK + Drizzle(SQLite) + 軽量UI）

2025-09-18 時点の最新実装ドキュメント。最小構成から拡張しやすい形を維持しつつ、ジャンル / サブジャンル管理、バッチ問題生成、チャット学習補助、ランダム練習などを備えています。

## ✅ 機能サマリ

- 四択問題を AI もしくはモックで 1〜50 問まとめて生成
- ジャンル / サブジャンル / 任意トピック指定で出題範囲を絞り込み
- 問題の保存・検索（ジャンル / キーワード）・削除
- ランダム 1 問練習ページ `/practice`
- 学習サポートチャット（最大5問を文脈として会話 / ストリーミング表示）
- ジャンル / サブジャンル管理 UI（追加・更新・削除）
- OPENAI_API_KEY 未設定でもモック応答で一通り試行可能

## 🧱 技術スタック

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Vercel AI SDK (`ai`, `@ai-sdk/openai`) でオブジェクト生成 & ストリーム
- Drizzle ORM + better-sqlite3（ローカル `sqlite.db` を同梱）
- UI: 独自の簡易 shadcn 風コンポーネント（Button / Input / Select / Card / Toaster）
- バリデーション: zod

## 📂 主なページ

| パス | 役割 |
|------|------|
| `/` | 問題生成 / 保存 / チャット補助 |
| `/saved` | 保存済み問題の検索・閲覧・削除 |
| `/admin/genres` | ジャンル & サブジャンル管理 |
| `/practice` | ランダム 1 問練習（保存済みプールから抽出） |

## 🔌 API 一覧

| メソッド & パス | 概要 | Body / Query | 備考 |
|-----------------|------|-------------|------|
| `POST /api/questions/generate` | 四択問題を batch 生成 (1〜50) | `{ subgenre?: string, topic?: string, count?: number }` | `count` 省略時 1。`subgenre` 未指定の場合はクライアント側でジャンル名を送ってジャンル全体を範囲化 |
| `GET /api/genres` | ジャンル一覧 | なし | フロント初期ロードで使用 |
| `GET /api/subgenres?genreId=NUMBER` | サブジャンル一覧 | `genreId` | ジャンル変更時に取得 |
| `POST /api/chat` | 学習サポートチャット (ストリーミング `text/plain`) | `{ messages: {role,content}[], contextQuestions?: Question[] }` | 最大5問を system prompt に埋め込み |

※ OPENAI_API_KEY 未設定時:
* `/api/questions/generate` は決め打ちロジックでモック問題を生成
* `/api/chat` は固定テキストのモックストリームを返却

### リクエスト例: 問題生成 (5問)
```bash
curl -X POST http://localhost:3000/api/questions/generate \
	-H 'Content-Type: application/json' \
	-d '{"subgenre":"ネットワーク基礎","topic":"TCP ハンドシェイク","count":5}'
```

### レスポンス例（抜粋）
```jsonc
{
	"questions": [
		{
			"question": "(1) TCPのコネクション確立で正しい手順はどれ?",
			"choices": ["SYN → SYN-ACK → ACK", "...", "...", "..."],
			"answerIndex": 0,
			"explanation": "TCPは3-way handshake..."
		}
	]
}
```

## 🧬 データモデル (Drizzle)

| テーブル | 主なカラム | 用途 |
|----------|------------|------|
| `questions` | `genre`, `topic`, `question`, `choice0..3`, `answerIndex`, `explanation`, `createdAt` | 四択問題本体 |
| `genres` | `name`, `createdAt` | ジャンル管理 |
| `subgenres` | `genreId`, `name`, `createdAt` (複合Unique: genreId+name) | サブジャンル管理 |

Zod スキーマ `QuestionSchema` (単一問題):
```ts
{ question: string, choices: [string,string,string,string], answerIndex: 0|1|2|3, explanation: string }
```

フロント/DB 保存時は `choices` を `choice0..3` に展開。生成後に内部で解答インデックス再シャッフルを行いランダム性を確保しています（`generate-questions.ts` 内 `normalizeQuestion`）。

## 🛠 サーバーアクション

- `saveQuestion()` 単一保存
- `listQuestions()` 条件検索（ジャンル / 部分一致）
- `deleteQuestion()` 削除
- `getRandomQuestion()` ランダム 1 問（`/practice`）
- `create/update/deleteGenre()` / `create/update/deleteSubgenre()`

## 🖥 クライアント挙動ポイント

- 生成時に既存プレビュー状態をリセット
- ジャンル変更でサブジャンルを再フェッチ。未選択状態は "ジャンル全体" として扱うため空文字を送らずフロントで `(subgenre || genre)` を送信
- 問題ごとの選択肢クリック → 1 回だけ解答判定ボタン
- チャットは最後の user メッセージのみを `prompt` に使用し、最大 5 問を system に埋め込み

## 🚀 セットアップ & 起動

1. 依存関係インストール
```bash
npm install
```
2. （任意）OpenAI API キーを設定（未設定ならモック）
```bash
export OPENAI_API_KEY="sk-..."  # macOS/Linux の例
```
3. 開発サーバー
```bash
npm run dev
```
4. 型チェック / Lint
```bash
npm run typecheck
npm run lint
```

## 🗃 マイグレーション (Drizzle)

スキーマ変更時:
```bash
npm run db:generate   # 新しい SQL (drizzle/XXXX.sql) 生成
npm run db:migrate    # sqlite.db に適用
```
既存 `sqlite.db` はリポジトリに同梱。破棄したい場合は削除後 `db:migrate` を再実行。

## 🔐 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `OPENAI_API_KEY` | 任意 | 設定で本番 AI 利用。未設定時はモック生成/モックチャット |

## 👀 ディレクトリ概要

```
src/
	app/
		page.tsx               # 生成 + 保存 + チャット
		saved/page.tsx         # 保存一覧/検索/削除
		practice/page.tsx      # ランダム練習
		admin/genres/page.tsx  # ジャンル & サブジャンル管理
		api/
			questions/generate/route.ts  # バッチ生成
			chat/route.ts                 # ストリーミングチャット
			genres/route.ts               # ジャンル一覧
			subgenres/route.ts            # サブジャンル一覧
	components/
		chat.tsx               # チャット UI
		question-display.tsx   # 練習用 1 問表示
		ui/*                   # 共通 UI
	db/
		schema.ts              # Drizzle テーブル定義
		client.ts              # better-sqlite3 クライアント
	lib/
		generate-questions.ts  # バッチ生成ロジック / モック
		schema.ts              # QuestionSchema (zod)
```

## 🔄 旧ストリーミング生成について

以前存在した `api/questions/generate/stream` は削除済み。現状は同期一括生成のみ（内部でバッチ → 失敗時シングルフォールバック）。再導入する場合は NDJSON エンベロープ形式を踏襲する想定。

## 🧪 テスト/検証（手動）

1. API キー未設定で 5 問生成 → モック問題表示
2. 1 問保存 → `/saved` に反映
3. `/practice` でランダム取得（保存ゼロならメッセージ）
4. チャットで質問 → ストリーム表示（モック or 本番）
5. ジャンル追加 → トップページ Select に反映
