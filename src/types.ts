export interface Option {
  id: string;
  text: string;
}

export interface Question {
  question: string;
  options: Option[];
  correctOptionId: string;
  explanation?: string;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuizData {
  questions: Question[];
  difficulty: Difficulty;
}

