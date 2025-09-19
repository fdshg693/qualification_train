import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
    // ここで throw せず、起動時に気付きやすいメッセージを出す
    console.warn('[db] DATABASE_URL が設定されていません。Postgres 接続は実行時に失敗します。')
}

const client = postgres(connectionString ?? '', {
    // ssl: 'require', // 本番で必要に応じて
})

export const db = drizzle(client)
