import { useState } from 'react';
import { Copy, Check, LogOut } from 'lucide-react';
import type { BattlePlayer } from '../../types/battle';
import { battleApi } from '../../lib/battleApi';

interface Props {
  roomCode: string;
  roomId: string;
  isHost: boolean;
  players: BattlePlayer[];
  connected: boolean;
  onLeave: () => void;
}

export function BattleLobby({ roomCode, roomId, isHost, players, connected, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
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

  // Host's cancel calls abandon() — flips room status to 'finished' so any
  // non-host participants in the lobby gracefully transition to BattleResults
  // instead of being stranded on "Loading room…" if we hard-deleted. The room
  // row itself is reaped by the 30-min cleanup cron.
  // Non-host's leave calls /leave so their player row is removed cleanly —
  // the lobby's player count, the active-phase denominator, and the
  // leaderboard all recompute correctly via the postgres_changes DELETE
  // subscription in useBattleRoom.
  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      if (isHost) await battleApi.abandon(roomId);
      else        await battleApi.leave(roomId);
    } catch { /* idempotent / room may already be gone */ }
    onLeave();
  };

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 py-10 flex flex-col items-center gap-8">
      <button
        type="button"
        onClick={leave}
        disabled={leaving}
        className="self-start inline-flex items-center gap-2 text-[12px] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] disabled:opacity-50 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" /> {isHost ? 'Cancel room' : 'Leave lobby'}
      </button>

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
