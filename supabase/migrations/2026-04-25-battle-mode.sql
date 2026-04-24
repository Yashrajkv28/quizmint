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
