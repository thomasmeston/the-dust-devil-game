import { Howl } from 'howler';
import type { StageId } from '../utils/constants';
import { clamp } from '../utils/constants';
import { publicUrl } from '../utils/publicUrl';

const STAGE_TRACKS: Record<StageId, string> = {
  desert: publicUrl('audio/desert_theme.mp3'),
  mountain: publicUrl('audio/mountain_theme.mp3'),
  forest: publicUrl('audio/forest_theme.mp3'),
  suburbs: publicUrl('audio/suburbs_theme.mp3'),
  downtown: publicUrl('audio/downtown_theme.mp3'),
};

const DEFAULT_MUSIC_VOLUME = 0.35;
const DEFAULT_SFX_VOLUME = 1;
const MUSIC_VOLUME_KEY = 'dust-devil-music-volume';
const MUSIC_MUTED_KEY = 'dust-devil-music-muted';
const SFX_VOLUME_KEY = 'dust-devil-sfx-volume';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private sfxVolume = DEFAULT_SFX_VOLUME;
  private musicMuted = false;
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicHowl: Howl | null = null;

  init(): void {
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
    this.loadMusicSettings();
  }

  private loadMusicSettings(): void {
    try {
      const storedVolume = localStorage.getItem(MUSIC_VOLUME_KEY);
      if (storedVolume != null) {
        const parsed = Number.parseFloat(storedVolume);
        if (Number.isFinite(parsed)) {
          this.musicVolume = clamp(parsed, 0, 1);
        }
      }
      this.musicMuted = localStorage.getItem(MUSIC_MUTED_KEY) === '1';
      const storedSfx = localStorage.getItem(SFX_VOLUME_KEY);
      if (storedSfx != null) {
        const parsed = Number.parseFloat(storedSfx);
        if (Number.isFinite(parsed)) {
          this.sfxVolume = clamp(parsed, 0, 1);
        }
      }
    } catch {
      /* private browsing / blocked storage */
    }
  }

  private saveMusicSettings(): void {
    try {
      localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume));
      localStorage.setItem(MUSIC_MUTED_KEY, this.musicMuted ? '1' : '0');
      localStorage.setItem(SFX_VOLUME_KEY, String(this.sfxVolume));
    } catch {
      /* private browsing / blocked storage */
    }
  }

  private effectiveMusicVolume(): number {
    if (this.muted || this.musicMuted) return 0;
    return this.musicVolume;
  }

  private sfxGain(base: number): number {
    if (this.muted) return 0;
    return base * this.sfxVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = clamp(volume, 0, 1);
    try {
      localStorage.setItem(SFX_VOLUME_KEY, String(this.sfxVolume));
    } catch {
      /* private browsing / blocked storage */
    }
  }

  private applyMusicVolume(): void {
    if (this.musicHowl) {
      this.musicHowl.volume(this.effectiveMusicVolume());
    }
    if (this.musicGain) {
      this.musicGain.gain.value = this.muted ? 0 : 0.08;
    }
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clamp(volume, 0, 1);
    this.saveMusicSettings();
    this.applyMusicVolume();
  }

  isMusicMuted(): boolean {
    return this.musicMuted;
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    this.saveMusicSettings();
    this.applyMusicVolume();
  }

  toggleMusicMuted(): boolean {
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  resume(): void {
    this.ctx?.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyMusicVolume();
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
    gain.gain.value = this.sfxGain(0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playUfoAbsorb(): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    // Retro space laser / warp slide
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.85);

    // LFO modulation to add spacey warble
    lfo.type = 'sine';
    lfo.frequency.value = 35;
    lfoGain.gain.value = 160;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(this.sfxGain(0.12), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    lfo.start(now);
    osc.start(now);

    lfo.stop(now + 0.85);
    osc.stop(now + 0.85);
  }

  playWindGust(): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const duration = 0.6;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.0;
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(150, now + duration);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.0, now);
    gainNode.gain.linearRampToValueAtTime(this.sfxGain(0.55), now + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    noiseNode.start(now);
    noiseNode.stop(now + duration);
  }

  playUiPop(volumeMultiplier = 1.0): void {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = 520;
    gain.gain.value = this.sfxGain(0.08 * volumeMultiplier);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playTortoiseRetract(): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const duration = 0.35;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + duration);

    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(this.sfxGain(0.35), now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  playExitOpen(): void {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, this.ctx.currentTime + 0.3);
    gain.gain.value = this.sfxGain(0.1);
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
    this.musicHowl = new Howl({
      src: [track],
      loop: true,
      volume: this.effectiveMusicVolume(),
      html5: true,
    });
    this.musicHowl.play();
    void stageIndex;
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
