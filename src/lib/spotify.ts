import { useEffect, useState } from 'react';

export type SpotifyEntityType = 'track' | 'album' | 'playlist' | 'artist' | 'episode' | 'show';

export interface ParsedSpotify {
  type: SpotifyEntityType;
  id: string;
}

const URL_RE = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{22})(?:[/?#].*)?$/i;
const URI_RE = /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{22})$/i;

export function parseSpotifyUrl(input: string): ParsedSpotify | null {
  if (!input) return null;
  const trimmed = input.trim();
  const m = trimmed.match(URL_RE) || trimmed.match(URI_RE);
  if (!m) return null;
  return { type: m[1].toLowerCase() as SpotifyEntityType, id: m[2] };
}

export function buildEmbedSrc(parsed: ParsedSpotify, theme: 'light' | 'dark' = 'dark'): string {
  const t = theme === 'dark' ? '0' : '1';
  return `https://open.spotify.com/embed/${parsed.type}/${parsed.id}?utm_source=generator&theme=${t}`;
}

const ENABLED_KEY = 'qm-spotify-enabled';
const URL_KEY = 'qm-spotify-url';
const SIZE_KEY = 'qm-spotify-size';
const EVENT_NAME = 'qm-spotify-change';

export type SpotifySize = 'compact' | 'standard';
export const SIZE_HEIGHTS: Record<SpotifySize, number> = {
  compact: 80,
  standard: 152,
};

function readBool(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

function readStr(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}

function notify() {
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useSpotifyEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readBool(ENABLED_KEY));
  useEffect(() => {
    const sync = () => setEnabled(readBool(ENABLED_KEY));
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const update = (v: boolean) => {
    try { localStorage.setItem(ENABLED_KEY, v ? '1' : '0'); } catch {}
    setEnabled(v);
    notify();
  };
  return [enabled, update];
}

export function useSpotifySize(): [SpotifySize, (v: SpotifySize) => void] {
  const read = (): SpotifySize => {
    try {
      const v = localStorage.getItem(SIZE_KEY);
      if (v === 'standard') return 'standard';
      if (v === 'full') return 'standard';
      return 'compact';
    } catch { return 'compact'; }
  };
  const [size, setSize] = useState<SpotifySize>(read);
  useEffect(() => {
    const sync = () => setSize(read());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const update = (v: SpotifySize) => {
    try { localStorage.setItem(SIZE_KEY, v); } catch {}
    setSize(v);
    notify();
  };
  return [size, update];
}

export function useSpotifyUrl(): [string, (v: string) => void] {
  const [url, setUrl] = useState<string>(() => readStr(URL_KEY));
  useEffect(() => {
    const sync = () => setUrl(readStr(URL_KEY));
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const update = (v: string) => {
    try {
      if (v) localStorage.setItem(URL_KEY, v);
      else localStorage.removeItem(URL_KEY);
    } catch {}
    setUrl(v);
    notify();
  };
  return [url, update];
}
