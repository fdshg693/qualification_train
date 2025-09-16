# Copilot instructions for this repo

Purpose: Help AI coding agents be productive in this Next.js + Vercel AI SDK + Drizzle (SQLite) app by documenting architecture, workflows, and project-specific patterns.

## Overview
- Stack: Next.js 14 App Router (TypeScript) + Tailwind, lightweight shadcn-style UI.
- AI: Vercel AI SDK (`ai`, `@ai-sdk/openai`) for object generation and streaming.
- DB: Drizzle ORM over `better-sqlite3` with a checked-in local `sqlite.db`.
- Main flows:
  - Generate a 4-choice question on `/` via API (JSON or NDJSON stream).
  - Save questions locally; list/search them on `/saved`.

## Key files & responsibilities
- Frontend
  - `src/app/page.tsx`: generate (JSON), stream (NDJSON), save via server action; displays preview.
  - `src/app/saved/page.tsx`: lists/sorts saved questions; simple GET form for filters.
  - `src/components/ui/*`: minimal buttons/inputs/cards/toast.
- API & actions
  - `src/app/api/questions/generate/route.ts`: JSON generation with fallback when no OPENAI_API_KEY.
  - `src/app/api/questions/generate/stream/route.ts`: streaming generation → NDJSON envelope (see below).
  - `src/app/actions.ts`: server actions `saveQuestion`, `listQuestions` using Drizzle.
- Data & config
  - `src/lib/schema.ts`: zod `QuestionSchema` (single source of truth for shape).
  - `src/db/schema.ts`: Drizzle SQLite schema (`questions` table, `choice0..3`).
  - `src/db/client.ts`: `better-sqlite3` client bound to `sqlite.db`.
  - `drizzle.config.ts` + `drizzle/`: migrations output location (initial migration present).

## Data contracts and conventions
- Question shape (keep in sync across API/UI):
  - `QuestionSchema`: `{ question: string, choices: [string, string, string, string], answerIndex: 0..3, explanation: string }` in `src/lib/schema.ts`.
- DB mapping:
  - `choices[0..3]` ↔ columns `choice0..3`; `answerIndex` is an `integer` column.
- Imports use TS path aliases (`@/lib/*`, `@/db/*`, `@/components/*`) defined in `tsconfig.json`.
- Next.js config enables Server Actions with `bodySizeLimit: '2mb'` (`next.config.js`).
- Copy/UI strings are Japanese; keep consistency for new UI text.

## AI generation patterns
- JSON (one-shot):
  - `generateObject({ model: openai('gpt-4.1'), system, prompt, schema: QuestionSchema })` → return `NextResponse.json(object)`.
  - MUST support mock fallback when `OPENAI_API_KEY` is not set (see existing code for example copy).
- Streaming (NDJSON):
  - Use `streamObject({ model: openai('gpt-4o-mini'), system, prompt, schema: QuestionSchema })`.
  - Response Content-Type: `application/x-ndjson; charset=utf-8`.
  - Envelope expected by the client (`src/app/page.tsx`):
    - `{"type":"start"}` once at start
    - `{"type":"partial","key":"question","value":"..."}`
    - `{"type":"partial","key":"choice","index":0..3,"value":"..."}` (emit as indices become available)
    - `{"type":"partial","key":"answerIndex","value":0..3}`
    - `{"type":"partial","key":"explanation","value":"..."}`
    - `{"type":"final"}` once at end
  - Preserve this wire format when extending streaming endpoints.

## Server actions and querying
- `saveQuestion(params)`: maps `choices` → `choice0..3`, writes to `questions`.
- `listQuestions({ genre?, q? })`: builds `AND` of `eq(genre)` and `like(question, %q%)`; orders by `createdAt`.
- If adding filters/columns: update `src/db/schema.ts`, action queries, and `/saved` UI. Also generate/commit a new migration in `drizzle/`.

## Dev workflows
- Scripts (`package.json`): `dev` (Next dev), `build`, `start`, `lint`, `typecheck`.
- Env: `OPENAI_API_KEY` optional; absence triggers a deterministic mock for both endpoints.
- DB is local `sqlite.db` in repo root (checked-in). Ok to modify for development tasks.

## When implementing changes
- Reuse `QuestionSchema` for any generation/validation to keep contract consistent.
- Maintain the NDJSON streaming envelope; update `page.tsx` parsing only if strictly necessary.
- Favor server actions for DB mutations/querying; keep DB access within server-side code.
- Keep UI additions consistent with existing lightweight components under `src/components/ui/`.
- Respect path aliases and strict TS settings; run `npm run typecheck` before committing.
