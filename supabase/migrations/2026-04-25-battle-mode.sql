-- Battle Mode schema
-- Run this in the Supabase SQL editor OR via `supabase db push` (if the CLI is linked).
-- Applies to the same project used by VITE_SUPABASE_URL.

begin;

-- 1. Tables -----------------------------------------------------------------

-- CREATE TYPE has no IF NOT EXISTS clause in Postgres, so guard with DO block.
do $$ begin
  create type room_status as enum ('waiting', 'active', 'finished');
exception when duplicate_object then null;
end $$;

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
--
-- NOTE ON ANSWER-KEY VISIBILITY: `rooms.quiz_data` contains `correctOptionId`
-- for every question, and the SELECT policy above is public. A player in a
-- room (or anyone who guesses a code) can read the key over REST before
-- answering. This is an accepted tradeoff for the v1 classroom use case —
-- clients need to render question text and options from the same column.
-- If competitive integrity is ever required, split the key into a separate
-- table without a public SELECT policy and have the server join for scoring.

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

-- cron.schedule inserts into cron.job and will error on re-run with a
-- duplicate jobname. Wrap so the migration is idempotent.
do $$ begin
  perform cron.schedule(
    'quizmint-room-cleanup',
    '*/15 * * * *',
    $cleanup$delete from public.rooms where created_at < now() - interval '2 hours'$cleanup$
  );
exception when unique_violation then null;
end $$;

-- 5. RPCs -------------------------------------------------------------------
-- Atomic score increment — avoids the read-modify-write race in /api/rooms/answer
-- when two concurrent scored answers hit the same player row.
create or replace function public.increment_player_score(p_player_id uuid, p_delta int)
returns int
language sql
security definer
as $$
  update public.room_players set score = score + p_delta where id = p_player_id
  returning score;
$$;

-- Lock it down — only service role should call this. Revoke from anon/authenticated
-- so a compromised anon key can't inflate scores directly.
revoke execute on function public.increment_player_score(uuid, int) from anon, authenticated;

commit;
