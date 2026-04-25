import { useState, useEffect, lazy, Suspense } from 'react';
import { Sun, Moon, ArrowLeft } from 'lucide-react';
import { QuizMintLogo } from './components/QuizMintLogo';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { AuthCallback } from './components/AuthCallback';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Dashboard } from './components/Dashboard';
import { QuizData } from './types';
import { useAuth } from './lib/auth';

// Heavy routes — not needed for landing/login, so we defer the download.
// QuizGenerator pulls in pdf.js (~450 KB) and is the biggest win.
const QuizGenerator = lazy(() =>
  import('./components/QuizGenerator').then((m) => ({ default: m.QuizGenerator })),
);
const QuizPlayer = lazy(() =>
  import('./components/QuizPlayer').then((m) => ({ default: m.QuizPlayer })),
);
const TimerPage = lazy(() =>
  import('./components/timer/TimerPage').then((m) => ({ default: m.TimerPage })),
);
const BattleRoute = lazy(() =>
  import('./components/battle/BattleRoute').then((m) => ({ default: m.BattleRoute })),
);

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--c-app)] text-[var(--c-text-subtle)] text-[14px]">
      Loading…
    </div>
  );
}

type Theme = 'light' | 'dark';
type View = 'landing' | 'login' | 'dashboard' | 'app' | 'timer' | 'battle';

export default function App() {
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [view, setView] = useState<View>('landing');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  const { user, loading, isPasswordRecovery } = useAuth();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.classList.add('light');
    else root.classList.remove('light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Once the user signs in, land on the dashboard. If they sign out while inside, bounce to landing.
  useEffect(() => {
    if (user && view === 'login') setView('dashboard');
    // 'battle' is NOT in this guard — guests (unauthenticated users) need to stay
    // on the battle view to join a room via a shared code.
    if (!user && (view === 'app' || view === 'dashboard' || view === 'timer')) {
      setQuizData(null);
      setView('landing');
    }
  }, [user, view]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const handleStart = () => {
    if (user) setView('dashboard');
    else setView('login');
  };

  // Guard navigation away from the app route when there's unsaved work: either
  // a quiz in progress (quizData set) or dirty generator input (flagged by QuizGenerator).
  const leaveAppRoute = () => {
    const dirtyInput = (window as unknown as { __quizmintDirty?: boolean }).__quizmintDirty === true;
    const quizInProgress = !!quizData;
    if (dirtyInput || quizInProgress) {
      const msg = quizInProgress
        ? 'Leave this quiz? Your progress will be lost.'
        : 'Discard your current input?';
      if (!window.confirm(msg)) return;
    }
    setQuizData(null);
    setView('dashboard');
  };

  if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--c-app)] text-[var(--c-text-subtle)] text-[14px]">
        Loading…
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <ResetPasswordPage theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (view === 'landing') {
    return (
      <LandingPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onStart={handleStart}
      />
    );
  }

  if (view === 'login') {
    return (
      <LoginPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onBack={() => setView('landing')}
      />
    );
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        theme={theme}
        onToggleTheme={toggleTheme}
        onStartGenerate={() => setView('app')}
        onStartTimer={() => setView('timer')}
        onStartBattle={() => setView('battle')}
        onLogoHome={() => setView(user ? 'dashboard' : 'landing')}
      />
    );
  }

  if (view === 'timer') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <TimerPage
          theme={theme}
          onToggleTheme={toggleTheme}
          onBack={() => setView('dashboard')}
        />
      </Suspense>
    );
  }

  if (view === 'battle') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <BattleRoute
          quizData={quizData}
          onNeedQuiz={() => setView('app')}
          onExit={() => setView('dashboard')}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--c-app)] text-[var(--c-text)] font-sans flex overflow-hidden">
      <aside className="hidden lg:flex w-[280px] bg-[var(--c-surface)] border-r border-[var(--c-border)] p-6 flex-col gap-8 shrink-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={leaveAppRoute}
            aria-label="Back to dashboard"
            className="text-[18px] font-bold tracking-tight flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <QuizMintLogo size={22} />
            <span>Quiz<span className="text-[var(--c-brand)]">Mint</span></span>
          </button>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg border border-[var(--c-border)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="button"
          onClick={leaveAppRoute}
          className="flex items-center gap-2 text-[12px] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors self-start"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

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

        <div className="mt-auto flex flex-col gap-3">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-xl">
            <p className="text-[12px] font-semibold text-emerald-500 mb-2">AI Engine Active</p>
            <p className="text-[11px] text-[var(--c-text-subtle)] leading-relaxed">
              Dynamically parsing and adjusting difficulty based on your dataset...
            </p>
          </div>
          {user && (
            <div className="p-3 bg-[var(--c-app)] border border-[var(--c-border)] rounded-xl">
              <p className="text-[11px] uppercase text-[var(--c-text-subtle)] tracking-wider">Signed in</p>
              <p className="text-[12px] text-[var(--c-text-muted)] font-medium truncate">{user.email}</p>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 relative flex flex-col h-screen overflow-y-auto">
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
      </main>

    </div>
  );
}
