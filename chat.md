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
