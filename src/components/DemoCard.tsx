import { useEffect, useState } from 'react';

type Stage = 0 | 1 | 2;

const btnPrimary: React.CSSProperties = {
  background: '#10B981',
  color: '#052E24',
  border: 'none',
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: -0.1,
};

const dot = (c: string): React.CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: 99,
  background: c,
  display: 'inline-block',
});

// Each quiz question: prompt, four options, and the index of the correct one.
const QUIZ_QUESTIONS = [
  {
    prompt: 'Which organ is primarily responsible for regulating blood sugar levels?',
    options: ['Liver', 'Pancreas', 'Kidney', 'Spleen'],
    correct: 1,
    why: 'The pancreas secretes insulin and glucagon, the two hormones that raise and lower glucose in the bloodstream.',
    meta: 'MEDIUM · 00:47',
    numLabel: 'QUESTION 1 OF 24',
  },
  {
    prompt: "The mitochondrion's inner membrane is folded into structures called what?",
    options: ['Cristae', 'Thylakoids', 'Stroma', 'Matrix'],
    correct: 0,
    why: 'The cristae increase the inner-membrane surface area, giving the electron transport chain more room to run.',
    meta: 'MEDIUM · 00:52',
    numLabel: 'QUESTION 2 OF 24',
  },
] as const;

export function DemoCard() {
  const [stage, setStage] = useState<Stage>(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  // Top-level stage timeline. Stage 2 is self-managed so it can walk through both questions.
  useEffect(() => {
    if (stage === 2) return;
    const loop = setTimeout(
      () => {
        if (stage === 0) setStage(1);
        else setStage(2);
      },
      stage === 1 ? 5200 : 4800,
    );
    return () => clearTimeout(loop);
  }, [stage]);

  // Slower progress fill during the "AI engine working" phase — reads more deliberate.
  useEffect(() => {
    if (stage !== 1) return;
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + 4);
      setProgress(p);
    }, 200);
    return () => clearInterval(iv);
  }, [stage]);

  // Stage 2 orchestration: for each question, pause briefly, auto-select the correct answer,
  // hold the explanation, then either advance to the next question or loop back to stage 0.
  useEffect(() => {
    if (stage !== 2) return;
    setSelected(null);
    const q = QUIZ_QUESTIONS[questionIdx];
    const pick = setTimeout(() => setSelected(q.correct), 1600);
    const next = setTimeout(() => {
      if (questionIdx < QUIZ_QUESTIONS.length - 1) {
        setQuestionIdx((i) => i + 1);
      } else {
        setStage(0);
        setQuestionIdx(0);
        setSelected(null);
        setProgress(0);
      }
    }, 4400);
    return () => {
      clearTimeout(pick);
      clearTimeout(next);
    };
  }, [stage, questionIdx]);

  return (
    <div
      aria-hidden="true"
      style={{
        background: '#15161A',
        border: '1px solid #2D2E35',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow:
          '0 40px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.08)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid #2D2E35',
          background: '#101115',
        }}
      >
        <span style={dot('#FF5F57')} />
        <span style={dot('#FEBC2E')} />
        <span style={dot('#28C840')} />
        <div
          style={{
            marginLeft: 12,
            fontSize: 12,
            color: '#64748B',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          }}
        >
          quizmint.me/generate
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#10B981',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 99, background: '#10B981' }} /> Live
        </div>
      </div>

      {stage === 0 && (
        <div style={{ padding: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.4,
              color: '#10B981',
              marginBottom: 10,
            }}
          >
            RAW DATA INPUT
          </div>
          <div
            style={{
              background: '#0A0A0C',
              border: '1px solid #2D2E35',
              borderRadius: 12,
              padding: 16,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 12.5,
              lineHeight: 1.7,
              color: '#CBD5E1',
              minHeight: 220,
            }}
          >
            <div>1. Which structure regulates blood sugar?</div>
            <div style={{ paddingLeft: 14 }}>A) Liver</div>
            <div style={{ paddingLeft: 14 }}>B) Pancreas</div>
            <div style={{ paddingLeft: 14 }}>C) Kidney</div>
            <div style={{ paddingLeft: 14 }}>D) Spleen</div>
            <div style={{ marginTop: 8 }}>2. The mitochondrion's inner membrane is folded into...</div>
            <div style={{ paddingLeft: 14 }}>A) Cristae</div>
            <div style={{ paddingLeft: 14 }}>B) Thylakoids</div>
            <div style={{ paddingLeft: 14 }}>C) Stroma</div>
            <div style={{ paddingLeft: 14 }}>D) Matrix</div>
            <div style={{ marginTop: 10, color: '#64748B' }}>Answer Key:</div>
            <div style={{ color: '#64748B' }}>
              1. B &nbsp; 2. A
              <span
                style={{
                  background: '#10B981',
                  width: 7,
                  height: 14,
                  display: 'inline-block',
                  marginLeft: 3,
                  verticalAlign: 'middle',
                  animation: 'qmDemoBlink 1s steps(2) infinite',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 12, color: '#64748B' }}>2 questions detected · Biology</div>
            <button style={btnPrimary} type="button">
              ✨ Generate module
            </button>
          </div>
        </div>
      )}

      {stage === 1 && (
        <div style={{ padding: 24, minHeight: 320, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.4,
              color: '#10B981',
              marginBottom: 14,
            }}
          >
            AI ENGINE WORKING
          </div>
          {(
            [
              ['Parsing document structure', progress > 10],
              ['Identifying 24 questions', progress > 35],
              ['Grading difficulty (Medium)', progress > 60],
              ['Writing explanations', progress > 85],
            ] as Array<[string, boolean]>
          ).map(([t, done], i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                color: done ? '#fff' : '#64748B',
                fontSize: 14,
                transition: 'color .3s',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 99,
                  border: '1.5px solid ' + (done ? '#10B981' : '#2D2E35'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: done ? '#10B981' : 'transparent',
                }}
              >
                {done && <span style={{ color: '#0A0A0C', fontSize: 11, fontWeight: 800 }}>✓</span>}
              </span>
              <span>{t}</span>
            </div>
          ))}
          <div
            style={{
              marginTop: 18,
              height: 4,
              background: '#0A0A0C',
              borderRadius: 99,
              overflow: 'hidden',
              border: '1px solid #2D2E35',
            }}
          >
            <div style={{ height: '100%', width: progress + '%', background: '#10B981', transition: 'width .25s' }} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              color: '#64748B',
            }}
          >
            <span>Analyzing dataset</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {stage === 2 && (() => {
        const q = QUIZ_QUESTIONS[questionIdx];
        return (
          <div style={{ padding: 24, pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.4, color: '#10B981' }}>{q.numLabel}</div>
              <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                {q.meta}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.35, marginBottom: 16, color: '#fff' }}>
              {q.prompt}
            </div>
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correct;
              const picked = selected === i;
              const bg = picked ? 'rgba(16,185,129,0.15)' : '#0A0A0C';
              const br = picked ? '#10B981' : '#2D2E35';
              return (
                <div
                  key={i}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    margin: '6px 0',
                    background: bg,
                    border: '1px solid ' + br,
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'background .35s ease, border-color .35s ease',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: '1px solid ' + br,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                      color: '#94A3B8',
                      transition: 'border-color .35s ease',
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                  {picked && isCorrect && (
                    <span style={{ marginLeft: 'auto', color: '#10B981', fontSize: 12, fontWeight: 600 }}>
                      ✓ Correct
                    </span>
                  )}
                </div>
              );
            })}
            {selected === q.correct && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: 10,
                  fontSize: 13,
                  color: '#A7F3D0',
                  lineHeight: 1.55,
                }}
              >
                <b style={{ color: '#10B981' }}>Why:</b> {q.why}
              </div>
            )}
          </div>
        );
      })()}
      <style>{`@keyframes qmDemoBlink { 50% { opacity: 0 } }`}</style>
    </div>
  );
}
