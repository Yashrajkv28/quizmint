import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  BattleAnswer,
  BattleBroadcast,
  BattlePlayer,
  BattleRoom,
} from '../types/battle';

interface Params {
  roomId: string;
  roomCode: string;
  playerId: string | null;
  displayName: string | null;
}

export function useBattleRoom({ roomId, roomCode, playerId, displayName }: Params) {
  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [answers, setAnswers] = useState<BattleAnswer[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<BattleBroadcast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initial fetch ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [roomRes, playersRes, answersRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('room_players').select('*').eq('room_id', roomId),
        supabase.from('room_answers').select('*').eq('room_id', roomId),
      ]);
      if (cancelled) return;
      const firstErr = roomRes.error || playersRes.error || answersRes.error;
      if (firstErr) setError(firstErr.message);
      if (roomRes.data) setRoom(roomRes.data as BattleRoom);
      if (playersRes.data) setPlayers(playersRes.data as BattlePlayer[]);
      if (answersRes.data) setAnswers(answersRes.data as BattleAnswer[]);
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // Realtime channel ---------------------------------------------------------
  useEffect(() => {
    const channel = supabase.channel(`room:${roomCode}`, {
      config: { presence: { key: playerId ?? `viewer-${crypto.randomUUID()}` } },
    });

    channel
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setRoom(null);
          else setRoom(payload.new as BattleRoom);
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === 'INSERT') return [...prev, payload.new as BattlePlayer];
            if (payload.eventType === 'UPDATE') return prev.map((x) => x.id === (payload.new as BattlePlayer).id ? payload.new as BattlePlayer : x);
            if (payload.eventType === 'DELETE') return prev.filter((x) => x.id !== (payload.old as BattlePlayer).id);
            return prev;
          });
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_answers', filter: `room_id=eq.${roomId}` },
        (payload) => { setAnswers((prev) => [...prev, payload.new as BattleAnswer]); })
      .on('broadcast', { event: 'battle' }, ({ payload }) => {
        setLastBroadcast(payload as BattleBroadcast);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnected(true);
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setConnected(false);
      });

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // playerId/displayName intentionally excluded — those are pushed via a
    // separate presence effect below so renaming or late player-id assignment
    // doesn't tear down the channel and drop in-flight broadcasts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, roomCode]);

  // Presence tracking ---------------------------------------------------------
  // Runs whenever the player identity changes. track() is idempotent on the
  // same key, so re-calling it just updates the payload without a resubscribe.
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !connected) return;
    if (playerId && displayName) {
      void ch.track({ playerId, displayName });
    } else {
      void ch.untrack();
    }
  }, [connected, playerId, displayName]);

  const broadcast = useMemo(() => async (msg: BattleBroadcast) => {
    const ch = channelRef.current;
    if (!ch) return;
    await ch.send({ type: 'broadcast', event: 'battle', payload: msg });
  }, []);

  const answersByQuestion = useMemo(() => {
    const byQ: Record<number, BattleAnswer[]> = {};
    for (const a of answers) (byQ[a.question_index] ||= []).push(a);
    return byQ;
  }, [answers]);

  return { room, players, answers, answersByQuestion, connected, lastBroadcast, error, broadcast };
}
