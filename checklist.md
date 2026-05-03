# Battle Mode Smoke Test Checklist

> Run after `npm run dev`. Need **two browser windows** signed in to **different accounts** (Window A = host, Window B = joiner). Use incognito for B if you only have one account, but real second account is better.
>
> Fill in `Result:` for each step after running it. Write FAIL with details if anything misbehaves. The agent will read this next time to know what works and what to fix.
>
> Tested on commit: ___________ (`git rev-parse HEAD`)
> Date: ___________

---

## Pre-flight

- [ ] `npm run dev` starts cleanly, no console errors on landing page
- [ ] Both windows can sign in successfully

Result:

---

## Test 1 — Happy path: generate → host → join → full battle → exit

**Goal:** End-to-end with no friction. Verifies the new "Host a battle" button on QuizPlayer (the fix from the start of this session).

**Window A (host):**
1. Sign in → dashboard
2. Click "Quick Generate" (or however you reach the generator) → land on quiz generator
3. Generate a quiz (2-3 questions is fine for testing)
4. After generation, you should see `<QuizPlayer>` rendering the questions
5. Top right: confirm there's a green **"Host a battle"** button next to **"Exit Quiz"**
6. Click "Host a battle" → should land on BattleEntry with the host card showing "Using your current quiz — N questions"
7. Click "Create room" → BattleLobby with 6-char code visible

**Window B (joiner):**
8. Sign in → dashboard → Battle tile → BattleEntry
9. Type the room code → "Join battle"
10. Should land in BattleLobby with both display names visible

**Window A:**
11. Click "Start battle" (button should be enabled now that 2 players present)
12. Both windows: see `<BattleQuestion>` with the same question, timer counting down, and "0/2 answered" counter
13. Both windows: pick an answer
14. Counter should update to "1/2" then "2/2" → auto-reveal triggers immediately when both answered
15. Both windows: see `<BattleLeaderboard>` with auto-advance countdown
16. Wait for next question (or auto-advance)
17. Repeat for remaining questions
18. After last question: both windows see `<BattleResults>` with podium

**Window A (host):**
19. Click **Exit**
20. Should land on dashboard with **NO quiz preserved** (Quick Generate should show fresh generator, not stale QuizPlayer)

**Window B:**
21. Click **Exit** → dashboard

Result:


---

## Test 2 — Rematch flow

**Goal:** Verify the rematch logic works — host triggers, both clients migrate to new room, old room is destroyed after 5 s.

**Setup:** Continue from end of a battle (both windows on `<BattleResults>`). If you exited Test 1, run a fresh quick battle to reach results again.

**Window A (host):**
1. On `<BattleResults>`, click **Rematch**
2. Button should briefly show "Setting up rematch…"
3. Should land in a fresh `<BattleLobby>` with a **NEW** 6-char code (different from the previous one)

**Window B (non-host):**
4. Should automatically migrate to the new lobby — should see the new room code without clicking anything
5. Both display names should appear in the lobby

**Both windows:**
6. Player count shows 2/20
7. Run another full battle (start → questions → results)

**Old room cleanup verification (optional, more advanced):**
8. Open Supabase dashboard → Table editor → `rooms` table
9. ~5-10 seconds after the rematch fired, the old room (the one with the previous code) should be **gone** (deleted via the destroy endpoint)
10. The new room should be there

Result:


---

## Test 3 — Lobby cancel by host

**Goal:** Host clicks "Cancel room" — non-host should gracefully end up on Results, not stranded on "Loading room…"

**Setup:** Both windows in `<BattleLobby>` (host created, joiner joined, but Start NOT clicked).

**Window A (host):**
1. Click "Cancel room" (top-left)
2. Should immediately go to dashboard

**Window B (non-host):**
3. Should transition to `<BattleResults>` (empty leaderboard, scores all 0) — NOT "Loading room…"
4. Click Exit → dashboard

Result:


---

## Test 4 — Lobby leave by non-host

**Goal:** Non-host clicks "Leave lobby" — their player row removed, host's lobby player count drops.

**Setup:** Both windows in `<BattleLobby>` (lobby has 2 players).

**Window B (non-host):**
1. Click "Leave lobby" (top-left)
2. Should land on dashboard (or BattleEntry — whichever the back path takes you)

**Window A (host):**
3. Within ~1 second, the players list should drop from 2 to 1
4. "Start battle" button should become disabled again ("Need at least 2 players")

Result:


---

## Test 5 — Mid-battle leave by non-host (the subtle one)

**Goal:** Verify the `room_answers` DELETE listener fix works. When a player leaves mid-question, their answers should disappear from everyone's local count, and auto-reveal should NOT fire prematurely.

**Setup:** This needs **THREE** participants ideally — host + 2 joiners. If you only have 2 windows, you can still test the leave path but the auto-reveal premature-fire scenario won't trigger. Three windows is best.

**Three-window version:**
1. Window A hosts, Windows B and C join (3 players in lobby)
2. Host clicks Start
3. All three see Q1
4. Window B answers Q1
5. Window C does NOT answer
6. **Window B clicks Leave** (the button next to the timer) — Window B exits to dashboard
7. **Crucial check:** Window A and Window C should NOT auto-reveal Q1 yet — counter should show "0/2 answered" (B's answer was cascaded out, B is no longer counted)
8. Window C answers Q1
9. NOW auto-reveal fires — counter should show "1/2 answered" briefly, then both A and C move to leaderboard
10. Leaderboard should show only A and C, no B

**Two-window version (degenerate):**
1. Window A hosts, Window B joins, start the battle
2. Q1 shows
3. Window B clicks Leave → exits
4. Window A: counter should show "0/1 answered" (B's removal updates totalPlayers from 2 to 1)
5. Window A answers → auto-reveal → leaderboard shows only A
6. Battle proceeds with just A

Result:


---

## Test 6 — Mid-battle leave during the leaderboard phase

**Goal:** Same as Test 5 but during the between-questions leaderboard, not during a question.

1. Run a 3-player (or 2-player) battle to the leaderboard between Q1 and Q2
2. Non-host clicks "Leave battle" (the button below the auto-advance countdown)
3. They exit to dashboard
4. Other clients should see the leaderboard re-render without them within ~1 second
5. Auto-advance should still work normally

Result:


---

## Test 7 — Host tab-close mid-battle (presence-based abandon)

**Goal:** Verify the 20-second host-disconnect detection still works.

**Setup:** Battle in progress (any phase — question or leaderboard).

1. Host suddenly **closes the tab** (Cmd/Ctrl+W or x button) — do NOT use Cancel/Leave
2. Start a stopwatch on Window B
3. Window B should sit there for ~20 seconds (presence grace period)
4. After ~20s, Window B should automatically transition to `<BattleResults>` (the abandon endpoint flipped status to finished)
5. Window B can click Exit normally

**Variant — host refreshes:**
6. During another battle, host hits F5 / refresh
7. Host loses session (lands on dashboard or login depending on auth state)
8. Window B again waits ~20s, then sees Results

Result:


---

## Test 8 — Navigation: BattleEntry back button

**Goal:** Verify the new "← Dashboard" button on BattleEntry doesn't strand the user.

1. Dashboard → Battle tile → BattleEntry (no quizData)
2. Click "← Dashboard" at top-left
3. Should return to dashboard cleanly

4. Same flow but with quizData (after generating a quiz first)
5. From QuizPlayer click "Host a battle" → BattleEntry shows quiz info
6. Click "← Dashboard"
7. Returns to dashboard. **`quizData` is cleared** (per the `onExit` handler that nulls it)
8. Verify by clicking Quick Generate — should be fresh generator, not stale QuizPlayer

Result:


---

## Test 9 — Multiple consecutive rematches

**Goal:** Verify rematch works repeatedly without state leaking between rounds (the `key={session.roomId}` remount).

1. Run a full battle to results
2. Host clicks Rematch → new lobby
3. Run another full battle to results
4. Host clicks Rematch again → another new lobby
5. Run a third battle to results
6. Each rematch should:
   - Generate a different room code from the previous
   - Both players land in the new lobby together
   - Scores reset to 0 for both players
   - The rematch button on the host's results screen should be ENABLED (not stuck disabled from a previous round)

Result:


---

## Test 10 — Sign-out during battle

**Goal:** Auth state changes while inside battle should evict to landing.

1. Sign in, get into a battle (lobby or active)
2. In that window, sign out (however your app does it)
3. Should immediately bounce to landing page (per the `useEffect` in App.tsx that watches user + view)
4. quizData should be null
5. Other window's battle continues normally OR transitions to abandoned-host results if it was the host who signed out

Result:


---

## Test 11 — Two-question quiz edge case

**Goal:** Smallest possible battle. Verify "isLastQuestion" detection and final results work.

1. Generate a quiz with the **minimum** number of questions your generator allows
2. Run a battle through to the end
3. After the last question's leaderboard, the countdown should say "Final results in Ns…"
4. Should transition to BattleResults, not back to a question

Result:


---

## Test 12 — Try to host without a quiz

**Goal:** Verify the "I need a quiz first" UX path.

1. Dashboard → Battle (with no quizData — fresh session or after exit-clears)
2. BattleEntry shows host card with "I need a quiz first" text
3. Click that button OR click "Go to quiz generator →"
4. Should navigate to the quiz generator
5. Generate a quiz → QuizPlayer renders
6. Click "Host a battle" → back to BattleEntry, this time with quizData
7. Card now says "Using your current quiz" → click Create room

Result:


---

## Test 13 — Invalid room code

**Goal:** Sanity check on join validation.

1. Window B: BattleEntry → Join card
2. Type a 6-character code that's all letters but doesn't match a real room (e.g., "QQQQQQ")
3. Click "Join battle"
4. Should see error "Room not found." (the regex `[A-Z0-9]{6}` allows 0/O/1/I/L which the alphabet excludes — those will hit this same error)
5. Type a too-short code (e.g., "ABC") — Join button should be DISABLED (client-side check `code.length !== 6`)

Result:


---

## Test 14 — Late join attempt

**Goal:** Verify joiner can't enter a battle that's already started.

1. Window A hosts, Window B joins, host clicks Start
2. Battle is now active (Q1 showing)
3. Open a **third window/incognito C**, sign in, navigate to Battle, type the active room's code
4. Click Join → should see error "Battle already in progress."

Result:


---

## Test 15 — Browser console: confirm answer-key visibility (KNOWN ISSUE)

**Goal:** Confirm the v1 limitation documented in `DOTHISASAP.md` is real. This SHOULD be exploitable currently — fixing it is the post-exam task.

1. As a non-host player in an active battle, open DevTools console
2. Run:
   ```js
   const { data } = await window.supabase.from('rooms').select('quiz_data').eq('code', '<your room code>').single();
   console.log(data.quiz_data.questions[0]);
   ```
   (You may need to expose `supabase` on `window` or use the existing app's binding — check `src/lib/supabase.ts`)
3. Expected: the response includes `correctOptionId` for every question. Cheating is possible.
4. After the post-exam fix, this same query should return questions WITHOUT `correctOptionId`, and a separate query against `room_answer_keys` should return empty (RLS denied).

Result (this confirms the known issue, not a regression):


---

## Bugs / unexpected behavior found during testing

Record anything weird here for the next agent session to fix:

1.

2.

3.

---

## Sign-off

- [ ] All tests pass or known issues understood
- [ ] Ready to deploy to production via `vercel --prod`

Tested by: ___________
Deployed: ___________
