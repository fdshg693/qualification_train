# 複数選択問題（0〜4個の正解）対応：2つの方針

目的: 現行の「四択・正解1つ」モデルに加えて、「0〜4個の正解（複数選択）」を導入する。

このドキュメントは 2 つの実装方針を示す。
- 方針A（推奨）: 破壊的だがシンプルな再設計（DB を作り直し、契約を一本化）
- 方針B: 非破壊の段階的移行（既存スキーマに追加しつつ併存）

Next.js 15 + Drizzle + SQLite + Vercel AI SDK の既存構成に追従。

---

## 方針A（推奨）: 破壊的・シンプル再設計

「DB は一から作り直してもOK」という前提で、設計/コードを最短でシンプルに保つ。

### A-1. 新データモデル（DB）
- テーブル: `questions`
	- `id`: integer PK autoincrement
	- `genre`: text not null（既存踏襲）
	- `topic`: text null
	- `question`: text not null
	- `choices_json`: text not null（JSON: string[]。当面は4択を前提、将来は可変に拡張可能）
	- `answers_json`: text not null（JSON: number[]。0〜4個、重複なし、各値は選択肢のインデックス）
	- `explanation`: text not null
	- `created_at`: integer(timestamp_ms) not null default now

備考:
- 既存の `choice0..3` と `answerIndex` は完全に廃止。
- JSON で choices/answers を保持することで、フロント/生成/保存の契約が単純化し、将来の「選択肢数の可変」も楽になる。
- `genres`/`subgenres` テーブルは現状維持（FK化は別論点）。

Drizzle 定義（イメージ）:
```
export const questions = sqliteTable('questions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	genre: text('genre').notNull(),
	topic: text('topic'),
	question: text('question').notNull(),
	choicesJson: text('choices_json').notNull(), // JSON.stringify(string[])
	answersJson: text('answers_json').notNull(), // JSON.stringify(number[])
	explanation: text('explanation').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(strftime('%s','now')*1000)`),
})
```

### A-2. アプリ契約（Zod）
- `src/lib/schema.ts` の `QuestionSchema` を刷新:
	- `choices: z.array(z.string()).length(4)`（当面4固定。将来は `.min(2).max(6)` 等に変更可）
	- `answerIndexes: z.array(z.number().int().min(0)).max(4)`（重複チェックは refine）
	- `explanation: z.string()`
- 旧 `answerIndex` は完全廃止。

契約の要点（Contract）:
- 入力/出力とも `answerIndexes: number[]` に統一。配列長が 0..4。
- 採点は集合一致（選択集合==正解集合）で正解。

### A-3. 生成ロジック（V2 のみ）
- `src/lib/generate-questions.ts` を V2 専用に置換/簡素化。
	- 生成スキーマは `{ question, choices: string[4], answerIndexes: number[], explanation }`。
	- `normalizeQuestionV2`: 選択肢シャッフル後、`answerIndexes` を新しいインデックスへ再マッピング。
	- モック分岐も V2 に合わせる。

### A-4. サーバーアクション/API
- 保存: `saveQuestion` を新契約に変更
	- `choices: string[4]`, `answerIndexes: number[]` を受け取り、JSON で保存。
- 取得: `listQuestions`, `getRandomQuestion` は JSON を parse して返す。
- API `/api/questions/generate` は V2 形のみを返す（`mode` パラメータ不要）。

### A-5. UI
- `src/components/question-display.tsx` を複数選択 UI に一本化。
	- 選択はチェックボックス or タップトグル。
	- 採点は集合一致。局所ハイライト（正/誤/未選択の正解）も実装。
- `src/app/page.tsx` のプレビュー/保存も新契約に更新。

### A-6. 破壊的移行手順
選択肢（環境に応じてどちらか）:

1) フレッシュリセット（ローカル・開発）
- 既存 DB/マイグレーションを破棄し、新スキーマで再初期化。
	- `rm sqlite.db -f`
	- `rm -rf drizzle/`
	- スキーマ更新後: `npm run db:generate && npm run db:migrate`

2) 破壊的マイグレーション（本番一発切り替え）
- 1本のマイグレーションで `questions` を DROP→CREATE。
- ダウンタイム/メンテ時間を確保。既存データは必要に応じて事前エクスポート/後インポート。

オプション: 旧DB→新形式への簡易変換
- 旧 `choice0..3` と `answerIndex` から `choices_json`, `answers_json` へ:
	- `choices_json = JSON.stringify([choice0,choice1,choice2,choice3])`
	- `answers_json = JSON.stringify([answerIndex])`
- 一時的に Node スクリプト/SQL で移行可。完全な再作成が許容なら省略可。

### A-7. 受け入れ基準 / テスト観点
- 生成: `answerIndexes` が 0..3 の重複なし整数配列で返る。
- 保存→取得: JSON round-trip が等価。
- UI 採点: 完全一致で正解。部分表示の色分けが意図通り。
- 型安全: `npm run typecheck` でエラー無し。

---

