import { listGenres, listKeywords, createKeyword, updateKeyword, deleteKeyword, generateKeywords, toggleKeywordExcluded, getKeyword } from '@/app/actions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export default async function AdminKeywordsPage({ searchParams }: { searchParams?: Promise<{ genreId?: string; parentId?: string | null }> }) {
    const genres = await listGenres()
    const sp = (await searchParams) || {}
    const fallbackId = genres[0]?.id as number | undefined
    const currentId = Number(sp?.genreId || fallbackId || 0) || fallbackId
    const rawParentId = sp?.parentId
    const parentId = rawParentId === 'null' ? null : (rawParentId ? Number(rawParentId) : null)
    const parent = parentId ? await getKeyword(parentId) : null
    // パンくず用: 祖先を辿る
    const crumbs: Array<{ id: number | null; name: string }> = []
    const currentGenre = genres.find(g => g.id === currentId)
    if (currentGenre) crumbs.push({ id: null, name: currentGenre.name })
    if (parent) {
        const stack: Array<{ id: number; name: string; parentId: number | null }> = []
        let p: any = parent
        while (p) {
            stack.unshift({ id: p.id, name: p.name, parentId: p.parentId ?? null })
            if (p.parentId) {
                // 親を辿る
                p = await getKeyword(p.parentId)
            } else {
                break
            }
        }
        for (const s of stack) crumbs.push({ id: s.id, name: s.name })
    }
    const initialKeywords = currentId ? await listKeywords({ genreId: currentId!, parentId }) : []
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
                            const limit = Number(formData.get('limit') || 5)
                            const pidValue = formData.get('parentId')
                            const pid = pidValue === 'null' ? null : (pidValue ? Number(pidValue) : null)
                            await generateKeywords({ genreId: gid, parentId: pid, limit })
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
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-600">親キーワード（省略時はトップレベル）</span>
                            <Select name="parentId" defaultValue={parentId === null ? 'null' : (parentId ? String(parentId) : 'null')} className="min-w-[12rem]">
                                <option value="null">(トップレベル)</option>
                                {parent && (
                                    <option value={parent.id}>{parent.name}</option>
                                )}
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1 w-28">
                            <span className="text-xs text-slate-600">上限数</span>
                            <Input name="limit" type="number" min={1} max={20} defaultValue={5} />
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
                    {/* パンくず */}
                    <nav className="text-sm text-slate-700 flex flex-wrap items-center gap-1">
                        {crumbs.map((c, idx) => (
                            <span key={`${c.id ?? 'top'}-${idx}`} className="flex items-center gap-1">
                                {idx > 0 && <span className="text-slate-400">›</span>}
                                {idx === crumbs.length - 1 ? (
                                    <span className="font-medium">{c.name}</span>
                                ) : (
                                    <form method="GET" className="inline">
                                        <input type="hidden" name="genreId" value={currentId ? String(currentId) : ''} />
                                        <input type="hidden" name="parentId" value={c.id ? String(c.id) : 'null'} />
                                        <button className="underline decoration-dotted hover:opacity-80" type="submit">{c.name}</button>
                                    </form>
                                )}
                            </span>
                        ))}
                    </nav>
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
                        <input type="hidden" name="parentId" value={parentId === null ? 'null' : ''} />
                        <Button type="submit" variant="outline">切り替え</Button>
                    </form>
                    <form
                        className="flex items-center gap-2"
                        action={async (formData: FormData) => {
                            'use server'
                            const gid = Number(formData.get('genreId'))
                            const name = String(formData.get('name') || '')
                            const pidValue = formData.get('parentId')
                            const pid = pidValue === 'null' ? null : (pidValue ? Number(pidValue) : null)
                            await createKeyword(gid, name, pid ?? undefined)
                        }}
                    >
                        <Select name="genreId" defaultValue={currentId ? String(currentId) : ''} className="min-w-[12rem]">
                            {!genres.length && <option value="">ジャンル未登録</option>}
                            {genres.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </Select>
                        <Select name="parentId" defaultValue={parentId === null ? 'null' : (parentId ? String(parentId) : 'null')} className="min-w-[12rem]">
                            <option value="null">(トップレベル)</option>
                            {parent && (
                                <option value={parent.id}>{parent.name}</option>
                            )}
                        </Select>
                        <Input name="name" placeholder="キーワード名" className="flex-1" />
                        <Button type="submit" variant="secondary">追加</Button>
                    </form>

                    <div className="grid gap-2">
                        {parent && (
                            <div className="text-sm text-slate-600">親: {parent.name}</div>
                        )}
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
                                <form method="GET">
                                    <input type="hidden" name="genreId" value={currentId ? String(currentId) : ''} />
                                    <input type="hidden" name="parentId" value={String(k.id)} />
                                    <Button type="submit" size="sm" variant="outline">子を見る</Button>
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
                    {parent && (
                        <form method="GET" className="mt-3">
                            <input type="hidden" name="genreId" value={currentId ? String(currentId) : ''} />
                            <input type="hidden" name="parentId" value={'null'} />
                            <Button type="submit" variant="outline">トップへ戻る</Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
