import { useEffect, useState } from 'react';
import type { QuizData } from '../../types';
import { QUESTION_WINDOW_MS } from '../../types/battle';
import { useAuth } from '../../lib/auth';
import { useBattleRoom } from '../../lib/useBattleRoom';
import { BattleEntry } from './BattleEntry';
import { BattleLobby } from './BattleLobby';
import { BattleQuestion } from './BattleQuestion';
import { BattleLeaderboard } from './BattleLeaderboard';
import { BattleResults } from './BattleResults';

interface Props {
  quizData: QuizData | null;
  onNeedQuiz: () => void;
  onExit: () => void;
}

interface Session {
  roomId: string;
  roomCode: string;
  playerId: string | null;
  displayName: string | null;
  asHost: boolean;
}

export function BattleRoute({ quizData, onNeedQuiz, onExit }: Props) {
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return (
      <BattleEntry
        quizData={quizData}
        onHosted={({ roomId, roomCode }) =>
          setSession({ roomId, roomCode, playerId: null, displayName: null, asHost: true })
        }
        onJoined={({ roomId, roomCode, playerId, displayName }) =>
          setSession({ roomId, roomCode, playerId, displayName, asHost: false })
        }
        onNeedQuiz={onNeedQuiz}
      />
    );
  }

  return (
    <InsideRoom
      session={session}
      isHostUser={!!user && session.asHost}
      onExit={() => { setSession(null); onExit(); }}
      onPlayAgain={() => setSession(null)}
    />
  );
}

function InsideRoom({
  session, isHostUser, onExit, onPlayAgain,
}: {
  session: Session;
  isHostUser: boolean;
  onExit: () => void;
  onPlayAgain: () => void;
}) {
  const { room, players, answersByQuestion, connected } = useBattleRoom({
    roomId: session.roomId,
    roomCode: session.roomCode,
    playerId: session.playerId,
    displayName: session.displayName,
  });

  const [phase, setPhase] = useState<'question' | 'reveal'>('question');
  useEffect(() => { setPhase('question'); }, [room?.current_question]);

  useEffect(() => {
    if (!room || room.status !== 'active' || !room.question_start_time) return;
    const endsAt = new Date(room.question_start_time).getTime() + QUESTION_WINDOW_MS;
    const tick = () => {
      const qIdx = room.current_question;
      const answered = (answersByQuestion[qIdx] || []).length;
      if (Date.now() >= endsAt || answered >= players.length) {
        setPhase('reveal');
      }
    };
    const id = window.setInterval(tick, 200);
    tick();
    return () => window.clearInterval(id);
  }, [room, players.length, answersByQuestion]);

  if (!room) {
    return <p className="text-center py-10 text-[var(--c-text-subtle)] text-[14px]">Loading room…</p>;
  }

  if (room.status === 'waiting') {
    return (
      <BattleLobby
        roomCode={room.code}
        roomId={room.id}
        isHost={isHostUser}
        players={players}
        connected={connected}
      />
    );
  }

  if (room.status === 'finished') {
    return (
      <BattleResults
        players={players}
        myPlayerId={session.playerId}
        onPlayAgain={onPlayAgain}
        onExit={onExit}
      />
    );
  }

  // status === 'active'
  const q = room.quiz_data.questions[room.current_question];
  const myAnswer = session.playerId
    ? (answersByQuestion[room.current_question] || []).find((a) => a.player_id === session.playerId)
    : undefined;

  if (phase === 'question' && q) {
    return (
      <BattleQuestion
        roomId={room.id}
        playerId={session.playerId}
        question={q}
        questionIndex={room.current_question}
        questionStartTime={room.question_start_time}
        existingAnswer={myAnswer}
      />
    );
  }

  return (
    <BattleLeaderboard
      roomId={room.id}
      players={players}
      isHost={isHostUser}
      isLastQuestion={room.current_question + 1 >= room.quiz_data.questions.length}
      currentQuestion={room.current_question}
      totalQuestions={room.quiz_data.questions.length}
      myPlayerId={session.playerId}
    />
  );
}
