import { Check, X } from 'lucide-react';
import { getPasswordChecks } from '../lib/validation';

interface PasswordStrengthProps {
  password: string;
}

const STRENGTH_COLORS = [
  'bg-red-500',
  'bg-red-500',
  'bg-amber-500',
  'bg-amber-500',
  'bg-lime-500',
  'bg-emerald-500',
];

const STRENGTH_LABELS = ['Too weak', 'Too weak', 'Weak', 'Okay', 'Strong', 'Excellent'];

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const checks = getPasswordChecks(password);
  const score = checks.filter((c) => c.passed).length;
  const color = STRENGTH_COLORS[score];
  const label = STRENGTH_LABELS[score];
  const showMeter = password.length > 0;

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {checks.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full bg-[var(--c-border)] overflow-hidden"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${i < score ? color : 'bg-transparent'}`}
                style={{ width: i < score ? '100%' : '0%' }}
              />
            </div>
          ))}
        </div>
        <span
          className={`text-[11px] font-medium tracking-wider uppercase transition-opacity duration-200 ${showMeter ? 'opacity-100' : 'opacity-0'}`}
        >
          {label}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`flex items-center gap-1.5 text-[11px] transition-colors duration-200 ${c.passed ? 'text-emerald-500' : 'text-[var(--c-text-subtle)]'}`}
          >
            <span
              className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full transition-all duration-200 ${c.passed ? 'bg-emerald-500/15 scale-100' : 'bg-[var(--c-border)] scale-90'}`}
            >
              {c.passed ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <X className="w-2.5 h-2.5" strokeWidth={3} />}
            </span>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
