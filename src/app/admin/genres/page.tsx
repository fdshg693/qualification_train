import { createGenre, deleteGenre, listGenres, updateGenre } from '../../actions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default async function AdminGenresPage() {
    const rows = await listGenres()
    // サブジャンルは廃止
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

                            {/* サブジャンル機能は削除されました */}
                        </CardContent>
                    </Card>
                ))}
                {!rows.length && <div className="text-slate-500 text-sm">ジャンルは未登録です</div>}
            </div>
        </div>
    )
}
