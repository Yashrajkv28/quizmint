import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Sun, Moon } from 'lucide-react';
import FlipClockDisplay from './timer/FlipClockDisplay';
import { runLandingAnimations } from './LandingPage.animations.js';

type Theme = 'light' | 'dark';

interface LandingPageProps {
  theme: Theme;
  onToggleTheme: () => void;
  onStart: () => void;
}

export function LandingPage({ theme, onToggleTheme, onStart }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const flipRootRef = useRef<Root | null>(null);
  const themeRootRef = useRef<Root | null>(null);

  // Mount markup + wire interactions + run animation script
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // Mount our real FlipClockDisplay into the timer card
    const timerRow = root.querySelector('.timer-row');
    if (timerRow) {
      timerRow.innerHTML = '<div id="qm-flip-mount" style="display:flex;justify-content:center;"></div>';
      const mount = timerRow.querySelector('#qm-flip-mount') as HTMLElement;
      flipRootRef.current = createRoot(mount);
      flipRootRef.current.render(<TimerDemo />);
    }

    // Mount the dashboard-style theme toggle into the nav slot
    const themeMount = root.querySelector('#qm-theme-mount') as HTMLElement | null;
    if (themeMount) {
      themeRootRef.current = createRoot(themeMount);
    }

    // Wire all CTAs (nav button, hero primary, CTA card button)
    const ctas = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.nav-cta, .btn-primary, .cta-btn')
    );
    const onCtaClick = (e: Event) => {
      e.preventDefault();
      onStart();
    };
    ctas.forEach((b) => b.addEventListener('click', onCtaClick));

    // Hijack in-page nav anchors to land INSIDE the sticky sections (otherwise
    // jumping to the section's top lands on a blank entry zone before the
    // sticky/fade-in animations kick in).
    const stickyOffsets: Record<string, number> = {
      story: 1.5,    // 700vh sticky — 1.5vh in puts you mid stage A (doc)
      features: 1.2, // 280vh sticky — 1.2vh in puts you past entrance fade
      timer: 0,      // not sticky, default behavior fine
    };
    const navAnchors = Array.from(
      root.querySelectorAll<HTMLAnchorElement>('.nav-links a[href^="#"]')
    );
    const onAnchorClick = (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const href = a.getAttribute('href') || '';
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const offsetVh = stickyOffsets[id] ?? 0;
      const top = target.getBoundingClientRect().top + window.scrollY + offsetVh * window.innerHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    };
    navAnchors.forEach((a) => a.addEventListener('click', onAnchorClick));

    // Run the animation script
    try {
      runLandingAnimations();
    } catch (err) {
      console.error('[LandingPage] animation script failed', err);
    }

    return () => {
      ctas.forEach((b) => b.removeEventListener('click', onCtaClick));
      navAnchors.forEach((a) => a.removeEventListener('click', onAnchorClick));
      const cleanup = (window as unknown as { __qmLandingCleanup?: () => void }).__qmLandingCleanup;
      if (typeof cleanup === 'function') cleanup();
      const flipR = flipRootRef.current;
      const themeR = themeRootRef.current;
      flipRootRef.current = null;
      themeRootRef.current = null;
      if (flipR) setTimeout(() => flipR.unmount(), 0);
      if (themeR) setTimeout(() => themeR.unmount(), 0);
    };
  }, [onStart]);

  // Render/refresh the theme button whenever theme or handler changes
  useEffect(() => {
    themeRootRef.current?.render(
      <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
    );
  }, [theme, onToggleTheme]);

  return (
    <>
      <style>{LANDING_STYLES}</style>
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: LANDING_BODY }} />
    </>
  );
}

// ---------- Theme toggle (same styling as Dashboard.tsx) ----------
function ThemeToggle({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggleTheme}
      aria-label="Toggle theme"
      className="p-2 rounded-lg border border-[var(--c-border)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

// ---------- Real flip clock demo (countdown 5:00 → 0, loops) ----------
function TimerDemo() {
  const TOTAL = 5 * 60;
  const [secs, setSecs] = useState(4 * 60 + 37);
  useEffect(() => {
    const id = window.setInterval(() => {
      setSecs((s) => (s <= 0 ? TOTAL : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <FlipClockDisplay
      hours={0}
      minutes={Math.floor(secs / 60)}
      seconds={secs % 60}
      showHours={false}
      isRunning
    />
  );
}

// ============================================================
//                       STYLES
// ============================================================
const LANDING_STYLES = `
:root {
  --bg: #0A0A0C;
  --bg2: #15161A;
  --surface: #1B1C20;
  --text: #FFFFFF;
  --muted: #94A3B8;
  --subtle: #64748B;
  --border: #2D2E35;
  --mint: #10B981;
  --mintDeep: #059669;
  --mintSoft: #A7F3D0;
}
html.light {
  --bg: #FAF7F0;
  --bg2: #FFFDF8;
  --surface: #FFFDF8;
  --text: #1A1713;
  --muted: #5C5346;
  --subtle: #837866;
  --border: #ECE6D8;
}
html, body {
  margin: 0; padding: 0;
  background: var(--bg); color: var(--text);
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  transition: background-color 0.5s ease, color 0.5s ease;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
body { overflow-x: hidden; }
.qm-landing, .qm-landing *, .qm-landing *::before, .qm-landing *::after { box-sizing: border-box; }
.qm-landing .serif { font-family: 'Fraunces', ui-serif, Georgia, serif; font-weight: 500; letter-spacing: -0.04em; }
.qm-landing .mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.qm-landing .mint  { color: var(--mint); }
.qm-landing .italic { font-style: italic; }
.qm-landing .eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.3em; text-transform: uppercase;
  color: var(--mint);
}
.qm-landing button { font-family: inherit; }
.qm-landing a { color: inherit; text-decoration: none; }

/* ---------- NAV ---------- */
.qm-landing .nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  padding: 14px 32px;
  display: flex; justify-content: space-between; align-items: center;
  transition: backdrop-filter 0.3s, background 0.3s, border-color 0.3s;
  border-bottom: 1px solid transparent;
}
.qm-landing .nav.scrolled {
  background: color-mix(in oklab, var(--bg) 72%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--border);
}
.qm-landing .nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
.qm-landing .nav-links { display: flex; align-items: center; gap: 4px; }
.qm-landing .nav-links a {
  color: var(--muted); font-size: 13px; font-weight: 500;
  padding: 8px 14px; border-radius: 99px; transition: color 0.2s, background 0.2s;
}
.qm-landing .nav-links a:hover { color: var(--text); background: color-mix(in oklab, var(--text) 6%, transparent); }
.qm-landing .nav-cta {
  padding: 9px 18px; border-radius: 99px;
  background: var(--text); color: var(--bg); border: none;
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.qm-landing .icon-btn {
  width: 34px; height: 34px; border-radius: 10px;
  background: transparent; border: 1px solid var(--border);
  color: var(--muted); cursor: pointer;
  display: grid; place-items: center; font-size: 14px;
  margin-right: 8px;
}
.qm-landing .nav-divider {
  width: 1px; height: 22px; background: var(--border);
  margin: 0 12px 0 4px; display: inline-block;
}
@media (max-width: 720px) {
  .qm-landing .nav { padding: 12px 18px; }
  .qm-landing .nav-links a { display: none; }
}

/* ---------- HERO ---------- */
.qm-landing .hero {
  position: relative; min-height: 100vh;
  padding: 140px 32px 80px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; overflow: hidden;
}
.qm-landing .hero-aurora { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.qm-landing .hero-blob { position: absolute; border-radius: 50%; filter: blur(80px); will-change: transform; }
.qm-landing .hero-blob.a {
  top: 15%; left: 10%; width: 480px; height: 480px;
  background: radial-gradient(circle, color-mix(in oklab, var(--mint) 25%, transparent), transparent 70%);
}
.qm-landing .hero-blob.b {
  bottom: 10%; right: 5%; width: 540px; height: 540px;
  background: radial-gradient(circle, color-mix(in oklab, var(--mint) 18%, transparent), transparent 70%);
}
.qm-landing .hero-blob.c {
  top: 50%; left: 50%; width: 320px; height: 320px;
  background: radial-gradient(circle, color-mix(in oklab, var(--mintSoft) 15%, transparent), transparent 70%);
  transform: translate(-50%, -50%);
}
.qm-landing .hero-eyebrow { margin-bottom: 32px; z-index: 2; position: relative; }
.qm-landing .hero-h1 {
  font-size: clamp(56px, 11vw, 168px);
  line-height: 1.05; margin: 0;
  max-width: 1500px;
  z-index: 2; position: relative;
  overflow: visible;
}
.qm-landing .hero-h1 .line {
  display: block;
  padding-bottom: 0.18em;
  line-height: 1.05;
}
.qm-landing .hero-h1 .gradient {
  background: linear-gradient(135deg, var(--mint), var(--mintDeep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  padding-bottom: 0.22em;
}
.qm-landing .hero-sub {
  font-size: clamp(16px, 1.6vw, 22px);
  color: var(--muted); max-width: 640px;
  line-height: 1.55; margin: 40px auto 0;
  z-index: 2; position: relative;
}
.qm-landing .hero-cta {
  display: flex; gap: 14px; margin-top: 48px;
  align-items: center; justify-content: center; flex-wrap: wrap;
  z-index: 2; position: relative;
}
.qm-landing .btn-primary {
  padding: 16px 28px; border-radius: 99px;
  background: var(--mint); color: #fff; border: none;
  font-size: 15px; font-weight: 600; cursor: pointer;
  box-shadow: 0 14px 40px -8px color-mix(in oklab, var(--mint) 60%, transparent);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.qm-landing .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 18px 44px -6px color-mix(in oklab, var(--mint) 70%, transparent); }
.qm-landing .scroll-cue {
  position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  z-index: 2;
}
.qm-landing .scroll-cue-line {
  width: 1px; height: 32px;
  background: linear-gradient(180deg, transparent, var(--mint), transparent);
  animation: qmScrollCue 2s ease-in-out infinite;
}
@keyframes qmScrollCue {
  0% { transform: translateY(-12px); opacity: 0; }
  40% { opacity: 1; }
  100% { transform: translateY(12px); opacity: 0; }
}

/* ---------- CANVAS REVEAL (story 1) ---------- */
.qm-landing .story { position: relative; height: 700vh; }
.qm-landing .story-sticky {
  position: sticky; top: 0; height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: flex-start;
  overflow: hidden;
  padding-top: 120px;
}
.qm-landing .story-bg {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, color-mix(in oklab, var(--mint) 6%, var(--bg)) 0%, var(--bg) 70%);
  transition: background 0.5s ease;
}
.qm-landing .story-eyebrow { position: relative; z-index: 5; text-align: center; margin-bottom: 18px; }
.qm-landing .story-h2 {
  position: relative; z-index: 5; text-align: center;
  font-size: clamp(32px, 5vw, 64px); line-height: 1; margin: 0 0 36px;
  padding: 0 32px; max-width: 1100px;
  transition: opacity 0.4s ease;
}
.qm-landing #storyCanvas {
  width: min(1100px, 92vw); height: min(520px, 56vh);
  position: relative; z-index: 4;
}
.qm-landing .story-steps {
  position: relative; z-index: 5;
  display: flex; gap: 32px;
  margin-top: 32px;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  flex-wrap: wrap; justify-content: center; padding: 0 16px;
}
.qm-landing .story-step {
  display: flex; align-items: center; gap: 8px;
  color: var(--subtle); font-weight: 500; letter-spacing: 0.2em;
  transition: color 0.3s;
}
.qm-landing .story-step .dot {
  width: 6px; height: 6px; border-radius: 99px;
  background: var(--border); transition: all 0.3s;
}
.qm-landing .story-step.active { color: var(--mint); font-weight: 700; }
.qm-landing .story-step.active .dot {
  background: var(--mint);
  box-shadow: 0 0 8px var(--mint);
}

/* ---------- PINNED FEATURE ---------- */
.qm-landing .feature { position: relative; height: 380vh; }
.qm-landing .feature-sticky {
  position: sticky; top: 0; height: 100vh;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 80px; padding: 0 64px; align-items: center;
  overflow: hidden;
}
.qm-landing .feature-text { will-change: transform, opacity; }
.qm-landing .feature-num {
  font-family: 'Fraunces', serif; font-style: italic;
  font-size: 88px; color: var(--mint);
  line-height: 1; font-weight: 500; margin-bottom: 24px;
}
.qm-landing .feature-title { font-size: clamp(40px, 5vw, 72px); line-height: 1; margin: 0; }
.qm-landing .feature-body {
  margin-top: 24px; font-size: 19px; line-height: 1.55;
  color: var(--muted); max-width: 520px;
}
.qm-landing .feature-visual { position: relative; height: 420px; will-change: transform, opacity; }
@media (max-width: 900px) {
  .qm-landing .feature-sticky { grid-template-columns: 1fr; gap: 40px; padding: 80px 32px; }
  .qm-landing .feature-visual { height: 340px; }
  .qm-landing .feature { height: 300vh; }
}

/* ---------- PARALLAX SHOWCASE ---------- */
.qm-landing .parallax {
  position: relative; height: 140vh; overflow: hidden;
  background: radial-gradient(ellipse at top, color-mix(in oklab, var(--mint) 8%, var(--bg)) 0%, var(--bg) 60%);
  display: flex; align-items: center; justify-content: center;
  transition: background 0.5s;
}
.qm-landing .parallax-back {
  position: absolute; inset: 0; display: flex;
  align-items: center; justify-content: center;
  pointer-events: none; will-change: transform;
  opacity: 0.06;
}
.qm-landing .parallax-back-q {
  font-family: 'Fraunces', serif; font-style: italic;
  font-size: clamp(280px, 40vw, 560px); color: var(--mint);
  font-weight: 500; letter-spacing: -0.06em; line-height: 0.9;
}
.qm-landing .parallax-mid { position: relative; z-index: 2; text-align: center; padding: 0 32px; will-change: transform; }
.qm-landing .parallax-front { position: absolute; inset: 0; pointer-events: none; will-change: transform; }
.qm-landing .parallax-card {
  position: absolute; width: 280px; padding: 24px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 16px 32px -8px rgba(0,0,0,0.4);
}
html.light .qm-landing .parallax-card { box-shadow: 0 16px 32px -8px rgba(0,0,0,0.1); }
.qm-landing .parallax-card .tag {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
  letter-spacing: 0.2em;
}
.qm-landing .parallax-card .q {
  font-family: 'Fraunces', serif; font-size: 19px;
  margin-top: 10px; line-height: 1.3; color: var(--text);
}

/* ---------- TIMER STORY ---------- */
.qm-landing .timer-section {
  padding: 160px 32px;
  max-width: 1280px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
}
.qm-landing .timer-text { will-change: transform, opacity; }
.qm-landing .timer-visual { will-change: transform, opacity; }
.qm-landing .kbd-list { margin-top: 32px; display: flex; flex-direction: column; gap: 10px; }
.qm-landing .kbd-row { display: flex; align-items: center; gap: 14px; }
.qm-landing .kbd {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
  padding: 4px 10px; border-radius: 6px;
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text); min-width: 50px; text-align: center;
}
.qm-landing .timer-card {
  padding: 40px 32px; border-radius: 24px;
  background: var(--bg2);
  border: 1px solid var(--border);
  box-shadow: 0 32px 80px -20px rgba(0,0,0,0.5);
  display: flex; flex-direction: column; align-items: center; gap: 24px;
}
html.light .qm-landing .timer-card { box-shadow: 0 32px 80px -20px rgba(26,23,19,0.18); background: #FFFDF8; }
.qm-landing .timer-header { display: flex; align-items: center; gap: 12px; }
.qm-landing .timer-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: rgba(16,185,129,0.10);
  border: 1px solid rgba(16,185,129,0.4);
  display: grid; place-items: center;
  color: var(--mint); font-size: 14px;
}
.qm-landing .timer-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.2em; color: var(--mint); text-transform: uppercase; }
.qm-landing .timer-title { font-size: 18px; font-weight: 600; color: var(--text); letter-spacing: -0.01em; line-height: 1.1; margin-top: 2px; }
.qm-landing .timer-row { display: flex; align-items: center; justify-content: center; min-height: 132px; }
.qm-landing .timer-controls { display: flex; gap: 8px; }
.qm-landing .timer-btn {
  padding: 10px 24px; border-radius: 12px;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.qm-landing .timer-btn.primary { background: var(--mint); color: #fff; border: none; }
.qm-landing .timer-btn.ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); padding: 10px 20px; font-weight: 500; }
@media (max-width: 900px) {
  .qm-landing .timer-section { grid-template-columns: 1fr; gap: 48px; padding: 100px 24px; }
}

/* ---------- MARQUEE ---------- */
.qm-landing .marquee {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--bg2);
  overflow: hidden; padding: 28px 0;
}
.qm-landing .marquee-track {
  display: flex; gap: 56px; animation: qmMarquee 40s linear infinite;
  white-space: nowrap; will-change: transform;
}
.qm-landing .marquee-item {
  display: flex; align-items: center; gap: 18px;
  font-family: 'Fraunces', serif; font-size: 30px; font-style: italic;
  color: var(--text); flex-shrink: 0; font-weight: 500;
}
.qm-landing .marquee-item .star { color: var(--mint); }
@keyframes qmMarquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-33.333%); }
}

/* ---------- FINAL CTA ---------- */
.qm-landing .cta { padding: 120px 32px; max-width: 1280px; margin: 0 auto; }
.qm-landing .cta-card {
  position: relative; overflow: hidden;
  border-radius: 32px;
  padding: clamp(72px, 12vw, 140px) clamp(32px, 6vw, 80px) clamp(96px, 14vw, 180px);
  background: linear-gradient(135deg, var(--mintDeep) 0%, var(--mint) 100%);
  text-align: center;
}
.qm-landing .cta-leaf {
  position: absolute;
  top: 46%; left: 50%;
  transform: translate(-50%, -50%);
  width: clamp(380px, 52vw, 620px);
  height: clamp(380px, 52vw, 620px);
  opacity: 0.12;
  pointer-events: none;
}
.qm-landing .cta-glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 30%, rgba(255,255,255,0.25), transparent 55%);
  pointer-events: none;
}
.qm-landing .cta-content { position: relative; z-index: 2; }
.qm-landing .cta-h2 {
  font-family: 'Fraunces', serif; font-weight: 500;
  font-size: clamp(48px, 8vw, 112px);
  letter-spacing: -0.04em; margin: 0;
  color: #052E24; line-height: 0.92;
}
.qm-landing .cta-h2 em { font-style: italic; }
.qm-landing .cta-btn {
  margin-top: 40px; padding: 20px 36px; border-radius: 99px;
  background: #0A0A0C; color: #fff; border: none;
  font-size: 16px; font-weight: 600; cursor: pointer;
  box-shadow: 0 12px 32px -8px rgba(0,0,0,0.4);
  transition: transform 0.2s;
}
.qm-landing .cta-btn:hover { transform: translateY(-2px); }
.qm-landing .cta-fine { margin-top: 16px; font-size: 13px; color: #052E24; opacity: 0.7; }

/* ---------- FOOTER ---------- */
.qm-landing .footer {
  border-top: 1px solid var(--border);
  font-size: 13px; color: var(--subtle);
}
.qm-landing .footer-inner {
  max-width: 1280px; margin: 0 auto;
  padding: 18px 32px;
}
.qm-landing .footer-row {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 16px;
}
.qm-landing .footer-brand { display: flex; align-items: center; gap: 10px; color: var(--text); font-weight: 600; }
.qm-landing .footer-brand .made { color: var(--subtle); font-weight: 400; margin-left: 12px; }
.qm-landing .footer-links { display: flex; gap: 24px; }
.qm-landing .footer-links a { color: var(--muted); }
.qm-landing .footer-divider {
  height: 1px; background: var(--border); width: 100%;
}
.qm-landing .footer-legal {
  font-size: 11.5px; line-height: 1.6; color: var(--muted);
  letter-spacing: 0.01em;
}
.qm-landing .footer-legal .copy { color: var(--text); font-weight: 600; }

/* ---------- entrance helpers ---------- */
.qm-landing .reveal { opacity: 0; transform: translateY(36px); transition: opacity 0.9s ease, transform 0.9s cubic-bezier(.2,.7,.2,1); }
.qm-landing .reveal.in { opacity: 1; transform: translateY(0); }
.qm-landing .reveal.d1 { transition-delay: 0.1s; }
.qm-landing .reveal.d2 { transition-delay: 0.2s; }
.qm-landing .reveal.d3 { transition-delay: 0.3s; }
.qm-landing .reveal.d4 { transition-delay: 0.4s; }

@media (prefers-reduced-motion: reduce) {
  .qm-landing *, .qm-landing *::before, .qm-landing *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .qm-landing .reveal { opacity: 1 !important; transform: none !important; }
}
`;

// ============================================================
//                       BODY MARKUP
// ============================================================
const LANDING_BODY = `
<div class="qm-landing">
  <nav class="nav" id="nav">
    <div class="nav-brand">
      <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 10 C 74 10, 88 28, 88 48 C 88 63, 76 74, 60 74 L 50 74 Z" fill="#10B981"/>
        <path d="M50 10 C 26 10, 12 28, 12 48 C 12 63, 24 74, 40 74 L 50 74 Z" fill="#10B981" opacity="0.85"/>
        <path d="M50 14 L 50 64 C 50 74, 60 76, 60 84" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" opacity="0.9"/>
        <circle cx="60" cy="92" r="3.4" fill="currentColor"/>
      </svg>
      <span>Quiz<span class="mint">Mint</span></span>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <div class="nav-links">
        <a href="#story">How it works</a>
        <a href="#features">Features</a>
        <a href="#timer">Timer</a>
      </div>
      <span id="qm-theme-mount" style="display:inline-flex; align-items:center; margin-right:8px;"></span>
      <span class="nav-divider" aria-hidden="true"></span>
      <button class="nav-cta">Get started</button>
    </div>
  </nav>

  <section class="hero" id="hero">
    <div class="hero-aurora">
      <div class="hero-blob a" data-blob="a"></div>
      <div class="hero-blob b" data-blob="b"></div>
      <div class="hero-blob c" data-blob="c"></div>
    </div>
    <div class="eyebrow hero-eyebrow reveal">✦ &nbsp; INTRODUCING QUIZMINT 2.0</div>
    <h1 class="hero-h1 serif">
      <span class="line reveal d1">Any document.</span>
      <span class="line italic gradient reveal d2">Instantly studyable.</span>
    </h1>
    <p class="hero-sub reveal d3">
      Drop a PDF, paste a chapter, or upload your lecture notes.
      QuizMint reads the mess and hands back a real quiz — graded, explained, ready to drill.
    </p>
    <div class="hero-cta reveal d4">
      <button class="btn-primary">Try it free →</button>
    </div>
  </section>

  <section class="story" id="story">
    <div class="story-sticky">
      <div class="story-bg"></div>
      <div class="eyebrow story-eyebrow">✦ &nbsp; HOW IT WORKS</div>
      <h2 class="story-h2 serif" id="storyH2">
        <span id="storyTextA">Drop in <em class="italic mint">messy notes.</em></span>
      </h2>
      <canvas id="storyCanvas"></canvas>
    </div>
  </section>

  <section id="features">
    <div class="feature" data-feature="0">
      <div class="feature-sticky">
        <div class="feature-text">
          <div class="feature-num serif italic">01.</div>
          <h3 class="feature-title serif">It parses the mess.</h3>
          <p class="feature-body">Numbered, lettered, footnoted answer keys, scanned pages — bring the worst documents you have. PDF, DOCX, or just paste the text.</p>
        </div>
        <div class="feature-visual" id="visual0"></div>
      </div>
    </div>

    <div class="feature" data-feature="1">
      <div class="feature-sticky">
        <div class="feature-text">
          <div class="feature-num serif italic">02.</div>
          <h3 class="feature-title serif">It grades itself.</h3>
          <p class="feature-body">Difficulty isn't a vibe. Every question gets an Easy / Medium / Hard label so you study what's hard, not just what's first.</p>
        </div>
        <div class="feature-visual" id="visual1"></div>
      </div>
    </div>

    <div class="feature" data-feature="2">
      <div class="feature-sticky">
        <div class="feature-text">
          <div class="feature-num serif italic">03.</div>
          <h3 class="feature-title serif">It explains.</h3>
          <p class="feature-body">"The answer is C" is useless at 2am. Every answer ships with a one-line why so you actually learn the thing.</p>
        </div>
        <div class="feature-visual" id="visual2"></div>
      </div>
    </div>
  </section>

  <section class="parallax" id="parallax">
    <div class="parallax-back" id="parallaxBack"><div class="parallax-back-q">Q.</div></div>
    <div class="parallax-mid" id="parallaxMid">
      <div class="eyebrow" style="margin-bottom:24px;">✦ &nbsp; BUILT FOR FOCUS</div>
      <h2 class="serif" style="font-size:clamp(48px,8vw,120px); line-height:0.92; margin:0; max-width:1100px;">
        Designed for the<br>
        <em class="italic mint">2 am session.</em>
      </h2>
      <p style="margin-top:28px; font-size:19px; color:var(--muted); max-width:560px; margin-left:auto; margin-right:auto; line-height:1.55;">
        Quiet typography. A timer that doesn't shout at you. A flow that respects your attention.
      </p>
    </div>
    <div class="parallax-front" id="parallaxFront">
      <div class="parallax-card" style="left:8%; top:18%; transform:rotate(-6deg);">
        <div class="tag" style="color:#F59E0B;">● Q1</div>
        <div class="q">Define photosynthesis.</div>
      </div>
      <div class="parallax-card" style="right:8%; top:14%; transform:rotate(8deg);">
        <div class="tag" style="color:#6366F1;">● Q2</div>
        <div class="q">Year of Magna Carta?</div>
      </div>
      <div class="parallax-card" style="left:10%; bottom:14%; transform:rotate(4deg);">
        <div class="tag" style="color:#EC4899;">● Q3</div>
        <div class="q">pKa of acetic acid?</div>
      </div>
      <div class="parallax-card" style="right:10%; bottom:18%; transform:rotate(-4deg);">
        <div class="tag" style="color:var(--mint);">● Q4</div>
        <div class="q">GDP vs GNP — diff?</div>
      </div>
    </div>
  </section>

  <section class="timer-section" id="timer">
    <div class="timer-text reveal">
      <div class="eyebrow" style="margin-bottom:20px;">✦ &nbsp; FLIP TIMER</div>
      <h2 class="serif" style="font-size:clamp(40px,5.5vw,80px); line-height:0.95; margin:0;">
        A timer that<br><em class="italic mint">doesn't shout.</em>
      </h2>
      <p style="margin-top:24px; font-size:18px; color:var(--muted); line-height:1.6; max-width:480px;">
        Soft card faces, a brand-mint hairline, an editorial colon that breathes with the second. Four modes — Clock, Countdown, Count up, Hybrid — one feel.
      </p>
      <div class="kbd-list">
        <div class="kbd-row"><span class="kbd">SPACE</span><span style="font-size:14px; color:var(--muted);">Start / pause</span></div>
        <div class="kbd-row"><span class="kbd">F</span><span style="font-size:14px; color:var(--muted);">Fullscreen focus</span></div>
        <div class="kbd-row"><span class="kbd">ESC</span><span style="font-size:14px; color:var(--muted);">Exit fullscreen</span></div>
      </div>
    </div>
    <div class="timer-visual reveal d1">
      <div class="timer-card">
        <div class="timer-header">
          <div class="timer-icon">⧗</div>
          <div>
            <div class="timer-eyebrow">Running</div>
            <div class="timer-title">Countdown</div>
          </div>
        </div>
        <div class="timer-row"></div>
        <div class="timer-controls">
          <button class="timer-btn primary" type="button">⏸ Pause</button>
          <button class="timer-btn ghost" type="button">↺ Reset</button>
        </div>
      </div>
    </div>
  </section>

  <div class="marquee">
    <div class="marquee-track">
      <span class="marquee-item"><span class="star">✦</span> PDF textbooks</span>
      <span class="marquee-item"><span class="star">✦</span> Lecture notes</span>
      <span class="marquee-item"><span class="star">✦</span> Practice exams</span>
      <span class="marquee-item"><span class="star">✦</span> Pasted MCQs</span>
      <span class="marquee-item"><span class="star">✦</span> DOCX problem sets</span>
      <span class="marquee-item"><span class="star">✦</span> Study guides</span>
      <span class="marquee-item"><span class="star">✦</span> PDF textbooks</span>
      <span class="marquee-item"><span class="star">✦</span> Lecture notes</span>
      <span class="marquee-item"><span class="star">✦</span> Practice exams</span>
      <span class="marquee-item"><span class="star">✦</span> Pasted MCQs</span>
      <span class="marquee-item"><span class="star">✦</span> DOCX problem sets</span>
      <span class="marquee-item"><span class="star">✦</span> Study guides</span>
      <span class="marquee-item"><span class="star">✦</span> PDF textbooks</span>
      <span class="marquee-item"><span class="star">✦</span> Lecture notes</span>
      <span class="marquee-item"><span class="star">✦</span> Practice exams</span>
      <span class="marquee-item"><span class="star">✦</span> Pasted MCQs</span>
      <span class="marquee-item"><span class="star">✦</span> DOCX problem sets</span>
      <span class="marquee-item"><span class="star">✦</span> Study guides</span>
    </div>
  </div>

  <section class="cta">
    <div class="cta-card">
      <svg class="cta-leaf" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 10 C 74 10, 88 28, 88 48 C 88 63, 76 74, 60 74 L 50 74 Z" fill="#FFFFFF"/>
        <path d="M50 10 C 26 10, 12 28, 12 48 C 12 63, 24 74, 40 74 L 50 74 Z" fill="#FFFFFF" opacity="0.85"/>
        <path d="M50 14 L 50 64 C 50 74, 60 76, 60 84" fill="none" stroke="#052E24" stroke-width="5.5" stroke-linecap="round" opacity="0.9"/>
        <circle cx="60" cy="92" r="3.4" fill="#052E24"/>
      </svg>
      <div class="cta-glow"></div>
      <div class="cta-content reveal">
        <h2 class="cta-h2">Stop formatting.<br><em>Start studying.</em></h2>
        <button class="cta-btn">Make your first quiz →</button>
        <div class="cta-fine">Free. Login with Gmail.</div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="footer-inner footer-row">
      <div class="footer-brand">
        <svg width="18" height="18" viewBox="0 0 100 100"><path d="M50 10 C 74 10, 88 28, 88 48 C 88 63, 76 74, 60 74 L 50 74 Z" fill="#10B981"/><path d="M50 10 C 26 10, 12 28, 12 48 C 12 63, 24 74, 40 74 L 50 74 Z" fill="#10B981" opacity="0.85"/></svg>
        <span>Quiz<span class="mint">Mint</span></span>
        <span class="made">Made with mint.</span>
      </div>
      <div class="footer-links">
        <a href="https://github.com/Yashrajkv28/quizmint" target="_blank" rel="noreferrer">GitHub ↗</a>
      </div>
    </div>
    <div class="footer-divider"></div>
    <div class="footer-inner footer-legal">
      <span class="copy">© 2026 QuizMint.</span> All rights reserved. QuizMint is provided as-is for educational and personal study purposes only. Generated quiz content is produced by AI and may contain inaccuracies, always verify against your original source material before relying on it. Uploaded files are processed transiently and are not stored or shared. QuizMint is an independent project and is not affiliated with, endorsed by, or sponsored by any educational institution, publisher, or examination board. All trademarks and source materials remain the property of their respective owners. By using this site you accept that the service is offered without warranty of any kind, and that the operators are not liable for any outcome, academic, financial, or otherwise, arising from its use.
    </div>
  </footer>
</div>
`;

