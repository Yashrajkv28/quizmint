import React, { useEffect, useState, useRef } from 'react';

interface FlipDigitProps {
  value: string;
  label?: string;
  color?: string;
}

const FlipDigit: React.FC<FlipDigitProps> = ({ value, label, color = '' }) => {
  const prevValueRef = useRef<string>(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  const currentValue = value;
  const previousValue = prevValueRef.current;
  const isValueMismatch = value !== prevValueRef.current;

  useEffect(() => {
    if (value !== prevValueRef.current) {
      setIsFlipping(true);
      setFlipKey((k) => k + 1);
      const timer = setTimeout(() => {
        prevValueRef.current = value;
        setIsFlipping(false);
      }, 600);
      return () => {
        clearTimeout(timer);
        prevValueRef.current = value;
      };
    }
  }, [value]);

  const cardBg = 'bg-[var(--c-surface)] border border-[var(--c-border)]';
  const textStyle =
    'font-mono text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold leading-none select-none text-[var(--c-text)]';
  const colorStyle = color ? { color } : undefined;

  const upperStaticValue = isValueMismatch && !isFlipping ? previousValue : currentValue;

  return (
    <div className="flex flex-col items-center mx-0.5 sm:mx-1.5 md:mx-2">
      <div
        className="relative w-12 h-[4.5rem] sm:w-20 sm:h-28 md:w-24 md:h-36 lg:w-32 lg:h-44 rounded-lg sm:rounded-xl shadow-sm"
        style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
      >
        <div
          className={`upper-card ${cardBg} flex justify-center items-end rounded-t-xl overflow-hidden`}
          style={{ zIndex: 1 }}
        >
          <span className={`${textStyle} translate-y-1/2`} style={colorStyle}>
            {upperStaticValue}
          </span>
        </div>

        <div
          className={`lower-card ${cardBg} flex justify-center items-start rounded-b-xl overflow-hidden`}
          style={{ zIndex: 1 }}
        >
          <span className={`${textStyle} -translate-y-1/2`} style={colorStyle}>
            {previousValue}
          </span>
        </div>

        {isFlipping && (
          <React.Fragment key={flipKey}>
            <div
              className={`upper-card ${cardBg} flex justify-center items-end rounded-t-xl overflow-hidden animate-flip-top-down`}
              style={{ zIndex: 10, transformOrigin: 'bottom center', backfaceVisibility: 'hidden' }}
            >
              <span className={`${textStyle} translate-y-1/2`} style={colorStyle}>
                {previousValue}
              </span>
            </div>

            <div
              className={`lower-card ${cardBg} flex justify-center items-start rounded-b-xl overflow-hidden animate-flip-bottom-up`}
              style={{
                zIndex: 10,
                transformOrigin: 'top center',
                backfaceVisibility: 'hidden',
                transform: 'rotateX(90deg)',
              }}
            >
              <span className={`${textStyle} -translate-y-1/2`} style={colorStyle}>
                {currentValue}
              </span>
            </div>
          </React.Fragment>
        )}

        <div
          className="absolute top-1/2 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent transform -translate-y-1/2"
          style={{ zIndex: 20 }}
        />
      </div>

      {label && (
        <span className="mt-2 sm:mt-4 text-[8px] sm:text-[10px] font-semibold text-[var(--c-text-faint)] uppercase tracking-[0.15em] select-none">
          {label}
        </span>
      )}
    </div>
  );
};

export default React.memo(FlipDigit);
