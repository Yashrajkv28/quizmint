import { useState, FormEvent } from 'react';
import { Sun, Moon, Loader2, Sparkles } from 'lucide-react';
import { QuizMintLogo } from './QuizMintLogo';
import { PasswordStrength } from './PasswordStrength';
import { useAuth } from '../lib/auth';
import { validatePassword, PASSWORD_HELP } from '../lib/validation';

type Theme = 'light' | 'dark';

interface ResetPasswordPageProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export function ResetPasswordPage({ theme, onToggleTheme }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updatePassword, clearPasswordRecovery, signOut } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const pwErr = validatePassword(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (password !== confirm) {
      setError('Passwords don\u2019t match.');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      clearPasswordRecovery();
      // The recovery session is already active, so the user lands in the app.
    } catch (err: any) {
      setError(err?.message || 'Could not update password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    // Dropping the recovery session — user goes back to landing.
    await signOut().catch(() => {});
    clearPasswordRecovery();
  };

  return (
    <div className="min-h-screen bg-[var(--c-app)] text-[var(--c-text)] font-sans flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-[var(--c-border)]">
        <div className="w-[72px]" />
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
          <h1 className="text-[28px] font-medium text-[var(--c-text)] mb-2 leading-tight">Pick a new password</h1>
          <p className="text-[14px] text-[var(--c-text-subtle)] mb-8">Choose something you don't use anywhere else. {PASSWORD_HELP}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-password" className="block text-[12px] font-semibold text-emerald-500 mb-2 tracking-wider uppercase">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl bg-[var(--c-surface)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 px-4 py-3 text-[14px] text-[var(--c-text)] outline-none transition-colors disabled:opacity-50"
              />
              <PasswordStrength password={password} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-[12px] font-semibold text-emerald-500 mb-2 tracking-wider uppercase">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl bg-[var(--c-surface)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 px-4 py-3 text-[14px] text-[var(--c-text)] outline-none transition-colors disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="p-3 bg-[rgba(239,68,68,0.05)] border border-red-500/20 rounded-xl text-red-500 text-[13px]">
                {error}
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
                  Updating...
                </>
              ) : (
                'Update password'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleCancel}
              className="text-[13px] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
