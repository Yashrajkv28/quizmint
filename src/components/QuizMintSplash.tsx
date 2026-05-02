import { useEffect, useState } from 'react';
import './QuizMintSplash.css';

interface Props {
  minDurationMs?: number;
  theme?: 'light' | 'dark';
  onDone?: () => void;
}

function detectTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
}

export function QuizMintSplash({ minDurationMs = 2800, theme, onDone }: Props) {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing');
  const resolvedTheme = theme ?? detectTheme();

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('fading'), minDurationMs);
    const t2 = setTimeout(() => { setPhase('done'); onDone?.(); }, minDurationMs + 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [minDurationMs, onDone]);

  if (phase === 'done') return null;

  return (
    <div className={`qm-splash play ${resolvedTheme} ${phase === 'fading' ? 'fade-out' : ''}`} aria-hidden="true">
      <div className="qm-ambient" />
      <div className="qm-logo">
        <svg viewBox="0 0 100 100" width={140} height={140} style={{ overflow: 'visible' }} aria-label="QuizMint">
          <path className="qm-leaf-r" d="M50 10 C 74 10, 88 28, 88 48 C 88 63, 76 74, 60 74 L 50 74 Z" fill="#10B981" />
          <path className="qm-leaf-l" d="M50 10 C 26 10, 12 28, 12 48 C 12 63, 24 74, 40 74 L 50 74 Z" fill="#059669" />
          <path className="qm-vein" d="M50 14 L 50 64 C 50 74, 60 76, 60 84"
                fill="none" stroke="currentColor" strokeWidth={5.5} strokeLinecap="round" opacity={0.9} />
          <circle className="qm-dot" cx={60} cy={92} r={3.4} fill="currentColor" />
        </svg>
        <div className="qm-word">Quiz<span style={{ color: '#10B981' }}>Mint</span></div>
        <div className="qm-loader"><div className="qm-loader-bar" /></div>
      </div>
    </div>
  );
}
