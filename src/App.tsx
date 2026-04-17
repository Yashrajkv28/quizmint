import { useState } from 'react';
import { QuizGenerator } from './components/QuizGenerator';
import { QuizPlayer } from './components/QuizPlayer';
import { QuizData } from './types';

export default function App() {
  const [quizData, setQuizData] = useState<QuizData | null>(null);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white font-sans flex overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[280px] bg-[#15161A] border-r border-[#2D2E35] p-6 flex-col gap-8 shrink-0">
        <div className="text-[18px] font-bold tracking-tight flex items-center gap-2.5">
          <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
          CyberIntel MCQ
        </div>

        <div className="flex flex-col gap-4">
          <div className="p-4 bg-white/5 border border-[#2D2E35] rounded-xl">
            <p className="text-[11px] uppercase text-slate-400 tracking-wider mb-1">Status</p>
            <p className="text-[20px] font-semibold">{quizData ? 'Active' : 'Awaiting Input'}</p>
          </div>
          {quizData && (
            <>
              <div className="p-4 bg-white/5 border border-[#2D2E35] rounded-xl">
                <p className="text-[11px] uppercase text-slate-400 tracking-wider mb-1">Predicted Difficulty</p>
                <p className={`text-[20px] font-semibold ${
                  quizData.difficulty === 'Hard' ? 'text-red-400' :
                  quizData.difficulty === 'Medium' ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>{quizData.difficulty}</p>
              </div>
              <div className="p-4 bg-white/5 border border-[#2D2E35] rounded-xl">
                <p className="text-[11px] uppercase text-slate-400 tracking-wider mb-1">Total Questions</p>
                <p className="text-[20px] font-semibold">{quizData.questions.length}</p>
              </div>
            </>
          )}
        </div>

        <div className="mt-auto p-4 bg-indigo-500/10 border border-indigo-500/50 rounded-xl">
          <p className="text-[12px] font-semibold text-indigo-500 mb-2">AI Engine Active</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Dynamically parsing and adjusting difficulty based on your dataset...
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col h-screen overflow-y-auto">
        {quizData ? (
          <QuizPlayer 
            questions={quizData.questions} 
            onReset={() => setQuizData(null)} 
          />
        ) : (
          <QuizGenerator 
            onGenerate={(generatedData) => setQuizData(generatedData)} 
          />
        )}
      </main>
    </div>
  );
}
