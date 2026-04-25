import { useEffect, useMemo, useState } from 'react';
import type { QuizData } from '../../types';
import { QUESTION_WINDOW_MS } from '../../types/battle';
import { useAuth } from '../../lib/auth';
import { useBattleRoom } from '../../lib/useBattleRoom';
import { battleApi } from '../../lib/battleApi';
import { BattleEntry } from './BattleEntry';
import { BattleLobby } from './BattleLobby';
import { BattleQuestion } from './BattleQuestion';
import { BattleLeaderboard } from './BattleLeaderboard';
import { BattleResults } from './BattleResults';

// How long the host can be missing from Realtime presence before a non-host
// participant marks the room finished. Tuned to forgive a single brief network
// blip without making the wait painful.
const HOST_GRACE_MS = 20_000;

interface Props {
  quizData: QuizData | null;
  onNeedQuiz: () => void;
  onExit: () => void;
}

interface Session {
  roomId: string;
  roomCode: string;
  playerId: string;
  displayName: string;
  asHost: boolean;
}

export function BattleRoute({ quizData, onNeedQuiz, onExit }: Props) {
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return (
      <BattleEntry
        quizData={quizData}
        onHosted={({ roomId, roomCode, playerId, displayName }) =>
          setSession({ roomId, roomCode, playerId, displayName, asHost: true })
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
  const { room, players, answersByQuestion, connected, presentPlayerIds } = useBattleRoom({
    roomId: session.roomId,
    roomCode: session.roomCode,
    playerId: session.playerId,
    displayName: session.displayName,
  });

  const [phase, setPhase] = useState<'question' | 'reveal'>('question');
  useEffect(() => { setPhase('question'); }, [room?.current_question]);

  // Detect host disconnection via Supabase Realtime presence. The host's
  // playerId is whichever room_players row matches room.host_id (host
  // auto-joins as a player on create). If they vanish from presenceState
  // for HOST_GRACE_MS, any non-host participant calls /api/rooms/abandon.
  // The endpoint is idempotent so multiple racing callers are fine.
  const hostPlayerId = useMemo(
    () => players.find((p) => room && p.user_id === room.host_id)?.id ?? null,
    [players, room],
  );
  const hostPresent = !!hostPlayerId && presentPlayerIds.has(hostPlayerId);

  useEffect(() => {
    if (isHostUser) return;                              // I'm the host — N/A
    if (!room || room.status === 'finished') return;     // game's over already
    if (!hostPlayerId) return;                           // host not in players yet
    if (hostPresent) return;                             // host is here — nothing to do

    const id = window.setTimeout(() => {
      battleApi.abandon(session.roomId).catch(() => {/* room will reflect via realtime */});
    }, HOST_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [isHostUser, room, hostPlayerId, hostPresent, session.roomId]);

  useEffect(() => {
    if (!room || room.status !== 'active' || !room.question_start_time) return;
    const endsAt = new Date(room.question_start_time).getTime() + QUESTION_WINDOW_MS;
    // Participant count = rows in room_players. The host does NOT have a row,
    // so this is the correct denominator. If the host ever becomes a player
    // row too, update this to exclude them explicitly.
    const participantCount = players.length;
    const tick = () => {
      const qIdx = room.current_question;
      const answered = (answersByQuestion[qIdx] || []).length;
      if (Date.now() >= endsAt || (participantCount > 0 && answered >= participantCount)) {
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
  const myAnswer = (answersByQuestion[room.current_question] || []).find(
    (a) => a.player_id === session.playerId,
  );

  if (phase === 'question' && q) {
    return (
      <BattleQuestion
        roomId={room.id}
        playerId={session.playerId}
        question={q}
        questionIndex={room.current_question}
        questionStartTime={room.question_start_time}
        existingAnswer={myAnswer}
        answersReceived={(answersByQuestion[room.current_question] || []).length}
        totalPlayers={players.length}
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
