# QuizMint — next session handoff

Short brief for Claude at the start of the next session. Read this first, then `chat.md` for history and `future.md` for the parked-work index.

## Current state (post 2026-04-23)
- **Live:** https://quizmint.me — deployed via `vercel --prod` (manual, GitHub not linked to Vercel)
- **Self-rated:** ~8.8/10. Feature-complete but visible polish gaps remain.
- **Shipped so far:** auth (Gmail-only signup + strong password), dashboard, 4-mode flip timer, Spotify mini player BETA, custom domain, Resend SMTP, security headers, CSP, per-user uploads w/ daily cron cleanup.

## What to work on next (priority order)

### P0 — biggest perceived-quality gap
1. **Social preview / OG metadata** (`future.md` §5)
   - Create `/og.png` (1200×630, Leaf Q + tagline)
   - Add `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card=summary_large_image`, `<meta name="description">`, `<link rel="canonical">` to `index.html`
   - Verify via https://opengraph.dev or iMessage self-send

2. **Bundle code-split** (`future.md` §1)
   - Current: `dist/assets/index-*.js` ~995 KB / 270 KB gzipped — everyone downloads it, including landing-only visitors
   - Convert `QuizGenerator`, `QuizPlayer`, `TimerPage` imports in `App.tsx` to `React.lazy` + `<Suspense fallback=...>`
   - Target: landing-only first paint <100 KB gzipped

### P1 — polish
3. **Mobile polish on landing** (`future.md` §2) — landing was never tested at 360–480px
4. **Animated DemoCard** (`future.md` §3) — port the Editorial `DemoCard` from `QuizMint Home Redesign.html` lines 176–296

### P2 — nice-to-have
5. **A11y audit** (`future.md` §4) — focus rings, ARIA, contrast, keyboard nav
6. **Error boundary** around the app route
7. **Logo-home dirty-state guard** (`future.md` §9) — confirm before discarding unsaved quiz input

## Things NOT to touch
- **Auth / Supabase / Resend config** — stable, tested
- **Security headers / CSP in `vercel.json`** — Task 35 hardened this carefully; any edit needs a reason
- **Flip timer `useTimer.ts`** — `startRef > 0` gate fixes a real bug (Task 42), don't "clean up"
- **Spotify OAuth/Web API upgrade** — parked in `future.md` §7 indefinitely; embed is fine
- **Full-size Spotify embed** — removed intentionally, don't resurrect

## Deploy policy (unchanged)
- **Manual only:** `vercel --prod` from local
- **GitHub main ≠ production** — pushing `main` doesn't deploy
- Always commit + push to `main` first, then deploy

## Important context
- **Stack:** React 19, Vite 6, Tailwind 4, Lucide, Motion; backend = Vercel Serverless Functions; DB/Storage/Auth = Supabase; SMTP = Resend; AI = Gemini (5 rotating keys)
- **Files to know:**
  - `src/App.tsx` — top-level router (landing ↔ login ↔ dashboard ↔ generator/timer)
  - `src/lib/useTimer.ts` — timer logic, timestamp-based tick
  - `src/lib/spotify.ts` — Spotify URL parser + localStorage hooks
  - `server/auth.ts` — shared auth helper for API routes (NOT in `api/_lib/` — Vercel bundler skips underscore dirs, Task 29)
- **CSS variables:** `--c-app`, `--c-surface`, `--c-border`, `--c-hover`, `--c-text[-muted|-subtle|-faint]`, `--c-brand`. Theme swap via `.light` class on `<html>`.
- **`docs/services-used.md`** — service limits + renewal dates (Namecheap expires 2027-04-21)

## How to start the next session
Paste this:
> Read `NEXT_SESSION.md`, then pick the P0 task to work on. Confirm the plan before writing code.
