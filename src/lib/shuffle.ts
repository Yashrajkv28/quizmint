import type { Question } from '../types';

// Fisher-Yates. `Array.sort(() => Math.random() - 0.5)` is biased.
export function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Shuffles a question's options and re-letters the ids so the display
// reads a/b/c/d in visual order. correctOptionId is remapped to the new id
// of whichever option was originally correct.
//
// Purpose: a lot of AI-generated quizzes bias the correct answer toward a
// specific letter. Per-attempt shuffling defeats that bias, and re-lettering
// keeps the UI clean.
export function shuffleQuestionOptions(q: Question): Question {
  const originallyCorrect = q.options.find((o) => o.id === q.correctOptionId);
  const reordered = shuffle(q.options);
  const options = reordered.map((opt, i) => ({
    id: OPTION_LETTERS[i] ?? String(i + 1),
    text: opt.text,
  }));
  // Find where the original-correct option landed in the new order.
  const correctIndex = reordered.findIndex((o) => o === originallyCorrect);
  return {
    ...q,
    options,
    correctOptionId: options[correctIndex].id,
  };
}
