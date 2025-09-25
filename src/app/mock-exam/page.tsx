import { db } from '@/db/client'
import { genres } from '@/db/schema'
import { MockExam } from '../../components/mock-exam'

export default async function MockExamPage() {
  const genreRows = await db.select().from(genres).orderBy(genres.createdAt)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">模擬試験</h1>
      <MockExam initialGenres={genreRows} />
    </div>
  )
}
