import { supabase } from './supabase';
import type { QuizData } from '../types';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to use battle mode.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
  return json as T;
}

export const battleApi = {
  create: (quizData: QuizData, displayName: string) =>
    post<{ roomId: string; roomCode: string; playerId: string }>(
      '/api/rooms/create',
      { quizData, displayName },
    ),
  join: (code: string, displayName: string) =>
    post<{ roomId: string; playerId: string }>('/api/rooms/join', { code, displayName }),
  start: (roomId: string) =>
    post<{ ok: true }>('/api/rooms/start', { roomId }),
  answer: (roomId: string, playerId: string, questionIndex: number, optionId: string) =>
    post<{ isCorrect: boolean; pointsEarned: number }>(
      '/api/rooms/answer',
      { roomId, playerId, questionIndex, optionId },
    ),
  next: (roomId: string, fromQuestion?: number) =>
    post<{ status: 'active' | 'finished'; currentQuestion: number }>(
      '/api/rooms/next',
      { roomId, fromQuestion },
    ),
  abandon: (roomId: string) =>
    post<{ status: 'finished' }>('/api/rooms/abandon', { roomId }),
};
