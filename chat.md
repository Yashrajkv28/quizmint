# QuizMint Development Chat Log

## Session: 2026-04-17

### Initial Request
User wanted to analyze the quiz generator codebase, verify everything works, and fix issues before publishing/hosting for close friends.

### Issues Identified
1. **API key exposed to client** — `vite.config.ts` injected `GEMINI_API_KEY` directly into the frontend bundle
2. **Model name** — `gemini-3-flash-preview` (kept as-is per user request)
3. **Progress state never resets** on error/empty results
4. **No loading state reset** on success path
5. **Sidebar not responsive** — 280px fixed sidebar unusable on mobile
6. **Title** — still said "My Google AI Studio App"
7. **metadata.json** — empty AI Studio artifact
8. **Express dependency** — unnecessary for Vercel deployment

### Architecture Decisions
- **Hosting:** Vercel (manual deploy via CLI, no auto-deploy). The GitHub repo is intentionally NOT linked to Vercel — pushing to `main` does not trigger a production deploy. Redeploys are always run manually with `vercel --prod`.
- **API Key approach:** Hybrid — server keys as default, users can optionally provide their own
- **Backend:** Vercel Serverless Functions (removed Express entirely)
- **Backup keys:** Up to 5 Gemini API keys with automatic rotation on rate limits (429) or auth errors (401/403)

### Changes Made

#### Task 1: Created Vercel serverless API route
- Created `api/generate.ts` — serverless function that holds API keys server-side
- Calls Gemini API and returns parsed quiz JSON
- Supports backup key rotation (tries next key on failure)

#### Task 2: Rewrote `src/services/geminiService.ts`
- Removed direct Gemini SDK usage from frontend
- Now calls `/api/generate` endpoint instead

#### Task 3: Cleaned up `vite.config.ts`
- Removed `process.env.GEMINI_API_KEY` injection (was leaking key to bundle)
- Removed AI Studio HMR disable hack

#### Task 4: Fixed `QuizGenerator.tsx`
- Removed streaming `onProgress` callback (API returns single response now)
- Fixed progress state reset on error and empty results

#### Task 5: Fixed HTML and layout
- Updated `index.html` title to "QuizMint"
- Deleted `metadata.json` (AI Studio artifact)
- Made sidebar responsive (hidden on mobile, visible on `lg:`)

#### Task 6: Updated config files
- Removed `express`, `@types/express`, `dotenv`, `tsx` from `package.json` (88 packages dropped)
- Created `vercel.json` with Vite framework config
- Updated `.env.example` with backup key slots
- Updated `.gitignore` to include `.vercel/`

#### Task 7: New README
- Complete rewrite removing all AI Studio references
- Added setup, deploy, and environment variable docs

#### Task 8: Build verification
- TypeScript check: PASS
- Vite build: PASS
- API key leak check: CLEAN (no keys in `dist/`)

#### Task 9: Hybrid API key
- Added optional API key input to QuizGenerator UI (collapsible, stored in localStorage)
- Server tries user-provided key first, falls back to server keys
- Updated `api/generate.ts` and `src/services/geminiService.ts`

#### Task 10: Renamed to QuizMint
- Updated `package.json`, `index.html`, `src/App.tsx`, `README.md`
- Name suggestions considered: quizparse, quizmint, flashquiz, quizforge
- User chose **quizmint**

#### Task 11: GitHub + Vercel deployment
- Installed GitHub CLI (`gh`) via winget
- Authenticated as `Yashrajkv28`
- Created repo: https://github.com/Yashrajkv28/quizmint
- Added 3 Gemini API keys to Vercel env vars
- Deployed to production: https://quizmint-blue.vercel.app

#### Task 12: Exit quiz button
- Added persistent "Exit Quiz" button with arrow icon in top-right of QuizPlayer
- Visible at all times during quiz (not just after completion)

#### Task 13: File upload security
- Restricted to single file upload (replaces previous, no appending)
- 10MB file size limit (client + server)
- Server-side validation: mime type whitelist (PDF/TXT/DOCX only)
- Server-side validation: base64 encoding integrity check
- Rejects malicious or unsupported file types

### Security Summary
- API keys stored only in Vercel env vars, never in client bundle
- `.env` is gitignored, verified not in any commit
- `grep` on `dist/` confirms zero key leaks
- HTTPS encrypts all client-server communication
- Server validates file type, size, and encoding before processing
- User-provided keys stored only in browser localStorage, never persisted server-side

### Tech Stack
- **Frontend:** React 19, Vite 6, Tailwind CSS 4, Lucide Icons, Motion
- **Backend:** Vercel Serverless Functions
- **AI:** Google Gemini API (`gemini-3-flash-preview`)
- **File Parsing:** Mammoth (DOCX), native FileReader (PDF)

#### Task 14: Mutually exclusive text / file input
`src/components/QuizGenerator.tsx`:
- Added `hasTypedText` / `hasFile` flags
- File zone disabled (dimmed, non-clickable, drop handlers no-op) when user has typed text; hint changes to "Clear the text below to upload a file"
- Textarea disabled when any file is attached; placeholder becomes "Remove the attached file to paste text instead."
- For PDFs, textarea value is blanked (PDF content lives only in `uploadedFile.data`, so nothing to show)
- For TXT/DOCX, the extracted text still renders (read-only) so the user can see what was parsed

Since the UI now guarantees only one input path reaches the server, the backend's dual-input prompt still works but will never see both fields populated in practice.

#### Task 15: Light mode
- Introduced CSS variables in `src/index.css` (`--c-app`, `--c-surface`, `--c-border`, `--c-hover`, `--c-text`, `--c-text-muted`, `--c-text-subtle`, `--c-text-faint`) with dark defaults on `:root` and a `.light` override on `<html>`
- Swept `App.tsx`, `QuizGenerator.tsx`, `QuizPlayer.tsx` to replace hardcoded hex/slate classes with `var(--c-*)` equivalents
- Added Sun/Moon theme toggle in the sidebar; preference persisted to `localStorage` and applied on mount

#### Task 27: Sidebar logo → back to landing
Wired the sidebar QuizMint mark (logo + wordmark) as a button in `App.tsx:40`. Click resets `quizData` and flips `showLanding` back to true. Standard "logo = home" behavior. Confirmation-on-dirty-state deliberately skipped for now — parked in `future.md` section 7 so we can come back to it.

#### Task 26: Fix unreadable green-on-green text in light mode
User flagged two places where emerald-200 text sat on an emerald-500/10 wash and became invisible in light mode (dark mode was fine):
- `QuizGenerator.tsx:192` — "{file} attached" pill
- `QuizPlayer.tsx:114-115` — answer Explanation block (body + "Explanation:" label)

Fix: kept dark-mode colors untouched and added Tailwind arbitrary variants that only fire under `:root.light` via the `[.light_&]:` selector. Filename pill → `emerald-700`; explanation body → `emerald-800`, label → `emerald-700`. Solid contrast on the pale mint wash without disturbing dark mode.

#### Task 25: Park future improvements in `future.md`
Self-rated the current state 8.5/10 (user wanted 9). Logged the path from 8.5 → 9.5 in a new `future.md` so we can come back to it. Six buckets:
1. **Code-split the landing from the app** — marketing landing shouldn't ship the full Gemini/quiz bundle. Lazy-load `QuizGenerator` / `QuizPlayer`, wrap in `Suspense`.
2. **Mobile polish** — desktop is solid but phone sizes weren't actually tested. Marquee font size, hero `clamp` min, nav wrap.
3. **Animated product demo** — Playful's floating cards are decorative. Port the Editorial `DemoCard` (paste → parsing → quiz auto-loop) from `QuizMint Home Redesign.html` lines 176–296.
4. **Accessibility audit** — contrast on mint CTA, focus-visible rings, ARIA labels, keyboard nav, reduced-motion coverage beyond just floating cards.
5. **OG / social preview** — no meta tags currently. Share in iMessage = blank preview. Need 1200×630 OG image, `og:*` + `twitter:card` tags, `<meta name="description">`, canonical.
6. **Nice-to-haves** — error boundary, optional skip-landing preference, favicon PNG fallbacks, a single Vercel Analytics counter on CTA click.

Not scheduled — just parked.

#### Task 24: Remove Playwright plugin from Claude Code
User found it unhelpful. Removed the `playwright@claude-plugins-official` entry from `~/.claude/plugins/installed_plugins.json` and deleted the cache folder `~/.claude/plugins/cache/claude-plugins-official/playwright/`. MCP server had already disconnected for the session, so no restart required. `/plugin` can reinstall it later if needed.

#### Task 23: Untrack local tool state + scratch files
Task 22's commit accidentally swept in `.claude/settings.local.json`, `.playwright-mcp/*.yml`, three `landing-*.png` debug screenshots, and the Task 21 `Screenshot 2026-04-19 135810.png`. No `.env` touched the repo — verified via `git ls-files | grep env` (only `.env.example` tracked, which is intentional). Ran `git rm -r --cached` on all of it and extended `.gitignore` with:

```
.claude/
.playwright-mcp/
landing-*.png
Screenshot*.png
```

Files still exist locally, just untracked.

#### Task 22: Playful landing page (from `QuizMint Home Redesign.html`)
Adapted the Playful direction from the handoff into a new `src/components/LandingPage.tsx`. Flow is now **Splash (5s) → Landing → [CTA] → App (sidebar + QuizGenerator)**. Splash and app code unchanged; `App.tsx` just gates on a `showLanding` state that flips to false when the user clicks any CTA.

Design moves:
- **Tokenized** every Playful color against `--c-app` / `--c-surface` / `--c-border` / `--c-text` / `--c-text-subtle` / `--c-text-faint` / `--c-brand` so the one component serves both light and dark. Cream (`#F7F3EC`) → `--c-app`; paper (`#FFFFFF`) → `--c-surface`; hairline (`#E6DFD2`) → `--c-border`. Mint CTA slab stays literal `var(--c-brand)` in both modes.
- **Fraunces** added to `index.html` (weights 500/600 + italic 600) for the serif headlines and italic accents. Inter stays via `@theme` in `index.css`.
- **FloatingCards**: four tilted quiz cards with staggered `translateY` float animations (`qmFloat0..3`). Hidden under 1100px via media query — no clipping on small screens.
- **Marquee**: `qmMarquee` 40s linear infinite, items triplicated for seamless loop. Pruned to formats that actually work: `PDF textbooks`, `DOCX problem sets`, `Pasted MCQs`, `Lecture notes`, `Practice exams`, `TXT study guides`.
- **Features grid**: 2×2 with serif numerals. Collapses to single column under 720px.
- **CTA slab**: mint `var(--c-brand)` with white radial glow, serif "Stop formatting. Start studying.", ink pill button.
- **Footer**: thin — wordmark + "Made with mint." + GitHub link.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` kills the float animation on the cards.

Cut from the handoff (all fake-promise content):
- `PlNav` links (`Product`, `Templates`, `For teachers`, `Pricing`) and `Sign in` button — none of those pages exist
- `PlQuote` — fake testimonial from "Priya K., pre-med · UC Davis"
- `PlCategories` — "2,792 quizzes · updated daily" / category browse; there's no library
- Hero stats claiming "eight seconds" (softened to "In seconds")
- Hero subcopy claim of "share link" — the app has no share feature; replaced with "difficulty labels and a one-line explanation for every answer"
- 4th feature "It shares" → replaced with "It stays out of the way" (no account / no email / no pricing page — true)

Behavior: landing shows on every fresh load after the splash. No localStorage gating — consistent with the splash policy from Task 19/20. Clicking any CTA (nav, hero, features section CTA, or big mint slab) flips `showLanding` to false; the existing sidebar + `QuizGenerator` takes over with no route change. Theme toggle lives in the landing nav too and uses the same `toggleTheme` from `App.tsx`, so the preference persists into the app view.

#### Task 21: Close gap between "Quiz" and "Mint" in sidebar wordmark
Screenshot showed a visible gap between "Quiz" and "Mint" in the sidebar header. The parent flex container uses `gap-2.5` to space the logo from the wordmark — but because the wordmark was `Quiz<span>Mint</span>` (a raw text node plus a span), flex treated them as two separate children and inserted the gap between them too.

Fix: wrap both in a single `<span>` so the wordmark is one flex item. `App.tsx:30`. Logo-to-wordmark gap preserved; "QuizMint" now renders tight.

#### Task 20: Splash duration locked to 5s on every load
Dropped the `isFirstEver` branching in `main.tsx` and removed the `qm-splash-first-done` localStorage flag. `minDurationMs={5000}` on every load — user wanted the full animation every time.

#### Task 19: Theme-aware splash + always-on-reload + longer first-visit
- Splash is now theme-aware. `QuizMintSplash` reads `localStorage.theme` (or accepts a `theme` prop) and applies a `.dark` / `.light` class. Dark mode: `#0A0A0C` backdrop, white wordmark, ink-alpha loader track, ambient `rgba(16,185,129,0.08)` at 50%. Light mode: `#F6F7F9` backdrop, ink wordmark, ink-alpha loader track, ambient `0.10` at 55%. The leaf itself is identical in both (v2 slate vein + dot).
- Removed the `sessionStorage('qm-splash-seen')` gate — splash now plays on every page load / reload.
- First-ever visit gets a longer run: `main.tsx` reads `localStorage.qm-splash-first-done`; if absent, `minDurationMs = 5000` (otherwise 2800). Flag is set in `onDone` so subsequent loads use the shorter duration.

#### Task 18: Brand handoff v2 (universal vein + light splash)
Applied the v2 diff from `QuizMint Logo Handoff v2.html`:
- Mark vein + dot now slate `#334155` (was `#FFFFFF` / `#059669`) so the Leaf Q reads on any background — paper, app-light, or dark sidebar. Opacity dropped `0.92 → 0.85`.
- `QuizMintLogo.tsx`, `public/favicon.svg` updated accordingly.
- Added `--c-vein: #334155` to `src/index.css` brand tokens.
- **Splash** flipped to a universal light treatment: backdrop `#0A0A0C → #F6F7F9`, wordmark `#FFFFFF → #0A0A0C`, loader track alpha re-keyed to ink, ambient gradient bumped `0.08 → 0.10` / `50% → 55%`. Same 2.6s timing, same reduced-motion behavior.

Design intent per the handoff: one splash for both themes. Dark-mode users see the light splash briefly before the app fades in — intentional, not a bug.

#### Task 17: Leaf Q brand identity (v1.1 handoff)
Implemented the checklist from `QuizMint Logo Handoff.html`:
- New `src/components/QuizMintLogo.tsx` — React component with `default`/`mono-ink`/`mono-white` variants
- New `public/favicon.svg` (mint Leaf Q); wired via `<link rel="icon">` + `theme-color` in `index.html`
- Added brand tokens to `src/index.css`: `--c-brand`, `--c-brand-deep`, `--c-brand-soft`, `--c-brand-wash`
- Sidebar header in `App.tsx`: dot replaced with `<QuizMintLogo size={22} />`; "Mint" wrapped in `text-[var(--c-brand)]`
- Splash: `QuizMintSplash.tsx` + `QuizMintSplash.css` — stroke-draws the leaf, writes the vein, pops the dot, fades wordmark; ~2.8s, respects `prefers-reduced-motion`
- `main.tsx` now renders a `Root` that mounts the splash on first load per session (`sessionStorage` flag `qm-splash-seen`)

Brand mint (`#10B981` / `#059669`) is identical to Tailwind's `emerald-500`/`600`, so the earlier indigo→emerald sweep already matches the brand palette — no further chrome color changes needed.

#### Task 16: Mint rebrand
- Swapped all `indigo-*` accent classes to `emerald-*` across `App.tsx`, `QuizGenerator.tsx`, `QuizPlayer.tsx` so both themes match the "QuizMint" name
- Correct-answer highlights were already emerald and now share the brand hue; incorrect remains red so feedback still reads

### Deploy policy
Deploys are **always manual** via `vercel --prod`. The GitHub repo is intentionally not connected to Vercel — `git push` to `main` does nothing on the hosting side. After pushing, run `vercel --prod` locally to ship.

### URLs
- **Production:** https://quizmint-blue.vercel.app
- **GitHub:** https://github.com/Yashrajkv28/quizmint
