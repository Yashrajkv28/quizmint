import { useState } from 'react';
import { ArrowLeft, Swords, Users } from 'lucide-react';
import type { QuizData } from '../../types';
import { useAuth } from '../../lib/auth';
import { battleApi } from '../../lib/battleApi';

interface Props {
  quizData: QuizData | null;
  onHosted: (args: { roomId: string; roomCode: string; playerId: string; displayName: string }) => void;
  onJoined: (args: { roomId: string; roomCode: string; playerId: string; displayName: string }) => void;
  onNeedQuiz: () => void;
  onBack: () => void;
}

// Local-part of an email address, capped at the display-name length.
function emailLocal(email: string | null | undefined): string {
  if (!email) return '';
  const at = email.indexOf('@');
  return (at > 0 ? email.slice(0, at) : email).slice(0, 32);
}

export function BattleEntry({ quizData, onHosted, onJoined, onNeedQuiz, onBack }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState(() => emailLocal(user?.email));
  const [busy, setBusy] = useState<'host' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanName = name.trim();

  const host = async () => {
    if (!quizData) return onNeedQuiz();
    setBusy('host'); setError(null);
    try {
      const { roomId, roomCode, playerId } = await battleApi.create(quizData, cleanName);
      onHosted({ roomId, roomCode, playerId, displayName: cleanName });
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const join = async () => {
    setBusy('join'); setError(null);
    try {
      const cleanCode = code.trim().toUpperCase();
      const { roomId, playerId } = await battleApi.join(cleanCode, cleanName);
      onJoined({ roomId, roomCode: cleanCode, playerId, displayName: cleanName });
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="w-full max-w-[900px] mx-auto px-4 py-10 flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[12px] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors self-start"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
      </button>

      <label className="flex flex-col gap-1.5 max-w-md mx-auto w-full">
        <span className="text-[11px] uppercase tracking-wider text-[var(--c-text-faint)]">Your battle name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 32))}
          placeholder="Your name"
          className="w-full px-3 py-2.5 rounded-lg bg-[var(--c-app)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-[14px]"
        />
      </label>

      <div className="grid gap-6 md:grid-cols-2">
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
              You'll play and host at the same time.
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
            disabled={!user || busy === 'host' || cleanName.length === 0}
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
          {!user && (
            <p className="text-[12px] text-amber-500">Joining requires a signed-in account.</p>
          )}
          <button
            type="button"
            disabled={!user || busy === 'join' || code.length !== 6 || cleanName.length === 0}
            onClick={join}
            className="mt-auto px-4 py-2.5 rounded-lg bg-emerald-500 text-[#0A0A0C] font-semibold text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
          >
            {busy === 'join' ? 'Joining…' : 'Join battle'}
          </button>
        </div>
      </div>

      {error && <p className="text-[13px] text-red-500 text-center">{error}</p>}
    </div>
  );
}
