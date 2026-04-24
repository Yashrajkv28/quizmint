import type { QuizData } from '../types';

export type RoomStatus = 'waiting' | 'active' | 'finished';

export interface BattleRoom {
  id: string;
  code: string;
  host_id: string;
  quiz_data: QuizData;
  status: RoomStatus;
  current_question: number;
  question_start_time: string | null;
  created_at: string;
}

export interface BattlePlayer {
  id: string;
  room_id: string;
  user_id: string | null;
  guest_id: string | null;
  display_name: string;
  score: number;
  joined_at: string;
}

export interface BattleAnswer {
  id: string;
  room_id: string;
  player_id: string;
  question_index: number;
  option_id: string;
  answered_at: string;
  is_correct: boolean;
  points_earned: number;
}

// Broadcast events on channel `room:{code}`
export type BattleBroadcast =
  | { type: 'question_start'; questionIndex: number; endsAt: number }
  | { type: 'question_end'; questionIndex: number; correctOptionId: string }
  | { type: 'game_finish' };

// Per-question scoring window
export const QUESTION_WINDOW_MS = 10_000;
