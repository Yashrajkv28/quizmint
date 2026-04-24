# QuizMint — next session handoff

Short brief for Claude at the start of the next session. Read this first, then `chat.md` for history and `future.md` for the parked-work index.

## Current state (post 2026-04-24 afternoon)
- **Live:** https://quizmint.me — deployed via `vercel --prod` (manual, GitHub not linked to Vercel)
- **Self-rated:** ~9.2/10. P0+P1+P2 backlog from last brief is fully shipped.
- **Shipped this session:** auth email token-hash flow, OG/Twitter meta, route-level code-split, mobile polish 360–480px, animated DemoCard section, global `:focus-visible`, error boundary, unsaved-work confirm on logo/back.

## What to work on next

### Blocking follow-ups
1. **Create `/og.png`** (1200×630, Leaf Q + tagline) and drop it in `public/og.png`. Meta tags already reference it — right now social scrapers 404 on the image and fall back to text-only.
2. **Deploy the batch.** All commits are on `main`; still need `vercel --prod` to push today's changes live.

### Parked work (see `future.md`)
- Full a11y audit (axe-devtools + screen-reader pass) — only baseline focus ring shipped
- Further bundle reduction (landing-only <100 KB gz; currently 128 KB gz) — would require splitting `LandingPage` or dropping `Motion`/`Lucide` bulk
- Spotify OAuth upgrade (parked indefinitely)
- Ambient play-state animation (`future.md`)

### Done 2026-04-24
- ✅ **Auth email link domain mismatch** — token-hash flow, `/auth/callback` + SPA rewrite. Plan: `docs/superpowers/plans/2026-04-24-auth-email-callback.md`.
- ✅ **OG / Twitter / canonical / description meta** — `index.html`. Missing `/og.png` (see follow-up 1).
- ✅ **Route-level code-split** — `QuizGenerator`, `QuizPlayer`, `TimerPage` lazy. Main bundle 998→452 KB (269→128 KB gz, ~53% drop).
- ✅ **Mobile polish** — landing padding, letter-spacing, card density at ≤560px.
- ✅ **Animated DemoCard** — `src/components/DemoCard.tsx`, inserted between marquee and features.
- ✅ **A11y baseline** — global `:focus-visible` ring in `src/index.css`. A full audit is still parked.
- ✅ **Error boundary** — `src/components/ErrorBoundary.tsx`, wraps `<App />` in `main.tsx`.
- ✅ **Dirty-state guard** — `leaveAppRoute` in `App.tsx` confirms before discarding quiz in progress or dirty generator input. Bridge: `window.__quizmintDirty` set by `QuizGenerator`.

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
