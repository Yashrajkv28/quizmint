-- Tiered room cleanup
-- Replaces the single 2-hour pg_cron job from 2026-04-25-battle-mode.sql with
-- three status-aware jobs that clean up stale rooms ~30-40 min after they go
-- idle instead of after 2h. Keeps the dashboard clean and recycles codes
-- faster (cosmetic — 32^6 collision space is astronomical anyway).
--
-- Apply this in the Supabase SQL Editor on the same project as the original
-- battle-mode migration. Idempotent on re-run.

begin;

-- 1. Drop the old single-threshold job. Wrapped so the migration doesn't
-- error if the job was already removed (e.g. running this twice).
do $$ begin
  perform cron.unschedule('quizmint-room-cleanup');
exception when others then null;
end $$;

-- 2. Finished battles: delete 30 min after creation. Players have already
-- seen the results screen by then.
do $$ begin
  perform cron.schedule(
    'quizmint-room-cleanup-finished',
    '*/10 * * * *',
    $cleanup$delete from public.rooms where status = 'finished' and created_at < now() - interval '30 minutes'$cleanup$
  );
exception when unique_violation then null;
end $$;

-- 3. Stale lobbies: created but never started, host wandered off pre-start.
do $$ begin
  perform cron.schedule(
    'quizmint-room-cleanup-waiting',
    '*/10 * * * *',
    $cleanup$delete from public.rooms where status = 'waiting' and created_at < now() - interval '30 minutes'$cleanup$
  );
exception when unique_violation then null;
end $$;

-- 4. Stuck active battles: question_start_time hasn't moved in 30 min, which
-- means the host left AND no client fired /api/rooms/abandon (e.g. all
-- participants vanished simultaneously). Normal play advances every ~16s
-- (10s question + 6s leaderboard), so 30 min is way more than legitimate.
do $$ begin
  perform cron.schedule(
    'quizmint-room-cleanup-active',
    '*/10 * * * *',
    $cleanup$delete from public.rooms where status = 'active' and (question_start_time is null or question_start_time < now() - interval '30 minutes')$cleanup$
  );
exception when unique_violation then null;
end $$;

commit;
