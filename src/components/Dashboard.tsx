import { useState, ReactNode } from 'react';
import { Sun, Moon, LogOut, Sparkles, KeyRound, Mail, Trash2, ChevronRight } from 'lucide-react';
import { QuizMintLogo } from './QuizMintLogo';
import { AccountModal } from './AccountModal';
import { useAuth } from '../lib/auth';

type Theme = 'light' | 'dark';

interface DashboardProps {
  theme: Theme;
  onToggleTheme: () => void;
  onStartGenerate: () => void;
  onBackToLanding: () => void;
}

export function Dashboard({ theme, onToggleTheme, onStartGenerate, onBackToLanding }: DashboardProps) {
  const { user, signOut, sendPasswordReset, deleteAccount } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetBusy(true);
    setResetStatus(null);
    try {
      await sendPasswordReset(user.email);
      setResetStatus('Reset link sent — check your email.');
    } catch (err: any) {
      setResetStatus(err?.message || 'Could not send reset link.');
    } finally {
      setResetBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm.');
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount(deletePassword);
      // signOut inside deleteAccount will bounce us back to landing via App's effect.
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete account.');
      setDeleteBusy(false);
    }
  };

  const cancelDelete = () => {
    setConfirmDelete(false);
    setDeletePassword('');
    setDeleteError(null);
  };

  return (
    <div className="min-h-screen bg-[var(--c-app)] text-[var(--c-text)] font-sans flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-[var(--c-border)]">
        <button
          type="button"
          onClick={onBackToLanding}
          aria-label="Back to landing"
          className="flex items-center gap-2.5 text-[16px] font-bold tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
        >
          <QuizMintLogo size={20} />
          <span>Quiz<span className="text-[var(--c-brand)]">Mint</span></span>
        </button>
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-lg border border-[var(--c-border)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-12">
        <div className="w-full max-w-[720px] flex flex-col gap-8">
          <div>
            <p className="text-[12px] font-semibold text-emerald-500 tracking-wider uppercase mb-2">Welcome back</p>
            <h1 className="text-[28px] font-medium leading-tight text-[var(--c-text)]">{user?.email}</h1>
          </div>

          <section>
            <h2 className="text-[11px] uppercase text-[var(--c-text-subtle)] tracking-wider mb-3">Create</h2>
            <button
              type="button"
              onClick={onStartGenerate}
              className="w-full text-left p-6 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[16px] font-semibold text-[var(--c-text)]">Generate a quiz</p>
                    <ChevronRight className="w-5 h-5 text-[var(--c-text-subtle)] group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <p className="text-[13px] text-[var(--c-text-subtle)] mt-1">
                    Paste text or drop a document — get an interactive MCQ quiz in seconds.
                  </p>
                </div>
              </div>
            </button>
          </section>

          <section>
            <h2 className="text-[11px] uppercase text-[var(--c-text-subtle)] tracking-wider mb-3">Profile</h2>
            <div className="flex flex-col gap-2">
              <ProfileRow
                icon={<Mail className="w-4 h-4" />}
                title="Change email"
                subtitle="Send a confirmation link to your new address"
                onClick={() => setAccountOpen(true)}
              />
              <ProfileRow
                icon={<KeyRound className="w-4 h-4" />}
                title={resetBusy ? 'Sending reset link…' : 'Reset password'}
                subtitle={resetStatus ?? 'Email yourself a password-reset link'}
                onClick={handlePasswordReset}
                disabled={resetBusy}
              />
              <ProfileRow
                icon={<LogOut className="w-4 h-4" />}
                title="Sign out"
                subtitle="End this session"
                onClick={() => signOut()}
              />
              <div className="mt-4 p-4 border border-red-500/30 rounded-xl bg-red-500/[0.03]">
                <div className="flex items-start gap-3">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-[var(--c-text)]">Delete account</p>
                    <p className="text-[12px] text-[var(--c-text-subtle)] mt-0.5">
                      Permanently removes your account and any uploaded documents. This can't be undone.
                    </p>
                    {confirmDelete ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <input
                          type="password"
                          autoComplete="current-password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          disabled={deleteBusy}
                          placeholder="Enter your password to confirm"
                          className="w-full rounded-lg bg-[var(--c-app)] border border-[var(--c-border)] focus:border-red-500 focus:ring-1 focus:ring-red-500 px-3 py-2 text-[13px] text-[var(--c-text)] outline-none transition-colors disabled:opacity-50"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(); }}
                          autoFocus
                        />
                        {deleteError && (
                          <p className="text-[12px] text-red-500">{deleteError}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleteBusy || !deletePassword}
                            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-red-500/10 border border-red-500/40 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deleteBusy ? 'Deleting…' : 'Confirm delete'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelDelete}
                            disabled={deleteBusy}
                            className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-[var(--c-border)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {deleteError && (
                          <p className="text-[12px] text-red-500 mt-2">{deleteError}</p>
                        )}
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            Delete account
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}

interface ProfileRowProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}

function ProfileRow({ icon, title, subtitle, onClick, disabled }: ProfileRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 p-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl hover:border-emerald-500/40 hover:bg-[var(--c-hover)] transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--c-app)] border border-[var(--c-border)] text-[var(--c-text-subtle)] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--c-text)]">{title}</p>
        <p className="text-[12px] text-[var(--c-text-subtle)] truncate">{subtitle}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-[var(--c-text-subtle)] shrink-0" />
    </button>
  );
}
