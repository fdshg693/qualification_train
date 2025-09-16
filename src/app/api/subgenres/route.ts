import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { subgenres } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const genreId = Number(searchParams.get('genreId'))
    const rows = await db
        .select()
        .from(subgenres)
        .where(Number.isFinite(genreId) && genreId > 0 ? eq(subgenres.genreId, genreId) : undefined as any)
        .orderBy(subgenres.createdAt)
    return NextResponse.json(rows)
}
