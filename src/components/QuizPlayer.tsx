import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Question } from '../types';

interface QuizPlayerProps {
  questions: Question[];
  onReset: () => void;
}

export function QuizPlayer({ questions, onReset }: QuizPlayerProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const handleOptionClick = (questionIndex: number, optionId: string) => {
    if (answers[questionIndex]) return; // Already answered
    setAnswers(prev => ({ ...prev, [questionIndex]: optionId }));
  };

  const score = Object.keys(answers).reduce((acc, qIndexStr) => {
    const qIndex = parseInt(qIndexStr, 10);
    if (answers[qIndex] === questions[qIndex].correctOptionId) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const progress = (Object.keys(answers).length / questions.length) * 100;

  const handleRetry = () => {
    setAnswers({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex-1 flex flex-col relative p-[60px]">
      <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--c-border)]">
        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
      </div>
      
      <div className="absolute top-8 right-8 flex items-center gap-3">
        {Object.keys(answers).length > 0 && Object.keys(answers).length < questions.length && (
          <button
            onClick={handleRetry}
            className="px-4 py-2 text-[13px] font-medium text-[var(--c-text-subtle)] hover:text-[var(--c-text)] bg-[var(--c-surface)] hover:bg-[var(--c-border)] border border-[var(--c-border)] hover:border-slate-500 rounded-lg transition-colors"
          >
            Restart Output
          </button>
        )}
        <button
          onClick={onReset}
          className="px-4 py-2 text-[13px] font-medium text-[var(--c-text-subtle)] hover:text-[var(--c-text)] bg-[var(--c-surface)] hover:bg-[var(--c-border)] border border-[var(--c-border)] hover:border-slate-500 rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Exit Quiz
        </button>
      </div>

      <div className="max-w-[600px] w-full mx-auto space-y-24 pb-20">
        {questions.map((q, index) => {
          const selectedOptionId = answers[index];
          const isAnswered = !!selectedOptionId;
          const isCorrect = selectedOptionId === q.correctOptionId;

          return (
            <div key={index} className="flex flex-col">
              <div className="text-indigo-500 text-[14px] font-semibold mb-3">Question {String(index + 1).padStart(2, '0')}</div>
              <h1 className="text-[28px] leading-[1.3] font-medium mb-10 text-[var(--c-text)]">
                {q.question}
              </h1>
              
              <div className="grid grid-cols-1 gap-3">
                {q.options.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  const isCorrectOption = q.correctOptionId === opt.id;
                  
                  let buttonClass = "p-[18px_24px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl cursor-pointer flex justify-between items-center transition-colors ";
                  
                  if (!isAnswered) {
                    buttonClass += "hover:border-slate-400";
                  } else {
                    buttonClass += "cursor-default ";
                    if (isCorrectOption) {
                      buttonClass += "border-emerald-500 bg-[rgba(16,185,129,0.05)]";
                    } else if (isSelected && !isCorrectOption) {
                      buttonClass += "border-red-500 bg-[rgba(239,68,68,0.05)]";
                    } else {
                      buttonClass += "opacity-50";
                    }
                  }

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleOptionClick(index, opt.id)}
                      className={buttonClass}
                    >
                      <span className="text-[16px] font-normal text-[var(--c-text)]">
                        {opt.id}) {opt.text}
                      </span>
                      {isAnswered && isCorrectOption && (
                        <span className="text-[11px] font-bold uppercase px-2 py-1 rounded text-emerald-500 border border-emerald-500">
                          Correct Answer
                        </span>
                      )}
                      {isAnswered && isSelected && !isCorrectOption && (
                        <span className="text-[11px] font-bold uppercase px-2 py-1 rounded text-red-500 border border-red-500">
                          Incorrect
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {isAnswered && q.explanation && (
                <div className="mt-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-[14px]">
                  <span className="font-semibold text-indigo-400">Explanation:</span> {q.explanation}
                </div>
              )}
              
              {!isAnswered && (
                <p className="mt-10 text-[13px] text-[var(--c-text-subtle)] italic">Tap an option to see instant verification. No submit button required.</p>
              )}
            </div>
          );
        })}

        {Object.keys(answers).length === questions.length && (
          <div className="mt-12 p-8 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl text-center">
            <h3 className="text-[24px] font-bold text-[var(--c-text)] mb-2">Quiz Completed!</h3>
            <p className="text-[16px] text-[var(--c-text-subtle)] mb-6">
              You scored {score} out of {questions.length} ({(score / questions.length * 100).toFixed(0)}%)
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-[var(--c-border)] hover:bg-slate-700 text-[var(--c-text)] font-medium rounded-xl transition-colors"
              >
                Retry Quiz
              </button>
              <button
                onClick={onReset}
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-[var(--c-text)] font-medium rounded-xl transition-colors"
              >
                Create Another Quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
