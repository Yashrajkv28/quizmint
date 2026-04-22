import { X } from 'lucide-react';
import { buildEmbedSrc, ParsedSpotify } from '../../lib/spotify';

type Theme = 'light' | 'dark';

interface SpotifyEmbedProps {
  parsed: ParsedSpotify;
  theme: Theme;
  onClose: () => void;
}

export function SpotifyEmbed({ parsed, theme, onClose }: SpotifyEmbedProps) {
  const src = buildEmbedSrc(parsed, theme);
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[360px] rounded-2xl overflow-hidden border border-emerald-500/20 bg-[var(--c-surface)]"
      style={{ boxShadow: '0 8px 32px -12px rgba(16,185,129,0.25), 0 4px 16px -8px rgba(0,0,0,0.4)' }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close music"
        className="absolute top-1 left-1/2 -translate-x-1/2 z-10 p-1 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
      <iframe
        title="Spotify mini player"
        src={src}
        width="100%"
        height="80"
        frameBorder={0}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{ display: 'block', border: 0 }}
      />
    </div>
  );
}
