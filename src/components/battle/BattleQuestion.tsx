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
  playerId: string | null;
  question: Question;
  questionIndex: number;
  questionStartTime: string | null;
  existingAnswer: BattleAnswer | undefined;
  // Host-view extras — when playerId is null (host), we show a different panel.
  answersReceived?: number;
  totalPlayers?: number;
}

export function BattleQuestion({
  roomId, playerId, question, questionIndex, questionStartTime, existingAnswer,
  answersReceived = 0, totalPlayers = 0,
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

  // Host view: show the question + live "X/Y answered" indicator instead of a
  // grid of disabled-looking buttons.
  const isHostView = !playerId;

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

      {isHostView ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {question.options.map((opt, i) => {
              const c = OPTION_COLORS[i % OPTION_COLORS.length];
              return (
                <div
                  key={opt.id}
                  className={`text-left p-5 rounded-xl border ${c.bg} ${c.border}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-8 h-8 rounded-lg ${c.bg} border ${c.border} grid place-items-center font-bold ${c.text}`}>
                      {opt.id}
                    </span>
                    <span className="text-[15px] text-[var(--c-text)] flex-1">{opt.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--c-text-faint)]">Answers received</p>
            <p className="text-[24px] font-mono tabular-nums font-semibold text-[var(--c-text)]">
              {answersReceived}/{totalPlayers}
            </p>
          </div>
        </div>
      ) : (
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
      )}

      {!isHostView && shownAnswer?.isCorrect !== undefined && (
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
