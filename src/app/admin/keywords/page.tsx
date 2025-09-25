import { listGenres, listKeywords, createKeyword, updateKeyword, deleteKeyword, generateKeywords, toggleKeywordExcluded } from '@/app/actions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export default async function AdminKeywordsPage({ searchParams }: { searchParams?: Promise<{ genreId?: string }> }) {
    const genres = await listGenres()
    const sp = (await searchParams) || {}
    const fallbackId = genres[0]?.id as number | undefined
    const currentId = Number(sp?.genreId || fallbackId || 0) || fallbackId
    const initialKeywords = currentId ? await listKeywords({ genreId: currentId }) : []
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">キーワード管理</h1>

            <Card>
                <CardHeader className="flex items-center justify-between">
                    <div className="font-medium">生成</div>
                </CardHeader>
                <CardContent>
                    <form
                        className="flex flex-wrap items-end gap-2"
                        action={async (formData: FormData) => {
                            'use server'
                            const gid = Number(formData.get('genreId'))
                            const limit = Number(formData.get('limit') || 50)
                            await generateKeywords({ genreId: gid, limit })
                        }}
                    >
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-600">ジャンル</span>
                            <Select name="genreId" defaultValue={currentId ? String(currentId) : ''} className="min-w-[12rem]">
                                {!genres.length && <option value="">ジャンル未登録</option>}
                                {genres.map((g) => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1 w-28">
                            <span className="text-xs text-slate-600">上限数</span>
                            <Input name="limit" type="number" min={1} max={200} defaultValue={50} />
                        </div>
                        <Button type="submit">AIで生成</Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex items-center justify-between">
                    <div className="font-medium">一覧 / 手動追加</div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <form method="GET" className="flex items-end gap-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-600">表示するジャンル</span>
                            <Select name="genreId" defaultValue={currentId ? String(currentId) : ''} className="min-w-[12rem]">
                                {!genres.length && <option value="">ジャンル未登録</option>}
                                {genres.map((g) => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </Select>
                        </div>
                        <Button type="submit" variant="outline">切り替え</Button>
                    </form>
                    <form
                        className="flex items-center gap-2"
                        action={async (formData: FormData) => {
                            'use server'
                            const gid = Number(formData.get('genreId'))
                            const name = String(formData.get('name') || '')
                            await createKeyword(gid, name)
                        }}
                    >
                        <Select name="genreId" defaultValue={currentId ? String(currentId) : ''} className="min-w-[12rem]">
                            {!genres.length && <option value="">ジャンル未登録</option>}
                            {genres.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </Select>
                        <Input name="name" placeholder="キーワード名" className="flex-1" />
                        <Button type="submit" variant="secondary">追加</Button>
                    </form>

                    <div className="grid gap-2">
                        {initialKeywords.map((k) => (
                            <div key={k.id} className="flex items-center gap-2">
                                <form
                                    className="flex items-center gap-2 flex-1"
                                    action={async (formData: FormData) => {
                                        'use server'
                                        const id = Number(formData.get('id'))
                                        const name = String(formData.get('name') || '')
                                        await updateKeyword(id, name)
                                    }}
                                >
                                    <input type="hidden" name="id" defaultValue={k.id} />
                                    <Input name="name" defaultValue={k.name} className="flex-1" />
                                    <span className={`text-xs px-2 py-1 rounded border ${k.excluded ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                        {k.excluded ? '除外中' : '対象'}
                                    </span>
                                    <Button type="submit" size="sm" variant="secondary">更新</Button>
                                </form>
                                <form
                                    action={async (formData: FormData) => {
                                        'use server'
                                        const id = Number(formData.get('id'))
                                        await toggleKeywordExcluded(id)
                                    }}
                                >
                                    <input type="hidden" name="id" defaultValue={k.id} />
                                    <Button type="submit" size="sm" variant={k.excluded ? 'secondary' : 'outline'}>
                                        {k.excluded ? '除外解除' : '除外'}
                                    </Button>
                                </form>
                                <form
                                    action={async (formData: FormData) => {
                                        'use server'
                                        const id = Number(formData.get('id'))
                                        await deleteKeyword(id)
                                    }}
                                >
                                    <input type="hidden" name="id" defaultValue={k.id} />
                                    <Button type="submit" size="sm" variant="outline">削除</Button>
                                </form>
                            </div>
                        ))}
                        {!initialKeywords.length && (
                            <div className="text-xs text-slate-500">まだキーワードがありません</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
