import { createGenre, deleteGenre, listGenres, updateGenre, listSubgenres, createSubgenre, updateSubgenre, deleteSubgenre } from '../../actions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default async function AdminGenresPage() {
    const rows = await listGenres()
    const subMap: Record<number, any[]> = {}
    for (const g of rows) {
        subMap[g.id] = await listSubgenres({ genreId: g.id })
    }
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">ジャンル管理</h1>
            <form
                className="flex gap-2"
                action={async (formData: FormData) => {
                    'use server'
                    const name = String(formData.get('name') || '')
                    await createGenre(name)
                }}
            >
                <Input name="name" placeholder="ジャンル名を入力" />
                <Button type="submit">追加</Button>
            </form>
            <div className="grid gap-3">
                {rows.map((g: any) => (
                    <Card key={g.id}>
                        <CardHeader className="flex items-center justify-between">
                            <div className="font-medium">ID: {g.id}</div>
                        </CardHeader>
                        <CardContent>
                            <form
                                className="flex items-center gap-2"
                                action={async (formData: FormData) => {
                                    'use server'
                                    const id = Number(formData.get('id'))
                                    const name = String(formData.get('name') || '')
                                    await updateGenre(id, name)
                                }}
                            >
                                <input type="hidden" name="id" defaultValue={g.id} />
                                <Input name="name" defaultValue={g.name} className="flex-1" />
                                <Button type="submit" variant="secondary">更新</Button>
                            </form>
                            <form
                                className="mt-2"
                                action={async (formData: FormData) => {
                                    'use server'
                                    const id = Number(formData.get('id'))
                                    await deleteGenre(id)
                                }}
                            >
                                <input type="hidden" name="id" defaultValue={g.id} />
                                <Button type="submit" variant="outline">削除</Button>
                            </form>

                            {/* Subgenres section */}
                            <div className="mt-4 pl-3 border-l">
                                <div className="text-sm font-semibold mb-2">サブジャンル</div>
                                <form
                                    className="flex items-center gap-2 mb-3"
                                    action={async (formData: FormData) => {
                                        'use server'
                                        const genreId = Number(formData.get('genreId'))
                                        const name = String(formData.get('name') || '')
                                        await createSubgenre(genreId, name)
                                    }}
                                >
                                    <input type="hidden" name="genreId" defaultValue={g.id} />
                                    <Input name="name" placeholder="サブジャンル名を追加" className="flex-1" />
                                    <Button type="submit" size="sm">追加</Button>
                                </form>
                                <div className="grid gap-2">
                                    {(subMap[g.id] || []).map((sg: any) => (
                                        <div key={sg.id} className="flex items-center gap-2">
                                            <form
                                                className="flex items-center gap-2 flex-1"
                                                action={async (formData: FormData) => {
                                                    'use server'
                                                    const id = Number(formData.get('id'))
                                                    const name = String(formData.get('name') || '')
                                                    await updateSubgenre(id, name)
                                                }}
                                            >
                                                <input type="hidden" name="id" defaultValue={sg.id} />
                                                <Input name="name" defaultValue={sg.name} className="flex-1" />
                                                <Button type="submit" size="sm" variant="secondary">更新</Button>
                                            </form>
                                            <form
                                                action={async (formData: FormData) => {
                                                    'use server'
                                                    const id = Number(formData.get('id'))
                                                    await deleteSubgenre(id)
                                                }}
                                            >
                                                <input type="hidden" name="id" defaultValue={sg.id} />
                                                <Button type="submit" size="sm" variant="outline">削除</Button>
                                            </form>
                                        </div>
                                    ))}
                                    {!(subMap[g.id] || []).length && (
                                        <div className="text-slate-500 text-xs">サブジャンルは未登録です</div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {!rows.length && <div className="text-slate-500 text-sm">ジャンルは未登録です</div>}
            </div>
        </div>
    )
}
