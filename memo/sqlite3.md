(This file documents how SQLite is used in this repository and how it relates to Drizzle's migration metadata.)

## SQLite と Drizzle の共存メモ

このリポジトリでは `sqlite.db`（リポジトリ直下）が存在し、`better-sqlite3` を通じてアプリケーションから参照されています。SQLite を使う場合、`drizzle/`（マイグレーション）と `sqlite.db`（実体ファイル）の整合性に注意が必要です。

ポイント:
- `drizzle/` にあるマイグレーション SQL は SQLite 用に生成されている（drizzle.config.ts の target/driver に依存）。`npx drizzle-kit migrate` で `sqlite.db` に適用される
- `drizzle/meta/_journal.json` や `drizzle/meta/*_snapshot.json` はマイグレーションのメタ情報。`migrate` の状態確認や不整合診断に使う
- ローカルで DB を手でいじると snapshot とずれることがある。手動変更は最小限にするか、変更後 `npx drizzle-kit introspect` してスナップショットを更新する

開発・CI 運用の推奨:
- ローカル開発: 開発者の判断で `sqlite.db` を `.gitignore` に入れることを検討（ただしこのリポジトリはチェックイン済みなのでチームルールに従う）
- CI: クリーンな DB を作り `npx drizzle-kit migrate` を実行してマイグレーションが通ることを確認する。マイグレーションの副作用（カスタムSQLや function 追加など）をテストに含める

トラブルシュート例:
- `npx drizzle-kit migrate` が失敗する場合:
	- `drizzle/meta/_journal.json` を確認して、最後に適用されたマイグレーションが何かを特定する
	- `drizzle/meta/*_snapshot.json` と最新のマイグレーションSQLを比較し、差分が期待通りか検証する
	- 必要ならローカル DB をバックアップした上でリセット（削除して再作成）し、再度 `npx drizzle-kit migrate` を実行してみる（開発環境でのみ）

小結: Drizzle の meta ファイル群（`drizzle/meta`）はマイグレーションの正しい適用と差分生成にとって重要なので、手動で触らず `drizzle-kit` コマンドを中心に運用するのが安全です。

## sqlite3 コマンドの使い方（CLI 実例）

以下はローカル開発で便利な `sqlite3` コマンドの例とワンライナー集です。`sqlite3` はシェルから直接操作する軽量クライアントで、`sqlite.db` を対話的に調べたりダンプ・復元・CSV 処理を行うのに便利です。

注意: このリポジトリは `better-sqlite3` 経由で DB を利用していますが、CLI から直接変更するとマイグレーションメタと不整合が起きる可能性があります。操作前に必ずバックアップを取ってください。

### 基本: DB を開く / SQL を実行する

 - 対話モードで開く:

	 sqlite3 sqlite.db

 - ファイルを指定して1つの SQL を実行して終了する:

	 sqlite3 sqlite.db "SELECT name, sql FROM sqlite_master WHERE type='table';"

 - SQL をパイプで渡す（ファイルから実行）:

	 sqlite3 sqlite.db < schema.sql

### ヘッダー/出力フォーマット設定

 - ヘッダーと列区切りを有効にしてテーブルを表示:

	 sqlite3 -header -column sqlite.db "SELECT * FROM questions LIMIT 10;"

 - CSV 出力（ヘッダー含む）:

	 sqlite3 -header -csv sqlite.db "SELECT * FROM questions;" > questions.csv

### CSV を読み込む

 - テーブルが既にある場合、.mode csv と .import を使って CSV を読み込めます:

	 sqlite3 sqlite.db
	 sqlite> .mode csv
	 sqlite> .import /path/to/file.csv tablename

 - 注意: CSV のヘッダー行は自動で無視されないため、ヘッダーを取り除くか、一度別名テーブルへインポートしてから処理するのが安全です。

### ダンプと復元

 - データベース全体を SQL ファイルにダンプ（バックアップ）:

	 sqlite3 sqlite.db ".dump" > dump.sql

 - ダンプから新しい DB を作る:

	 sqlite3 new.db < dump.sql

 - あるテーブルだけをダンプする例:

	 sqlite3 sqlite.db ".dump questions" > questions_dump.sql

### 一時的な読み取り専用で開く

 - 誤操作を避けたい場合に読み取り専用で開く:

	 sqlite3 -readonly sqlite.db

### PRAGMA とパフォーマンス / ロックの確認

 - journal_mode の確認／設定（WAL は同時並行性が良い）:

	 sqlite3 sqlite.db "PRAGMA journal_mode;"
	 sqlite3 sqlite.db "PRAGMA journal_mode = WAL;"

 - foreign_keys の有効化（SQLite はデフォルトで制約チェックをしない場合がある）:

	 sqlite3 sqlite.db "PRAGMA foreign_keys = ON;"

 - busy_timeout（ロック待ちの最大 ms）:

	 sqlite3 sqlite.db "PRAGMA busy_timeout = 5000;"

 - page_size / cache_size などの確認:

	 sqlite3 sqlite.db "PRAGMA page_size;"
	 sqlite3 sqlite.db "PRAGMA cache_size;"

### トラブルシュート用ワンライナー

 - テーブル一覧と行数を一気に見る:

	 for t in $(sqlite3 sqlite.db "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"); do echo "-- $t --"; sqlite3 -header -column sqlite.db "SELECT COUNT(*) AS cnt FROM $t;"; done

 - DB ファイルの整合性チェック:

	 sqlite3 sqlite.db "PRAGMA integrity_check;"

 - ロックやトランザクションの問題を簡易確認（.timeout は sqlite3 クライアントのコマンド）:

	 sqlite3 sqlite.db "PRAGMA busy_timeout = 2000;" \
		 "BEGIN;" "SELECT * FROM questions LIMIT 1;" "COMMIT;"

### スクリプトからの利用例（bash）

 - 新しいバックアップを作りつつ最新10行を確認する:

	 cp sqlite.db sqlite.db.bak && sqlite3 -header -column sqlite.db "SELECT * FROM questions ORDER BY createdAt DESC LIMIT 10;"

 - マイグレーション実行前にスナップショット作成（drizzle と合わせて）:

	 sqlite3 sqlite.db ".dump" > pre_migrate_dump_$(date +%Y%m%d_%H%M%S).sql

### 補助メモ

 - GUI が欲しい場合は DB Browser for SQLite や TablePlus 等のツールが便利です。
 - Drizzle のマイグレーションと手動変更を混ぜる場合は、操作ログ（ダンプ）を必ず残すこと。手動変更は最小限に。

---


