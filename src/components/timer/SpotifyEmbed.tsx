import { X } from 'lucide-react';
import { buildEmbedSrc, ParsedSpotify, SIZE_HEIGHTS, SpotifySize } from '../../lib/spotify';

interface SpotifyEmbedProps {
  parsed: ParsedSpotify;
  size: SpotifySize;
  onClose: () => void;
  className?: string;
}

export function SpotifyEmbed({ parsed, size, onClose, className = '' }: SpotifyEmbedProps) {
  const src = buildEmbedSrc(parsed, 'dark');
  const height = SIZE_HEIGHTS[size];
  const width = size === 'compact' ? 360 : 420;
  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-emerald-500/20 bg-[var(--c-surface)] ${className}`}
      style={{ width: `${width}px`, boxShadow: '0 8px 32px -12px rgba(16,185,129,0.25), 0 4px 16px -8px rgba(0,0,0,0.4)' }}
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
        height={height}
        frameBorder={0}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{ display: 'block', border: 0 }}
      />
    </div>
  );
}
