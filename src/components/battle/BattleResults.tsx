import { Crown, Medal, Award, Repeat, Home } from 'lucide-react';
import type { BattlePlayer } from '../../types/battle';

interface Props {
  players: BattlePlayer[];
  myPlayerId: string | null;
  isHost: boolean;
  rematching: boolean;
  rematchError: string | null;
  onRematch: () => void;
  onExit: () => void;
}

export function BattleResults({
  players, myPlayerId, isHost, rematching, rematchError, onRematch, onExit,
}: Props) {
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const [first, second, third] = ranked;

  const Podium = ({ p, place, h }: { p: BattlePlayer; place: 1 | 2 | 3; h: string }) => {
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

      <div className="flex items-end justify-center gap-2 h-[180px]">
        {second && <Podium p={second} place={2} h="h-[120px]" />}
        {first  && <Podium p={first}  place={1} h="h-[160px]" />}
        {third  && <Podium p={third}  place={3} h="h-[90px]" />}
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
        {isHost ? (
          <button
            type="button"
            disabled={rematching}
            onClick={onRematch}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-[#0A0A0C] font-semibold text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
          >
            <Repeat className="w-4 h-4" /> {rematching ? 'Setting up rematch…' : 'Rematch'}
          </button>
        ) : (
          <div className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[var(--c-border)] text-[var(--c-text-subtle)] text-[13px]">
            Waiting for host to rematch…
          </div>
        )}
        <button
          type="button"
          onClick={onExit}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--c-border)] text-[var(--c-text)] font-semibold text-[14px] hover:bg-[var(--c-hover)] transition-colors"
        >
          <Home className="w-4 h-4" /> Exit
        </button>
      </div>
      {rematchError && <p className="text-[13px] text-red-500 text-center">{rematchError}</p>}
    </div>
  );
}
