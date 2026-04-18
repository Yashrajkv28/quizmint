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
- **Hosting:** Vercel (manual deploy via CLI, no auto-deploy)
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

### URLs
- **Production:** https://quizmint-blue.vercel.app
- **GitHub:** https://github.com/Yashrajkv28/quizmint
