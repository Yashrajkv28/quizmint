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
