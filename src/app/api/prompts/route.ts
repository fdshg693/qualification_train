import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { prompts } from '@/db/schema'

export async function GET() {
    try {
        const rows = await db.select().from(prompts)
        if (!rows.length) {
            return NextResponse.json([])
        }
        return NextResponse.json(rows)
    } catch (e) {
        // テーブルが無い/エラー時は空で返す（UI側でデフォルト扱い）
        return NextResponse.json([])
    }
}
