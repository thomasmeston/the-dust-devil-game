import { Howl } from 'howler';
import type { StageId } from '../utils/constants';
import { publicUrl } from '../utils/publicUrl';

const STAGE_TRACKS: Partial<Record<StageId, string>> = {
  desert: publicUrl('audio/desert_theme.mp3'),
  mountain: publicUrl('audio/mountain_theme.mp3'),
};

const MUSIC_VOLUME = 0.35;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicHowl: Howl | null = null;

  init(): void {
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
  }

  resume(): void {
    this.ctx?.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.musicHowl) {
      this.musicHowl.volume(this.muted ? 0 : MUSIC_VOLUME);
    }
    if (this.musicGain) {
      this.musicGain.gain.value = this.muted ? 0 : 0.08;
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  playAbsorb(mass: number): void {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 200 + mass * 20;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playUiPop(): void {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = 520;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playExitOpen(): void {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, this.ctx.currentTime + 0.3);
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.stop(this.ctx.currentTime + 0.4);
  }

  startMusic(stageId: StageId, stageIndex: number): void {
    this.stopMusic();
    if (this.muted) return;

    const track = STAGE_TRACKS[stageId];
    if (track) {
      this.musicHowl = new Howl({
        src: [track],
        loop: true,
        volume: MUSIC_VOLUME,
        html5: true,
      });
      this.musicHowl.play();
      return;
    }

    if (!this.ctx) return;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.08;
    this.musicGain.connect(this.ctx.destination);

    this.musicOsc = this.ctx.createOscillator();
    this.musicOsc.type = 'triangle';
    this.musicOsc.frequency.value = 130 + stageIndex * 15;
    this.musicOsc.connect(this.musicGain);
    this.musicOsc.start();
  }

  stopMusic(): void {
    if (this.musicHowl) {
      this.musicHowl.stop();
      this.musicHowl.unload();
      this.musicHowl = null;
    }
    try {
      this.musicOsc?.stop();
    } catch {
      /* already stopped */
    }
    this.musicOsc = null;
    this.musicGain = null;
  }
}
