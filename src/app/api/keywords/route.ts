import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { keywords } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateKeywords } from '@/app/actions'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const genreId = Number(searchParams.get('genreId'))
    const rows = await db
        .select()
        .from(keywords)
        .where(Number.isFinite(genreId) && genreId > 0 ? eq(keywords.genreId, genreId) : undefined as any)
        .orderBy(keywords.createdAt)
    return NextResponse.json(rows)
}

export async function POST(req: Request) {
    try {
        const json = await req.json()
        const genreId = Number(json?.genreId)
        const limit = Number(json?.limit || 20)
        const list = await generateKeywords({ genreId, limit })
        return NextResponse.json({ keywords: list })
    } catch (e) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    }
}
