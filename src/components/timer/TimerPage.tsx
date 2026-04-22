import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Sun, Moon, ArrowLeft, Play, Pause, RotateCcw, Maximize2, Minimize2,
  Clock as ClockIcon, Timer as TimerIcon, TrendingUp, Repeat, Music,
} from 'lucide-react';
import { QuizMintLogo } from '../QuizMintLogo';
import { secondsToParts } from '../../lib/formatTime';
import { useTimer, TimerMode } from '../../lib/useTimer';
import { audioService } from '../../lib/audioService';
import FlipClockDisplay from './FlipClockDisplay';
import { SpotifyEmbed } from './SpotifyEmbed';
import { parseSpotifyUrl, useSpotifyEnabled, useSpotifyUrl } from '../../lib/spotify';

type Theme = 'light' | 'dark';

interface TimerPageProps {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
}

const PRESETS = [5, 10, 15, 20, 30, 45, 60];
const DEFAULT_DURATION = 5 * 60;

const MODE_META: Record<TimerMode, { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  clock:     { label: 'Clock',     icon: ClockIcon,   desc: 'Live system time, always on' },
  countdown: { label: 'Countdown', icon: TimerIcon,   desc: 'Count down to zero' },
  countup:   { label: 'Count up',  icon: TrendingUp,  desc: 'Start from zero, no limit' },
  hybrid:    { label: 'Hybrid',    icon: Repeat,      desc: 'Countdown, then count up' },
};

export function TimerPage({ theme, onToggleTheme, onBack }: TimerPageProps) {
  const [selectedMode, setSelectedMode] = useState<TimerMode | null>(null);

  // When no mode selected, show the menu
  if (selectedMode === null) {
    return (
      <TimerMenu
        theme={theme}
        onToggleTheme={onToggleTheme}
        onBack={onBack}
        onPickMode={setSelectedMode}
      />
    );
  }

  return (
    <TimerView
      theme={theme}
      onToggleTheme={onToggleTheme}
      onChangeMode={() => setSelectedMode(null)}
      onBack={onBack}
      mode={selectedMode}
    />
  );
}

// ----------------- Mode selector (landing inside timer page) -----------------

interface TimerMenuProps {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
  onPickMode: (m: TimerMode) => void;
}

function TimerMenu({ theme, onToggleTheme, onBack, onPickMode }: TimerMenuProps) {
  return (
    <div className="min-h-screen bg-[var(--c-app)] text-[var(--c-text)] font-sans flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b border-[var(--c-border)]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2.5 text-[16px] font-bold tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
        >
          <QuizMintLogo size={20} />
          <span>Quiz<span className="text-[var(--c-brand)]">Mint</span></span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg border border-[var(--c-border)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[900px] mx-auto px-6 py-16 flex flex-col items-center justify-center gap-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold text-emerald-500 tracking-[0.2em] uppercase mb-3">Flip Timer</p>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight">Pick a mode</h1>
          <p className="text-[14px] text-[var(--c-text-subtle)] mt-2">
            Four modes. Space to start and pause. F for fullscreen.
          </p>
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(MODE_META) as TimerMode[]).map((m) => {
            const meta = MODE_META[m];
            const Icon = meta.icon;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onPickMode(m)}
                className="mint-breathe group flex items-start gap-4 p-5 rounded-2xl border border-emerald-500/20 bg-[var(--c-surface)] hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--c-app)] border border-[var(--c-border)] grid place-items-center shrink-0 text-[var(--c-text-subtle)] group-hover:text-emerald-500 group-hover:border-emerald-500/40 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--c-text)]">{meta.label}</p>
                  <p className="text-[12px] text-[var(--c-text-subtle)] mt-1">{meta.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ----------------- Running timer view -----------------

interface TimerViewProps {
  theme: Theme;
  onToggleTheme: () => void;
  onChangeMode: () => void;
  onBack: () => void;
  mode: TimerMode;
}

function TimerView({ theme, onToggleTheme, onChangeMode, onBack, mode }: TimerViewProps) {
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [spotifyEnabled] = useSpotifyEnabled();
  const [spotifyUrl, setSpotifyUrl] = useSpotifyUrl();
  const [spotifyInput, setSpotifyInput] = useState('');
  const [spotifyError, setSpotifyError] = useState(false);
  const parsedSpotify = useMemo(() => parseSpotifyUrl(spotifyUrl), [spotifyUrl]);

  const handleSpotifySubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseSpotifyUrl(spotifyInput);
    if (!parsed) {
      setSpotifyError(true);
      return;
    }
    setSpotifyError(false);
    setSpotifyUrl(spotifyInput.trim());
    setSpotifyInput('');
  };

  const handleSpotifyClose = () => {
    setSpotifyUrl('');
    setSpotifyInput('');
    setSpotifyError(false);
  };

  const { seconds, status, hybridPhase, start, pause, resume, reset } = useTimer({
    mode,
    initialSeconds: duration,
  });

  const parts = useMemo(() => secondsToParts(seconds), [seconds]);
  const showHours = mode === 'clock' || parts.h > 0 || duration >= 3600;
  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;

  const alertColor = useMemo(() => {
    const isCountingDown = mode === 'countdown' || (mode === 'hybrid' && hybridPhase === 'countdown');
    if (!isCountingDown) return '';
    if (status !== 'running') return '';
    if (seconds <= 10 && seconds > 0) return '#EF4444';
    if (seconds <= 60) return '#F59E0B';
    return '';
  }, [mode, hybridPhase, status, seconds]);

  const lastAlertRef = useRef<number>(-1);
  useEffect(() => {
    if (status !== 'running') { lastAlertRef.current = -1; return; }
    const isCountingDown = mode === 'countdown' || (mode === 'hybrid' && hybridPhase === 'countdown');
    if (!isCountingDown) return;
    if ((seconds === 60 || seconds === 10) && lastAlertRef.current !== seconds) {
      lastAlertRef.current = seconds;
      audioService.play('alert');
    }
  }, [seconds, status, mode, hybridPhase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (mode === 'clock') return;
        if (status === 'idle' || status === 'completed') start();
        else if (status === 'running') pause();
        else if (status === 'paused') resume();
      } else if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, mode]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  const statusLabel =
    mode === 'clock' ? 'Live' :
    status === 'idle' ? 'Ready' :
    status === 'paused' ? 'Paused' :
    status === 'completed' ? 'Complete' :
    mode === 'hybrid' ? (hybridPhase === 'countdown' ? 'Countdown' : 'Count up') :
    mode === 'countup' ? 'Counting up' : 'Running';

  const canStart = mode !== 'clock';
  const primaryLabel =
    status === 'idle' || status === 'completed' ? 'Start' :
    status === 'running' ? 'Pause' : 'Resume';

  const handlePrimary = () => {
    if (status === 'idle' || status === 'completed') start();
    else if (status === 'running') pause();
    else if (status === 'paused') resume();
  };

  const applyPresetMinutes = (min: number) => {
    setDuration(min * 60);
    reset();
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[var(--c-app)] text-[var(--c-text)] font-sans flex flex-col"
    >
      {!isFullscreen && (
        <header className="flex items-center justify-between px-6 py-5 border-b border-[var(--c-border)]">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2.5 text-[16px] font-bold tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
          >
            <QuizMintLogo size={20} />
            <span>Quiz<span className="text-[var(--c-brand)]">Mint</span></span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onChangeMode}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Change mode
            </button>
            <button
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg border border-[var(--c-border)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] hover:bg-[var(--c-hover)] transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>
      )}

      <main
        className={`flex-1 w-full px-6 flex flex-col items-center justify-center gap-8 ${
          isFullscreen ? 'py-8' : 'max-w-[1100px] mx-auto py-10'
        }`}
      >
        {!isFullscreen && (
          <div className="w-full flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/40 grid place-items-center text-emerald-500">
              <ModeIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-emerald-500 tracking-[0.2em] uppercase">{statusLabel}</p>
              <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{meta.label}</h1>
            </div>
          </div>
        )}

        <div
          className={`relative flex flex-col items-center gap-6 ${
            isFullscreen
              ? 'p-8 sm:p-12 md:p-16 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-[var(--c-surface)] via-[var(--c-surface)] to-emerald-500/[0.06] shadow-[0_0_60px_-12px_rgba(16,185,129,0.35)]'
              : ''
          }`}
        >
          {isFullscreen && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] uppercase tracking-[0.25em] text-emerald-500 font-semibold">
              <ModeIcon className="w-3.5 h-3.5" />
              <span>{meta.label} · {statusLabel}</span>
            </div>
          )}

          <FlipClockDisplay
            hours={parts.h}
            minutes={parts.m}
            seconds={parts.s}
            showHours={showHours}
            color={alertColor}
            isRunning={status === 'running'}
          />

          {isFullscreen && canStart && (
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={handlePrimary}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-semibold transition-colors"
              >
                {status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {primaryLabel}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={status === 'idle'}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-app)] hover:bg-[var(--c-hover)] text-[14px] font-medium text-[var(--c-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Exit fullscreen"
                className="p-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-app)] hover:bg-[var(--c-hover)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {!isFullscreen && (
          <div className="flex items-center gap-3">
            {canStart && (
              <>
                <button
                  type="button"
                  onClick={handlePrimary}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-semibold transition-colors"
                >
                  {status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {primaryLabel}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  disabled={status === 'idle'}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] hover:bg-[var(--c-hover)] text-[14px] font-medium text-[var(--c-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              className="inline-flex items-center gap-2 p-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] hover:bg-[var(--c-hover)] text-[var(--c-text-subtle)] hover:text-[var(--c-text)] transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isFullscreen && (mode === 'countdown' || mode === 'hybrid') && (
          <div className="w-full max-w-[640px] flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--c-text-faint)] mb-3">Presets (minutes)</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {PRESETS.map((min) => {
                const active = duration === min * 60;
                return (
                  <button
                    key={min}
                    type="button"
                    onClick={() => applyPresetMinutes(min)}
                    className={`px-4 py-2 rounded-lg border text-[13px] font-medium transition-colors ${
                      active
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-500'
                        : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-muted)] hover:border-[var(--c-text-faint)]'
                    }`}
                  >
                    {min}m
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!isFullscreen && spotifyEnabled && !parsedSpotify && (
          <form onSubmit={handleSpotifySubmit} className="w-full max-w-[480px] flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 mb-1">
              <Music className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--c-text-faint)]">Music</p>
              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[9px] font-bold tracking-[0.15em] uppercase text-amber-600 [.light_&]:text-amber-700">
                Beta
              </span>
            </div>
            <div className="w-full flex gap-2">
              <input
                type="url"
                value={spotifyInput}
                onChange={(e) => { setSpotifyInput(e.target.value); if (spotifyError) setSpotifyError(false); }}
                placeholder="Paste a Spotify playlist, album, or track link"
                className={`flex-1 rounded-xl bg-[var(--c-surface)] border px-4 py-2.5 text-[13px] text-[var(--c-text)] placeholder:text-[var(--c-text-faint)] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors ${
                  spotifyError ? 'border-red-500/60' : 'border-[var(--c-border)]'
                }`}
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-medium transition-colors"
              >
                Load
              </button>
            </div>
            {spotifyError && (
              <p className="text-[11px] text-red-500 self-start">Not a Spotify link.</p>
            )}
          </form>
        )}
      </main>

      {spotifyEnabled && parsedSpotify && (
        <SpotifyEmbed parsed={parsedSpotify} theme={theme} onClose={handleSpotifyClose} />
      )}
    </div>
  );
}
