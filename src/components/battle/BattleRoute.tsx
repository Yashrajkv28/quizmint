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
        onBack={onExit}
      />
    );
  }

  // key={session.roomId} fully remounts InsideRoom on rematch. Without it,
  // useBattleRoom retains stale state across the session swap (stale
  // lastBroadcast triggering a re-fire of the rematch effect; lingering
  // `rematching` flag disabling the next rematch button; old room/players
  // showing for a frame). With it, the new room mounts fresh.
  return (
    <InsideRoom
      key={session.roomId}
      session={session}
      isHostUser={!!user && session.asHost}
      onExit={() => { setSession(null); onExit(); }}
      onRematchSwitch={(s) => setSession(s)}
    />
  );
}

function InsideRoom({
  session, isHostUser, onExit, onRematchSwitch,
}: {
  session: Session;
  isHostUser: boolean;
  onExit: () => void;
  onRematchSwitch: (s: Session) => void;
}) {
  const {
    room, players, answersByQuestion, connected, presentPlayerIds,
    lastBroadcast, broadcast,
  } = useBattleRoom({
    roomId: session.roomId,
    roomCode: session.roomCode,
    playerId: session.playerId,
    displayName: session.displayName,
  });

  // Rematch wiring -----------------------------------------------------------
  // Host calls /rematch → broadcasts {type:'rematch', ...} on the OLD channel
  // → swaps own session into the new room → fires destroy on the old room
  // after a short grace so other clients have time to migrate before the
  // postgres_changes DELETE arrives. Non-host clients listen for the broadcast
  // and auto-rejoin the new room with their existing display name.
  const [rematching, setRematching] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);

  const handleRematch = async () => {
    if (!isHostUser || rematching) return;
    setRematching(true); setRematchError(null);
    try {
      const oldRoomId = session.roomId;
      const { roomId, roomCode, playerId } = await battleApi.rematch(oldRoomId);
      await broadcast({ type: 'rematch', newRoomId: roomId, newRoomCode: roomCode });
      onRematchSwitch({ roomId, roomCode, playerId, displayName: session.displayName, asHost: true });
      // 5s grace before destroying the old room: enough time for non-hosts to
      // receive the broadcast, fire /api/rooms/join, and switch session before
      // the postgres_changes DELETE on the old room would otherwise flash them
      // through "Loading room…". Idempotent if it loses (room already gone).
      window.setTimeout(() => {
        battleApi.destroy(oldRoomId).catch(() => {/* idempotent — ignore */});
      }, 5000);
    } catch (e: any) {
      setRematchError(e.message || 'Rematch failed.');
      setRematching(false);
    }
  };

  // Non-host mid-battle leave: remove the player row server-side so the
  // total-players denominator and leaderboard recompute correctly for
  // everyone else, then exit. Host doesn't get a leave button (they would
  // strand the battle); presence-based abandon handles host tab-close.
  const handleLeave = async () => {
    if (!isHostUser) {
      try { await battleApi.leave(session.roomId); } catch { /* idempotent */ }
    }
    onExit();
  };

  // Non-host: listen for rematch broadcast and migrate. Belt-and-suspenders
  // guard `newRoomCode !== session.roomCode` — the parent's key={session.roomId}
  // already fully remounts on session swap (so this branch can't actually
  // re-fire post-migration), but the guard makes the intent obvious if anyone
  // refactors the parent later.
  useEffect(() => {
    if (isHostUser) return;
    if (!lastBroadcast || lastBroadcast.type !== 'rematch') return;
    const { newRoomCode } = lastBroadcast;
    if (newRoomCode === session.roomCode) return;
    let cancelled = false;
    (async () => {
      try {
        const { roomId, playerId } = await battleApi.join(newRoomCode, session.displayName);
        if (cancelled) return;
        onRematchSwitch({ roomId, roomCode: newRoomCode, playerId, displayName: session.displayName, asHost: false });
      } catch {
        /* host's destroy will eventually fire; we'll fall back to "Loading room…" → user can exit */
      }
    })();
    return () => { cancelled = true; };
  }, [lastBroadcast, isHostUser, session.displayName, session.roomCode, onRematchSwitch]);

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
    // Participant count = rows in room_players. Host auto-joins as a player
    // row (Task 61) and answers questions like everyone else, so they count
    // toward the denominator here.
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
        onLeave={onExit}
      />
    );
  }

  if (room.status === 'finished') {
    return (
      <BattleResults
        players={players}
        myPlayerId={session.playerId}
        isHost={isHostUser}
        rematching={rematching}
        rematchError={rematchError}
        onRematch={handleRematch}
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
        canLeave={!isHostUser}
        onLeave={handleLeave}
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
      canLeave={!isHostUser}
      onLeave={handleLeave}
    />
  );
}
