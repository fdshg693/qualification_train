
# Drizzle ORM まとめ

## 概要
TypeScriptファーストの軽量ORM。TSでスキーマを定義して型安全なクエリを実現しつつ、生成されるSQLは読みやすく手で調整しやすい。サーバレスやエッジ環境、SQLite/Postgres/MySQL に対応しており、コールドスタートや軽量ランタイムを重視するプロジェクトと相性が良い。

## 基本ワークフロー
- TSでスキーマを定義（テーブル/カラム/型）
- マイグレーション生成（差分からSQLを作る）
- 生成されたSQLをレビューしてDBへ適用
- 実行時は型安全なクエリビルダ/関数で操作

## drizzle/ ディレクトリの構成と各ファイルの意味
このプロジェクトでは `drizzle/` ディレクトリがリポジトリに含まれており、マイグレーションSQLファイルやメタ情報が出力されます。以下は `drizzle/` とその下位にある `meta/` に置かれる主要なファイルと用途の一覧です。`drizzle-kit` による生成・適用のワークフローと合わせて理解してください。

注意: Drizzle はツール群（drizzle-kit）でスキーマからSQL差分を生成したり、DBに適用したりします。生成されるファイル名やフォルダ構成は `drizzle.config.ts` の設定や drizzle-kit のバージョンで若干変わる可能性があります。

### drizzle/ 配下の代表的なファイル
- `0000_flawless_sheva_callister.sql`, `0001_add_genres_table.sql`, ...（数字で始まるファイル）
	- マイグレーション用の SQL ファイル。
	- 通常は `npx drizzle-kit generate` により TypeScript のスキーマ等から差分SQLを生成し、`migrate` 時に適用される。ファイル名はタイムスタンプやシーケンス番号（ゼロパディング）で管理され、変更履歴としてコミットされます。
	- 役割: スキーマ変更の説明書として人が読める形で保存し、CI や手動で `npx drizzle-kit migrate` を実行することで DB に適用される。

- `meta/` ディレクトリ
	- マイグレーションの状態やスナップショットなどメタ情報を格納するフォルダ。
	- Drizzle の内部管理用であり、手で編集することは基本的に推奨されません。

### drizzle/meta/ にあるファイルの説明
- `_journal.json`
	- マイグレーションがどのように適用されたかの逐次ログ／ジャーナル。
	- 複数のマイグレーション適用があった場合の履歴や適用順序、失敗情報などが記録されます。
	- 用途: 過去の適用状態を辿る、ロールバックや適用済みチェックに用いる。

- `0000_snapshot.json`, `0001_snapshot.json`, ...
	- スキーマのスナップショット（ある時点のメタ情報）。drizzle-kit がスキーマのベースラインを管理するために利用します。
	- 生成のタイミング: `npx drizzle-kit generate` や `introspect` 実行時に更新されることがある。
	- 役割: 差分生成 (generate) のために「現在のスキーマ状態」を比較する基準として使われます。

### 生成・適用フローとファイルの関係
- 開発者がスキーマ（TS スキーマ/Drizzle schema）を変更
- `npx drizzle-kit generate` を実行 → `drizzle/` に新しい SQL マイグレーションファイル（例: `0002_add_xxx.sql`） と `meta/` のスナップショットが更新される
- 生成した SQL をコードレビュー・コミット
- CI またはローカルで `npx drizzle-kit migrate` を実行 → SQL が DB に適用され、`meta/_journal.json` や snapshot が更新される

### 運用上の注意点
- `drizzle/meta` の手動編集は危険（不整合を招く）なので基本は自動ツールに任せる
- マイグレーション SQL はレビューの対象にし、DB固有の SQL（例えばカスタム関数や INDEX）を含める場合はコメントで理由を書く
- `sqlite.db` のようなローカル DB をリポジトリで管理している場合、マイグレーションと DB ファイルの状態に注意。CI ではクリーンな DB を使ってマイグレーションを走らせることを推奨

### トラブルシューティングのヒント
- `npx drizzle-kit migrate` が失敗する場合:
	- まず `drizzle/meta/_journal.json` や `drizzle/meta/*_snapshot.json` と生成された SQL を確認し、期待どおりの差分になっているか確認する
	- ローカル `sqlite.db` の状態とスナップショットがずれているなら、バックアップを取りつつ手動で調整するか、一旦 DB を再生成してマイグレーションをやり直す（開発環境に限る）

### 参考コマンド（要プロジェクトの `drizzle.config.ts` 設定）
- `npx drizzle-kit generate` — スキーマ差分から SQL を生成して `drizzle/` に出力
- `npx drizzle-kit migrate` — `drizzle/` の SQL を DB に適用
- `npx drizzle-kit introspect` — 既存 DB からスキーマを逆生成（スキーマ/スナップショットの作成に便利）
- `npx drizzle-kit studio` — Drizzle Studio を起動（UIでスキーマ/データを閲覧）

---

追記: このリポジトリの `drizzle/` 中身は実際に
```
drizzle/
	0000_flawless_sheva_callister.sql
	0001_add_genres_table.sql
	meta/
		_journal.json
		0000_snapshot.json
		0001_snapshot.json
```
のようになっており、上記の説明はこの構成を前提に書かれています。

## 強み
- 型安全性が高く、IDEの補完が効く
- ランタイムが軽い（外部クエリエンジン不要）ためコールドスタート有利
- 生成SQLが読みやすく、必要なら直接編集できる
- サーバレス/エッジに適した設計

## 弱み・注意点
- 高度なORM抽象（自動で複雑リレーションを解決する機能）は最小限
- Prisma ほどのエコシステム・GUIやプラグインはまだ限定的
- SQLやDB設計の理解があると使いやすい（内部でSQLを書く場面が出る）

## 他ツールとの比較（短評）
- Prisma: DX・リレーション操作・Studio は強力。だがクエリエンジン依存で重め、エッジでの制約がある場面も。
- TypeORM: 伝統的なORM。機能は幅広いが型安全・現代的なDXではやや劣る。
- Kysely: 型安全なSQLビルダ。ORM機能は薄く、細かく制御したいなら好適。
- Knex: 実績あるクエリビルダ＋マイグレーション。型安全性は弱いが自由度高い。

## よく使うコマンド（drizzle-kit）
- マイグレーション生成:
	- `npx drizzle-kit generate`  （TSスキーマからSQL差分を生成）
- マイグレーション適用:
	- `npx drizzle-kit migrate`   （生成SQLをDBに適用）
- スキーマ強制反映（限定的）:
	- `npx drizzle-kit push`
- 既存DBからスキーマ逆生成:
	- `npx drizzle-kit introspect`
- Drizzle Studio（ブラウザUI）起動:
	- `npx drizzle-kit studio`

備考: ルートの `drizzle.config.ts` を参照して接続情報／出力先を設定する。生成SQLは自動適用前に必ずレビューすること。

## Next.js + SQLite（運用メモ）
- SQLite（`better-sqlite3`）はローカル開発や軽量アプリに最適。リード/ライト同時アクセスや複数インスタンスでの運用は注意。
- Next.js のサーバーサイド処理（Server Actions / API routes）から直接 Drizzle を呼ぶ構成がシンプル。

## ベストプラクティス & Tips
- スキーマは型の「唯一の真実」として保つ。UI/APIの型と同期させる。
- マイグレーションはCIで検証し、自動適用は慎重に（特に本番環境）
- 複雑なクエリはSQLそのものを書いて性能最適化する余地を残す

## まとめ
小〜中規模で型安全性と軽量性を重視するプロジェクトに向いたORM。Prisma のようなフルスタックDXを求める場合は比較検討するが、エッジ適性やシンプルな運用を重視するならDrizzleが有力。

