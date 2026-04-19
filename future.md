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
