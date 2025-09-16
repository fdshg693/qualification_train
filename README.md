四択問題ジェネレーター＆保存アプリ（Next.js + Vercel AI SDK + Drizzle(SQLite) + shadcn風UI）

2025-09-16 時点の実装状況と使い方をまとめます。最小で動かしつつ、あとから拡張しやすい構成です。

## 実装概要

- フロント: Next.js(App Router) + TypeScript + Tailwind
- UI: shadcn風の軽量コンポーネント（Button/Input/Select/Card/Toaster）
- AI生成: Vercel AI SDK（ai + @ai-sdk/openai）
	- 一括生成のみ: `generateObject`
	- スキーマ: zod (`QuestionSchema`)
	- OPENAI_API_KEY 未設定時はモックにフォールバック
- 保存: Drizzle ORM + SQLite（ローカル `sqlite.db`）
	- サーバーアクション `saveQuestion()`
	- 一覧/検索 `/saved`

## ページ / API

- ページ
	- `/` 生成フォーム＋プレビュー＋保存ボタン
	- `/saved` 保存一覧＋検索（ジャンル/キーワード）
- API
	- `POST /api/questions/generate` 一括JSON（AI or モック）
		- body: `{ genre?: string, topic?: string }`

## セットアップ & 起動

1) 依存関係インストール

```bash
npm install
```

2) （任意）OpenAI APIキーを設定（設定しない場合はモック動作）

```bash
export OPENAI_API_KEY="sk-..."
```

3) 開発サーバー起動（http://localhost:3000）

### ジャンル管理

- 管理ページ: `/admin/genres`
- ここでジャンルの追加・編集・削除が可能です。
- トップページと保存一覧のジャンル選択はDBのジャンルから読み込みます。

```bash
npm run dev

## 使い方

1) トップページ `/`
	 - ジャンル（Select）とサブトピック（Input）を設定
	 - 「生成（モックAPI呼び出し）」: 一括JSONで問題生成
	 - 「保存」: 生成結果をDBへ保存（Toasterで結果表示）

2) 保存一覧 `/saved`
	 - 保存済みの問題を一覧表示
	 - 上部フォームでジャンル/キーワード検索

## 技術詳細

- 主要ディレクトリ/ファイル
	- `src/app/page.tsx` フロント（生成/保存/ストリーム受信）
	- `src/app/saved/page.tsx` 保存一覧・検索
	- `src/app/api/questions/generate/route.ts` generateObject 実装
	- （削除）`src/app/api/questions/generate/stream/route.ts` 旧ストリーミング実装
	- `src/app/actions.ts` `saveQuestion`, `listQuestions`
	- `src/db/schema.ts` Drizzle スキーマ（questions）
	- `drizzle.config.ts` / `drizzle/` マイグレーション

- スキーマ（zod）
	- `QuestionSchema`: `{ question: string, choices: string[4], answerIndex: 0..3, explanation: string }`

- モデル/プロバイダ
	- `@ai-sdk/openai` の `gpt-4o-mini`（変更可）

## 開発メモ

- AIキー未設定でもモックで一通り試せるようフォールバック実装
- SQLiteファイルはリポジトリ直下の `sqlite.db`
- Toasterは簡易版（必要に応じて shadcn/ui 公式の Toast に置換可能）

## 今後の拡張候補

- プロンプト強化（難易度、出題形式、誤答分布、禁止事項）
- UIのリッチ化（Badge/Toast/Empty state/ページネーション）
- 重複保存の防止、タグ管理、難易度/出典フィールド追加
- Turso 連携（libSQL）と本番DB、マイグレーション運用