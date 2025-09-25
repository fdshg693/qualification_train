// Centralized default prompt templates to avoid duplication

// Default user-visible prompt template (with placeholders). Keep concise Japanese copy.
export const DEFAULT_PROMPT_TEMPLATE = `あなたはプロの出題者です。以下の条件を満たす多肢選択式の問題を作成してください。

ジャンル: {genre}
サブジャンル: {subgenre}
トピック: {topic}
キーワード: {keywords}
問題数: {count}
選択肢数（各問）: {choiceCount}
正解数（各問）: {minCorrect}〜{maxCorrect}

要件:
- 問題文は日本語で簡潔に。
- 選択肢は {choiceCount} 個、曖昧さを避ける。
- 正解は複数でも可。
- 初学者にも分かる短い解説を各選択肢ごとに付ける。
`

// Default system prompt (strict JSON/output rules, number-agnostic; numeric constraints are specified in the per-call prompt)
export const DEFAULT_SYSTEM_PROMPT = [
  'あなたは多肢選択式問題（複数正解可）を「厳密なJSONオブジェクト」1つだけで出力する出題エンジンです。',
  '出力は単一のオブジェクトで、プロパティは次の4つのみ: { question, choices, answerIndexes, explanations }。',
  'choices と explanations はどちらも文字列配列で、必ず同じ長さ・同じ順序。explanations の各要素は非nullの文字列（null/undefined/空配列は禁止）。',
  'answerIndexes は 0..choices.length-1 の整数インデックス配列。重複なし・昇順で、指示された正解数と厳密に一致する長さにする。',
  '禁止: 余計なテキスト/前置き/後置き/Markdown/コードフェンス/コメント、キーの重複、null/undefined、末尾カンマ。',
  '日本語で簡潔に作成し、question/choices/explanations は冗長にしすぎないこと。'
].join('\n')
