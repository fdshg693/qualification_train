import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { keywords } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { generateKeywords } from '@/app/actions'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const genreId = Number(searchParams.get('genreId'))
    const parentParam = searchParams.get('parentId')
    const parentId = parentParam === 'null' ? null : (parentParam != null ? Number(parentParam) : undefined)
    const where = [
        Number.isFinite(genreId) && genreId > 0 ? eq(keywords.genreId, genreId) : undefined,
        parentId === undefined
            ? undefined
            : parentId === null
                ? sql`"parent_id" IS NULL`
                : Number.isFinite(parentId) && (parentId as number) > 0
                    ? eq(keywords.parentId, parentId as number)
                    : undefined,
    ].filter(Boolean) as any
    const rows = await db
        .select()
        .from(keywords)
        .where(where.length ? (and as any)(...where) : undefined)
        .orderBy(keywords.createdAt)
    return NextResponse.json(rows)
}

export async function POST(req: Request) {
    try {
        const json = await req.json()
        const genreId = Number(json?.genreId)
        const limit = Number(json?.limit || 20)
        const parentId = json?.parentId === null ? null : Number(json?.parentId)
        const list = await generateKeywords({ genreId, parentId, limit })
        return NextResponse.json({ keywords: list })
    } catch (e) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    }
}
