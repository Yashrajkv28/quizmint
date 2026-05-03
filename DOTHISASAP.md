# DOTHISASAP — Battle Mode Answer-Key Visibility Fix

> **Saved 2026-05-03.** Implement after exams. About 30 minutes of work + a two-window smoke test.

## The problem

`rooms.quiz_data` (JSONB) currently contains `correctOptionId` for every question, AND the `rooms` table has a public-read RLS policy. So any player in a battle can open DevTools and run:

```js
supabase.from('rooms').select('quiz_data').eq('code', 'ABC123').single()
```

…and read the right answer for every question before the timer ends. This is documented in `supabase/migrations/2026-04-25-battle-mode.sql` lines 89-95 as accepted v1 tradeoff for "casual classroom use." If you ever care about competitive integrity, fix this.

## The fix — high level

Split the quiz into two parts:
- **Public part** (`rooms.quiz_data`): questions + options, **no `correctOptionId`**. Clients render this.
- **Private part** (new table `room_answer_keys`): the answer key. RLS denies public reads; only the service-role server can read it.

Postgres RLS is row-level, not column-level — that's why we need a separate table, not just a column-level grant.

## Step 1 — Migration

New file: `supabase/migrations/<date>-battle-answer-key-split.sql`

```sql
begin;

create table if not exists public.room_answer_keys (
  room_id    uuid primary key references public.rooms(id) on delete cascade,
  -- Position-aligned with rooms.quiz_data.questions: answer_key[i] = correctOptionId
  -- for questions[i]. Using text[] (not jsonb) so a future direct-from-SQL scoring
  -- path can index cheaply if needed.
  answer_key text[] not null
);

alter table public.room_answer_keys enable row level security;
-- NO select policy. Service role bypasses RLS; anon/authenticated cannot read.

-- DO NOT add this table to supabase_realtime publication. Clients have no
-- business subscribing to the answer key.

commit;
```

Apply via Supabase SQL editor (no `supabase db push` linked here per chat.md / project policy).

**Backfill decision:** existing rooms in the DB still have keys in `quiz_data`. Cleanest path: skip backfill — the cleanup cron reaps rooms 30 min after activity (per Task 64), so within an hour of deploying, every room is on the new schema. If you'd rather backfill, here's the one-shot:

```sql
-- One-shot backfill (optional). Run AFTER deploying the server changes below
-- so new rooms are already split correctly.
insert into public.room_answer_keys (room_id, answer_key)
select
  id,
  array(
    select (q->>'correctOptionId')::text
    from jsonb_array_elements(quiz_data->'questions') as q
  )
from public.rooms
where not exists (select 1 from public.room_answer_keys k where k.room_id = rooms.id);

-- Then strip correctOptionId from existing quiz_data:
update public.rooms
set quiz_data = jsonb_set(
  quiz_data,
  '{questions}',
  (
    select jsonb_agg(q - 'correctOptionId')
    from jsonb_array_elements(quiz_data->'questions') as q
  )
);
```

## Step 2 — Server changes

### `api/rooms/create.ts`

After validating quizData and before inserting the room:

```ts
const answerKey: string[] = body.quizData.questions.map((q: any) => q.correctOptionId);
const sanitizedQuiz = {
  ...body.quizData,
  questions: body.quizData.questions.map(({ correctOptionId, ...rest }: any) => rest),
};
```

Use `sanitizedQuiz` in the `rooms.insert({ quiz_data: sanitizedQuiz, ... })` call. Then, after the host-player insert succeeds, insert the key:

```ts
const { error: keyErr } = await supabaseAdmin
  .from("room_answer_keys")
  .insert({ room_id: room.id, answer_key: answerKey });
if (keyErr) {
  // Rollback BOTH the host-player insert AND the room insert. Order matters:
  // delete the room first; cascades will remove room_players. Then we don't
  // need a separate room_players delete.
  await supabaseAdmin.from("rooms").delete().eq("id", room.id);
  console.error("create answer key insert failed", keyErr);
  return Response.json({ error: keyErr.message }, { status: 500 });
}
```

### `api/rooms/rematch.ts`

The current code copies `oldRoom.quiz_data` straight into the new room. After the split, `oldRoom.quiz_data` is already sanitized (no correctOptionId) — good for the new room. But you also need to copy the answer key from the old room's `room_answer_keys` row into the new room's row.

Add to the `select` near the top:
```ts
const { data: oldKey } = await supabaseAdmin
  .from("room_answer_keys")
  .select("answer_key")
  .eq("room_id", oldRoomId)
  .single();
if (!oldKey) return Response.json({ error: "Old answer key missing." }, { status: 500 });
```

After the new host-player insert succeeds, mirror the key:
```ts
const { error: keyErr } = await supabaseAdmin
  .from("room_answer_keys")
  .insert({ room_id: room.id, answer_key: oldKey.answer_key });
if (keyErr) {
  await supabaseAdmin.from("rooms").delete().eq("id", room.id);
  return Response.json({ error: keyErr.message }, { status: 500 });
}
```

### `api/rooms/answer.ts`

Currently reads `room.quiz_data.questions[questionIndex].correctOptionId`. Change to:

```ts
const { data: keyRow, error: keyErr } = await supabaseAdmin
  .from("room_answer_keys")
  .select("answer_key")
  .eq("room_id", roomId)
  .single();
if (keyErr || !keyRow) return Response.json({ error: "Answer key missing." }, { status: 500 });
const correctOptionId = keyRow.answer_key[questionIndex];
if (!correctOptionId) return Response.json({ error: "Question missing." }, { status: 500 });

const isCorrect = correctOptionId === optionId;
```

The existing `room.quiz_data.questions[questionIndex]` check can stay (it validates the question exists), but the `q.correctOptionId` read goes away.

### Other endpoints (no changes needed)

- `api/rooms/start.ts` — never reads correctOptionId
- `api/rooms/next.ts` — never reads correctOptionId
- `api/rooms/abandon.ts` — never reads correctOptionId
- `api/rooms/leave.ts` — never reads correctOptionId
- `api/rooms/destroy.ts` — never reads correctOptionId. But: when a room is deleted, `room_answer_keys.room_id` has `ON DELETE CASCADE`, so the key row goes too. Verify this still works in your two-window test.
- `api/rooms/join.ts` — never reads correctOptionId

## Step 3 — Client changes

Make `correctOptionId` optional on the Question type so the battle path doesn't break, while solo QuizPlayer keeps using it.

`src/types.ts` (or wherever `Question` is defined):
```ts
export interface Question {
  question: string;
  options: { id: string; text: string }[];
  correctOptionId?: string;   // ← was required, now optional. Solo flow always sets it; battle clients receive it absent.
  explanation?: string;
}
```

Then audit consumers:
- `src/components/QuizPlayer.tsx:32` — uses `displayQuestions[qIndex].correctOptionId` for local verification. Solo flow always has it set. TS will flag the now-optional access; either assert or guard. Cleanest: `if (q.correctOptionId && answers[qIndex] === q.correctOptionId)`.
- `src/components/QuizGenerator.tsx` — generates and sets correctOptionId. Unchanged.
- `src/components/battle/BattleQuestion.tsx` — never reads correctOptionId. Unchanged.
- `src/types/battle.ts` — `BattleRoom.quiz_data: QuizData` still works because the runtime shape just lacks the optional field on questions. No type change needed here.

## Order of operations (important)

1. **Apply migration** in Supabase SQL editor — creates the table, no impact on running prod yet.
2. **Deploy server changes** — `vercel --prod` per project deploy policy. From this point, NEW rooms are split correctly.
3. **Optional backfill** — run the SQL above ONLY after step 2, otherwise old rooms might briefly have neither key copy if a request races.
4. **Smoke test** — two browser windows, host + join, full battle round. Then DevTools `supabase.from('rooms').select('quiz_data')...` and confirm no `correctOptionId` in the response.

If you skip backfill: rooms created before step 2 keep the old visibility until they're cleaned up by the cron (≤30 min after their last activity). Acceptable.

## Verification

After deploying, run these from a player's browser console while in an active room (not host):
```js
const { data } = await supabase.from('rooms').select('quiz_data').eq('id', '<roomId>').single();
console.log(JSON.stringify(data.quiz_data.questions[0]));
// Should NOT contain correctOptionId.

const { data: k, error: e } = await supabase.from('room_answer_keys').select('*').eq('room_id', '<roomId>');
// Should be { data: [], error: null } — RLS denies the read silently.
```

Both expectations confirm the fix works.

## Tradeoffs

- **One extra DB read per answer** — `answer.ts` now does 3 reads (player + room + key) instead of 2. Adds ~5-10 ms per scored answer. Negligible.
- **Two-write atomicity in `create.ts` / `rematch.ts`** — if the key insert fails after the room insert, the rollback path deletes the room. Already the existing pattern for the host-player insert; just one more step in the same chain.
- **Rollback-by-game** — if the answer key for a room is somehow missing (bug, partial backfill, manual DB edit), `answer.ts` returns 500 instead of silently scoring. That's the safe failure mode; no one gets a free correct answer.

## Files touched

- `supabase/migrations/<new>.sql` — table + RLS
- `api/rooms/create.ts` — split on insert
- `api/rooms/rematch.ts` — copy key on rematch
- `api/rooms/answer.ts` — read key from protected table
- `src/types.ts` — `correctOptionId` becomes optional
- `src/components/QuizPlayer.tsx` — guard the now-optional access (solo path only)

That's the entire scope. No client-shape changes for battle, no migration of running clients required.
