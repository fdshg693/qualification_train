import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
    title: '四択問題ジェネレーター',
    description: 'Vercel AI SDK + Drizzle(SQLite) + shadcn/ui を用いた四択問題生成＆保存アプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja">
            <body>
                <div className="min-h-screen">
                    <header className="bg-white border-b">
                        {/* max-w-4xl を外し横幅いっぱいを利用 */}
                        <div className="container mx-auto px-6 py-4 max-w-none flex items-center justify-between">
                            <h1 className="text-lg font-semibold">四択問題ジェネレーター</h1>
                            <nav className="flex gap-3 items-center">
                                <Link href="/" className="text-sm text-slate-700 hover:text-slate-900">ホーム</Link>
                                <Link href="/saved" className="text-sm text-slate-700 hover:text-slate-900">保存済み</Link>
                                <Link href="/practice" className="text-sm text-slate-700 hover:text-slate-900">ランダム練習</Link>
                                <Link href="/admin/genres" className="text-sm text-slate-700 hover:text-slate-900">ジャンル管理</Link>
                            </nav>
                        </div>
                    </header>
                    {/* メイン領域も最大幅制限を解除 */}
                    <main className="container mx-auto px-6 py-6 max-w-none">{children}</main>
                </div>
            </body>
        </html>
    )
}
