# QuizMint Development Chat Log

## Session: 2026-04-23

### Summary
Shipped the Spotify "Now Playing" mini player as a BETA feature on the flip timer, after rejecting the OAuth / Web API path (25-user dev cap + Premium requirement). Embed-iframe approach — user pastes any `open.spotify.com` link, card renders inline. Full playback controls belong to Spotify, not us. Per-user dashboard toggle, Compact (80px) / Standard (152px) size picker, mobile fully gated. Along the way: widened main to 1400px + `min-w-fit` root to fix horizontal-overflow chrome breaks, and disabled the fullscreen button on mobile where `requestFullscreen()` isn't supported.

#### Task 54: Malwarebytes heuristic flags fullscreen usage
MBG blocks `quizmint.me` with "abuse of your device's full screen functionality" — pattern-matches tech-support-scam fullscreen lockers. Our usage is legit (user-initiated button + `F` shortcut, never programmatic on load), so the only real fix is a false-positive report to Malwarebytes. User deferred that, will allowlist the domain manually for now. No code change.

#### Task 53: Mobile gate for Spotify + fullscreen
User reported the fullscreen button doesn't work on any mobile browser (iOS Safari has no `Element.requestFullscreen()`, Android Chrome is partial). Also Spotify embed's interactivity (hover states, skip chevrons) is poor on touch. New `src/lib/useIsMobile.ts` — `matchMedia('(max-width: 767px)')` hook with live updates. Gated:
- Dashboard Spotify toggle + size picker: not rendered under 768px (stored preference preserved for desktop sessions)
- TimerView paste input + embed: same
- Fullscreen `Maximize2` button: hidden
- `F` keyboard shortcut: no-op on mobile
Viewport-based not user-agent — resizing the window across 768px live-toggles the UI.

#### Task 52: Deploy + merge to main
`song-include` merged into `main` with `--no-ff`, pushed, then `vercel --prod`. Deploy policy stays manual (GitHub still not linked to Vercel).

#### Task 51: Header border discontinuity + horizontal overflow
Screenshot showed two problems at narrow viewports: (a) clock + Standard player (~1150px combined) pushes past `max-w-[1100px] mx-auto` main, causing horizontal scroll, and (b) scrolling right revealed raw background — the `<header>`'s `border-b` ended at viewport edge while content continued. Fix:
- `max-w-[1100px]` → `max-w-[1400px]` on the main (fits clock+standard on ≥1400px viewports without scroll)
- `min-w-fit` on the root `<div>` so the whole page (header included) stretches to natural content width. Horizontal scroll now reveals a fully styled page, border-b continues all the way, and users can scroll both ways to see the leftmost hour digits.

Rejected an earlier attempt: pulling Change mode + theme toggle out of the header flow into a `fixed top-4 right-6` pill. User called it "horrible," reverted.

#### Task 50: Spotify player placement iterations
Three rounds of positioning, landed on a hybrid:
- **Compact (80px)**: always `fixed bottom-6 left-1/2 -translate-x-1/2` — both normal and fullscreen modes. Small enough not to compete with the timer buttons.
- **Standard (152px)**: flex sibling of the clock column, *outside* the emerald fullscreen card. `items-start` in normal mode (player top aligns with digit top edge), `items-center` in fullscreen (vertical center against the big card). Because it's the same DOM node in both modes, the iframe persists through fullscreen toggles — no playback reload.

Earlier attempts rejected:
- Fixed bottom-center only — "messes with the timer buttons in Standard/Full"
- Absolute `xl:left-full xl:ml-8` on the clock wrapper — put the player inside the emerald card, user hated it
- Flex-row keeping clock in center via absolute positioning — overflowed on narrow viewports

Hardcoded iframe theme to `theme=0` (dark) — app theme toggle was reloading the iframe and cutting off playback. The iframe now survives both fullscreen toggle AND light/dark swap.

Dropped **Full** size (352px) — tracklist-heavy variant looked bad in either placement.

#### Task 49: Spotify embed feature (BETA)
User drops a `https://open.spotify.com/<type>/<id>` link on the flip timer. Card renders a dark-themed iframe; user controls playback themselves (play / pause / next / prev / seek — full interactivity inside the iframe). Free-tier listeners get 30s previews unless they're logged into Spotify in the same browser with 3rd-party cookies allowed; Premium listeners get full tracks. We don't mediate any of that.

Files:
- `src/lib/spotify.ts` — URL parser accepts `/track/`, `/album/`, `/playlist/`, `/artist/`, `/episode/`, `/show/` (with optional `intl-xx/` prefix, query strings, and `spotify:*:id` URIs). 22-char base62 ID validation. `useSpotifyEnabled` / `useSpotifySize` / `useSpotifyUrl` hooks — localStorage-backed, cross-tab via the `storage` event and same-tab via a custom `qm-spotify-change` event.
- `src/components/timer/SpotifyEmbed.tsx` — `relative` card with emerald ring + green-tinted drop shadow. Close `X` centered at `top-1` to avoid colliding with Spotify's own top-right controls (first attempt at top-right was ugly, user caught it).
- `src/components/Dashboard.tsx` — first row in the account sidebar: mint Music icon, "Spotify player · BETA" (amber pill), caption "Music on the flip timer · login required on open.spotify.com" (login phrase in red, links to `open.spotify.com`). Segmented `Compact / Standard` picker appears below the toggle when enabled, tucked inside an inset bg-app pill.
- `src/components/timer/TimerPage.tsx` — URL input below presets when toggle on and no URL saved; valid paste stashes the URL, input disappears, card appears.
- `vercel.json` — `frame-src https://open.spotify.com` added to the CSP from Task 35.

Rejected the OAuth/Web API path before starting:
- Spotify dev mode caps at 25 allowlisted emails; extended quota needs review
- Web Playback SDK requires Premium
- Our CSP would need `connect-src` + `img-src` additions, not just `frame-src`
- Color extraction from album art (cinematic theming) was the one thing OAuth offered that the embed can't do — decided not worth the cost. Parked in `future.md` section 7.

### URLs
- **Production:** https://quizmint.me
- **GitHub:** https://github.com/Yashrajkv28/quizmint
- **Branch:** merged `song-include` → `main`

---

## Session: 2026-04-22

### Summary
Shipped auth + dashboard + custom domain + hardening. Landing → login → dashboard → generator is now the real flow. Uploads per-user to Supabase storage with a daily cleanup cron. `quizmint.me` is live, Resend SMTP handles auth emails, CSP and friends are in place. MCQ option shuffling defeats AI-bias toward a fixed correct letter. Later same day: integrated a flip-clock timer (Clock / Countdown / Count up / Hybrid) ported from a personal `chronoflip` project, stripped of speech-timer IP, and reskinned to the QuizMint mint aesthetic.

#### Task 48: Logo routes home based on auth
Dashboard's QuizMint header button was booting logged-in users back to the landing page. Renamed the prop (`onBackToLanding` → `onLogoHome`) and wired it in `App.tsx` as `user ? 'dashboard' : 'landing'`. TimerPage already routed to dashboard via `onBack`, so no change needed there.

#### Task 47: Hover effects on dashboard and timer menu cards
Two distinct motions so cards feel different, not uniform:
- **Generate** and **Flip timer** (primary CTAs): share identical emerald gradient wash + 30/60% border + hover-only `shimmer-hover` sweep (2.5s). Permanent shimmer removed — it was irritating at rest.
- **4 mode cards** in TimerMenu: new `mint-breathe` class — emerald box-shadow pulses at rest to full emerald ring + outer glow (2.6s cycle). Radial motion, different grammar from the sweep.
- **Info chips** (Sources / Speed / Privacy): stripped back to a static emerald border — no shimmer, no hover motion. They're metadata, not actions.

Added `.shimmer-hover` and `@keyframes mint-breathe` to `src/index.css`.

#### Task 46: ChronoFlip timer integration (Clock / Countdown / Count up / Hybrid)
User dropped a `chronoflip/` folder into the repo — a personal flip-clock app — and asked for its modes to become a QuizMint tool, with the speech-timer features strictly excluded (company IP). Grep found 145 speech/event/orb references inside `FlipClockTimer.tsx` — full rewrite of the container was cheaper than surgical de-linting.

**Extracted, reskinned:** `FlipDigit.tsx` and `FlipClockDisplay.tsx` → `src/components/timer/` — zinc gradients swapped for `var(--c-surface)` + `var(--c-border)`, digits in JetBrains Mono via existing `font-mono`. Hinge line re-done as a mint gradient (`from-transparent via-emerald-500/40`). Colon separators go emerald with a soft halo.

**Rewritten:** `src/lib/useTimer.ts` — timestamp-based tick (`Date.now()` + refs, immune to tab throttling), 4 modes, hybrid phase handling. Clock mode reads `new Date()` on a 1s interval so system time stays authoritative (no drift). `startRef > 0` gate in `tick()` prevents a spurious finish chime firing when modes switch mid-run.

**New UI:** `TimerPage.tsx` splits into `TimerMenu` (centered 4-card mode selector with breathing glow) and `TimerView` (picked-mode runner). Dashboard grew a "Tools" subsection below the Generate hero with a Flip timer card. Fullscreen wraps the digits in a rounded card with emerald-ringed shadow and a pill-style status badge; content centers vertically in both normal and fullscreen modes.

**Audio, minimal:** Ported only `start` / `pause` / `alert` / `finish` chimes (Web Audio API, no external files, no speech IP). Alerts fire once at 60s and 10s remaining in countdown/hybrid-countdown phases; digits tint amber at ≤60s, red at ≤10s. No settings UI — the knob configuration was part of the speech-timer scope.

**Deleted:** entire `chronoflip/` folder after extraction (types/screens/segment cards/speech docs — all gone).

**Keyboard:** Space = start/pause/resume, F = fullscreen, Esc = exit fullscreen.

#### Task 45: Timer plan presented and iterated
Before writing any code, presented a 7-section plan covering scope, aesthetic mapping, file structure, and UX flow. User pushed back on three decisions:
- "why are we rewriting hybrid?" — clarified: hybrid *logic* (~15 lines) is reused, only the 1432-line container is rewritten.
- "why ticking?" for clock — clarified: it's live `new Date()` on every interval, not counted. OS is authoritative.
- "no audio?" — user wanted audio A (port the chimes). Fallback to synthesized-only sounds, no file dependencies.

Alerts dialed down to "minimal" per user taste ("color edits ruin the vibe") — two hard-coded thresholds, no UI.

#### Task 44: Tiny cleanup in Dashboard + preset centering on TimerPage
Presets stack was aligned left inside an `items-center` main — corrected with `flex-col items-center` wrapper and `justify-center` on the chip row.

#### Task 43: Fullscreen bugs + mint branding iteration
Two round trips with the user:
- Fullscreen wasn't centering vertically — `justify-center` on the main container fixed it.
- User asked for chronoflip-style bordered card in fullscreen — added emerald-ringed card (`border-emerald-500/30`, `shadow-[0_0_60px_-12px_rgba(16,185,129,0.35)]`).
- Tried emerald gradient on digit card faces — user rejected ("digit cards are a no no"). Reverted to flat `var(--c-surface)`. Kept emerald hinge + colon dots — those were liked.

#### Task 42: Phantom audio on mode switch (bug)
Switching from Clock → Countdown played the finish chime. Root cause: tick interval effect fires with `[status, mode, tick]` deps; when mode changed, the effect re-ran with the **old** `status='running'` before the reset effect flushed `setStatus('idle')`. The stale tick computed elapsed against `startRef.current = 0`, hit `remaining <= 0`, played `finish`. Fixed by (a) gating `tick()` on `startRef.current > 0` and (b) zeroing `startRef` / `totalPausedRef` / `pausedAtRef` inside the mode-change reset effect.

#### Task 41: Per-attempt option shuffling + letter re-mapping
User flagged a real teaching-side issue: a lot of AI-generated quizzes bias the correct answer toward a specific letter, so students memorize position instead of content. Fix in `src/lib/shuffle.ts` + `QuizPlayer.tsx`:
- Fisher-Yates shuffle (not `sort(() => Math.random() - 0.5)` which is biased)
- Options re-lettered a/b/c/d in visual order after shuffle, `correctOptionId` remapped to the new letter
- `useMemo` keyed on `[questions, attemptKey]` so order is stable mid-quiz but re-shuffles on **Restart Output** / **Retry Quiz**
- All render + score paths now use `displayQuestions` instead of raw `questions`

Data model was already keyed by `correctOptionId` (not index), so grading survives the reshuffle for free.

#### Task 40: DNS IP-range migration
Vercel prompted a DNS update for planned IP range expansion. Swapped two records in Namecheap:
- `A @`: `76.76.21.21` → `216.198.79.1`
- `CNAME www`: `cname.vercel-dns.com.` → `ed165d6e01573168.vercel-dns-017.com.`

Resend MX/TXT rows untouched. Vercel runs old + new in parallel — zero downtime during propagation.

#### Task 39: Cream light mode (subtle paper palette)
User wanted a warmer, less-sterile light mode. Two attempts, settled on the subtle one:
- `--c-app: #FAF7F0`, `--c-surface: #FFFDF8`, `--c-border: #ECE6D8`, warm text (`#1A1713` / `#3A342B` / `#5C5346` / `#837866`)
- One bolder version (`#F3EBD6` / `#FBF5E6` / `#DED2B0`) was deployed and reverted — "looks shit now"
- Original cool-grey values (`#F6F7F9` / `#FFFFFF` / `#E4E6EB`) kept as a documented fallback

Dark mode untouched.

#### Task 38: Dashboard redesign — Workspace layout
Previous dashboard was functional but "mid". Generated a 3-variant mockup page (`mockups/dashboard.html`) — Spotlight / Workspace / Command — user picked Workspace. Rewrote `src/components/Dashboard.tsx`:
- 12-col grid, main column 8 wide with hero "Generate a quiz" card (gradient wash + CSS `shimmer-sweep` overlay), 3-chip info strip below
- Sticky account sidebar (4 wide) with email/password/signout rows + inline password-confirm delete zone
- Main column left open for future tool cards (timer, etc.)
- Works in both themes via `var(--c-*)` throughout
- `shimmer-sweep` keyframe added to `src/index.css`

#### Task 37: Gmail-only signup + strong password policy + animated strength meter
- `src/lib/validation.ts` — `validateEmail` (gmail-only on signup/forgot-password; sign-in skips so pre-existing non-gmail accounts can still log in), `validatePassword` (8+, upper/lower/digit/symbol), `PASSWORD_HELP`, `getPasswordChecks` per-rule breakdown
- `PasswordStrength.tsx` — 5-segment bar, red→amber→lime→emerald, Too weak → Excellent label, rule pills with check/x icons, all CSS transitions (no libraries)
- Wired into `LoginPage.tsx` (signup tab), `AccountModal.tsx` (change password), `ResetPasswordPage.tsx`
- Sign-in path deliberately skips gmail check so Supabase surfaces the error server-side

#### Task 36: `docs/services-used.md` — service expiries and limits
Created reference doc listing Vercel (Hobby, never expires, daily cron limit, 300s timeout, 4.5MB body cap), Supabase (Free, auto-pauses 7 days idle), Resend (Free, 100/day, 3000/month, 1 custom domain), Namecheap (GitHub Student Pack, **expires 2027-04-21**), Google AI Studio (Free, 20/day/model × 5 rotating keys), GitHub Student Pack. Renewal calendar table at the bottom.

#### Task 35: Security headers in `vercel.json`
Added headers block covering all routes:
- `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (defense-in-depth against clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Content-Security-Policy`: `default-src 'self'`, scripts `'self'`, styles `'self' 'unsafe-inline' + Google Fonts`, images `self data: blob:`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co`, `worker-src 'self' blob:`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`

#### Task 34: Remove Vercel-generated preview domain from canonical URL
`quizmint-blue.vercel.app` auto-regenerates on every deploy — can't be permanently deleted. Chose `quizmint.me` as the primary domain; every other alias (including `www.quizmint.me` and all auto `.vercel.app` hosts) redirects to it via the Vercel Domains UI.

#### Task 33: Resend SMTP → Supabase auth emails via `quizmint.me`
Set up Resend's free tier (100/day, 3000/month) as the SMTP provider for Supabase auth. DNS records added to Namecheap (Advanced DNS for TXT, Custom MX block for MX):
- `MX send` → `feedback-smtp.ap-northeast-1.amazonses.com` (priority 10)
- `TXT send` → `v=spf1 include:amazonses.com ~all`
- `TXT resend._domainkey` → DKIM public key
- `TXT _dmarc` → `v=DMARC1; p=none;`

Debugging notes: Namecheap's top "Host Records" block has no MX type unless "Mail Settings" is explicitly set to "Custom MX" — and even then the MX input lives in its own block at the bottom of the page, not in the main records table. Branded HTML email templates committed under `docs/email-templates/`.

#### Task 32: Custom domain `quizmint.me` via GitHub Student Pack
Grabbed the 1-year free `.me` via the Student Developer Pack → Namecheap. Pointed at Vercel, removed an accidentally-configured GitHub Pages integration. Domain expires **2027-04-21**. Security hygiene: 2FA on Namecheap (authenticator, not SMS), Registrar Lock ON, WhoisGuard ON.

#### Task 31: `/api/account/delete` + password re-auth
Self-service account deletion:
- `api/account/delete.ts` — verifies bearer token, lists the user's files in the `user-uploads` Supabase bucket, removes them, then calls `supabaseAdmin.auth.admin.deleteUser(auth.id)`
- Client re-authenticates with `signInWithPassword` before calling the endpoint — a hijacked browser session can't silently nuke the account without the current password
- UI: inline password-confirm zone on the dashboard, Enter-to-submit, red styling

#### Task 30: Dashboard v1 (between login and generator)
Added `Dashboard.tsx` as the post-login landing: generate card, profile rows (change email, reset password, sign out), red danger zone with inline delete. Sign-out was removed from the `QuizGenerator` sidebar to consolidate account actions. Design marked "mid" by the user, kicked off the Task 38 redesign.

#### Task 29: Fix `FUNCTION_INVOCATION_FAILED` on all `/api/*` routes
Vercel's bundler was silently skipping files under `api/_lib/`, so every serverless function threw `Cannot find module '/var/task/api/_lib/auth'` at runtime. Moved the shared auth helper to `server/auth.ts` (outside `api/`, no underscore prefix) and added `.js` extensions to all relative imports so Vercel's ESM resolution doesn't choke. Lazy-init proxy around `createClient` so missing env vars surface as a handled error instead of crashing the function cold-start.

#### Task 28: Tighten Gemini key rotation (proper 429 detection)
`err.status` from the Gemini SDK is often `undefined`; the actual code lives in `err.error.code` or `err.response.data.error.code`. Rotation was falling through to 502 instead of retrying on the next key. Fix in `api/generate.ts`: check nested code paths AND regex the message for `429`, `RESOURCE_EXHAUSTED`, `quota`, `UNAUTHENTICATED`, `PERMISSION_DENIED`. Confirmed working after adding two more keys (`GEMINI_API_KEY_4/_5`) to Vercel env.

### URLs
- **Production:** https://quizmint.me
- **GitHub:** https://github.com/Yashrajkv28/quizmint

---

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

### URLs (at time of this session)
- **Production (auto-generated):** https://quizmint-blue.vercel.app
- **GitHub:** https://github.com/Yashrajkv28/quizmint
