# Shipping Battle Mode — Manual Steps

The Battle Mode feature is code-complete on branch `feat/battle-mode`. Three things still have to happen by hand: apply the DB migration, run an end-to-end test, and deploy.

Do them in order. Do not skip step 2.

---

## 1. Apply the migration SQL

**What it does:** creates the `rooms`, `room_players`, `room_answers` tables, RLS policies, Realtime publication, the `pg_cron` cleanup job, and the `increment_player_score` RPC.

### 1a. Enable `pg_cron` (one-time, only if not already enabled)

1. Open the Supabase dashboard for your QuizMint project (the same one `VITE_SUPABASE_URL` points to).
2. Left sidebar → **Database** → **Extensions**.
3. Search `pg_cron`. Toggle it on. Wait for the confirmation banner.
   - If it's already green/enabled, skip.

### 1b. Run the migration

1. Left sidebar → **SQL Editor** → **New query**.
2. In your repo, open `supabase/migrations/2026-04-25-battle-mode.sql`. Select all, copy.
3. Paste into the SQL editor.
4. Click **Run** (or `Ctrl+Enter`).

**Expected output:** `Success. No rows returned.` (One `SELECT` inside the cron wrapper may return a `bigint` job id — that's fine.)

**If you see an error:**

| Error | Meaning | Fix |
|---|---|---|
| `permission denied for schema cron` | `pg_cron` isn't actually enabled. | Redo step 1a. |
| `relation "rooms" already exists` | You've run it before. | Safe — script uses `create ... if not exists`. |
| `type "room_status" already exists` | Already created. | Safe — wrapped in a `DO $$ ... exception when duplicate_object` block. |

### 1c. Verify

All four of these have to pass before moving on:

1. **Table Editor** — three new tables visible: `rooms`, `room_players`, `room_answers`.
2. **Database → Replication** — under the `supabase_realtime` publication, all three tables checked.
3. **Database → Functions** — `increment_player_score` listed.
4. **Database → Cron Jobs** (sometimes under Integrations) — job named `quizmint-room-cleanup` with schedule `*/15 * * * *`.

If any verification fails, re-run the migration. Do not proceed to step 2 with a partial schema.

---

## 2. Two-window end-to-end test

### 2a. Boot the dev server

```bash
npm run dev
```

Wait for the `Local: http://localhost:3000/` line. Leave the terminal open.

### 2b. Prepare two browser profiles

You need two independent sessions:

- **Window A** — your regular browser, signed in to a test account.
- **Window B** — an **incognito/private** window (no shared localStorage, no shared Supabase session). Sign in with a second test account.

Open `http://localhost:3000/` in both.

### 2c. Host flow (Window A)

1. Sign in if not already.
2. Click **Generate a new quiz**. Paste a short prompt — 3–4 questions for a fast loop. Quick text:

   ```
   1. What is 2+2? A) 3 B) 4 C) 5 D) 6 — Answer: B
   2. Sky color? A) Red B) Blue C) Green D) Yellow — Answer: B
   3. Capital of France? A) Berlin B) Madrid C) Paris D) Rome — Answer: C
   ```

3. After the quiz generates, navigate back to Dashboard (logo or back button).
4. Dashboard → **Battle mode** card (has the `NEW` pill).
5. The `BattleEntry` screen loads. The Host card should read: *"Using your current quiz — 3 questions, Easy."*
6. Click **Create room**. You land on the lobby with a 6-character code (e.g. `K7HMPQ`), shown large.
7. Click the code to test clipboard copy — the icon should flip to a checkmark.

### 2d. Player flow (Window B)

1. In Window B (incognito), open `http://localhost:3000/`. Landing page appears.
2. Click **Start** → sign in with a second test account → Dashboard → **Battle mode**.
3. On `BattleEntry`, use the **Join** card: enter the code from Window A + display name `Alice`. Click **Join battle**.

> **v1 limitation:** unsigned guests can't currently reach the battle view from the landing page. Use a second signed-in account for testing.

Window A's lobby should update within 1–2 seconds to show `Alice`. The connection indicator should read **Connected** (emerald).

### 2e. Add a second player (Window C, recommended)

Starting a battle requires **≥ 2 players**.

1. Open a second incognito window (Window C).
2. Sign in with a third test account.
3. Join the same room with display name `Bob`.

Window A should now show both `Alice` and `Bob` (count `2/20`).

### 2f. Run the battle

1. **Window A (host)** — click **Start battle**. All three windows transition to the question view.
2. **Window A** sees a host view: question + 4 read-only answer cards + an `Answers received 0/2` counter.
3. **Windows B & C** see the full-screen question with 4 colored (blue / amber / rose / violet) answer buttons and a ticking 10.0s timer.
4. Have **Window B** answer quickly (within 2s). Let **Window C** wait until the timer hits 0.
5. After either the timer expires *or* both players answer, all windows transition to the leaderboard. Alice's score should be ~900, Bob's should be 0.
6. **Window A** — click **Next question**. Repeat for each question.
7. After the last question, the host button reads **End battle**. Click it. All windows show `BattleResults` with a podium.

### 2g. Invariants to verify

Tick each one:

- [ ] Player list updates live (join/leave) in under 2 seconds.
- [ ] Timer bars in Windows B and C are roughly in sync (within 0.5s of each other).
- [ ] A second tap on an answer button does nothing (UI locks).
- [ ] The host's **Next question** button works as expected (advances or ends).
- [ ] Refreshing Window B mid-battle re-joins idempotently and lands at the current question.
- [ ] Network tab in Window B → a `wss://...supabase.co/...` connection is open and green.
- [ ] Console tab — no red errors in any window.

If any check fails, **stop and debug** before deploying. Report the failure and we'll work through it.

### 2h. Shut down dev

`Ctrl+C` in the dev terminal.

---

## 3. Deploy to production

Deploy policy: **manual `vercel --prod`**. GitHub is not linked to Vercel, so pushing the branch does not auto-deploy.

### 3a. Pre-flight

```bash
git status
```

Working tree should be clean on `feat/battle-mode`. The `email-logo.png` modification is already committed.

### 3b. Merge into `main` (recommended — repo history shows direct-to-main is the norm)

```bash
git checkout main
git merge feat/battle-mode --no-ff -m "Merge feat/battle-mode: live multiplayer battle mode"
```

If you'd rather open a PR first, skip this and run step 3c from the branch — Vercel doesn't care which branch you deploy from.

### 3c. (Optional, recommended) Install the Vercel CLI globally

```bash
npm i -g vercel
```

Without this, you'll need to use `npx vercel ...` for every command in step 3.

### 3d. Deploy

```bash
vercel --prod
```

First-time prompts:

- *Set up and deploy "~/Downloads/quiz generator"?* → **Y**
- *Scope* → pick your team / personal account.
- *Link to existing project?* → **Y** → select **QuizMint**.

The deploy runs `vite build` remotely and uploads. Wait for the `✅ Production: https://quizmint.me` line (or whatever your custom domain is).

### 3e. Production smoke test

1. Open the production URL on your **desktop**. Sign in. Generate quiz → Dashboard → Battle mode → **Create room**.
2. Open the production URL on your **phone** (different network, ideally — catches CORS/WSS issues that dev hides). Sign in with a second account. Join the code.
3. Host starts the battle. Phone answers. Desktop advances.
4. Verify the final screen shows correct standings.

### 3f. Watch logs during the smoke test

In a second terminal:

```bash
vercel logs --follow
```

Flag anything containing:

- `FUNCTION_INVOCATION_FAILED` on `/api/rooms/*` → environment variables missing. Check Vercel dashboard → **Project → Settings → Environment Variables** for the **Production** environment. Required keys:
  - `VITE_SUPABASE_URL`
  - `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
  - `GEMINI_API_KEY`
- `wss://` blocked by CSP → shouldn't happen; `vercel.json` already allows `wss://*.supabase.co`.

### 3g. Rollback if something breaks

- **Fast rollback:** Vercel dashboard → Project → **Deployments** → pick the previous Production deployment → ⋮ → **Promote to Production**. Safe and instant.
- **Don't** patch-over-and-redeploy under pressure. Rollback first, fix locally, redeploy.

---

## When you're done

- Tick off Task 11, Task 20, Task 21 in the running task list.
- Mention any check from §2g that didn't pass — those are bugs that should be fixed before users see them.

Don't ship step 3 if step 2 didn't produce a clean end-to-end battle.
