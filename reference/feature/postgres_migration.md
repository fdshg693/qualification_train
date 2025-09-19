# Postgres 移行計画（破壊的 OK / 既存データ破棄）

目的: 現在の SQLite + better-sqlite3 + Drizzle 構成を、PostgreSQL + Drizzle に移行する。既存データは保持しない前提でスキーマ最適化も許容する。

---

## 方針サマリ
- ランタイムドライバは `postgres`（postgres.js）を採用し、`drizzle-orm/postgres-js` を使用。
- `drizzle.config.ts` を `dialect: 'postgresql'` に変更し、`DATABASE_URL` で接続。
- `src/db/schema.ts` を `pg-core` へ移行（`pgTable`, `serial`, `text`, `timestamp`, `jsonb` 等）。
- SQLite 固有の実装を Postgres 等価に置換（例: `RANDOM()` → `random()`）。
- 破壊的移行のため、`drizzle/` を再生成し、DB を新規作成する（既存 `sqlite.db` は廃止）。
- JSON 列は Postgres の `jsonb` を活用し、アプリ側の stringify/parse を削減（必要な最小限のコード変更を同時に実施）。

---

## 依存関係の変更
- 削除: `better-sqlite3`, `@types/better-sqlite3`
- 追加: `postgres`（または `pg` でも可。ここでは `postgres` を推奨）

インストール例:
```bash
npm remove better-sqlite3 @types/better-sqlite3
npm i -E postgres
```

---

## 接続情報 / 環境変数
`.env`（またはデプロイ先の環境変数）に `DATABASE_URL` を定義:
```
DATABASE_URL=postgres://<USER>:<PASSWORD>@<HOST>:<PORT>/<DBNAME>
```

ローカル用（Docker 一例）:
```bash
docker run --name qual-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=qualification -p 5432:5432 -d postgres:16
# 接続例: postgres://postgres:postgres@localhost:5432/qualification
```

---

## 設定ファイルの変更
### `drizzle.config.ts`
```ts
import type { Config } from 'drizzle-kit'

export default {
	schema: './src/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
} satisfies Config
```

### `src/db/client.ts`
postgres.js + Drizzle に置換:
```ts
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const client = postgres(process.env.DATABASE_URL!, {
	// ssl: 'require', // 本番（Neon/Supabase 等）で必要に応じて
})

export const db = drizzle(client)
```

---

## スキーマ移行（`src/db/schema.ts`）
現状（SQLite）:
- テーブル: `questions`, `genres`, `subgenres`
- `questions` は `choicesJson`/`answersJson` を TEXT(JSON 文字列)で保持
- 時刻は `integer('created_at', { mode: 'timestamp_ms' })`（ミリ秒）

Postgres では次を推奨:
- `choices` と `answers` を `jsonb` 列に変更（配列として型安全に扱える）
- 時刻は `timestamp`（`defaultNow()`）に変更
- 参照整合性/ユニーク制約は現状踏襲

例（概念スニペット。実装時に置換）:
```ts
import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'

export const genres = pgTable('genres', {
	id: serial('id').primaryKey(),
	name: text('name').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
})

export const subgenres = pgTable(
	'subgenres',
	{
		id: serial('id').primaryKey(),
		genreId: integer('genre_id').notNull().references(() => genres.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => ({
		subgenresGenreIdNameUnique: uniqueIndex('subgenres_genre_id_name_unique').on(t.genreId, t.name),
	})
)

export const questions = pgTable('questions', {
	id: serial('id').primaryKey(),
	genre: text('genre').notNull(),
	topic: text('topic'),
	question: text('question').notNull(),
	choices: jsonb('choices').$type<string[]>().notNull(),
	answers: jsonb('answers').$type<number[]>().notNull(),
	explanation: text('explanation').notNull(),
	createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
})
```

注意:
- 既存コードは `choicesJson`/`answersJson` に対して `JSON.stringify/parse` しているため、`jsonb` 化する場合はアプリ側の読み書きを修正する（下記参照）。
- 互換性重視でテキスト JSON のままにする選択も可能（`text('choices_json')` 等を維持）。その場合は Postgres でもそのまま動作する。

---

## アプリ側コード調整ポイント
1) ランダム 1 件取得（SQLite → Postgres）
- `orderBy(sql\`RANDOM()\`)` は Postgres では `random()` を使用。

2) JSON 列の扱い
- `jsonb` 採用時:
	- 保存時: `choices`/`answers` をそのまま配列で渡す（stringify 不要）
	- 取得時: `q.choices`/`q.answers` はそのまま配列として扱える（parse 不要）
- テキスト JSON 維持時:
	- 既存どおり `JSON.stringify` / `JSON.parse` を継続

変更イメージ（`jsonb` 採用時）:
```ts
// saveQuestion
await db.insert(questions).values({
	genre: params.genre,
	topic: params.topic ?? null,
	question: params.question,
	choices: params.choices, // そのまま
	answers: Array.from(new Set((params.answerIndexes ?? []).filter((i) => i >= 0 && i < 4))).sort((a,b)=>a-b),
	explanation: params.explanation,
})

// getRandomQuestion
const row = await db.select().from(questions).orderBy(sql`random()`).limit(1)
if (!row.length) return null
const q = row[0]
return {
	id: q.id,
	genre: q.genre,
	topic: q.topic ?? undefined,
	question: q.question,
	choices: q.choices as [string,string,string,string],
	answerIndexes: q.answers as number[],
	explanation: q.explanation,
	createdAt: q.createdAt,
}
```

3) `createdAt` の型
- これまで: number(ミリ秒)
- Postgres: `timestamp`（JS では `Date` として扱われる）
- UI 影響最小にするなら、`createdAtMs` を `bigint`/`integer` で持つ設計も可。今回は簡素化のため `timestamp` を使用する前提（必要なら UI 側で `new Date(q.createdAt)` へ調整）。

---

## マイグレーション運用
破壊的移行（新規作成）手順:
```bash
# 1) SQLite 資材の掃除（任意）
rm -f sqlite.db
rm -rf drizzle

# 2) Drizzle 生成（Postgres）
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/qualification
npm run db:generate
npm run db:migrate
```

マイグレーションで作られる SQL は `drizzle/` 以下に出力される。レビュー後にコミットする。

---

## ロールアウト手順（まとめ）
1. 依存関係の更新（`postgres` を追加、`better-sqlite3` を削除）
2. `drizzle.config.ts` を Postgres 化
3. `src/db/client.ts` を Postgres クライアントへ置換
4. `src/db/schema.ts` を `pg-core` へ移行（`jsonb` 採用 or 既存 TEXT JSON 維持）
5. `src/app/actions.ts` の `random()`、JSON 取り扱い、`createdAt` の型差分を反映
6. `drizzle` を再生成して `migrate`
7. `npm run dev` で起動確認

---

## 既知の差分/注意点
- SQL 方言差分: `RANDOM()` → `random()`、`strftime` → Postgres では `now()` 等を使用
- タイムスタンプ: ミリ秒整数から `timestamp` へ（UI での表示整形を見直し）
- JSON: `jsonb` を使うとインデックスやクエリ（`@>` 等）も活用可能
- 文字コード/照合順序: Postgres のロケール/Collation 仕様に従う

---

## 代替案（簡易・互換優先）
アプリ側の変更を最小化したい場合:
- `questions` の列名と型を SQLite と同名・同意味で維持
	- `choicesJson: text('choices_json').notNull()`
	- `answersJson: text('answers_json').notNull()`
	- `createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(EXTRACT(EPOCH FROM now())*1000)` as any)`
- これにより `actions.ts` のロジックは最小変更（`random()` 置換のみ）で動作

---

## 次のアクション
- この計画に沿ってコード変更を行い、`jsonb` を採用するか、既存 TEXT JSON を維持するかを選択
- 選択に応じて `schema.ts` と `actions.ts` の差分を実装し、`db:generate` → `db:migrate`
- 起動・動作をローカルで確認後、デプロイ先の `DATABASE_URL` を設定

以上。

