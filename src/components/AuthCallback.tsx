import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Status = 'working' | 'error';

type VerifyType = 'signup' | 'recovery' | 'email_change' | 'email' | 'invite' | 'magiclink';

const VALID_TYPES: VerifyType[] = ['signup', 'recovery', 'email_change', 'email', 'invite', 'magiclink'];

function isValidType(t: string | null): t is VerifyType {
  return !!t && (VALID_TYPES as string[]).includes(t);
}

export function AuthCallback() {
  const [status, setStatus] = useState<Status>('working');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get('token_hash');
    const type = params.get('type');

    if (!token_hash || !isValidType(type)) {
      setErrorMsg('This link is missing or malformed. Request a new email and try again.');
      setStatus('error');
      return;
    }

    // verifyOtp establishes the session (or fires PASSWORD_RECOVERY for recovery links).
    // The AuthProvider listener in src/lib/auth.tsx handles post-verify routing.
    supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) {
        setErrorMsg(error.message || 'Verification failed. The link may have expired.');
        setStatus('error');
        return;
      }
      // Clean the URL so a refresh doesn't re-run verifyOtp with a now-consumed token.
      window.history.replaceState(null, '', '/');
    });
  }, []);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--c-app)] text-[var(--c-text)] p-6">
        <div className="max-w-md w-full border border-[var(--c-border)] bg-[var(--c-surface)] rounded-2xl p-6 text-center">
          <h1 className="text-[18px] font-semibold mb-2">Link didn’t work</h1>
          <p className="text-[14px] text-[var(--c-text-subtle)] mb-5">{errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              window.location.replace('/');
            }}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[var(--c-brand)] text-white text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--c-app)] text-[var(--c-text-subtle)] text-[14px]">
      Verifying your email…
    </div>
  );
}
