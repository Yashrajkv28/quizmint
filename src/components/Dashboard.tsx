import { useState, ReactNode } from 'react';
import {
  Sun, Moon, LogOut, Sparkles, KeyRound, Mail, Trash2,
  ArrowRight, FileText, Clock, ShieldCheck, Timer, Music,
} from 'lucide-react';
import { QuizMintLogo } from './QuizMintLogo';
import { AccountModal } from './AccountModal';
import { useAuth } from '../lib/auth';
import { useSpotifyEnabled } from '../lib/spotify';

type Theme = 'light' | 'dark';

interface DashboardProps {
  theme: Theme;
  onToggleTheme: () => void;
  onStartGenerate: () => void;
  onStartTimer: () => void;
  onLogoHome: () => void;
}

export function Dashboard({ theme, onToggleTheme, onStartGenerate, onStartTimer, onLogoHome }: DashboardProps) {
  const { user, signOut, sendPasswordReset, deleteAccount } = useAuth();
  const [spotifyEnabled, setSpotifyEnabled] = useSpotifyEnabled();
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
          onClick={onLogoHome}
          aria-label="Home"
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

      <main className="flex-1 w-full max-w-[1100px] mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-[11px] font-semibold text-emerald-500 tracking-[0.2em] uppercase mb-2">Signed in</p>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-[var(--c-text)] break-all">
            {user?.email}
          </h1>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main column — tool cards stack here */}
          <div className="col-span-12 md:col-span-8 flex flex-col gap-4">
            <button
              type="button"
              onClick={onStartGenerate}
              className="relative overflow-hidden w-full text-left p-8 bg-gradient-to-br from-emerald-500/[0.08] to-transparent border border-emerald-500/30 rounded-2xl group hover:border-emerald-500/60 transition-colors"
            >
              <span className="shimmer-hover" />
              <div className="relative flex items-start gap-5">
                <div className="w-14 h-14 rounded-xl bg-emerald-500/15 border border-emerald-500/40 grid place-items-center shrink-0">
                  <Sparkles className="w-6 h-6 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-emerald-500 tracking-[0.2em] uppercase mb-2">Create</p>
                  <p className="text-[20px] font-semibold text-[var(--c-text)] leading-snug">Generate a new quiz</p>
                  <p className="text-[14px] text-[var(--c-text-subtle)] mt-2 max-w-md">
                    Paste study notes or drop a document and QuizMint builds an interactive MCQ quiz in seconds.
                  </p>
                  <span className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-medium text-emerald-500 group-hover:gap-2.5 transition-all">
                    Start generating
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </span>
                </div>
              </div>
            </button>

            <div className="grid grid-cols-3 gap-3">
              <InfoChip icon={<FileText className="w-3 h-3" />} label="Sources" value="PDF, text, links" />
              <InfoChip icon={<Clock className="w-3 h-3" />} label="Speed" value="~8s per quiz" />
              <InfoChip icon={<ShieldCheck className="w-3 h-3" />} label="Privacy" value="Wiped daily" />
            </div>

            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--c-text-faint)] mb-3">Tools</p>
              <button
                type="button"
                onClick={onStartTimer}
                className="relative overflow-hidden w-full text-left p-5 bg-gradient-to-br from-emerald-500/[0.08] to-transparent border border-emerald-500/30 rounded-2xl hover:border-emerald-500/60 transition-colors group"
              >
                <span className="shimmer-hover" />
                <div className="relative flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 grid place-items-center shrink-0 text-emerald-500 transition-colors">
                    <Timer className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--c-text)]">Flip timer</p>
                    <p className="text-[12px] text-[var(--c-text-subtle)] mt-1">
                      Live clock, countdown, count up, hybrid. Useful for timed study.
                    </p>
                    <span className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-medium text-[var(--c-text-subtle)] group-hover:text-emerald-500 group-hover:gap-2 transition-all">
                      Open timer
                      <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Account sidebar */}
          <aside className="col-span-12 md:col-span-4">
            <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5 md:sticky md:top-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--c-text-faint)] mb-4">Account</p>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 p-2.5 rounded-lg">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 grid place-items-center text-emerald-500 shrink-0">
                    <Music className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-medium text-[var(--c-text)] truncate">Spotify player</p>
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold tracking-[0.15em] uppercase text-amber-600 [.light_&]:text-amber-700 shrink-0">
                        Beta
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--c-text-subtle)] truncate">Music on the flip timer</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={spotifyEnabled}
                    aria-label="Toggle Spotify mini player"
                    onClick={() => setSpotifyEnabled(!spotifyEnabled)}
                    className={`relative shrink-0 w-10 h-5.5 rounded-full border transition-colors ${
                      spotifyEnabled
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-[var(--c-app)] border-[var(--c-border)]'
                    }`}
                    style={{ width: '40px', height: '22px' }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-[16px] h-[16px] rounded-full bg-white shadow transition-transform ${
                        spotifyEnabled ? 'translate-x-[18px]' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <AccountRow
                  icon={<Mail className="w-3.5 h-3.5" />}
                  title="Change email"
                  subtitle="Confirm via link"
                  onClick={() => setAccountOpen(true)}
                />
                <AccountRow
                  icon={<KeyRound className="w-3.5 h-3.5" />}
                  title={resetBusy ? 'Sending reset link…' : 'Reset password'}
                  subtitle={resetStatus ?? 'Email yourself a link'}
                  onClick={handlePasswordReset}
                  disabled={resetBusy}
                />
                <AccountRow
                  icon={<LogOut className="w-3.5 h-3.5" />}
                  title="Sign out"
                  subtitle="End this session"
                  onClick={() => signOut()}
                />
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--c-border)]">
                {confirmDelete ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/30 grid place-items-center text-red-500 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-red-500">Confirm deletion</p>
                        <p className="text-[11px] text-red-500/70">Permanent — cannot undo</p>
                      </div>
                    </div>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      disabled={deleteBusy}
                      placeholder="Enter your password"
                      className="w-full rounded-lg bg-[var(--c-app)] border border-[var(--c-border)] focus:border-red-500 focus:ring-1 focus:ring-red-500 px-3 py-2 text-[13px] text-[var(--c-text)] outline-none transition-colors disabled:opacity-50"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(); }}
                      autoFocus
                    />
                    {deleteError && <p className="text-[12px] text-red-500">{deleteError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteBusy || !deletePassword}
                        className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-red-500/10 border border-red-500/40 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleteBusy ? 'Deleting…' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelDelete}
                        disabled={deleteBusy}
                        className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg border border-[var(--c-border)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-red-500/5 transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 grid place-items-center text-red-500 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-red-500">Delete account</p>
                      <p className="text-[11px] text-red-500/60 truncate">Permanent · cannot undo</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}

interface InfoChipProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function InfoChip({ icon, label, value }: InfoChipProps) {
  return (
    <div className="p-3.5 bg-[var(--c-surface)] border border-emerald-500/25 rounded-xl">
      <div className="flex items-center gap-2 mb-1 text-[var(--c-text-faint)]">
        {icon}
        <p className="text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-[13px] text-[var(--c-text-muted)]">{value}</p>
    </div>
  );
}

interface AccountRowProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}

function AccountRow({ icon, title, subtitle, onClick, disabled }: AccountRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--c-hover)] transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="w-8 h-8 rounded-lg bg-[var(--c-app)] border border-[var(--c-border)] grid place-items-center text-[var(--c-text-subtle)] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--c-text)]">{title}</p>
        <p className="text-[11px] text-[var(--c-text-faint)] truncate">{subtitle}</p>
      </div>
    </button>
  );
}
