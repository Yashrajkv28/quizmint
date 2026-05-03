import { useEffect, useMemo, useState } from 'react';
import { LogOut } from 'lucide-react';
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
  playerId: string;
  question: Question;
  questionIndex: number;
  questionStartTime: string | null;
  existingAnswer: BattleAnswer | undefined;
  // Live "X / Y answered" counter — shown to everyone so players can see
  // how many of their opponents are still deciding.
  answersReceived: number;
  totalPlayers: number;
  // Host can't leave mid-battle (would strand other players); only non-hosts
  // get a Leave affordance here. Host disconnect is handled by the existing
  // presence-based abandon flow in BattleRoute.
  canLeave: boolean;
  onLeave: () => void;
}

export function BattleQuestion({
  roomId, playerId, question, questionIndex, questionStartTime, existingAnswer,
  answersReceived, totalPlayers, canLeave, onLeave,
}: Props) {
  // endsAt is derived from the SERVER's question_start_time, but `now` is local
  // Date.now(). If the client's clock is skewed, the visible countdown drifts,
  // but scoring is server-side (see api/rooms/answer.ts), so drift only affects
  // the local timer bar — not fairness. The 500ms grace window on the server
  // additionally forgives a half-second of network/clock slop.
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

  useEffect(() => {
    setLocalAnswer(null);
    setError(null);
  }, [questionIndex]);

  const remaining = Math.max(0, endsAt - now);
  const pct = Math.max(0, Math.min(100, (remaining / QUESTION_WINDOW_MS) * 100));
  const locked = !!localAnswer || !!existingAnswer || remaining === 0;

  const answer = async (optionId: string) => {
    if (locked) return;
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--c-text-faint)]">Question {questionIndex + 1}</p>
        <div className="flex items-center gap-3 text-[13px] font-mono tabular-nums text-[var(--c-text-subtle)]">
          <span>{answersReceived}/{totalPlayers} answered</span>
          <span className="text-[var(--c-text-faint)]">·</span>
          <span>{(remaining / 1000).toFixed(1)}s</span>
          {canLeave && (
            <>
              <span className="text-[var(--c-text-faint)]">·</span>
              <button
                type="button"
                onClick={onLeave}
                className="inline-flex items-center gap-1 text-[var(--c-text-subtle)] hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Leave
              </button>
            </>
          )}
        </div>
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

      {error && <p className="text-[13px] text-red-500">{error}</p>}
    </div>
  );
}
