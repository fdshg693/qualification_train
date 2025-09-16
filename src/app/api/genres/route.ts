import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { genres } from '@/db/schema'

export async function GET() {
    const rows = await db.select().from(genres).orderBy(genres.createdAt)
    return NextResponse.json(rows)
}
