import { useState, FormEvent, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { PasswordStrength } from './PasswordStrength';
import { validateEmail, validatePassword, PASSWORD_HELP } from '../lib/validation';

interface AccountModalProps {
  onClose: () => void;
}

type Status = { kind: 'ok' | 'err'; message: string } | null;

export function AccountModal({ onClose }: AccountModalProps) {
  const { user, updateEmail, updatePassword } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState<Status>(null);
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailStatus(null);
    const emailErr = validateEmail(newEmail);
    if (emailErr) {
      setEmailStatus({ kind: 'err', message: emailErr });
      return;
    }
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setEmailStatus({ kind: 'err', message: 'That\u2019s already your email.' });
      return;
    }
    setEmailBusy(true);
    try {
      await updateEmail(newEmail.trim());
      setEmailStatus({ kind: 'ok', message: 'Check your new email to confirm the change.' });
      setNewEmail('');
    } catch (err: any) {
      setEmailStatus({ kind: 'err', message: err?.message || 'Could not update email.' });
    } finally {
      setEmailBusy(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    const pwErr = validatePassword(newPassword);
    if (pwErr) {
      setPasswordStatus({ kind: 'err', message: pwErr });
      return;
    }
    setPasswordBusy(true);
    try {
      await updatePassword(newPassword);
      setPasswordStatus({ kind: 'ok', message: 'Password updated.' });
      setNewPassword('');
    } catch (err: any) {
      setPasswordStatus({ kind: 'err', message: err?.message || 'Could not update password.' });
    } finally {
      setPasswordBusy(false);
    }
  };

  const statusClass = (s: Status) => s?.kind === 'ok'
    ? 'p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-[13px]'
    : 'p-3 bg-[rgba(239,68,68,0.05)] border border-red-500/20 rounded-xl text-red-500 text-[13px]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-[480px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-border)]">
          <h2 className="text-[16px] font-semibold text-[var(--c-text)]">Account</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-[var(--c-text-subtle)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div>
            <p className="text-[11px] uppercase text-[var(--c-text-subtle)] tracking-wider mb-1">Signed in as</p>
            <p className="text-[14px] text-[var(--c-text)] font-medium break-all">{user?.email ?? '—'}</p>
          </div>

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <label htmlFor="new-email" className="block text-[12px] font-semibold text-emerald-500 tracking-wider uppercase">
              Change email
            </label>
            <input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={emailBusy}
              placeholder="new@example.com"
              className="w-full rounded-xl bg-[var(--c-app)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 px-4 py-3 text-[14px] text-[var(--c-text)] outline-none transition-colors disabled:opacity-50"
            />
            {emailStatus && <div className={statusClass(emailStatus)}>{emailStatus.message}</div>}
            <button
              type="submit"
              disabled={emailBusy}
              className="self-start inline-flex items-center px-5 py-2.5 text-[13px] font-medium rounded-xl text-[var(--c-text)] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {emailBusy ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Sending...
                </>
              ) : (
                'Send confirmation'
              )}
            </button>
          </form>

          <div className="border-t border-[var(--c-border)]" />

          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <label htmlFor="new-pw" className="block text-[12px] font-semibold text-emerald-500 tracking-wider uppercase">
              Change password
            </label>
            <input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordBusy}
              placeholder={PASSWORD_HELP}
              className="w-full rounded-xl bg-[var(--c-app)] border border-[var(--c-border)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 px-4 py-3 text-[14px] text-[var(--c-text)] outline-none transition-colors disabled:opacity-50"
            />
            <PasswordStrength password={newPassword} />
            {passwordStatus && <div className={statusClass(passwordStatus)}>{passwordStatus.message}</div>}
            <button
              type="submit"
              disabled={passwordBusy}
              className="self-start inline-flex items-center px-5 py-2.5 text-[13px] font-medium rounded-xl text-[var(--c-text)] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {passwordBusy ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Updating...
                </>
              ) : (
                'Update password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
