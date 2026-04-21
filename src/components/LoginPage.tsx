import { useState, FormEvent } from 'react';
import { Sun, Moon, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { QuizMintLogo } from './QuizMintLogo';
import { PasswordStrength } from './PasswordStrength';
import { useAuth } from '../lib/auth';
import { validateEmail, validatePassword, PASSWORD_HELP } from '../lib/validation';

type Theme = 'light' | 'dark';
type Tab = 'signin' | 'signup';
type Mode = 'auth' | 'forgot';

interface LoginPageProps {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
}

export function LoginPage({ theme, onToggleTheme, onBack }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>('auth');
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { signIn, signUp, sendPasswordReset } = useAuth();

  const resetMessages = () => {
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    // Gmail-only is enforced on signup and forgot-password. Sign-in skips the gmail
    // check so existing non-gmail accounts (if any snuck in before the rule) can still
    // sign in and see the "switch to gmail" nudge via Supabase instead of failing here.
    if (tab === 'signup' || mode === 'forgot') {
      const emailErr = validateEmail(email);
      if (emailErr) {
        setError(emailErr);
        return;
      }
    } else if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (mode === 'auth') {
      if (!password) {
        setError('Password is required.');
        return;
      }
      if (tab === 'signup') {
        const pwErr = validatePassword(password);
        if (pwErr) {
          setError(pwErr);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        await sendPasswordReset(email.trim());
        setNotice('Check your email for a reset link.');
      } else if (tab === 'signin') {
        await signIn(email.trim(), password);
        // AuthProvider state change will unmount this page.
      } else {
        const { needsEmailConfirmation } = await signUp(email.trim(), password);
        if (needsEmailConfirmation) {
          setNotice('Check your email to confirm your account, then sign in.');
          setTab('signin');
          setPassword('');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const heading = mode === 'forgot'
    ? 'Reset your password'
    : tab === 'signin' ? 'Welcome back' : 'Create your account';
  const subheading = mode === 'forgot'
    ? 'Enter your email and we\u2019ll send a reset link.'
    : tab === 'signin' ? 'Sign in to generate quizzes.' : 'It takes ten seconds. No credit card, no spam.';

  return (
    <div className="min-h-screen bg-[var(--c-app)] text-[var(--c-text)] font-sans flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-[var(--c-border)]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2.5 text-[16px] font-bold tracking-tight">
          <QuizMintLogo size={20} />
          <span>Quiz<span className="text-[var(--c-brand)]">Mint</span></span>
        </div>
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-lg border border-[var(--c-border)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mb-6 border border-emerald-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-[28px] font-medium text-[var(--c-text)] mb-2 leading-tight">{heading}</h1>
          <p className="text-[14px] text-[var(--c-text-subtle)] mb-8">{subheading}</p>

          {mode === 'auth' && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl mb-6">
              {(['signin', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); resetMessages(); }}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${tab === t ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-500' : 'border border-transparent text-[var(--c-text-subtle)] hover:text-[var(--c-text)]'}`}
                >
                  {t === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="block text-[12px] font-semibold text-emerald-500 mb-2 tracking-wider uppercase">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl bg-[var(--c-surface)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 px-4 py-3 text-[14px] text-[var(--c-text)] outline-none transition-colors disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>
            {mode === 'auth' && (
              <div>
                <label htmlFor="password" className="block text-[12px] font-semibold text-emerald-500 mb-2 tracking-wider uppercase">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl bg-[var(--c-surface)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 px-4 py-3 text-[14px] text-[var(--c-text)] outline-none transition-colors disabled:opacity-50"
                  placeholder={tab === 'signup' ? PASSWORD_HELP : ''}
                />
                {tab === 'signup' && <PasswordStrength password={password} />}
              </div>
            )}

            {error && (
              <div className="p-3 bg-[rgba(239,68,68,0.05)] border border-red-500/20 rounded-xl text-red-500 text-[13px]">
                {error}
              </div>
            )}
            {notice && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-[13px]">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center px-6 py-3 text-[14px] font-medium rounded-xl text-[var(--c-text)] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  {mode === 'forgot' ? 'Sending...' : tab === 'signin' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                mode === 'forgot' ? 'Send reset link' : tab === 'signin' ? 'Sign in' : 'Create account'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            {mode === 'auth' && tab === 'signin' ? (
              <button
                type="button"
                onClick={() => { setMode('forgot'); resetMessages(); }}
                className="text-[13px] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors"
              >
                Forgot password?
              </button>
            ) : mode === 'forgot' ? (
              <button
                type="button"
                onClick={() => { setMode('auth'); resetMessages(); }}
                className="text-[13px] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors"
              >
                Back to sign in
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
