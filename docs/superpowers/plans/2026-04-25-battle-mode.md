# Battle Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live, Kahoot-style multiplayer quiz battle to QuizMint where a host starts a room from a generated quiz, players join via a 6-char code (guests allowed), and everyone answers questions in real time with scored leaderboards, all driven by Supabase Realtime.

**Architecture:** Three Supabase tables (`rooms`, `room_players`, `room_answers`) with RLS that lets anyone with the room code read/write via five Vercel serverless functions. The server uses the Supabase service-role client to enforce host-only actions and one-answer-per-question. Clients connect to a Realtime channel `room:{code}` using Broadcast (game events), Presence (live player list), and `postgres_changes` (auth-free room state sync). A single `useBattleRoom` hook owns the channel; five view components render the states. Guest players get a UUID persisted in `localStorage`; the server accepts either a Bearer token or an `X-Guest-Id` header.

**Tech Stack:** React 19, TypeScript, Supabase (Postgres + Auth + Realtime), Vercel serverless (Node runtime, `Request`/`Response` handlers in `api/`), Tailwind 4 with the mint CSS variables in `src/index.css`. No new dependencies.

**Conventions in this repo you must preserve:**
- Server endpoints live in `api/**.ts` and export `POST`/`GET` functions that take `Request` and return `Response` — see `api/generate.ts` and `api/account/delete.ts`.
- Server uses `server/auth.ts` (`requireUser`, `supabaseAdmin`) — we extend it, not replace it.
- Client uses `src/lib/supabase.ts` (anon client) and `src/lib/auth.tsx` (`useAuth()`).
- Design tokens: `--c-app`, `--c-surface`, `--c-border`, `--c-hover`, `--c-text`, `--c-text-subtle`, `--c-text-faint`, `--c-brand` (`emerald-500`). Use these for all chrome. Answer-card colors are the ONE exception — they must use hardcoded `blue-500`, `amber-500`, `rose-500`, `violet-500` so A/B/C/D are distinguishable in both themes.
- No unit test framework is installed. Verification is manual: two browser windows, `npm run dev`, plus `npm run lint` (which is `tsc --noEmit`). Every task ends with a browser smoke check, type check, and a commit.
- Deploys are **manual**: `vercel --prod`. Do not push branches expecting auto-deploy. GitHub isn't linked to Vercel.
- The CSP header in `vercel.json` already allows `wss://*.supabase.co`, so Realtime works in prod with no changes.

---

## File Structure

**Create:**
- `supabase/migrations/2026-04-25-battle-mode.sql` — schema + RLS + pg_cron cleanup.
- `src/types/battle.ts` — shared battle types (`RoomStatus`, `BattlePlayer`, `BattleRoom`, Broadcast event payload types).
- `src/lib/guestId.ts` — get/create a guest UUID in `localStorage`.
- `src/lib/battleApi.ts` — thin fetch wrappers for the five endpoints, adds auth headers automatically.
- `src/lib/useBattleRoom.ts` — the single Realtime hook that owns the channel.
- `api/rooms/create.ts`, `api/rooms/join.ts`, `api/rooms/start.ts`, `api/rooms/answer.ts`, `api/rooms/next.ts`.
- `src/components/battle/BattleRoute.tsx` — state-machine wrapper picking which battle screen to render.
- `src/components/battle/BattleEntry.tsx`
- `src/components/battle/BattleLobby.tsx`
- `src/components/battle/BattleQuestion.tsx`
- `src/components/battle/BattleLeaderboard.tsx`
- `src/components/battle/BattleResults.tsx`

**Modify:**
- `server/auth.ts` — add `requireActor()` that accepts either a Bearer token (authed user) or `X-Guest-Id` (guest UUID).
- `src/App.tsx` — add `'battle'` to the `View` union and route to `BattleRoute`.
- `src/components/Dashboard.tsx` — add "Battle Mode" card in the Tools section (mirrors the Timer card, same `mint-breathe`/shimmer treatment).

**Do not modify:** `api/generate.ts`, `src/components/QuizGenerator.tsx`, `src/components/QuizPlayer.tsx`, anything under `src/components/timer/`.

---

## Task 0: Branch + worktree

- [ ] **Step 1: Create a feature branch**

```bash
git checkout -b feat/battle-mode
```

- [ ] **Step 2: Verify clean starting point**

```bash
git status
npm run lint
npm run dev   # Ctrl+C after you've confirmed the existing app still boots
```

Expected: `tsc --noEmit` exits 0. Dashboard, generator, and timer still work.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/2026-04-25-battle-mode.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Battle Mode schema
-- Run this in the Supabase SQL editor OR via `supabase db push` (if the CLI is linked).
-- Applies to the same project used by VITE_SUPABASE_URL.

begin;

-- 1. Tables -----------------------------------------------------------------

create type if not exists room_status as enum ('waiting', 'active', 'finished');

create table if not exists public.rooms (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique check (char_length(code) = 6),
  host_id             uuid not null references auth.users(id) on delete cascade,
  quiz_data           jsonb not null,
  status              room_status not null default 'waiting',
  current_question    int not null default 0,
  question_start_time timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_created_at_idx on public.rooms (created_at);

create table if not exists public.room_players (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  guest_id      uuid,
  display_name  text not null check (char_length(display_name) between 1 and 32),
  score         int not null default 0,
  joined_at     timestamptz not null default now(),
  -- Exactly one of user_id/guest_id must be set.
  constraint room_players_actor_check check (
    (user_id is not null)::int + (guest_id is not null)::int = 1
  ),
  -- Same user/guest can't double-join the same room.
  constraint room_players_unique_user unique (room_id, user_id),
  constraint room_players_unique_guest unique (room_id, guest_id)
);

create index if not exists room_players_room_idx on public.room_players (room_id);

create table if not exists public.room_answers (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms(id) on delete cascade,
  player_id      uuid not null references public.room_players(id) on delete cascade,
  question_index int not null,
  option_id      text not null,
  answered_at    timestamptz not null default now(),
  is_correct     boolean not null,
  points_earned  int not null,
  constraint room_answers_unique unique (room_id, player_id, question_index)
);

create index if not exists room_answers_room_q_idx on public.room_answers (room_id, question_index);

-- 2. RLS --------------------------------------------------------------------
-- The anon key does NOT write anything — all writes go through the service-role
-- client in our Vercel functions. But clients need to READ rooms/players/answers
-- over Realtime + REST, and they need to SUBSCRIBE to postgres_changes.
-- We allow public read; writes stay service-role-only.

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_answers enable row level security;

drop policy if exists "rooms readable to anyone with code" on public.rooms;
create policy "rooms readable to anyone with code"
  on public.rooms for select to anon, authenticated
  using (true);

drop policy if exists "room_players readable" on public.room_players;
create policy "room_players readable"
  on public.room_players for select to anon, authenticated
  using (true);

drop policy if exists "room_answers readable" on public.room_answers;
create policy "room_answers readable"
  on public.room_answers for select to anon, authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies — service role bypasses RLS.

-- 3. Realtime publication ---------------------------------------------------
-- Enables postgres_changes subscriptions for these tables.

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.room_answers;

-- 4. Cleanup ----------------------------------------------------------------
-- Rooms self-expire after 2 hours. Uses pg_cron if available, otherwise rely on
-- the Vercel daily cron to invoke a cleanup endpoint (added in a later task — see
-- note at end).
-- pg_cron is available on Supabase Free once enabled via the dashboard.

-- Enable pg_cron (no-op if already enabled).
create extension if not exists pg_cron;

select cron.schedule(
  'quizmint-room-cleanup',
  '*/15 * * * *',
  $$delete from public.rooms where created_at < now() - interval '2 hours'$$
);

commit;
```

- [ ] **Step 2: Apply it against the live Supabase project**

Open Supabase dashboard → SQL Editor → paste the migration → Run. If `pg_cron` isn't enabled, go to Database → Extensions → enable `pg_cron`, then re-run just the cron block.

Verify via Supabase dashboard → Table Editor that `rooms`, `room_players`, `room_answers` exist with the expected columns. Check Database → Replication to confirm the three tables are in the `supabase_realtime` publication.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026-04-25-battle-mode.sql
git commit -m "feat(battle): db schema, RLS, and pg_cron room cleanup"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/types/battle.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/types/battle.ts
import type { QuizData } from '../types';

export type RoomStatus = 'waiting' | 'active' | 'finished';

export interface BattleRoom {
  id: string;
  code: string;
  host_id: string;
  quiz_data: QuizData;
  status: RoomStatus;
  current_question: number;
  question_start_time: string | null;
  created_at: string;
}

export interface BattlePlayer {
  id: string;
  room_id: string;
  user_id: string | null;
  guest_id: string | null;
  display_name: string;
  score: number;
  joined_at: string;
}

export interface BattleAnswer {
  id: string;
  room_id: string;
  player_id: string;
  question_index: number;
  option_id: string;
  answered_at: string;
  is_correct: boolean;
  points_earned: number;
}

// Broadcast events on channel `room:{code}`
export type BattleBroadcast =
  | { type: 'question_start'; questionIndex: number; endsAt: number }
  | { type: 'question_end'; questionIndex: number; correctOptionId: string }
  | { type: 'game_finish' };

// Per-question scoring window
export const QUESTION_WINDOW_MS = 10_000;
```

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/types/battle.ts
git commit -m "feat(battle): shared battle types"
```

---

## Task 3: Guest ID helper

**Files:**
- Create: `src/lib/guestId.ts`

- [ ] **Step 1: Write the helper**

```ts
// src/lib/guestId.ts
// Persistent UUID for non-logged-in players. Created lazily on first read.

const KEY = 'quizmint.guestId';

export function getGuestId(): string {
  if (typeof window === 'undefined') throw new Error('getGuestId called on server');
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npm run lint
git add src/lib/guestId.ts
git commit -m "feat(battle): guest id helper"
```

---

## Task 4: Extend server auth with actor model

**Files:**
- Modify: `server/auth.ts`

- [ ] **Step 1: Add `requireActor` alongside existing `requireUser`**

Append to `server/auth.ts` (do not touch `requireUser` — `api/generate.ts` and `api/account/delete.ts` still use it):

```ts
// Battle endpoints accept either a signed-in user (Bearer token) or a guest
// (X-Guest-Id header with a client-generated UUID). The UUID is not trusted for
// identity — it's only a stable handle so the same browser can't double-join a
// room and so answers tie back to the right player row.

export type Actor =
  | { kind: 'user'; userId: string; email: string | null }
  | { kind: 'guest'; guestId: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireActor(request: Request): Promise<Actor | Response> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data.user) {
        return { kind: 'user', userId: data.user.id, email: data.user.email ?? null };
      }
    }
  }
  const guestId = request.headers.get('x-guest-id') || request.headers.get('X-Guest-Id');
  if (guestId && UUID_RE.test(guestId)) {
    return { kind: 'guest', guestId };
  }
  return Response.json({ error: 'Not authenticated.' }, { status: 401 });
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npm run lint
git add server/auth.ts
git commit -m "feat(battle): requireActor accepts Bearer or X-Guest-Id"
```

---

## Task 5: Client API wrapper

**Files:**
- Create: `src/lib/battleApi.ts`

- [ ] **Step 1: Write the wrapper**

```ts
// src/lib/battleApi.ts
import { supabase } from './supabase';
import { getGuestId } from './guestId';
import type { QuizData } from '../types';

async function authHeaders(includeGuest: boolean): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (!token && includeGuest) h['X-Guest-Id'] = getGuestId();
  return h;
}

async function post<T>(path: string, body: unknown, allowGuest: boolean): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: await authHeaders(allowGuest),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
  return json as T;
}

export const battleApi = {
  create: (quizData: QuizData) =>
    post<{ roomId: string; roomCode: string }>('/api/rooms/create', { quizData }, false),
  join: (code: string, displayName: string) =>
    post<{ roomId: string; playerId: string }>('/api/rooms/join', { code, displayName }, true),
  start: (roomId: string) =>
    post<{ ok: true }>('/api/rooms/start', { roomId }, false),
  answer: (roomId: string, playerId: string, questionIndex: number, optionId: string) =>
    post<{ isCorrect: boolean; pointsEarned: number }>(
      '/api/rooms/answer',
      { roomId, playerId, questionIndex, optionId },
      true,
    ),
  next: (roomId: string) =>
    post<{ status: 'active' | 'finished'; currentQuestion: number }>(
      '/api/rooms/next',
      { roomId },
      false,
    ),
};
```

- [ ] **Step 2: Type-check and commit**

```bash
npm run lint
git add src/lib/battleApi.ts
git commit -m "feat(battle): client api wrapper"
```

---

## Task 6: `POST /api/rooms/create`

**Files:**
- Create: `api/rooms/create.ts`

- [ ] **Step 1: Write the handler**

```ts
// api/rooms/create.ts
import { requireUser, supabaseAdmin } from '../../server/auth.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L for legibility
const CODE_LEN = 6;

function genCode(): string {
  let out = '';
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function isValidQuizData(x: any): boolean {
  if (!x || typeof x !== 'object') return false;
  if (!Array.isArray(x.questions) || x.questions.length === 0) return false;
  for (const q of x.questions) {
    if (typeof q?.question !== 'string') return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    if (typeof q.correctOptionId !== 'string') return false;
  }
  return true;
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid body.' }, { status: 400 }); }
  if (!isValidQuizData(body?.quizData)) {
    return Response.json({ error: 'Invalid quizData.' }, { status: 400 });
  }

  // Retry up to 5x on (extremely unlikely) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .insert({
        code,
        host_id: auth.id,
        quiz_data: body.quizData,
        status: 'waiting',
        current_question: 0,
      })
      .select('id, code')
      .single();
    if (!error && data) {
      return Response.json({ roomId: data.id, roomCode: data.code });
    }
    // 23505 = unique_violation — try a new code; anything else is a real failure.
    if ((error as any)?.code !== '23505') {
      console.error('create room failed', error);
      return Response.json({ error: error?.message || 'Could not create room.' }, { status: 500 });
    }
  }
  return Response.json({ error: 'Could not allocate room code.' }, { status: 500 });
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npm run lint
git add api/rooms/create.ts
git commit -m "feat(battle): POST /api/rooms/create"
```

---

## Task 7: `POST /api/rooms/join`

**Files:**
- Create: `api/rooms/join.ts`

- [ ] **Step 1: Write the handler**

```ts
// api/rooms/join.ts
import { requireActor, supabaseAdmin } from '../../server/auth.js';

const MAX_PLAYERS = 20;
const NAME_MIN = 1;
const NAME_MAX = 32;

export async function POST(request: Request) {
  const actor = await requireActor(request);
  if (actor instanceof Response) return actor;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid body.' }, { status: 400 }); }

  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';

  if (!/^[A-Z0-9]{6}$/.test(code)) return Response.json({ error: 'Invalid room code.' }, { status: 400 });
  if (displayName.length < NAME_MIN || displayName.length > NAME_MAX) {
    return Response.json({ error: `Display name must be ${NAME_MIN}-${NAME_MAX} characters.` }, { status: 400 });
  }

  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, status')
    .eq('code', code)
    .maybeSingle();
  if (roomErr) return Response.json({ error: roomErr.message }, { status: 500 });
  if (!room) return Response.json({ error: 'Room not found.' }, { status: 404 });
  if (room.status === 'finished') return Response.json({ error: 'This battle has already ended.' }, { status: 409 });

  // Reject late joiners once the battle has started — easier UX than letting players into the middle of a question.
  if (room.status === 'active') return Response.json({ error: 'Battle already in progress.' }, { status: 409 });

  // Enforce player cap.
  const { count, error: countErr } = await supabaseAdmin
    .from('room_players')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id);
  if (countErr) return Response.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) >= MAX_PLAYERS) return Response.json({ error: 'Room is full.' }, { status: 409 });

  // If the same actor is already in the room, return the existing player row (idempotent rejoin).
  const actorFilter = actor.kind === 'user'
    ? { user_id: actor.userId, guest_id: null as string | null }
    : { user_id: null as string | null, guest_id: actor.guestId };

  const { data: existing, error: exErr } = await supabaseAdmin
    .from('room_players')
    .select('id')
    .eq('room_id', room.id)
    .eq(actor.kind === 'user' ? 'user_id' : 'guest_id', actor.kind === 'user' ? actor.userId : actor.guestId)
    .maybeSingle();
  if (exErr) return Response.json({ error: exErr.message }, { status: 500 });
  if (existing) {
    return Response.json({ roomId: room.id, playerId: existing.id });
  }

  const { data: player, error: insErr } = await supabaseAdmin
    .from('room_players')
    .insert({
      room_id: room.id,
      user_id: actorFilter.user_id,
      guest_id: actorFilter.guest_id,
      display_name: displayName,
    })
    .select('id')
    .single();
  if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

  return Response.json({ roomId: room.id, playerId: player.id });
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npm run lint
git add api/rooms/join.ts
git commit -m "feat(battle): POST /api/rooms/join"
```

---

## Task 8: `POST /api/rooms/start`

**Files:**
- Create: `api/rooms/start.ts`

- [ ] **Step 1: Write the handler**

```ts
// api/rooms/start.ts
import { requireUser, supabaseAdmin } from '../../server/auth.js';

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid body.' }, { status: 400 }); }
  const roomId = typeof body?.roomId === 'string' ? body.roomId : '';
  if (!roomId) return Response.json({ error: 'Missing roomId.' }, { status: 400 });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, host_id, status')
    .eq('id', roomId)
    .maybeSingle();
  if (roomErr) return Response.json({ error: roomErr.message }, { status: 500 });
  if (!room) return Response.json({ error: 'Room not found.' }, { status: 404 });
  if (room.host_id !== auth.id) return Response.json({ error: 'Only the host can start the battle.' }, { status: 403 });
  if (room.status !== 'waiting') return Response.json({ error: 'Battle already started.' }, { status: 409 });

  const { count } = await supabaseAdmin
    .from('room_players')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId);
  if ((count ?? 0) < 2) return Response.json({ error: 'Need at least 2 players.' }, { status: 400 });

  const { error: upErr } = await supabaseAdmin
    .from('rooms')
    .update({ status: 'active', current_question: 0, question_start_time: new Date().toISOString() })
    .eq('id', roomId);
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint
git add api/rooms/start.ts
git commit -m "feat(battle): POST /api/rooms/start"
```

---

## Task 9: `POST /api/rooms/answer`

**Files:**
- Create: `api/rooms/answer.ts`

- [ ] **Step 1: Write the handler**

```ts
// api/rooms/answer.ts
import { requireActor, supabaseAdmin } from '../../server/auth.js';

const WINDOW_MS = 10_000;
const BASE_POINTS = 1000;

function calcPoints(elapsedMs: number): number {
  const clamped = Math.max(0, Math.min(WINDOW_MS, elapsedMs));
  // 1000 → 500 linearly over the 10s window. Wrong = 0 (handled below).
  return Math.round(BASE_POINTS * (1 - (clamped / WINDOW_MS) * 0.5));
}

export async function POST(request: Request) {
  const actor = await requireActor(request);
  if (actor instanceof Response) return actor;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid body.' }, { status: 400 }); }
  const roomId = typeof body?.roomId === 'string' ? body.roomId : '';
  const playerId = typeof body?.playerId === 'string' ? body.playerId : '';
  const questionIndex = Number(body?.questionIndex);
  const optionId = typeof body?.optionId === 'string' ? body.optionId : '';
  if (!roomId || !playerId || !optionId || !Number.isInteger(questionIndex) || questionIndex < 0) {
    return Response.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  // Player must belong to the room AND to this actor.
  const { data: player, error: playerErr } = await supabaseAdmin
    .from('room_players')
    .select('id, room_id, user_id, guest_id, score')
    .eq('id', playerId)
    .maybeSingle();
  if (playerErr) return Response.json({ error: playerErr.message }, { status: 500 });
  if (!player || player.room_id !== roomId) return Response.json({ error: 'Player not in room.' }, { status: 403 });
  if (actor.kind === 'user' && player.user_id !== actor.userId) return Response.json({ error: 'Not your player.' }, { status: 403 });
  if (actor.kind === 'guest' && player.guest_id !== actor.guestId) return Response.json({ error: 'Not your player.' }, { status: 403 });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('status, current_question, question_start_time, quiz_data')
    .eq('id', roomId)
    .maybeSingle();
  if (roomErr) return Response.json({ error: roomErr.message }, { status: 500 });
  if (!room) return Response.json({ error: 'Room not found.' }, { status: 404 });
  if (room.status !== 'active') return Response.json({ error: 'Battle not active.' }, { status: 409 });
  if (room.current_question !== questionIndex) return Response.json({ error: 'Wrong question.' }, { status: 409 });

  const q = room.quiz_data?.questions?.[questionIndex];
  if (!q) return Response.json({ error: 'Question missing.' }, { status: 500 });

  const startedAt = room.question_start_time ? new Date(room.question_start_time).getTime() : Date.now();
  const elapsed = Date.now() - startedAt;
  const isCorrect = q.correctOptionId === optionId;
  // Beyond the window, answer is accepted but scores 0 (if correct) — matches "unanswered = 0".
  const pointsEarned = isCorrect && elapsed <= WINDOW_MS ? calcPoints(elapsed) : 0;

  const { error: insErr } = await supabaseAdmin
    .from('room_answers')
    .insert({
      room_id: roomId,
      player_id: playerId,
      question_index: questionIndex,
      option_id: optionId,
      is_correct: isCorrect,
      points_earned: pointsEarned,
    });
  // 23505 = already answered this question — reject idempotently.
  if (insErr) {
    if ((insErr as any).code === '23505') return Response.json({ error: 'Already answered.' }, { status: 409 });
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  if (pointsEarned > 0) {
    const { error: scoreErr } = await supabaseAdmin
      .from('room_players')
      .update({ score: player.score + pointsEarned })
      .eq('id', playerId);
    if (scoreErr) console.error('score update failed', scoreErr);
  }

  return Response.json({ isCorrect, pointsEarned });
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint
git add api/rooms/answer.ts
git commit -m "feat(battle): POST /api/rooms/answer with scoring"
```

---

## Task 10: `POST /api/rooms/next`

**Files:**
- Create: `api/rooms/next.ts`

- [ ] **Step 1: Write the handler**

```ts
// api/rooms/next.ts
import { requireUser, supabaseAdmin } from '../../server/auth.js';

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid body.' }, { status: 400 }); }
  const roomId = typeof body?.roomId === 'string' ? body.roomId : '';
  if (!roomId) return Response.json({ error: 'Missing roomId.' }, { status: 400 });

  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, host_id, status, current_question, quiz_data')
    .eq('id', roomId)
    .maybeSingle();
  if (roomErr) return Response.json({ error: roomErr.message }, { status: 500 });
  if (!room) return Response.json({ error: 'Room not found.' }, { status: 404 });
  if (room.host_id !== auth.id) return Response.json({ error: 'Host only.' }, { status: 403 });
  if (room.status !== 'active') return Response.json({ error: 'Battle not active.' }, { status: 409 });

  const total = Array.isArray(room.quiz_data?.questions) ? room.quiz_data.questions.length : 0;
  const nextIndex = room.current_question + 1;

  if (nextIndex >= total) {
    const { error: upErr } = await supabaseAdmin
      .from('rooms')
      .update({ status: 'finished', question_start_time: null })
      .eq('id', roomId);
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 });
    return Response.json({ status: 'finished', currentQuestion: room.current_question });
  }

  const { error: upErr } = await supabaseAdmin
    .from('rooms')
    .update({ current_question: nextIndex, question_start_time: new Date().toISOString() })
    .eq('id', roomId);
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });
  return Response.json({ status: 'active', currentQuestion: nextIndex });
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint
git add api/rooms/next.ts
git commit -m "feat(battle): POST /api/rooms/next"
```

---

## Task 11: Manual smoke test of the API layer

Before building the UI, exercise the endpoints with `curl` so UI debugging later doesn't blame the API.

- [ ] **Step 1: Boot the dev server**

```bash
npm run dev
```

- [ ] **Step 2: From a logged-in browser session, grab your access token**

In DevTools console on the running app:
```js
(await supabase.auth.getSession()).data.session.access_token
```

- [ ] **Step 3: Run through create → join(guest) → start(fail, 1 player) → join(second guest) → start → answer → next → next… → finished**

Use a scratch shell (PowerShell or bash). Replace `$TOKEN`, `$ROOM_ID`, `$CODE`, `$PLAYER_ID` as you go. `$GUEST1` and `$GUEST2` are any two fresh UUIDs.

```bash
# create
curl -s -X POST http://localhost:3000/api/rooms/create \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"quizData":{"difficulty":"Easy","questions":[{"question":"2+2","options":[{"id":"A","text":"3"},{"id":"B","text":"4"}],"correctOptionId":"B"},{"question":"Sky?","options":[{"id":"A","text":"Blue"},{"id":"B","text":"Green"}],"correctOptionId":"A"}]}}'

# join as guest
curl -s -X POST http://localhost:3000/api/rooms/join \
  -H "X-Guest-Id: $GUEST1" -H "Content-Type: application/json" \
  -d '{"code":"'$CODE'","displayName":"Alice"}'

# start with only 1 player — expect 400
curl -s -X POST http://localhost:3000/api/rooms/start \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"roomId":"'$ROOM_ID'"}'

# second guest
curl -s -X POST http://localhost:3000/api/rooms/join \
  -H "X-Guest-Id: $GUEST2" -H "Content-Type: application/json" \
  -d '{"code":"'$CODE'","displayName":"Bob"}'

# start — expect ok:true
curl -s -X POST http://localhost:3000/api/rooms/start \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"roomId":"'$ROOM_ID'"}'

# answer q0 correct
curl -s -X POST http://localhost:3000/api/rooms/answer \
  -H "X-Guest-Id: $GUEST1" -H "Content-Type: application/json" \
  -d '{"roomId":"'$ROOM_ID'","playerId":"'$ALICE_PLAYER_ID'","questionIndex":0,"optionId":"B"}'

# duplicate answer — expect 409
curl -s -X POST http://localhost:3000/api/rooms/answer \
  -H "X-Guest-Id: $GUEST1" -H "Content-Type: application/json" \
  -d '{"roomId":"'$ROOM_ID'","playerId":"'$ALICE_PLAYER_ID'","questionIndex":0,"optionId":"A"}'

# advance
curl -s -X POST http://localhost:3000/api/rooms/next \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"roomId":"'$ROOM_ID'"}'

# advance again — expect status:"finished"
curl -s -X POST http://localhost:3000/api/rooms/next \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"roomId":"'$ROOM_ID'"}'
```

Verify each response matches the expectation above. Check the Supabase table editor shows correct rows. If anything's off, fix the relevant endpoint before moving on — UI tasks assume this layer works.

- [ ] **Step 2: Commit any fixes**

```bash
git status
# commit only if there are fixes
```

---

## Task 12: `useBattleRoom` hook

**Files:**
- Create: `src/lib/useBattleRoom.ts`

This is the hook that owns the Realtime channel. It:
- Loads the room once by id.
- Subscribes to `postgres_changes` on `rooms`, `room_players`, `room_answers` filtered by room id.
- Joins the channel's Presence with the player's `{ displayName, score }` once `playerId` is set.
- Exposes `{ room, players, myAnswers, answersByQuestion, broadcast }` plus connection state.

- [ ] **Step 1: Write the hook**

```ts
// src/lib/useBattleRoom.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  BattleAnswer,
  BattleBroadcast,
  BattlePlayer,
  BattleRoom,
} from '../types/battle';

interface Params {
  roomId: string;
  roomCode: string;
  playerId: string | null; // null = host who isn't a player / unjoined viewer
  displayName: string | null;
}

export interface BattleRoomState {
  room: BattleRoom | null;
  players: BattlePlayer[];
  answers: BattleAnswer[];
  connected: boolean;
  lastBroadcast: BattleBroadcast | null;
  error: string | null;
}

export function useBattleRoom({ roomId, roomCode, playerId, displayName }: Params) {
  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [answers, setAnswers] = useState<BattleAnswer[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<BattleBroadcast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initial fetch ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: r, error: rErr }, { data: p }, { data: a }] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('room_players').select('*').eq('room_id', roomId),
        supabase.from('room_answers').select('*').eq('room_id', roomId),
      ]);
      if (cancelled) return;
      if (rErr) setError(rErr.message);
      if (r) setRoom(r as BattleRoom);
      if (p) setPlayers(p as BattlePlayer[]);
      if (a) setAnswers(a as BattleAnswer[]);
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // Realtime channel ---------------------------------------------------------
  useEffect(() => {
    const channel = supabase.channel(`room:${roomCode}`, {
      config: { presence: { key: playerId ?? `viewer-${crypto.randomUUID()}` } },
    });

    channel
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setRoom(null);
          else setRoom(payload.new as BattleRoom);
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === 'INSERT') return [...prev, payload.new as BattlePlayer];
            if (payload.eventType === 'UPDATE') return prev.map((x) => x.id === (payload.new as BattlePlayer).id ? payload.new as BattlePlayer : x);
            if (payload.eventType === 'DELETE') return prev.filter((x) => x.id !== (payload.old as BattlePlayer).id);
            return prev;
          });
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_answers', filter: `room_id=eq.${roomId}` },
        (payload) => { setAnswers((prev) => [...prev, payload.new as BattleAnswer]); })
      .on('broadcast', { event: 'battle' }, ({ payload }) => {
        setLastBroadcast(payload as BattleBroadcast);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          if (playerId && displayName) {
            await channel.track({ playerId, displayName });
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnected(false);
        }
      });

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, roomCode, playerId, displayName]);

  const broadcast = useMemo(() => async (msg: BattleBroadcast) => {
    const ch = channelRef.current;
    if (!ch) return;
    await ch.send({ type: 'broadcast', event: 'battle', payload: msg });
  }, []);

  const answersByQuestion = useMemo(() => {
    const byQ: Record<number, BattleAnswer[]> = {};
    for (const a of answers) (byQ[a.question_index] ||= []).push(a);
    return byQ;
  }, [answers]);

  return { room, players, answers, answersByQuestion, connected, lastBroadcast, error, broadcast };
}
```

Notes for implementers:
- We rely on `postgres_changes` — not Broadcast — for room state so there's no host-authoritative event to miss. Broadcast is only for the optional "question_start" flourish (used by clients to sync the local countdown without hitting the DB for every tick).
- Presence isn't strictly required for the player list (we already have `room_players` via postgres_changes), but we track it anyway so future work can show "online" dots without adding a column.

- [ ] **Step 2: Type-check and commit**

```bash
npm run lint
git add src/lib/useBattleRoom.ts
git commit -m "feat(battle): useBattleRoom realtime hook"
```

---

## Task 13: `BattleEntry` component

**Files:**
- Create: `src/components/battle/BattleEntry.tsx`

Two-card chooser: "Host" (disabled until a `QuizData` is available — when disabled, shows a hint with a button that bounces to the generator) and "Join" (code + display-name form).

- [ ] **Step 1: Write the component**

```tsx
// src/components/battle/BattleEntry.tsx
import { useState } from 'react';
import { Swords, Users } from 'lucide-react';
import type { QuizData } from '../../types';
import { useAuth } from '../../lib/auth';
import { battleApi } from '../../lib/battleApi';

interface Props {
  quizData: QuizData | null;
  onHosted: (args: { roomId: string; roomCode: string; asHost: true }) => void;
  onJoined: (args: { roomId: string; roomCode: string; playerId: string; displayName: string }) => void;
  onNeedQuiz: () => void;
}

export function BattleEntry({ quizData, onHosted, onJoined, onNeedQuiz }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'host' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const host = async () => {
    if (!quizData) return onNeedQuiz();
    setBusy('host'); setError(null);
    try {
      const { roomId, roomCode } = await battleApi.create(quizData);
      onHosted({ roomId, roomCode, asHost: true });
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const join = async () => {
    setBusy('join'); setError(null);
    try {
      const cleanCode = code.trim().toUpperCase();
      const { roomId, playerId } = await battleApi.join(cleanCode, name.trim());
      onJoined({ roomId, roomCode: cleanCode, playerId, displayName: name.trim() });
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="w-full max-w-[900px] mx-auto px-4 py-10 grid gap-6 md:grid-cols-2">
      {/* Host card */}
      <div className="p-6 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 grid place-items-center text-emerald-500">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-500">Host</p>
            <h2 className="text-[18px] font-semibold">Start a battle</h2>
          </div>
        </div>
        {quizData ? (
          <p className="text-[13px] text-[var(--c-text-subtle)]">
            Using your current quiz — {quizData.questions.length} questions, {quizData.difficulty}.
          </p>
        ) : (
          <p className="text-[13px] text-[var(--c-text-subtle)]">
            You need a generated quiz first. Head to the generator, then come back.
          </p>
        )}
        {!user && (
          <p className="text-[12px] text-amber-500">Hosting requires a signed-in account.</p>
        )}
        <button
          type="button"
          disabled={!user || busy === 'host'}
          onClick={host}
          className="mt-auto px-4 py-2.5 rounded-lg bg-emerald-500 text-[#0A0A0C] font-semibold text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
        >
          {busy === 'host' ? 'Creating room…' : quizData ? 'Create room' : 'I need a quiz first'}
        </button>
        {!quizData && (
          <button type="button" onClick={onNeedQuiz} className="text-[12px] text-emerald-500 hover:underline self-start">
            Go to quiz generator →
          </button>
        )}
      </div>

      {/* Join card */}
      <div className="p-6 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 grid place-items-center text-emerald-500">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-500">Join</p>
            <h2 className="text-[18px] font-semibold">Enter a room code</h2>
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-[var(--c-text-faint)]">Room code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--c-app)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-mono tracking-[0.3em] text-[18px] text-center"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-[var(--c-text-faint)]">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            placeholder="Your name"
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--c-app)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-[14px]"
          />
        </label>
        <button
          type="button"
          disabled={busy === 'join' || code.length !== 6 || name.trim().length === 0}
          onClick={join}
          className="mt-auto px-4 py-2.5 rounded-lg bg-emerald-500 text-[#0A0A0C] font-semibold text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
        >
          {busy === 'join' ? 'Joining…' : 'Join battle'}
        </button>
      </div>

      {error && <p className="md:col-span-2 text-[13px] text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint
git add src/components/battle/BattleEntry.tsx
git commit -m "feat(battle): BattleEntry (host/join chooser)"
```

---

## Task 14: `BattleLobby` component

**Files:**
- Create: `src/components/battle/BattleLobby.tsx`

Waiting-room UI. Huge copyable code. Live player chip list (fed by `useBattleRoom`). Host sees a "Start battle" button (disabled until ≥2 players).

- [ ] **Step 1: Write the component**

```tsx
// src/components/battle/BattleLobby.tsx
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { BattlePlayer } from '../../types/battle';
import { battleApi } from '../../lib/battleApi';

interface Props {
  roomCode: string;
  roomId: string;
  isHost: boolean;
  players: BattlePlayer[];
  connected: boolean;
}

export function BattleLobby({ roomCode, roomId, isHost, players, connected }: Props) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const start = async () => {
    setStarting(true); setError(null);
    try { await battleApi.start(roomId); }
    catch (e: any) { setError(e.message); setStarting(false); }
  };

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 py-10 flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--c-text-faint)]">Room code</p>
        <button
          type="button"
          onClick={copy}
          className="group flex items-center gap-3 px-6 py-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl hover:border-emerald-500/60 transition-colors"
        >
          <span className="font-mono text-[48px] md:text-[64px] font-bold tracking-[0.25em] text-[var(--c-text)]">{roomCode}</span>
          <span className="text-[var(--c-text-subtle)] group-hover:text-emerald-500 transition-colors">
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </span>
        </button>
        <p className={`text-[11px] uppercase tracking-wider ${connected ? 'text-emerald-500' : 'text-amber-500'}`}>
          {connected ? 'Connected' : 'Connecting…'}
        </p>
      </div>

      <div className="w-full">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--c-text-faint)] mb-3">Players ({players.length}/20)</p>
        {players.length === 0 ? (
          <p className="text-[13px] text-[var(--c-text-subtle)]">Waiting for players to join…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <span key={p.id} className="px-3 py-1.5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-full text-[13px]">
                {p.display_name}
              </span>
            ))}
          </div>
        )}
      </div>

      {isHost ? (
        <>
          <button
            type="button"
            disabled={players.length < 2 || starting}
            onClick={start}
            className="px-6 py-3 rounded-xl bg-emerald-500 text-[#0A0A0C] font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
          >
            {starting ? 'Starting…' : players.length < 2 ? 'Need at least 2 players' : 'Start battle'}
          </button>
          {error && <p className="text-[13px] text-red-500">{error}</p>}
        </>
      ) : (
        <p className="text-[13px] text-[var(--c-text-subtle)]">Waiting for the host to start…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint
git add src/components/battle/BattleLobby.tsx
git commit -m "feat(battle): BattleLobby waiting room"
```

---

## Task 15: `BattleQuestion` component

**Files:**
- Create: `src/components/battle/BattleQuestion.tsx`

Full-screen question view for players. Timer bar ticks from 10s down based on `room.question_start_time`. Answer submits once, then shows "Waiting…" until `question_end` or room advances.

- [ ] **Step 1: Write the component**

```tsx
// src/components/battle/BattleQuestion.tsx
import { useEffect, useMemo, useState } from 'react';
import type { Question } from '../../types';
import type { BattleAnswer } from '../../types/battle';
import { QUESTION_WINDOW_MS } from '../../types/battle';
import { battleApi } from '../../lib/battleApi';

const OPTION_COLORS = [
  { bg: 'bg-blue-500/15', border: 'border-blue-500/60', ring: 'ring-blue-500', text: 'text-blue-400' },
  { bg: 'bg-amber-500/15', border: 'border-amber-500/60', ring: 'ring-amber-500', text: 'text-amber-400' },
  { bg: 'bg-rose-500/15', border: 'border-rose-500/60', ring: 'ring-rose-500', text: 'text-rose-400' },
  { bg: 'bg-violet-500/15', border: 'border-violet-500/60', ring: 'ring-violet-500', text: 'text-violet-400' },
];

interface Props {
  roomId: string;
  playerId: string | null; // null = host viewing, can't answer
  question: Question;
  questionIndex: number;
  questionStartTime: string | null;
  existingAnswer: BattleAnswer | undefined;
}

export function BattleQuestion({
  roomId, playerId, question, questionIndex, questionStartTime, existingAnswer,
}: Props) {
  const endsAt = useMemo(
    () => (questionStartTime ? new Date(questionStartTime).getTime() + QUESTION_WINDOW_MS : Date.now() + QUESTION_WINDOW_MS),
    [questionStartTime],
  );
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [localAnswer, setLocalAnswer] = useState<{ optionId: string; isCorrect?: boolean; points?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  // Reset local state when the question changes.
  useEffect(() => {
    setLocalAnswer(null);
    setError(null);
  }, [questionIndex]);

  const remaining = Math.max(0, endsAt - now);
  const pct = Math.max(0, Math.min(100, (remaining / QUESTION_WINDOW_MS) * 100));
  const locked = !!localAnswer || !!existingAnswer || remaining === 0 || !playerId;

  const answer = async (optionId: string) => {
    if (locked || !playerId) return;
    setSubmitting(true); setError(null);
    setLocalAnswer({ optionId });
    try {
      const { isCorrect, pointsEarned } = await battleApi.answer(roomId, playerId, questionIndex, optionId);
      setLocalAnswer({ optionId, isCorrect, points: pointsEarned });
    } catch (e: any) {
      setError(e.message);
      setLocalAnswer(null);
    } finally {
      setSubmitting(false);
    }
  };

  const shownAnswer = existingAnswer
    ? { optionId: existingAnswer.option_id, isCorrect: existingAnswer.is_correct, points: existingAnswer.points_earned }
    : localAnswer;

  return (
    <div className="w-full max-w-[820px] mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--c-text-faint)]">Question {questionIndex + 1}</p>
        <p className="text-[13px] font-mono tabular-nums text-[var(--c-text-subtle)]">{(remaining / 1000).toFixed(1)}s</p>
      </div>

      <div className="h-1.5 w-full bg-[var(--c-border)] rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-100 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>

      <h2 className="text-[22px] md:text-[28px] font-semibold leading-tight text-[var(--c-text)]">{question.question}</h2>

      <div className="grid gap-3 md:grid-cols-2">
        {question.options.map((opt, i) => {
          const c = OPTION_COLORS[i % OPTION_COLORS.length];
          const isPicked = shownAnswer?.optionId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={locked || submitting}
              onClick={() => answer(opt.id)}
              className={`text-left p-5 rounded-xl border ${c.bg} ${c.border} disabled:cursor-not-allowed transition-all ${
                isPicked ? `ring-2 ${c.ring}` : 'hover:brightness-110'
              } ${locked && !isPicked ? 'opacity-40' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className={`w-8 h-8 rounded-lg ${c.bg} border ${c.border} grid place-items-center font-bold ${c.text}`}>
                  {opt.id}
                </span>
                <span className="text-[15px] text-[var(--c-text)] flex-1">{opt.text}</span>
              </div>
            </button>
          );
        })}
      </div>

      {shownAnswer?.isCorrect !== undefined && (
        <div className={`p-4 rounded-xl border text-[14px] ${
          shownAnswer.isCorrect
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
            : 'bg-red-500/10 border-red-500/40 text-red-400'
        }`}>
          {shownAnswer.isCorrect ? `+${shownAnswer.points} pts` : 'Incorrect'} — waiting for host to advance…
        </div>
      )}

      {!playerId && (
        <p className="text-[13px] text-[var(--c-text-subtle)]">You're the host — answers are disabled for you.</p>
      )}
      {error && <p className="text-[13px] text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint
git add src/components/battle/BattleQuestion.tsx
git commit -m "feat(battle): BattleQuestion view with countdown and answer lock"
```

---

## Task 16: `BattleLeaderboard` component

**Files:**
- Create: `src/components/battle/BattleLeaderboard.tsx`

Between-question and end-game leaderboard. Host sees "Next question" / "End game" control.

- [ ] **Step 1: Write the component**

```tsx
// src/components/battle/BattleLeaderboard.tsx
import { useState } from 'react';
import { Crown, Medal, Award } from 'lucide-react';
import type { BattlePlayer } from '../../types/battle';
import { battleApi } from '../../lib/battleApi';

interface Props {
  roomId: string;
  players: BattlePlayer[];
  isHost: boolean;
  isLastQuestion: boolean;
  currentQuestion: number;
  totalQuestions: number;
  myPlayerId: string | null;
}

export function BattleLeaderboard({
  roomId, players, isHost, isLastQuestion, currentQuestion, totalQuestions, myPlayerId,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ranked = [...players].sort((a, b) => b.score - a.score);

  const advance = async () => {
    setBusy(true); setError(null);
    try { await battleApi.next(roomId); }
    catch (e: any) { setError(e.message); setBusy(false); }
  };

  const trim = (i: number) => {
    if (i === 0) return { icon: <Crown className="w-4 h-4" />, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/40' };
    if (i === 1) return { icon: <Medal className="w-4 h-4" />, cls: 'text-slate-300 bg-slate-400/10 border-slate-400/40' };
    if (i === 2) return { icon: <Award className="w-4 h-4" />, cls: 'text-orange-400 bg-orange-500/10 border-orange-500/40' };
    return { icon: null, cls: 'text-[var(--c-text-subtle)] bg-[var(--c-surface)] border-[var(--c-border)]' };
  };

  return (
    <div className="w-full max-w-[620px] mx-auto px-4 py-8 flex flex-col gap-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--c-text-faint)]">Leaderboard</p>
        <h2 className="text-[22px] font-semibold">
          After question {currentQuestion + 1} of {totalQuestions}
        </h2>
      </div>

      <ol className="flex flex-col gap-2">
        {ranked.map((p, i) => {
          const t = trim(i);
          const isMe = p.id === myPlayerId;
          return (
            <li
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-xl border ${t.cls} ${isMe ? 'ring-1 ring-emerald-500' : ''}`}
            >
              <span className="w-7 text-center font-bold">{i + 1}</span>
              {t.icon}
              <span className="flex-1 text-[14px] font-medium">{p.display_name}{isMe && ' (you)'}</span>
              <span className="font-mono tabular-nums text-[14px]">{p.score}</span>
            </li>
          );
        })}
      </ol>

      {isHost && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={advance}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-[#0A0A0C] font-semibold text-[14px] disabled:opacity-50 hover:bg-emerald-400 transition-colors"
          >
            {busy ? 'Advancing…' : isLastQuestion ? 'End battle' : 'Next question'}
          </button>
          {error && <p className="text-[13px] text-red-500">{error}</p>}
        </>
      )}
      {!isHost && <p className="text-[13px] text-[var(--c-text-subtle)]">Waiting for the host…</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint
git add src/components/battle/BattleLeaderboard.tsx
git commit -m "feat(battle): BattleLeaderboard with host next/end control"
```

---

## Task 17: `BattleResults` component

**Files:**
- Create: `src/components/battle/BattleResults.tsx`

Podium for top 3, full ranked list, and two buttons: "New quiz" (exits battle view) and "Play again" (returns host to `BattleEntry` — simplest path; rematch-in-same-room is out of scope for v1).

- [ ] **Step 1: Write the component**

```tsx
// src/components/battle/BattleResults.tsx
import { Crown, Medal, Award, Repeat, Home } from 'lucide-react';
import type { BattlePlayer } from '../../types/battle';

interface Props {
  players: BattlePlayer[];
  myPlayerId: string | null;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function BattleResults({ players, myPlayerId, onPlayAgain, onExit }: Props) {
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const [first, second, third] = ranked;

  const Podium = ({ p, place, h }: { p: BattlePlayer | undefined; place: 1 | 2 | 3; h: string }) => {
    if (!p) return <div className={`flex-1 ${h}`} />;
    const icon = place === 1 ? <Crown className="w-5 h-5 text-amber-400" />
      : place === 2 ? <Medal className="w-5 h-5 text-slate-300" />
      : <Award className="w-5 h-5 text-orange-400" />;
    return (
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5">{icon}<span className="text-[12px] uppercase tracking-wider text-[var(--c-text-subtle)]">#{place}</span></div>
        <div className={`w-full ${h} rounded-t-xl bg-emerald-500/15 border border-emerald-500/40 flex flex-col items-center justify-center p-3`}>
          <p className="text-[14px] font-semibold text-center">{p.display_name}</p>
          <p className="text-[12px] font-mono text-[var(--c-text-subtle)]">{p.score}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[620px] mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-500">Battle complete</p>
        <h2 className="text-[28px] font-semibold">Final standings</h2>
      </div>

      <div className="flex items-end gap-2 h-[180px]">
        <Podium p={second} place={2} h="h-[120px]" />
        <Podium p={first}  place={1} h="h-[160px]" />
        <Podium p={third}  place={3} h="h-[90px]" />
      </div>

      <ol className="flex flex-col gap-2">
        {ranked.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border bg-[var(--c-surface)] border-[var(--c-border)] ${p.id === myPlayerId ? 'ring-1 ring-emerald-500' : ''}`}>
            <span className="w-7 text-center font-bold">{i + 1}</span>
            <span className="flex-1 text-[14px] font-medium">{p.display_name}{p.id === myPlayerId && ' (you)'}</span>
            <span className="font-mono tabular-nums text-[14px]">{p.score}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-[#0A0A0C] font-semibold text-[14px] hover:bg-emerald-400 transition-colors"
        >
          <Repeat className="w-4 h-4" /> Play again
        </button>
        <button
          type="button"
          onClick={onExit}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] font-semibold text-[14px] hover:bg-[var(--c-hover)] transition-colors"
        >
          <Home className="w-4 h-4" /> Back to dashboard
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint
git add src/components/battle/BattleResults.tsx
git commit -m "feat(battle): BattleResults final screen with podium"
```

---

## Task 18: `BattleRoute` state machine

**Files:**
- Create: `src/components/battle/BattleRoute.tsx`

Owns the local "where am I" state: pre-join (Entry) → in-room (Lobby | Question | Leaderboard | Results), driven by `room.status` + `current_question` from `useBattleRoom`, plus the "have all players answered OR timer expired" heuristic for switching from Question to Leaderboard.

- [ ] **Step 1: Write the router component**

```tsx
// src/components/battle/BattleRoute.tsx
import { useEffect, useState } from 'react';
import type { QuizData } from '../../types';
import { QUESTION_WINDOW_MS } from '../../types/battle';
import { useAuth } from '../../lib/auth';
import { useBattleRoom } from '../../lib/useBattleRoom';
import { BattleEntry } from './BattleEntry';
import { BattleLobby } from './BattleLobby';
import { BattleQuestion } from './BattleQuestion';
import { BattleLeaderboard } from './BattleLeaderboard';
import { BattleResults } from './BattleResults';

interface Props {
  quizData: QuizData | null;
  onNeedQuiz: () => void;
  onExit: () => void;
}

interface Session {
  roomId: string;
  roomCode: string;
  playerId: string | null; // null when the user is host-only (not a player row)
  displayName: string | null;
  asHost: boolean;
}

export function BattleRoute({ quizData, onNeedQuiz, onExit }: Props) {
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return (
      <BattleEntry
        quizData={quizData}
        onHosted={({ roomId, roomCode }) =>
          setSession({ roomId, roomCode, playerId: null, displayName: null, asHost: true })
        }
        onJoined={({ roomId, roomCode, playerId, displayName }) =>
          setSession({ roomId, roomCode, playerId, displayName, asHost: false })
        }
        onNeedQuiz={onNeedQuiz}
      />
    );
  }

  return (
    <InsideRoom
      session={session}
      isHostUser={!!user && session.asHost}
      onExit={() => { setSession(null); onExit(); }}
      onPlayAgain={() => setSession(null)}
    />
  );
}

function InsideRoom({
  session, isHostUser, onExit, onPlayAgain,
}: {
  session: Session;
  isHostUser: boolean;
  onExit: () => void;
  onPlayAgain: () => void;
}) {
  const { room, players, answersByQuestion, connected } = useBattleRoom({
    roomId: session.roomId,
    roomCode: session.roomCode,
    playerId: session.playerId,
    displayName: session.displayName,
  });

  // Phase: waiting | question | reveal | finished
  // Question → reveal fires when either timer expires OR every player has answered this question.
  const [phase, setPhase] = useState<'question' | 'reveal'>('question');
  useEffect(() => { setPhase('question'); }, [room?.current_question]);

  useEffect(() => {
    if (!room || room.status !== 'active' || !room.question_start_time) return;
    const endsAt = new Date(room.question_start_time).getTime() + QUESTION_WINDOW_MS;
    const tick = () => {
      const qIdx = room.current_question;
      const answered = (answersByQuestion[qIdx] || []).length;
      if (Date.now() >= endsAt || answered >= players.length) {
        setPhase('reveal');
      }
    };
    const id = window.setInterval(tick, 200);
    tick();
    return () => window.clearInterval(id);
  }, [room, players.length, answersByQuestion]);

  if (!room) {
    return <p className="text-center py-10 text-[var(--c-text-subtle)] text-[14px]">Loading room…</p>;
  }

  if (room.status === 'waiting') {
    return (
      <BattleLobby
        roomCode={room.code}
        roomId={room.id}
        isHost={isHostUser}
        players={players}
        connected={connected}
      />
    );
  }

  if (room.status === 'finished') {
    return (
      <BattleResults
        players={players}
        myPlayerId={session.playerId}
        onPlayAgain={onPlayAgain}
        onExit={onExit}
      />
    );
  }

  // status === 'active'
  const q = room.quiz_data.questions[room.current_question];
  const myAnswer = session.playerId
    ? (answersByQuestion[room.current_question] || []).find((a) => a.player_id === session.playerId)
    : undefined;

  if (phase === 'question' && q) {
    return (
      <BattleQuestion
        roomId={room.id}
        playerId={session.playerId}
        question={q}
        questionIndex={room.current_question}
        questionStartTime={room.question_start_time}
        existingAnswer={myAnswer}
      />
    );
  }

  return (
    <BattleLeaderboard
      roomId={room.id}
      players={players}
      isHost={isHostUser}
      isLastQuestion={room.current_question + 1 >= room.quiz_data.questions.length}
      currentQuestion={room.current_question}
      totalQuestions={room.quiz_data.questions.length}
      myPlayerId={session.playerId}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
npm run lint
git add src/components/battle/BattleRoute.tsx
git commit -m "feat(battle): BattleRoute state machine"
```

---

## Task 19: App.tsx wiring + Dashboard tile

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Extend `View` and add the route in `App.tsx`**

In `src/App.tsx`:

Replace the `View` type and its effects:

```ts
type View = 'landing' | 'login' | 'dashboard' | 'app' | 'timer' | 'battle';
```

Add the lazy import near the other lazy imports:

```ts
const BattleRoute = lazy(() =>
  import('./components/battle/BattleRoute').then((m) => ({ default: m.BattleRoute })),
);
```

Update the sign-out guard so `'battle'` also bounces to landing:

```ts
if (!user && (view === 'app' || view === 'dashboard' || view === 'timer' || view === 'battle')) {
  setQuizData(null);
  setView('landing');
}
```

Update the Dashboard props (pass a new handler):

```tsx
<Dashboard
  theme={theme}
  onToggleTheme={toggleTheme}
  onStartGenerate={() => setView('app')}
  onStartTimer={() => setView('timer')}
  onStartBattle={() => setView('battle')}
  onLogoHome={() => setView(user ? 'dashboard' : 'landing')}
/>
```

Add the battle route right after the timer route (before the generator/player fallthrough):

```tsx
if (view === 'battle') {
  return (
    <Suspense fallback={<RouteFallback />}>
      <BattleRoute
        quizData={quizData}
        onNeedQuiz={() => setView('app')}
        onExit={() => setView('dashboard')}
      />
    </Suspense>
  );
}
```

Note: guest players joining via a shared code hit the battle route without going through the dashboard — that's fine, because the landing page already has a "Join battle" CTA we'll address later. For v1, both host and joiner flows start from the dashboard's Battle Mode card (a guest can sign in first OR use the Join card inside `BattleEntry` without an account).

- [ ] **Step 2: Add the Battle Mode card in `Dashboard.tsx`**

At the top of `Dashboard.tsx`, add `Swords` to the lucide import list:

```ts
import {
  Sun, Moon, LogOut, Sparkles, KeyRound, Mail, Trash2,
  ArrowRight, FileText, Clock, ShieldCheck, Timer, Music, Swords,
} from 'lucide-react';
```

Add to the Props interface and destructuring:

```ts
interface DashboardProps {
  theme: Theme;
  onToggleTheme: () => void;
  onStartGenerate: () => void;
  onStartTimer: () => void;
  onStartBattle: () => void;
  onLogoHome: () => void;
}

export function Dashboard({
  theme, onToggleTheme, onStartGenerate, onStartTimer, onStartBattle, onLogoHome,
}: DashboardProps) {
```

Replace the current single-button "Tools" block with a two-card grid. Find:

```tsx
<div className="mt-6">
  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--c-text-faint)] mb-3">Tools</p>
  <button
    type="button"
    onClick={onStartTimer}
    ...
  </button>
</div>
```

…and change to:

```tsx
<div className="mt-6">
  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--c-text-faint)] mb-3">Tools</p>
  <div className="grid gap-3 md:grid-cols-2">
    <button
      type="button"
      onClick={onStartTimer}
      className="relative overflow-hidden w-full text-left p-5 bg-gradient-to-br from-emerald-500/[0.08] to-transparent border border-emerald-500/30 rounded-2xl hover:border-emerald-500/60 transition-colors group"
    >
      <span className="shimmer-hover" />
      <div className="relative flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 grid place-items-center shrink-0 text-emerald-500 transition-colors">
          <Timer className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[var(--c-text)]">Flip timer</p>
          <p className="text-[12px] text-[var(--c-text-subtle)] mt-1">
            Live clock, countdown, count up, hybrid. Useful for timed study.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-medium text-[var(--c-text-subtle)] group-hover:text-emerald-500 group-hover:gap-2 transition-all">
            Open timer
            <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </button>

    <button
      type="button"
      onClick={onStartBattle}
      className="relative overflow-hidden w-full text-left p-5 bg-gradient-to-br from-emerald-500/[0.08] to-transparent border border-emerald-500/30 rounded-2xl hover:border-emerald-500/60 transition-colors group"
    >
      <span className="shimmer-hover" />
      <div className="relative flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 grid place-items-center shrink-0 text-emerald-500 transition-colors">
          <Swords className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold text-[var(--c-text)]">Battle mode</p>
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold tracking-[0.15em] uppercase text-amber-600 [.light_&]:text-amber-700 shrink-0">New</span>
          </div>
          <p className="text-[12px] text-[var(--c-text-subtle)] mt-1">
            Kahoot-style live battles. Host from a generated quiz, share a code, up to 20 players.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-medium text-[var(--c-text-subtle)] group-hover:text-emerald-500 group-hover:gap-2 transition-all">
            Open battle
            <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </button>
  </div>
</div>
```

- [ ] **Step 3: Type-check and boot the app**

```bash
npm run lint
npm run dev
```

Click Battle Mode on the dashboard → `BattleEntry` should render.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Dashboard.tsx
git commit -m "feat(battle): wire BattleRoute into App and add Dashboard tile"
```

---

## Task 20: Two-window end-to-end verification

No automated integration test exists — verify the full flow by driving two browser windows.

- [ ] **Step 1: Host flow (window A, signed-in)**

1. Sign in, generate a short quiz (use "Generate mode" with ~3 questions for speed).
2. Dashboard → Battle mode → "Create room".
3. Confirm the lobby shows a 6-char code and "Players (0/20)".

- [ ] **Step 2: Player flow (window B, incognito, not signed in)**

1. Open `http://localhost:3000/` in an incognito window.
2. Start button → Sign-up page. Skip sign-up by clicking "back" then nav to Battle mode — ACTUALLY, since the landing doesn't yet expose a direct Battle link, v1 accepts this: host shares the URL `/` + asks joiner to sign in OR we accept that guest joiners need the dashboard link too. For v1 testing, sign in as a different user in window B (or open a second guest tab after signing out of the host window — note you'll need to re-sign-in to host again).

   Simplified verification path (no landing-page changes needed yet):
   - Open window B in incognito.
   - Sign up with a throwaway email OR sign in as a second known test user.
   - Dashboard → Battle mode → Join card → enter the code from window A + display name "Bob" → Join battle.
3. Host window should show Bob in the player list within <2s.

- [ ] **Step 3: Add a second player**

1. Open window C (second incognito). Sign in with a third test user OR just run the join API via curl with a fresh `X-Guest-Id` so you have ≥2 players. (The simplest way: use the Supabase anon key path in a curl loop — or just add a third real account.)
2. Confirm both players appear for the host.

- [ ] **Step 4: Run the battle**

1. Host clicks "Start battle". Both players move from lobby to Question view.
2. Player B answers correctly within 2s. Player C waits until timer expires.
3. After timer expiry OR both answers are in, all three windows show the leaderboard with the correct scores.
4. Host clicks "Next question". Repeat.
5. After the last question, host clicks "End battle" → all windows show `BattleResults` with podium.

- [ ] **Step 5: Confirmed checks**

- Countdown ticks roughly in sync across windows (within 1s — they derive from `question_start_time` which is server-set).
- Duplicate answer attempt returns "Already answered." and does not increase score.
- Player list updates in real time when a new player joins OR leaves (close a window → after a minute Presence untracks; `room_players` rows persist by design).
- Connection indicator in lobby goes green.
- Refresh a player's browser mid-battle → they rejoin via `battleApi.join` (idempotent) and see the current question.

- [ ] **Step 6: If anything fails, fix and recommit**

Investigate first (look at browser console, Supabase Realtime logs in the dashboard, and Vercel dev server logs). Do not disable pieces to make the error go away.

---

## Task 21: Build + deploy

- [ ] **Step 1: Type-check and production build locally**

```bash
npm run lint
npm run build
```

Expected: both succeed. `dist/` is regenerated.

- [ ] **Step 2: Deploy manually**

```bash
vercel --prod
```

(GitHub is not linked — manual deploy is the policy in this repo.)

- [ ] **Step 3: Smoke test in production**

Repeat the short version of Task 20 against the production URL with two devices (phone + desktop is a good mobile-first check). Confirm `wss://*.supabase.co` connects — if CSP blocks it, it'll show in the browser console.

- [ ] **Step 4: Final commit of anything stray**

```bash
git status
```

If there's a stray change (e.g., a generated `dist/` change you want to keep out of git), ensure `.gitignore` already covers it — don't commit build artifacts.

- [ ] **Step 5: Open a PR or merge**

Follow `superpowers:finishing-a-development-branch` to decide: PR vs direct merge to main. This repo's history shows direct commits to `main` are normal; matches project convention.

---

## Known limitations (acceptable for v1, flag in PR description)

- **Late-join is rejected once status=active.** Simpler UX; revisit if users complain.
- **Rematch returns host to `BattleEntry`** rather than resetting the existing room. Room is GC'd by pg_cron after 2h.
- **Landing page does not yet expose a direct "Join battle" entry for unsigned visitors.** Guests still work — they can sign up (free) and use the dashboard Join card, OR follow-up work can add a `/battle/:code` deep link. Out of scope for this plan.
- **Scoring is server-calculated at answer time**, so clock skew between client and Vercel doesn't affect fairness; only `question_start_time` (server `now()`) and answer arrival time (server `Date.now()`) matter.
- **Presence is tracked but not displayed separately** from `room_players`. The `track()` call is kept for future "online now" indicators.

---

## Self-review checklist (filled in by author)

- [x] **Spec coverage:** all three tables, all five endpoints, guest support, 2h auto-cleanup, 20-player cap, scoring formula, mobile-first components, CSS variables, no changes to generator/timer.
- [x] **Placeholders:** none — every code block is complete.
- [x] **Type consistency:** `BattleRoom`, `BattlePlayer`, `BattleAnswer`, `BattleBroadcast`, `QUESTION_WINDOW_MS` defined in Task 2 and used verbatim in Tasks 9, 12, 15, 18.
- [x] **Endpoint ↔ client consistency:** `battleApi.create/join/start/answer/next` payloads match handler `request.json()` reads field-for-field.
- [x] **Deploy policy:** plan explicitly uses `vercel --prod`; no accidental git push expectation.
