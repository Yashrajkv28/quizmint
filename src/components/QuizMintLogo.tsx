type Variant = 'default' | 'mono-ink' | 'mono-white';

interface Props {
  size?: number;
  variant?: Variant;
  className?: string;
  title?: string;
}

export function QuizMintLogo({
  size = 32,
  variant = 'default',
  className,
  title = 'QuizMint',
}: Props) {
  const leafA = variant === 'default' ? '#10B981'
              : variant === 'mono-white' ? '#FFFFFF'
              : '#0A0A0C';
  const leafB = variant === 'default' ? '#059669' : leafA;
  const vein  = variant === 'mono-ink' ? '#FFFFFF'
              : variant === 'mono-white' ? '#0A0A0C'
              : '#FFFFFF';
  const dot   = variant === 'default' ? '#059669' : leafA;
  const veinOpacity = variant === 'default' ? 0.92 : 1;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <path d="M50 10 C 74 10, 88 28, 88 48 C 88 63, 76 74, 60 74 L 50 74 Z" fill={leafA} />
      <path d="M50 10 C 26 10, 12 28, 12 48 C 12 63, 24 74, 40 74 L 50 74 Z" fill={leafB} />
      <path
        d="M50 14 L 50 64 C 50 74, 60 76, 60 84"
        fill="none"
        stroke={vein}
        strokeWidth={5.5}
        strokeLinecap="round"
        opacity={veinOpacity}
      />
      <circle cx={60} cy={92} r={3.4} fill={dot} />
    </svg>
  );
}
