import { getPrompt, listPrompts, savePrompt, deletePrompt } from '../../actions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'

export default async function AdminPromptsPage() {
    // 既存プロンプト一覧
    const rows = await listPrompts()
    const defaultRow = await getPrompt('default')
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">プロンプト管理</h1>
            {/* 追加フォーム */}
            <Card>
                <CardHeader className="font-medium">新規テンプレート追加</CardHeader>
                <CardContent>
                    <form
                        className="grid gap-3"
                        action={async (formData: FormData) => {
                            'use server'
                            const name = String(formData.get('name') || '')
                            const template = String(formData.get('template') || '')
                            await savePrompt({ name, template })
                        }}
                    >
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">テンプレート名</label>
                            <Input name="name" placeholder="例: default" />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">テンプレート本文</label>
                            <textarea
                                name="template"
                                defaultValue={defaultRow.template}
                                className="min-h-[200px] w-full rounded border p-2 font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500">
                                利用可能なプレースホルダー: {`{genre}`}, {`{subgenre}`}, {`{topic}`}, {`{count}`}, {`{minCorrect}`}, {`{maxCorrect}` }。これらは送信時に置換されます。
                                条件分岐などの複雑なロジックはサポートしません。
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit">追加</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* 一覧と編集 */}
            <div className="grid gap-3">
                {rows.map((row: any) => (
                    <Card key={row.id}>
                        <CardHeader className="font-medium">{row.name}</CardHeader>
                        <CardContent>
                            <form
                                className="grid gap-3"
                                action={async (formData: FormData) => {
                                    'use server'
                                    const id = Number(formData.get('id'))
                                    const name = String(formData.get('name') || '')
                                    const template = String(formData.get('template') || '')
                                    await savePrompt({ id, name, template })
                                }}
                            >
                                <input type="hidden" name="id" defaultValue={row.id} />
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">テンプレート名</label>
                                    <Input name="name" defaultValue={row.name} />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">テンプレート本文</label>
                                    <textarea
                                        name="template"
                                        defaultValue={row.template}
                                        className="min-h-[200px] w-full rounded border p-2 font-mono text-sm"
                                    />
                                    <p className="text-xs text-slate-500">
                                        利用可能なプレースホルダー: {`{genre}`}, {`{subgenre}`}, {`{topic}`}, {`{count}`}, {`{minCorrect}`}, {`{maxCorrect}` }。これらは送信時に置換されます。
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button type="submit" variant="secondary">更新</Button>
                                </div>
                            </form>
                            <form
                                className="mt-2"
                                action={async (formData: FormData) => {
                                    'use server'
                                    const id = Number(formData.get('id'))
                                    await deletePrompt(id)
                                }}
                            >
                                <input type="hidden" name="id" defaultValue={row.id} />
                                <ConfirmSubmitButton className="text-xs" confirmMessage="このテンプレートを削除します。よろしいですか？">
                                    削除
                                </ConfirmSubmitButton>
                            </form>
                        </CardContent>
                    </Card>
                ))}
                {!rows.length && (
                    <div className="text-slate-500 text-sm">テンプレートは未登録です</div>
                )}
            </div>
        </div>
    )
}
