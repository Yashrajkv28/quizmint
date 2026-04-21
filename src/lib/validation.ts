// Client-side input validation. Also enforced at the Supabase side via auth settings —
// the client checks give instant feedback; the server is the actual source of truth.

const ALLOWED_EMAIL_DOMAINS = ['gmail.com'];

export function validateEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email) return 'Email is required.';
  // Minimal shape check; full RFC validation isn't useful here.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  const domain = email.split('@')[1];
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return 'Only Gmail addresses are supported right now.';
  }
  return null;
}

// Strong-password policy:
// - 8+ characters
// - at least one lowercase letter
// - at least one uppercase letter
// - at least one digit
// - at least one symbol
// Returns the first problem encountered so the UI can surface a specific message.
export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(password)) return 'Password needs a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password needs an uppercase letter.';
  if (!/\d/.test(password)) return 'Password needs a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password needs a symbol (e.g. !, @, #).';
  return null;
}

export const PASSWORD_HELP =
  '8+ characters with an uppercase, lowercase, number, and symbol.';

// Per-rule breakdown so the UI can show a live strength meter. Order matches
// the order validatePassword reports errors in, so the first unmet rule is
// also what the submit-time error message will complain about.
export interface PasswordCheck {
  label: string;
  passed: boolean;
}

export function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { label: '8+ characters', passed: password.length >= 8 },
    { label: 'lowercase letter', passed: /[a-z]/.test(password) },
    { label: 'uppercase letter', passed: /[A-Z]/.test(password) },
    { label: 'number', passed: /\d/.test(password) },
    { label: 'symbol', passed: /[^A-Za-z0-9]/.test(password) },
  ];
}
