# Personal portfolio — notes for when I build it

Captured 2026-05-03 at 2:23 am after shipping QuizMint v3 landing. Don't lose these.

## Core principle: don't out-design the portfolio

It's tempting to build the portfolio site *more elaborate* than the work it showcases. Don't. A portfolio that's more designed than the projects it links to signals "this person cares more about their portfolio than about shipping." Keep the portfolio quiet — let the projects shout.

The QuizMint landing has scroll-pinned canvases, hand-drawn note fragments, a real flip clock, parallax cards, a typed-fragment animation system. The portfolio doesn't need to compete with that. The portfolio just needs to *frame* it.

Aesthetic target: closer to a writer's blog than a designer's reel. Confident typography, generous whitespace, one clean color, almost no animation. Linus-Lee-style or Maggie-Appleton-style — quiet, opinionated, clearly written by a human who has actually built things.

## Show, don't list

Skip:
- Skill bar charts ("React ████░░ 90%") — recruiters skim past these
- Tech logo grids ("My stack: [50 colored logos]")
- A "soft skills" section
- "Currently learning..." — feels like an apology
- Generic project cards with screenshots and a "Live" / "Code" button

Instead, write **2–3 case studies** per project, structured around the interesting bug and how I fixed it. The shape that works:

- **Context** (1 paragraph): what the project is, why I built it, what was at stake
- **The bug / problem** (1–2 paragraphs): something specific that went wrong, ideally something non-obvious. Not "the design wasn't responsive" — that's everyone. Things like "production CSP silently rejected `new Function`, which Vite dev allowed, so the page rendered with no animations only on quizmint.me." That's a real story.
- **The fix** (1–2 paragraphs): what I did, what I considered and rejected, why this approach
- **What I'd do differently** (1 paragraph): genuine retrospective, not humblebrag

QuizMint has at least three of these ready to write up:
1. **CSP blocks `new Function`** — production-only rendering bug, debugging via comparing dev vs prod CSP, fix by extracting the script to a module + memo
2. **PowerShell corrupted UTF-8** — `Get-Content | Set-Content` round-tripped through cp1252 and turned every emoji into mojibake; ten `replace_all` passes + a Python byte-replace for one C1 control byte; saved as a memory so future sessions don't repeat it
3. **The Leaf Q stem disappearing in dark mode** — slate vein/dot vanished on `#0A0A0C` bg; root cause was a brand-handoff spec that assumed "any background" but didn't account for the darkest theme; fix was switching to `currentColor` so the stem inherits the parent's text color across all six consumers + the splash

These read as "engineer who actually ships" not "junior who copies tutorials."

## Lead with QuizMint

Most personal projects are todo apps with a Tailwind starter. QuizMint isn't:
- Real product solving a real problem (not a clone of an existing tool)
- Full stack: auth (Supabase + Google OAuth), file upload, PDF parsing, Gemini integration, transient processing, cron-based cleanup
- Landing page with real design taste (scroll-driven canvas, both themes, brand mark with adaptive stem)
- Battle mode — realtime multiplayer, which most indie devs never touch
- Live at quizmint.me with a real domain
- Months of iteration visible in git history (real engineering, not weekend project)

This is the headline. Lead with it. Don't bury it under three half-finished side projects to "show range." One project shipped to production with care beats five abandoned demos.

## Stack (when I get there)

Don't overthink it:
- **Next.js** App Router or **Astro** for content-heavy. Astro probably better — portfolio is mostly static pages with minimal interactivity. Less JS shipped.
- **MDX** for case studies — write in markdown, embed React components when needed (a small interactive demo, a syntax-highlighted code snippet, an annotated screenshot)
- **Vercel** for hosting (already familiar from QuizMint)
- **Plausible** or no analytics. Don't add Google Analytics for a portfolio.
- **No CMS.** Case studies live as MDX files in the repo. Git is the CMS.
- **Inter** + one serif (Fraunces? A real book serif like Source Serif?). Don't use the variable-font-of-the-week.

What to skip:
- Headless CMS (overkill for ~5 pages)
- A blog "engine" — just write the case studies as static pages
- Comments / newsletter / RSS until there's actually content people want to subscribe to
- A custom 404 page that's funnier than the actual content (cliché)

## Pages, in order of importance

1. **Home** — name, one-line positioning, link to QuizMint case study, link to 1-2 other case studies, contact. That's it. No hero animation. No "scroll to discover."
2. **Case study: QuizMint** — the one above
3. **Case study: 1-2 more** — only if they're substantial. If not, leave them off.
4. **About** — short. What I'm interested in, what I'm working on now, where I am, how to reach me. No timeline of life events. No "my journey."
5. **Contact / footer** — email, GitHub, maybe Twitter / LinkedIn. No contact form (an email link is fine).

What to leave off:
- A "Resume" page — link to a PDF if asked, don't put one in nav
- A "Now" page (cliché now)
- A "Uses" page (cliché now)
- A "Bookshelf" page (extremely cliché now)
- A blog with three posts from 2024 ("I should write more!")

## Voice

Write the way I actually talk. The chat.md from QuizMint reads like a real person — sentences with rhythm, occasional "lol" and "🥺", confident corrections ("'cringe'" → cut the SCROLL ↓ cue). The portfolio should read the same way.

What kills portfolios:
- LinkedIn voice ("I'm a passionate developer with a strong interest in...")
- Listicle voice ("✅ React ✅ TypeScript ✅ Tailwind")
- Manifesto voice ("I believe great software is built at the intersection of...")
- "Currently obsessed with [trendy thing]" — read like a tweet from 2019

What works:
- Specific over abstract ("I shipped quizmint.me at 2 am" > "I'm a self-starter")
- Show the work, not the credentials
- Admit what didn't work — engineers trust other engineers who can name their failures

## Don't ship until

- The QuizMint case study is actually written (not "Coming soon")
- I've read it back to myself and it doesn't make me cringe
- A friend who isn't in tech can understand what QuizMint does from the home page
- It loads fast on mobile (no 500KB hero animation)
- Lighthouse Best Practices ≥ 95

## When I start

Probably do a `/brainstorm` session first — scope it, pick the stack, write one case study end-to-end before building any chrome around it. The case study is the product; the wrapper is incidental.
