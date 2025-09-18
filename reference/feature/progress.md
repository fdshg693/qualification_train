# 複数選択（0〜4個の正解）対応 進捗

最終更新: 2025-09-18

対応方針: 方針A（破壊的・シンプル再設計）で実装。既存DBを再初期化し、新契約に一元化。

完了した項目:
- 契約（Zod）: `QuestionSchema` を `{ question, choices(4), answerIndexes:number[], explanation }` に変更（`src/lib/schema.ts`）。重複チェックあり。
- 生成ロジック: `src/lib/generate-questions.ts` を V2 仕様へ。`normalizeQuestion` で選択肢シャッフル後に `answerIndexes` を再マッピング。モックも複数正解に対応。
- DB スキーマ: `questions` テーブルを `choices_json(text)`, `answers_json(text)` に変更（`src/db/schema.ts`）。破壊的初期化（`sqlite.db` と `drizzle/` を削除→再生成）。
- サーバーアクション: `saveQuestion`/`getRandomQuestion` を JSON で保存・取得するよう更新（`src/app/actions.ts`）。`answerIndexes` を保存・返却。
- API: チャット API のコンテキスト契約を `answerIndexes` に更新（`src/app/api/chat/route.ts`）。
- UI: `QuestionDisplay` を複数選択 UI に刷新（チェック式動作、集合一致で採点）。`practice/page.tsx` も `answerIndexes` に対応。
- トップページ（ジェネレータ）: プレビューパネルを複数選択に対応、保存時は `answerIndexes` を使用。
- 保存一覧: JSON から復元し複数正解表示（`/saved`）。
- 型チェック/マイグレーション: `npm run typecheck` OK。`npm run db:generate && npm run db:migrate` 済。

残タスク/注意:
- 既存データの移行スクリプトが必要な場合は、旧 `choice0..3` と `answerIndex` から `choices_json`/`answers_json` へ変換する簡易スクリプトを別途用意可能（今回はDB再作成のため省略）。
- 生成 API のBodyは従来通り（subgenre/topic/count/model）でOK。返却の質問配列が新契約に統一。

ローカル再現手順（破壊的初期化）:
1) 依存インストール
	- `npm install`
2) DB 初期化（既存DB破棄: 注意）
	- `rm -f sqlite.db && rm -rf drizzle`
	- `npm run db:generate && npm run db:migrate`
3) 開発サーバー
	- `npm run dev`

確認観点:
- 生成→プレビュー→保存→保存一覧→ランダム練習→チャットの一連の流れで `answerIndexes` が一貫していること。
- 選択肢シャッフル後も正解集合が正しく再マッピングされること。
