import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { QuizGenerator } from './components/QuizGenerator';
import { QuizPlayer } from './components/QuizPlayer';
import { QuizMintLogo } from './components/QuizMintLogo';
import { LandingPage } from './components/LandingPage';
import { QuizData } from './types';

type Theme = 'light' | 'dark';

export default function App() {
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.classList.add('light');
    else root.classList.remove('light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  if (showLanding) {
    return (
      <LandingPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onStart={() => setShowLanding(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--c-app)] text-[var(--c-text)] font-sans flex overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[280px] bg-[var(--c-surface)] border-r border-[var(--c-border)] p-6 flex-col gap-8 shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-[18px] font-bold tracking-tight flex items-center gap-2.5">
            <QuizMintLogo size={22} />
            <span>Quiz<span className="text-[var(--c-brand)]">Mint</span></span>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg border border-[var(--c-border)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="p-4 bg-white/5 border border-[var(--c-border)] rounded-xl">
            <p className="text-[11px] uppercase text-[var(--c-text-subtle)] tracking-wider mb-1">Status</p>
            <p className="text-[20px] font-semibold">{quizData ? 'Active' : 'Awaiting Input'}</p>
          </div>
          {quizData && (
            <>
              <div className="p-4 bg-white/5 border border-[var(--c-border)] rounded-xl">
                <p className="text-[11px] uppercase text-[var(--c-text-subtle)] tracking-wider mb-1">Predicted Difficulty</p>
                <p className={`text-[20px] font-semibold ${
                  quizData.difficulty === 'Hard' ? 'text-red-400' :
                  quizData.difficulty === 'Medium' ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>{quizData.difficulty}</p>
              </div>
              <div className="p-4 bg-white/5 border border-[var(--c-border)] rounded-xl">
                <p className="text-[11px] uppercase text-[var(--c-text-subtle)] tracking-wider mb-1">Total Questions</p>
                <p className="text-[20px] font-semibold">{quizData.questions.length}</p>
              </div>
            </>
          )}
        </div>

        <div className="mt-auto p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-xl">
          <p className="text-[12px] font-semibold text-emerald-500 mb-2">AI Engine Active</p>
          <p className="text-[11px] text-[var(--c-text-subtle)] leading-relaxed">
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
