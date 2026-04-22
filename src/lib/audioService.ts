export type SoundType = 'alert' | 'finish' | 'start' | 'pause';

class AudioService {
  private context: AudioContext | null = null;
  private volume = 0.5;
  private enabled = true;

  private async getContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context;
  }

  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }
  setEnabled(e: boolean) { this.enabled = e; }
  isEnabled() { return this.enabled; }

  async play(type: SoundType): Promise<void> {
    if (!this.enabled || this.volume === 0) return;
    try {
      const ctx = await this.getContext();
      switch (type) {
        case 'alert':  return this.playAlert(ctx);
        case 'finish': return this.playFinish(ctx);
        case 'start':  return this.playStart(ctx);
        case 'pause':  return this.playPause(ctx);
      }
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }

  private playAlert(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  private playFinish(ctx: AudioContext) {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteDuration = 0.2;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + i * noteDuration;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(this.volume * 0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + noteDuration + 0.3);
    });
  }

  private playStart(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(this.volume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  private playPause(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(this.volume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }
}

export const audioService = new AudioService();
