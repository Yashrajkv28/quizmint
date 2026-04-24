import { Sun, Moon } from 'lucide-react';
import { QuizMintLogo } from './QuizMintLogo';
import { DemoCard } from './DemoCard';

type Theme = 'light' | 'dark';

interface LandingPageProps {
  theme: Theme;
  onToggleTheme: () => void;
  onStart: () => void;
}

const serif = "'Fraunces', ui-serif, Georgia, serif";

export function LandingPage({ theme, onToggleTheme, onStart }: LandingPageProps) {
  return (
    <div
      style={{
        background: 'var(--c-app)',
        color: 'var(--c-text)',
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
      }}
    >
      <LandingNav theme={theme} onToggleTheme={onToggleTheme} onStart={onStart} />
      <LandingHero onStart={onStart} />
      <LandingMarquee />
      <LandingDemo />
      <LandingFeatures />
      <LandingCTA onStart={onStart} />
      <LandingFooter />
      <LandingStyles />
    </div>
  );
}

function LandingNav({ theme, onToggleTheme, onStart }: LandingPageProps) {
  return (
    <header
      className="landing-nav"
      style={{
        padding: '24px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--c-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: -0.2,
        }}
      >
        <QuizMintLogo size={22} />
        <span>
          Quiz<span style={{ color: 'var(--c-brand)' }}>Mint</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          style={{
            background: 'transparent',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text-subtle)',
            padding: 8,
            borderRadius: 10,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={onStart}
          style={{
            background: 'var(--c-text)',
            color: 'var(--c-app)',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 99,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Make a quiz →
        </button>
      </div>
    </header>
  );
}

function LandingHero({ onStart }: { onStart: () => void }) {
  return (
    <section
      className="landing-hero"
      style={{
        position: 'relative',
        padding: '80px 40px 120px',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: 2.4,
            color: 'var(--c-brand)',
            fontWeight: 700,
            marginBottom: 24,
          }}
        >
          ✦ &nbsp;THE STUDY TOOL YOUR NOTES DESERVE
        </div>
        <h1
          className="landing-headline"
          style={{
            fontFamily: serif,
            fontWeight: 600,
            fontSize: 'clamp(48px, 9vw, 124px)',
            lineHeight: 0.9,
            letterSpacing: -4.5,
            margin: 0,
            maxWidth: 1100,
          }}
        >
          Any document,
          <br />
          <em
            style={{
              color: 'var(--c-brand)',
              fontStyle: 'italic',
              fontWeight: 600,
            }}
          >
            instantly
          </em>{' '}
          studyable.
        </h1>
        <p
          style={{
            fontSize: 20,
            color: 'var(--c-text-subtle)',
            lineHeight: 1.5,
            maxWidth: 560,
            marginTop: 32,
          }}
        >
          QuizMint reads your PDFs, pastes, and lecture docs and turns them into real
          quizzes — with difficulty labels and a one-line explanation for every answer.
          In seconds.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 40, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onStart}
            style={{
              background: 'var(--c-text)',
              color: 'var(--c-app)',
              border: 'none',
              padding: '16px 26px',
              borderRadius: 99,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try it free →
          </button>
          <div style={{ fontSize: 13, color: 'var(--c-text-faint)' }}>
            No account. No sign-in. Just paste and go.
          </div>
        </div>
      </div>

      <FloatingCards />
    </section>
  );
}

function FloatingCards() {
  const cards = [
    { t: 'Biology · Ch 7', q: 'Which organ regulates blood sugar?', color: '#10B981', rotate: -6, top: 90, right: 520, z: 3 },
    { t: 'US History', q: 'What year did the Treaty of Versailles conclude?', color: '#F59E0B', rotate: 4, top: 60, right: 240, z: 2 },
    { t: 'Organic Chem', q: 'The SN1 reaction proceeds through a...', color: '#6366F1', rotate: -2, top: 320, right: 120, z: 4 },
    { t: 'Intro to Econ', q: 'Price elasticity of demand measures...', color: '#EC4899', rotate: 8, top: 380, right: 420, z: 1 },
  ];
  return (
    <div className="landing-floating" style={{ position: 'absolute', top: 40, right: 0, width: 720, height: 620, pointerEvents: 'none' }}>
      {cards.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: c.top,
            right: c.right,
            width: 260,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 20px 40px -12px rgba(10,10,12,0.18), 0 4px 8px -2px rgba(10,10,12,0.08)',
            transform: `rotate(${c.rotate}deg)`,
            zIndex: c.z,
            animation: `qmFloat${i} 6s ease-in-out infinite`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, letterSpacing: 1.4, color: c.color, fontWeight: 700 }}>
              {c.t.toUpperCase()}
            </span>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: c.color }} />
          </div>
          <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: 'var(--c-text)' }}>
            {c.q}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 4 }}>
            {['A', 'B', 'C', 'D'].map((l) => (
              <div
                key={l}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '6px 0',
                  background: 'var(--c-app)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: 'var(--c-text-subtle)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LandingMarquee() {
  const items = [
    'PDF textbooks',
    'DOCX problem sets',
    'Pasted MCQs',
    'Lecture notes',
    'Practice exams',
    'TXT study guides',
  ];
  return (
    <div
      style={{
        borderTop: '1px solid var(--c-border)',
        borderBottom: '1px solid var(--c-border)',
        background: 'var(--c-surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 56,
          padding: '20px 0',
          animation: 'qmMarquee 40s linear infinite',
          whiteSpace: 'nowrap',
        }}
      >
        {[...items, ...items, ...items].map((it, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              fontFamily: serif,
              fontSize: 26,
              fontStyle: 'italic',
              color: 'var(--c-text)',
              flexShrink: 0,
            }}
          >
            <span style={{ color: 'var(--c-brand)' }}>✦</span> {it}
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingDemo() {
  return (
    <section
      className="landing-demo"
      style={{
        padding: '96px 40px',
        maxWidth: 1040,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 48,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: 2.4,
            color: 'var(--c-brand)',
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          ✦ &nbsp;LIVE DEMO
        </div>
        <h2
          className="landing-demo-h2"
          style={{
            fontFamily: serif,
            fontWeight: 600,
            fontSize: 'clamp(32px, 4.5vw, 52px)',
            letterSpacing: -1.5,
            margin: 0,
            lineHeight: 1.05,
          }}
        >
          Paste in. <em style={{ color: 'var(--c-brand)' }}>Quiz out.</em>
        </h2>
        <p
          style={{
            marginTop: 16,
            fontSize: 16,
            color: 'var(--c-text-subtle)',
            lineHeight: 1.55,
            maxWidth: 560,
            margin: '16px auto 0',
          }}
        >
          A 30-second loop of what actually happens when you drop in a messy document.
        </p>
      </div>
      <DemoCard />
    </section>
  );
}

function LandingFeatures() {
  const items = [
    { n: '01', t: 'It parses the mess', d: 'Numbered? Lettered? Footnoted answer key? Scan of a page? Yes, yes, yes, yes.' },
    { n: '02', t: 'It grades itself', d: "Difficulty labels aren't guesses. They're based on what the question actually demands." },
    { n: '03', t: 'It explains', d: '"The answer is C" is useless at 2am. Every answer ships with a one-line why.' },
    { n: '04', t: 'It stays out of the way', d: 'No account. No email. No pricing page. You paste, it quizzes. That is the whole contract.' },
  ];
  return (
    <section className="landing-features" style={{ padding: '120px 40px', maxWidth: 1280, margin: '0 auto' }}>
      <h2
        className="landing-features-h2"
        style={{
          fontFamily: serif,
          fontWeight: 600,
          fontSize: 'clamp(40px, 6vw, 72px)',
          letterSpacing: -2,
          margin: '0 0 64px',
          maxWidth: 820,
          lineHeight: 1,
        }}
      >
        Four small things.
        <br />
        <em style={{ color: 'var(--c-brand)' }}>One big difference.</em>
      </h2>
      <div
        className="landing-feature-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
          background: 'var(--c-border)',
          border: '1px solid var(--c-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {items.map((it) => (
          <div
            key={it.n}
            className="landing-feature-card"
            style={{
              background: 'var(--c-app)',
              padding: 48,
              minHeight: 260,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: serif,
                fontStyle: 'italic',
                fontSize: 48,
                color: 'var(--c-brand)',
                lineHeight: 1,
                fontWeight: 600,
              }}
            >
              {it.n}.
            </div>
            <h3
              style={{
                fontFamily: serif,
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: -0.6,
                margin: 0,
                color: 'var(--c-text)',
              }}
            >
              {it.t}
            </h3>
            <p style={{ fontSize: 17, color: 'var(--c-text-subtle)', lineHeight: 1.55, margin: 0, maxWidth: 420 }}>
              {it.d}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LandingCTA({ onStart }: { onStart: () => void }) {
  return (
    <section className="landing-cta" style={{ padding: '0 40px 120px', maxWidth: 1280, margin: '0 auto' }}>
      <div
        style={{
          background: 'var(--c-brand)',
          borderRadius: 32,
          padding: 'clamp(56px, 10vw, 96px) clamp(32px, 6vw, 72px)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.22), transparent 50%)',
          }}
        />
        <h2
          style={{
            fontFamily: serif,
            fontSize: 'clamp(48px, 8vw, 88px)',
            fontWeight: 600,
            letterSpacing: -3,
            margin: 0,
            color: '#052E24',
            lineHeight: 0.95,
            position: 'relative',
          }}
        >
          Stop formatting.
          <br />
          <em>Start studying.</em>
        </h2>
        <button
          onClick={onStart}
          style={{
            marginTop: 40,
            background: '#0A0A0C',
            color: '#fff',
            border: 'none',
            padding: '20px 36px',
            borderRadius: 99,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          Make your first quiz →
        </button>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer
      className="landing-footer"
      style={{
        padding: '32px 40px 48px',
        borderTop: '1px solid var(--c-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        fontSize: 13,
        color: 'var(--c-text-faint)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <QuizMintLogo size={18} />
        <span>
          Quiz<span style={{ color: 'var(--c-brand)' }}>Mint</span>
        </span>
        <span style={{ marginLeft: 12 }}>Made with mint.</span>
      </div>
      <a
        href="https://github.com/Yashrajkv28/quizmint"
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--c-text-subtle)', textDecoration: 'none' }}
      >
        GitHub ↗
      </a>
    </footer>
  );
}

function LandingStyles() {
  return (
    <style>{`
      @keyframes qmFloat0 { 0%,100% { transform: rotate(-6deg) translateY(0) } 50% { transform: rotate(-6deg) translateY(-8px) } }
      @keyframes qmFloat1 { 0%,100% { transform: rotate(4deg)  translateY(0) } 50% { transform: rotate(4deg)  translateY(-12px) } }
      @keyframes qmFloat2 { 0%,100% { transform: rotate(-2deg) translateY(0) } 50% { transform: rotate(-2deg) translateY(-6px) } }
      @keyframes qmFloat3 { 0%,100% { transform: rotate(8deg)  translateY(0) } 50% { transform: rotate(8deg)  translateY(-10px) } }
      @keyframes qmMarquee { 0% { transform: translateX(0) } 100% { transform: translateX(-33.33%) } }
      @media (max-width: 1100px) {
        .landing-floating { display: none; }
      }
      @media (max-width: 720px) {
        .landing-feature-grid { grid-template-columns: 1fr !important; }
      }
      @media (max-width: 560px) {
        .landing-nav { padding: 18px 20px !important; }
        .landing-nav button:last-child { padding: 9px 14px !important; font-size: 13px !important; }
        .landing-hero { padding: 56px 20px 80px !important; }
        .landing-headline { letter-spacing: -2px !important; line-height: 0.95 !important; }
        .landing-features { padding: 72px 20px !important; }
        .landing-features-h2 { letter-spacing: -1px !important; margin-bottom: 40px !important; }
        .landing-feature-card { padding: 28px !important; min-height: 0 !important; }
        .landing-feature-card h3 { font-size: 24px !important; }
        .landing-feature-card p { font-size: 15px !important; }
        .landing-cta { padding: 0 20px 80px !important; }
        .landing-footer { padding: 24px 20px 36px !important; }
        .landing-demo { padding: 64px 20px !important; gap: 32px !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .landing-floating > div { animation: none !important; }
      }
    `}</style>
  );
}
