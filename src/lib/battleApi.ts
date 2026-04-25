import { supabase } from './supabase';
import { getGuestId } from './guestId';
import type { QuizData } from '../types';

async function authHeaders(includeGuest: boolean): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (!token && includeGuest) h['X-Guest-Id'] = getGuestId();
  return h;
}

async function post<T>(path: string, body: unknown, allowGuest: boolean): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: await authHeaders(allowGuest),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
  return json as T;
}

export const battleApi = {
  create: (quizData: QuizData) =>
    post<{ roomId: string; roomCode: string }>('/api/rooms/create', { quizData }, false),
  join: (code: string, displayName: string) =>
    post<{ roomId: string; playerId: string }>('/api/rooms/join', { code, displayName }, true),
  start: (roomId: string) =>
    post<{ ok: true }>('/api/rooms/start', { roomId }, false),
  answer: (roomId: string, playerId: string, questionIndex: number, optionId: string) =>
    post<{ isCorrect: boolean; pointsEarned: number }>(
      '/api/rooms/answer',
      { roomId, playerId, questionIndex, optionId },
      true,
    ),
  next: (roomId: string) =>
    post<{ status: 'active' | 'finished'; currentQuestion: number }>(
      '/api/rooms/next',
      { roomId },
      false,
    ),
};
