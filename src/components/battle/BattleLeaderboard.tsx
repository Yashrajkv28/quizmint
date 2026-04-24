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
