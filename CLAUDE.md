# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project: Pouchy

美妝保養品管理 App。Next.js 14 App Router + Supabase + Anthropic Claude API，部署在 Vercel。

### Commands

```bash
npm run dev      # local dev server (localhost:3000)
npm run build    # production build (run before pushing to catch TS errors)
npm run lint     # ESLint
```

No test suite exists.

### Environment Variables

Required in `.env.local` (see Vercel dashboard for production values):
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — database + storage
- `ANTHROPIC_API_KEY` — Claude API
- `TAVILY_API_KEY` — web search for brand shade lookup
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — NextAuth Google OAuth
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — NextAuth session
- `ADMIN_PASSWORD` — admin backend cookie auth

### Architecture

**Auth (two separate systems):**
- Regular users: NextAuth.js (`src/lib/auth.ts`) with Google OAuth. Session read via `getSessionUser()` (`src/lib/getUser.ts`) in all API routes. `user_id` = Google email.
- Admin: separate cookie `cosmetics_admin` checked against `ADMIN_PASSWORD` env var. Admin routes live under `/admin` with their own standalone layout (no Navigation).
- Middleware (`src/middleware.ts`): admin routes exit early (bypass NextAuth), regular routes check NextAuth JWT token.

**Database (Supabase):**
- `src/lib/db.ts` exports a lazy singleton `supabase` client using service role key (server-side only).
- Key tables: `cosmetics`, `user_profiles`, `shade_analyses`, `advice_feedback`.
- `user_id` column is the Google email string across all tables.

**API Routes (`src/app/api/`):**
- All user-facing routes call `await getSessionUser()` at the top; return 401 if null.
- AI routes use `@anthropic-ai/sdk` with model `claude-sonnet-4-20250514`.
- `scan/` — barcode → product lookup; `auto-tag/` — AI sub-tag generation; `fill-description/` — AI product description fill; `analyze-profile/` — full skin tone analysis from photos + shade notes; `color-catalog/` — per-cosmetic color data with vision AI; `advice/` — purchase recommendation; `ai-match/` — outfit/look matching; `lookup-brand-shade/` — Tavily search + Claude for brand shade table.
- `upload/` — uploads to Supabase Storage. Client-side image compression happens before upload via `src/lib/compressImage.ts` (max 1600px, JPEG 82%) to stay under Vercel's 4.5MB body limit.

**Pages:**
- `/` — cosmetics library with filter/sort/search
- `/profile` — skin profile + color analysis + brand shade table
- `/colors` — color catalog per cosmetic
- `/match` — AI outfit matching
- `/advice` — AI purchase advice
- `/cosmetics/[id]` — detail view; `/cosmetics/[id]/edit` — server component that checks session before rendering form

**Design System:**
- Tailwind with custom `blush` (primary #FF2C5D rose) and `nude` (secondary #3D2535 dark plum) color scales. Both scales are remapped from the originals; class names throughout the codebase use these names.
- Fonts loaded via `next/font/google`: Plus Jakarta Sans (`--font-heading`), Noto Sans TC (`--font-body`), DM Mono (`--font-mono`).
- Component classes defined in `src/app/globals.css`: `.btn-primary`, `.btn-secondary`, `.card`, `.input-field`, `.pill`, `.pill-active`, `.pill-inactive`.

**Key types (`src/lib/types.ts`):**
- `Cosmetic` — main product record; `ColorData` — per-product color analysis (JSON stored in `color_data` column); `ShadeNote` — trial shade with `verdicts: ColorVerdict[]`; `ColorProfile` — user skin profile.
- `color_verdict` DB column stores multiple verdicts joined with `、` (e.g. `偏深、偏黃`).
- `brand_shade_table` and `shade_notes` stored as JSON strings in `user_profiles`.
