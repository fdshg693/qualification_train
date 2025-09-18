# スクロール実装メモ（チャット／プレビューの独立スクロール）

このドキュメントは、チャットと問題プレビューを「互いに独立してスクロール」させるための実装パターンと、背後にある CSS/Flexbox の技術的理由をまとめたものです。

## 目的
- チャットのメッセージ表示領域は、一定の高さで縦スクロール可能にする。
- 入力欄は固定高で、長文時は入力欄内部をスクロールさせる。
- 画面分割（プレビュー列とチャット列）では、左右が互いに独立してスクロールできるようにする。
- リセット操作でチャット表示を初期状態に戻し、送信中のレスポンスが混入しないようにする。

## 対象ファイル
- `src/components/chat.tsx`
- `src/app/page.tsx`（トップ画面）
- `src/app/saved/page.tsx`（保存済み画面）

## 実装の要点

### 1) チャットのメッセージ領域（固定高 or 親内で伸縮）
- `Chat` コンポーネントは `fullHeight` プロップで挙動を切り替えています。
  - `fullHeight = true`: 親カードの余白いっぱいに伸縮しつつ、内側でスクロール。
    - クラス: `flex-1 min-h-0 overflow-y-auto ...`
  - `fullHeight = false`: メッセージ領域を固定高にして、内側でスクロール。
    - クラス: `h-96 overflow-y-auto ...`
- メッセージ領域のラッパーは `overflow-y-auto` を付与し、スクロールバーを出す。
- 親が Flex コンテナの場合、子要素の `min-height` 既定値が `auto` のため、子要素が勝手に膨張してスクロールが効かない事象が起きます。これを避けるために `min-h-0` を併用します（重要）。

### 2) 入力欄（固定高で内部スクロール）
- `textarea` に `h-24 overflow-y-auto resize-none` を指定し、入力欄自体が伸びず、内部だけスクロールします。

### 3) 自動スクロール制御
- `scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })` を `messages`/`sending` の変更時に呼び出し、最新メッセージへ自動スクロールさせています。

### 4) リセット（未完了レスポンスを無視）
- `session`（数値）と `sessionRef` を導入し、送信開始時にセッション番号をスナップショット。レスポンス適用前に一致を確認し、リセット後に返ってきた古いレスポンスを破棄します。
- `handleReset()` では以下を実行:
  - `setSession((s) => s + 1)` でセッション更新
  - `setMessages([])` と `setInput('')` で初期化
  - `scrollRef.current.scrollTop = 0` でスクロール位置を先頭へ

## 画面ごとのレイアウト

### トップ画面（`src/app/page.tsx`）
- 下段の 2 カラム全体は、ドラッグで高さを変更できる固定高パネル（`style={{ height: mainHeight }}`）になっています。
  - パネルには `overflow-hidden` を付与し、左右の内側でスクロールさせます。
- 左カラム（プレビュー）は `flex flex-col min-h-0 overflow-hidden` とし、リスト領域に `flex-1 min-h-0 overflow-y-auto` を適用。
  - これにより、プレビューがカラム内で独立してスクロールします。
- 右カラム（チャット）は親コンテナに `flex flex-col min-h-0 overflow-hidden` を与え、内側に `flex-1 min-h-0` のラッパーを挟んでから `<Chat fullHeight className="h-full max-h-full" />` を配置。
- 独立スクロールのポイント:
  - 右カラムの外側には高さの上限（親の高さ or 余白）を設定。
  - 右カラム直下のラッパーに `min-h-0` を付けて、子が縮めるようにする。
  - `Chat` 内のメッセージ領域は `fullHeight` によって `flex-1 min-h-0 overflow-y-auto` となり、右カラム内部だけがスクロールします。

### 保存済み画面（`src/app/saved/page.tsx`）
- 下段の 2 列を `grid` で構成し、親に高さ境界を与えています。
  - 親: `h-[70vh] min-h-[560px] overflow-hidden`
- 左列（保存済み問題一覧）: `min-h-0 overflow-y-auto` で内側スクロール。
- 右列（チャット）: `flex flex-col min-h-0` の中に `<Chat fullHeight className="h-full max-h-full" />` を配置。
- これにより、左右が互いに独立してスクロールします。

## よくある罠 / 注意点
- Flex 子要素の既定 `min-height: auto` のせいで、`overflow-y-auto` が効かずスクロールできない。
  - 解決: スクロールさせたい要素（または一つ上のラッパー）に必ず `min-h-0` を付ける。
- `overflow-y-auto` は「要素自体の高さ境界」が無いと効かない。
  - 解決: 固定高（例: `h-96`）か、親の残余高にフィットする `flex-1` と組み合わせて高さを確保する。
- 親側で `overflow-hidden` を使い、スクロールは内側の対象要素で行うようにする（画面全体スクロールと混ざらない）。

## 調整ポイント（Tailwind）
- メッセージ領域の固定高: `h-96`（例）を `h-80` などに変更可能。
- 入力欄の高さ: `h-24` を用途に合わせて変更可能。
- 保存済み画面の下段高さ: `h-[70vh] min-h-[560px]` を調整して端末別に最適化可能。

## 利用例（埋め込みパターン）

```tsx
// 1) 残余領域内で伸縮させつつ、チャット内で独立スクロール
<div className="flex flex-col min-h-0">
  <div className="flex-1 min-h-0">
    <Chat questions={qs} fullHeight className="h-full max-h-full" />
  </div>
</div>

// 2) 固定高のチャットをそのまま配置（親の高さ制御が不要な場合）
<Chat questions={qs} />  // fullHeight を渡さない: メッセージ領域 h-96 で内側スクロール
```

## 変更点のサマリ
- `src/components/chat.tsx`
  - `fullHeight` のとき: メッセージ領域を `flex-1 min-h-0 overflow-y-auto`。非 `fullHeight` のとき: `h-96 overflow-y-auto`。
  - 入力欄: `h-24 overflow-y-auto resize-none`。
  - リセット: セッション ID による未完了レスポンス無効化 + 初期化。
  - 自動スクロール: `messages`/`sending` 更新時に最下部へ。
- `src/app/page.tsx`
  - 右カラムに `min-h-0` を付与し、`<Chat fullHeight />` を `h-full max-h-full` で内側スクロール。
- `src/app/saved/page.tsx`
  - 親グリッドに高さ境界（`h-[70vh] min-h-[560px] overflow-hidden`）。
  - 左列: `min-h-0 overflow-y-auto`。右列: `flex flex-col min-h-0` + `<Chat fullHeight className="h-full max-h-full" />`。

---

このパターンに従えば、左右のコンテンツやチャットの入力欄・メッセージ領域が期待どおりにスクロールし、画面全体スクロールと干渉しません。今後画面を追加する場合も、

1. 親に高さ境界を与える
2. スクロール対象の直上に `min-h-0` を付与
3. スクロールさせたい要素に `overflow-y-auto` と高さ/伸縮の指定

という 3 点を満たすよう配置すれば安定します。
