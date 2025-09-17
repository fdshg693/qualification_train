## Copilot instructions for this repo

Purpose: Give AI agents the minimal, project-specific context to contribute safely and productively. Keep answers concrete; reuse existing patterns.

### 1. Architecture Snapshot
- Next.js 14 App Router + TypeScript + Tailwind (custom light shadcn-style UI under `src/components/ui`).
- Data: Drizzle ORM over `better-sqlite3` (`sqlite.db` committed for simplicity).
- AI: Vercel AI SDK for (a) batch question generation and (b) streaming tutor chat.
- Core flows: generate 1–50 four‑choice questions, save/search, random practice, genre & subgenre CRUD, tutor chat referencing up to 5 questions.

### 2. Key Files (edit here, not ad‑hoc)
- `src/lib/schema.ts`: `QuestionSchema` single source of truth for a Question object.
- `src/lib/generate-questions.ts`: batch generation logic (+ mock + per‑question fallback + choice re-shuffle `normalizeQuestion`).
- `src/app/api/questions/generate/route.ts`: POST batch generation (JSON only). Old streaming endpoint removed; reintroduce only if NDJSON envelope (see legacy note) is needed.
- `src/app/api/chat/route.ts`: streaming plain text tutor chat; mock path when no `OPENAI_API_KEY`.
- `src/app/actions.ts`: server actions (save/list/delete questions, random pick, genres/subgenres CRUD) + `revalidatePath` calls.
- `src/db/schema.ts`: Drizzle tables `questions`, `genres`, `subgenres` (unique: `genreId+name`).

### 3. Data & Contracts
- Question shape: `{ question, choices[4], answerIndex 0..3, explanation }` via `QuestionSchema`.
- DB mapping: `choices[i]` → `choice0..3`; keep answer index aligned after `normalizeQuestion` reshuffle.
- When adding question fields: update `QuestionSchema`, DB schema + migration, save & list actions, and any UI renderers (`page.tsx`, `saved/page.tsx`, `question-display.tsx`).

### 4. AI Generation Rules
- Always validate model output (batch path: manual `z.any()` then `QuestionsArraySchema.safeParse`; fallback per‑question with schema).
- Limit batch size 1..50 (enforced in `generateQuestions`).
- Mock mode triggers when `OPENAI_API_KEY` is absent; preserve deterministic style for local dev.
- On new generation logic: keep the post‑process shuffle (maintains consistent UX anonymity of correct option position).

### 5. Chat Stream Pattern
- Uses `streamText` → plain `text/plain` chunks (NOT NDJSON). Include up to 5 context questions inside the system prompt (see `contextSnippet`).
- If extending (e.g., tool calls), keep mock branch simple and fast.

### 6. Genres / Subgenres
- CRUD through server actions; each mutation revalidates `/admin/genres`, `/`, and sometimes `/saved`.
- `subgenres` table cascades on genre delete. Maintain unique (genreId, name).
- Frontend passes either a concrete subgenre or falls back to genre name for generation scope.

### 7. Conventions
- Japanese copy throughout; match tone & language for new strings.
- Use path aliases (`@/lib/*`, etc.)—do not use relative `../../` unless inside same feature cluster.
- Keep DB access only in server actions / server routes. No direct client DB imports.
- Prefer small, focused server actions over embedding logic in route handlers.

### 8. Dev Workflow
- Install: `npm install`; run: `npm run dev` (mock mode OK). Type safety: `npm run typecheck`; lint: `npm run lint`.
- Schema change: update `src/db/schema.ts` → generate migration (`npm run db:generate`) → apply (`npm run db:migrate`). Commit both SQL + updated schema.
- Do not reinvent streaming—reuse existing chat stream pattern.

### 9. Legacy Note (Removed Feature)
- Former NDJSON streaming question generation endpoint was removed. If restoring, reuse prior envelope: start, partial(question/choice/index/explanation), final.

### 10. Safe Extension Checklist
1. Touch the schema? Update zod + Drizzle + migrations + actions + UI.
2. Add AI endpoint? Provide mock branch when no API key.
3. Return arrays? Validate with zod before trusting.
4. Mutate data? Revalidate affected routes.
5. New UI text? Keep Japanese & concise.

Keep this file succinct—add only proven patterns. Remove outdated guidance when behavior changes.
