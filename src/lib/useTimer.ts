import { useEffect, useRef, useState, useCallback } from 'react';
import { audioService } from './audioService';

export type TimerMode = 'clock' | 'countdown' | 'countup' | 'hybrid';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';
export type HybridPhase = 'countdown' | 'countup';

export interface UseTimerOpts {
  mode: TimerMode;
  initialSeconds: number;
}

export interface UseTimerReturn {
  seconds: number;
  status: TimerStatus;
  hybridPhase: HybridPhase;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useTimer({ mode, initialSeconds }: UseTimerOpts): UseTimerReturn {
  const [seconds, setSeconds] = useState(
    mode === 'clock' ? liveClockSeconds() :
    mode === 'countup' ? 0 : initialSeconds
  );
  const [status, setStatus] = useState<TimerStatus>(mode === 'clock' ? 'running' : 'idle');
  const [hybridPhase, setHybridPhase] = useState<HybridPhase>('countdown');

  const startRef = useRef<number>(0);
  const pausedAtRef = useRef<number | null>(null);
  const totalPausedRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const finishedFiredRef = useRef(false);

  // Clock mode: always tick live system time
  useEffect(() => {
    if (mode !== 'clock') return;
    const update = () => setSeconds(liveClockSeconds());
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [mode]);

  // Reset when mode or initialSeconds changes
  useEffect(() => {
    stopTick();
    finishedFiredRef.current = false;
    startRef.current = 0;
    totalPausedRef.current = 0;
    pausedAtRef.current = null;
    if (mode === 'clock') {
      setSeconds(liveClockSeconds());
      setStatus('running');
    } else if (mode === 'countup') {
      setSeconds(0);
      setStatus('idle');
    } else {
      setSeconds(initialSeconds);
      setStatus('idle');
      setHybridPhase('countdown');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initialSeconds]);

  const stopTick = () => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const tick = useCallback(() => {
    if (startRef.current === 0) return;
    const elapsedMs = Date.now() - startRef.current - totalPausedRef.current;
    const elapsedSec = Math.floor(elapsedMs / 1000);

    if (mode === 'countup') {
      setSeconds(elapsedSec);
      return;
    }
    if (mode === 'countdown') {
      const remaining = initialSeconds - elapsedSec;
      if (remaining <= 0) {
        setSeconds(0);
        setStatus('completed');
        stopTick();
        if (!finishedFiredRef.current) {
          finishedFiredRef.current = true;
          audioService.play('finish');
        }
      } else {
        setSeconds(remaining);
      }
      return;
    }
    if (mode === 'hybrid') {
      if (hybridPhase === 'countdown') {
        const remaining = initialSeconds - elapsedSec;
        if (remaining <= 0) {
          setHybridPhase('countup');
          setSeconds(0);
          startRef.current = Date.now();
          totalPausedRef.current = 0;
          if (!finishedFiredRef.current) {
            finishedFiredRef.current = true;
            audioService.play('finish');
          }
        } else {
          setSeconds(remaining);
        }
      } else {
        setSeconds(elapsedSec);
      }
    }
  }, [mode, initialSeconds, hybridPhase]);

  useEffect(() => {
    if (status !== 'running' || mode === 'clock') return;
    tick();
    tickRef.current = window.setInterval(tick, 250);
    return stopTick;
  }, [status, mode, tick]);

  const start = () => {
    if (mode === 'clock') return;
    finishedFiredRef.current = false;
    startRef.current = Date.now();
    totalPausedRef.current = 0;
    pausedAtRef.current = null;
    setHybridPhase('countdown');
    setStatus('running');
    audioService.play('start');
  };

  const pause = () => {
    if (status !== 'running' || mode === 'clock') return;
    pausedAtRef.current = Date.now();
    setStatus('paused');
    audioService.play('pause');
  };

  const resume = () => {
    if (status !== 'paused') return;
    if (pausedAtRef.current !== null) {
      totalPausedRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    setStatus('running');
    audioService.play('start');
  };

  const reset = () => {
    stopTick();
    finishedFiredRef.current = false;
    startRef.current = 0;
    totalPausedRef.current = 0;
    pausedAtRef.current = null;
    setHybridPhase('countdown');
    if (mode === 'countup') setSeconds(0);
    else if (mode === 'countdown' || mode === 'hybrid') setSeconds(initialSeconds);
    setStatus('idle');
  };

  return { seconds, status, hybridPhase, start, pause, resume, reset };
}

function liveClockSeconds(): number {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}
