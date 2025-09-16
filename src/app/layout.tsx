import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: '四択問題ジェネレーター',
    description: 'Vercel AI SDK + Drizzle(SQLite) + shadcn/ui を用いた四択問題生成＆保存アプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja">
            <body>
                <div className="min-h-screen">
                    <main className="container mx-auto px-4 py-6 max-w-4xl">{children}</main>
                </div>
            </body>
        </html>
    )
}
