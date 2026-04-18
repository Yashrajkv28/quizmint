# Rename brainstorm

Context: "QuizMint" is already taken by other projects. Parking this here for a future rename — keeping the name for now.

## Strategy

Stop trying to be descriptive. `Quiz` + word is crowded. Coined words you can *own* are the move — short, pronounceable, not a real English word. Easier to trademark, easier to buy the domain, easier to rank on Google.

## Candidates

### Coined / brandable
- Querio
- Quizling
- Quizkin
- Quilo
- Quizora
- Querlo

### Mint-adjacent without "mint"
- Sprig
- Sprout
- Verdant
- Basil

### Action verbs (the app mints quizzes from docs)
- Forgequiz
- Paperpop
- Quizcast
- Quizforge

### Playful / one-word
- Quipp
- Quirk
- Quizzy
- Snap
- Pop

## How to pick (10 min test)

1. Shortlist 3–5.
2. Check each on `namechk.com` — shows domains, GitHub, npm, and social handles in one shot.
3. Throw out anything where the `.com` or `.app` is squatted for four figures.
4. Google `"<name>" quiz` — if page-one results aren't a competitor, you're probably safe.
5. Say it out loud. Text it to a friend. If they spell it wrong, ditch it.

## Gut picks

- **Querio** — clean, Latin-ish, quiz-adjacent
- **Quizling** — playful, memorable, reads as "small quiz" without trying

## When you're ready to rename

Five-file sweep:
- `package.json` — `name` field
- `index.html` — `<title>`, theme-color (probably stays mint)
- `src/App.tsx` — sidebar brand text
- `README.md` — headings + URLs
- `public/favicon.svg` — `aria-label`
- (optional) `QuizMintLogo.tsx` / `QuizMintSplash.tsx` component names if you want a clean slate

Also: rename the Vercel project, update the production alias, and decide what to do with the GitHub repo (rename vs. new repo + redirect).
