# QuizMint — future improvements

Things to raise the landing + app from 8.5/10 to 9.5/10. Not scheduled — park here until ready.

## 1. Code-split the landing from the app
The marketing landing shouldn't ship the whole Gemini/quiz stack. Current bundle is 732 KB (200 KB gzipped). `LandingPage` is pure presentation — no Gemini calls, no PDF parsing — so it should lazy-load the app chunk on CTA click.

- Convert `QuizGenerator` / `QuizPlayer` imports in `App.tsx` to `React.lazy`
- Wrap the app branch in `<Suspense fallback={...}>`
- Measure: aim for landing-only first paint well under 100 KB gzipped

## 2. Mobile polish
Desktop is solid. Phone-sized viewports were never actually tested.

- Hero headline at `clamp(48px, 9vw, 124px)` — verify the 48px min doesn't overflow at 360px
- Marquee font size (26px italic) probably too big on mobile — scale down
- CTA slab padding collapses via `clamp` but the button + serif heading pair needs a look
- Nav: at narrow widths the wordmark + theme toggle + "Make a quiz →" should stack or tighten
- `FloatingCards` is already hidden under 1100px — good, but confirm the hero text doesn't feel lonely

## 3. Show, don't just tell — animated product demo
The Editorial direction in `QuizMint Home Redesign.html` had a `DemoCard` that cycled through paste → parsing (with progress bar) → interactive quiz. That's the single best thing it did. Playful's floating cards are decorative; they don't prove the product works.

- Port the Editorial `DemoCard` (lines 176–296 in the handoff) into a new component
- Place it either replacing FloatingCards in the hero right column, or as a dedicated section between hero and marquee
- Tokenize colors like we did for the rest of the landing
- Keep the 3-stage auto-loop (paste → parsing → quiz → restart)

## 4. Accessibility audit
Untouched so far.

- Contrast: mint `#10B981` on mint-ink `#052E24` in the CTA — verify WCAG AA
- Focus rings: every pill button currently relies on browser defaults. Add a visible `:focus-visible` ring in brand or ink color
- ARIA: only the theme toggle has `aria-label`. Audit the CTA buttons, nav, GitHub link
- Heading order: landing is `h1` then `h2` — confirm no skipped levels
- `prefers-reduced-motion` already disables floating cards; also disable the marquee and any future DemoCard animation
- Keyboard nav: tab through the whole landing + app, confirm nothing traps or jumps

## 5. Metadata / social preview
Right now sharing the URL in iMessage / Slack / Twitter gives a blank preview.

- OG image: 1200×630 with the Leaf Q + "QuizMint — any document, instantly studyable." Render once, host at `/og.png`
- `<meta property="og:title">`, `og:description`, `og:image`, `og:url`
- Twitter card: `twitter:card = summary_large_image`
- `<meta name="description">` for SEO — currently none
- Consider a `<link rel="canonical">` pointing at the `quizmint-blue.vercel.app` alias

## 6. Nice-to-haves (lower priority)
- Error boundary around the app branch so a Gemini failure doesn't blank the page
- Persist `theme` + maybe a "skip landing" preference in localStorage (Task 19 deliberately didn't do this for splash — reconsider for landing if friends give feedback)
- Actual favicon PNG fallbacks for browsers that don't handle SVG favicons well
- Telemetry: just a single Vercel Analytics counter on CTA click would answer "does anyone actually press the button"

## 7. Spotify "Now Playing" for the flip timer
Personal want: a small music window alongside the focus timer. Two pieces:

- **Now Playing card** — floating bottom-corner card on `TimerView`: album art thumb, title + artist, next track from `/v1/me/player/queue`. Poll `/v1/me/player` every 5s (pause polling when tab hidden).
- **Dynamic accent from album art** — extract dominant color with `node-vibrant` or `colorthief`, smoothly animate `--c-brand` / `--c-brand-deep` / glow shadows to match. Cinematic, not jarring. Respect `prefers-reduced-motion`.

Blockers (why this is parked, not scheduled):
- Spotify dev mode is capped at **25 allowlisted users** and needs each tester's email pasted into the Spotify dashboard. Extended quota mode requires a formal review.
- Some `/v1/me/player/*` endpoints require the end user to have **Spotify Premium** — free-tier listeners get 403s on parts of this.
- Our current CSP (`vercel.json`, Task 35) blocks it. Would need `connect-src` additions for `https://api.spotify.com` + `https://accounts.spotify.com` and `img-src` for `https://i.scdn.co`.

Implementation shape when revisited:
- OAuth 2.0 **Authorization Code + PKCE** (SPA-friendly, no client secret in browser). Callback handled by a Vercel serverless function under `api/spotify/`.
- Store refresh tokens server-side keyed on Supabase `auth.uid` (new `spotify_tokens` table). Access token refresh runs server-side; client only sees short-lived tokens.
- `useSpotifyNowPlaying` hook mirrors `useTimer`'s shape — owns polling + state, no UI. `NowPlayingCard` component is purely presentational.
- Feature-flag per user (dashboard toggle, default off). Only surface the UI when the user is in the allowlist.
- Scope to Countdown / Count up / Hybrid modes — skip Clock mode (pure decoration there).
- Wrap Spotify calls in a `SpotifyClient` class with one method per endpoint so playback controls can drop in later without restructuring.

## 8. Ambient animation synced to Spotify play-state
"Visualizer" for the embed is impossible — cross-origin iframe, browser same-origin policy, no access to audio samples. `getDisplayMedia` would work but prompts every session and captures all tab audio (creepy). Web Playback SDK reopens OAuth + Premium, rejected in section 7.

What we *can* do: honest ambient animation. Load Spotify's IFrame API (`https://open.spotify.com/embed/iframe-api/v1`) instead of a raw `<iframe>`, subscribe to `playback_update` events, and use just the play/pause state to drive a slow gradient/blob animation behind the timer.

- When playing: background gradient slowly cycles (e.g., 20s loop, emerald/teal shift)
- When paused: animation halts/fades
- No pretending to beat-match; truthful to the data we actually have

Not a visualizer — more like "vibe mode." Fits the focus-timer aesthetic. Respect `prefers-reduced-motion`. Per-user toggle or bundled into the Spotify BETA feature.

## 9. Real legal pages (Terms, Privacy, possibly Cookies)
The footer currently carries a generic disclaimer paragraph (© line + as-is / not-affiliated / no-warranty / files-not-retained) but **no actual T&C or Privacy Policy pages**. Good enough for a side project shown to friends; not good enough once the site sees real traffic, especially given:
- We auth via Google OAuth (Gmail) — privacy law (GDPR / CCPA / India DPDP Act) requires a Privacy Policy that names what we collect, why, retention, and the user's rights
- We process user-uploaded study material — needs an explicit data-handling clause (we currently process transiently with no retention; that should be stated formally and enforced by the cleanup cron)
- Gemini calls send file content to a third-party LLM — Privacy Policy must disclose this sub-processor

What to build:
- `/terms` route with **Terms of Service** — license to use, AUP, no-warranty, limitation of liability, governing law, termination, changes-to-terms clause
- `/privacy` route with **Privacy Policy** — data we collect (email, OAuth profile, uploaded files transiently, generated quizzes), purposes, sub-processors (Google OAuth, Google Gemini, Vercel, Supabase), retention (transient for files, indefinite for account data until deletion request), user rights (access / delete / export), contact email, last-updated date
- Footer-link both pages from the disclaimer paragraph (the disclaimer becomes a teaser; the real text lives on the routes)
- Add a "Last updated: YYYY-MM-DD" line at the top of each
- Don't write the legal text by hand — use a generator like Termly / iubenda / Termsfeed and paste the output. Skill agents should NOT invent legal copy.
- Account-deletion path: a button in the user settings or a `mailto:` to a project email that triggers a manual delete from Supabase. Required by GDPR Art. 17 ("right to erasure").

Implementation shape:
- Pages live under `src/components/legal/Terms.tsx` and `src/components/legal/Privacy.tsx`, rendered by a thin route layout with the same nav as the landing
- React Router (or whatever routing the app uses post-Task-65) gets two new routes
- Update `vercel.json` if needed (probably not — same SPA fallback)
- After deploy: re-run the Lighthouse "Best Practices" audit, which currently flags missing privacy policy

Out of scope for now (park):
- Cookie banner — we don't currently set marketing/analytics cookies, only session auth ones (essential, no consent required under GDPR). Re-evaluate if/when Vercel Analytics gets added per Task 6.
- DPA (Data Processing Agreement) for institutional customers — needed only if we go B2B.

## 10. Logo-home: guard against losing unsaved input
The sidebar QuizMint logo now navigates back to the landing page (Task 27). It unconditionally wipes `quizData` and `showLanding = true`, which means a user mid-paste or mid-quiz loses their state silently.

Upgrade: before navigating, check for unsaved work — non-empty `rawText` in `QuizGenerator`, an `uploadedFile`, or an in-progress `quizData` with unanswered questions — and show a confirm dialog ("Leave? Your input will be cleared."). Only nuke state on confirm. The check needs `QuizGenerator` to lift or expose its dirty state (currently local), or App can track it via a callback ref.
