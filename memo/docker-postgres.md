# Docker 上の Postgres 操作用メモ

このファイルはローカル開発で Docker Compose を使った Postgres コンテナを操作するためのコマンド集（日本語）です。`
`docker compose` を使う前提で例を示します。必要に応じて `docker-compose` に置き換えてください。

---

## 基本：サービスの状態確認

- 全サービスの起動（デタッチ）

```bash
docker compose up -d
```

- 稼働中のコンテナ一覧

```bash
docker compose ps
```

- コンテナログ（`db` サービスの最新ログ）

```bash
docker compose logs --follow db
```

## Postgres に接続する（コンテナ内の psql を利用）

- コンテナ内で `psql` を実行してデータベースに入る（ユーザー/DB 名は compose 定義に合わせて変更）

```bash
docker compose exec db psql -U postgres -d qualification_train
```

- 非対話で SQL を実行して終了（例：テーブル一覧）

```bash
docker compose exec db psql -U postgres -d qualification_train -c "\dt public.*"
```

## テーブルの構造確認

- `
`psql` 内でテーブルの詳細を表示

```sql
\d+ public.questions
```

- 情報スキーマからカラム一覧を取得（非対話）

```bash
docker compose exec db psql -U postgres -d qualification_train -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='questions';"
```

## よく使うクエリ（非対話一発）

- レコード数を確認

```bash
docker compose exec db psql -U postgres -d qualification_train -c "SELECT COUNT(*) FROM public.questions;"
```

- サンプル行を取得（上位 5 行）

```bash
docker compose exec db psql -U postgres -d qualification_train -c "SELECT * FROM public.questions LIMIT 5;"
```

## マイグレーション確認（Drizzle / SQL ファイルベースの例）

- `drizzle` のマイグレーションを実行している場合、アプリ側で `npm run db:migrate` を実行することが多いです。コンテナ内で実行している場合は、該当コンテナでコマンドを叩いてログを確認します。

```bash
# ローカルで実行済みならアプリ logs を確認
docker compose logs --follow app

# またはマイグレーションコマンドをコンテナ内で実行する例
docker compose exec app npm run db:migrate
```

マイグレーションが成功していれば、`CREATE TABLE` / `ALTER TABLE` 等のログや、`drizzle` が管理する `drizzle_migrations` 相当のテーブルが作成されます（プロジェクトごとに名称が異なることがあります）。

## バックアップ / リストア

- コンテナ外へダンプを作る（`pg_dump` を使う）

```bash
docker compose exec db pg_dump -U postgres -d qualification_train > qualification_train.sql
```

- ダンプファイルをコンテナ内に流し込む（リストア）

```bash
cat qualification_train.sql | docker compose exec -T db psql -U postgres -d qualification_train
```

## ホストから直接接続する（必要に応じて）

- Compose 側でポートが公開されていると、ホストの `psql` で接続可能：

```bash
psql postgresql://postgres@localhost:5432/qualification_train
```

接続できない場合は `docker compose ps` でポート公開確認、`docker compose logs db` でエラー確認を行ってください。

## トラブルシュートのヒント

- コンテナが起動しない：`docker compose logs db` を確認。
- psql がコンテナ内で見つからない：イメージに `postgres` クライアントが入っているか確認。代替として `docker compose run --rm --entrypoint psql postgres` のように公式イメージを一時起動して接続可能。
- 認証エラー：`POSTGRES_PASSWORD` 等の env が合っているか、`docker compose exec db env` で確認。

---

メモは必要に応じて追加します。実行中に出たエラーや、よく使うワンライナーがあればここに追記してください。

