import type { AudioManager } from '../game/AudioManager';
import { hintsForDevice } from '../utils/device';

export class PauseMenu {
  private el: HTMLDivElement;
  private volumeSlider: HTMLInputElement;
  private volumeLabel: HTMLSpanElement;
  private muteBtn: HTMLButtonElement;
  private open = false;
  private onOpenChange?: (open: boolean) => void;

  constructor(
    container: HTMLElement,
    private audio: AudioManager,
    onOpenChange?: (open: boolean) => void
  ) {
    this.onOpenChange = onOpenChange;
    this.el = document.createElement('div');
    this.el.className = 'pause-menu';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="pause-menu__card">
        <div class="pause-menu__header">
          <h3 class="pause-menu__title">Paused</h3>
          <button type="button" class="pause-menu__close" aria-label="Resume">×</button>
        </div>
        <div class="pause-menu__section">
          <label class="pause-menu__label" for="pause-music-volume">Music volume</label>
          <div class="pause-menu__volume-row">
            <input type="range" id="pause-music-volume" class="pause-menu__slider"
              min="0" max="100" step="1" value="35" />
            <span class="pause-menu__volume-value">35%</span>
          </div>
          <button type="button" class="pause-menu__mute">Mute music</button>
        </div>
        <button type="button" class="pause-menu__resume">Resume</button>
        <p class="pause-menu__hint">Esc to resume</p>
      </div>
    `;
    container.appendChild(this.el);
    this.volumeSlider = this.el.querySelector('#pause-music-volume')!;
    this.volumeLabel = this.el.querySelector('.pause-menu__volume-value')!;
    this.muteBtn = this.el.querySelector('.pause-menu__mute')!;

    this.el.querySelector('.pause-menu__close')!.addEventListener('click', () => {
      this.setOpen(false);
    });
    this.el.querySelector('.pause-menu__resume')!.addEventListener('click', () => {
      this.setOpen(false);
    });
    this.volumeSlider.addEventListener('input', () => this.onVolumeInput());
    this.muteBtn.addEventListener('click', () => this.onMuteClick());
    this.injectStyles();
    this.syncControls();
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.syncControls();
    this.setOpen(true);
  }

  hide(): void {
    this.setOpen(false);
  }

  toggle(): boolean {
    if (this.open) this.hide();
    else this.show();
    return this.open;
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.el.hidden = !open;
    this.el.classList.toggle('pause-menu--open', open);
    this.onOpenChange?.(open);
  }

  private syncControls(): void {
    const pct = Math.round(this.audio.getMusicVolume() * 100);
    this.volumeSlider.value = String(pct);
    this.volumeLabel.textContent = `${pct}%`;
    this.updateMuteLabel();
    this.el.querySelector('.pause-menu__hint')!.textContent = hintsForDevice().pauseClose;
  }

  private onVolumeInput(): void {
    const pct = Number(this.volumeSlider.value);
    this.audio.setMusicVolume(pct / 100);
    this.volumeLabel.textContent = `${pct}%`;
    if (pct > 0 && this.audio.isMusicMuted()) {
      this.audio.setMusicMuted(false);
    }
    this.updateMuteLabel();
  }

  private onMuteClick(): void {
    this.audio.toggleMusicMuted();
    this.updateMuteLabel();
  }

  private updateMuteLabel(): void {
    this.muteBtn.textContent = this.audio.isMusicMuted() ? 'Unmute music' : 'Mute music';
    const pct = Math.round(this.audio.getMusicVolume() * 100);
    this.volumeLabel.textContent = this.audio.isMusicMuted() ? 'Muted' : `${pct}%`;
  }

  private injectStyles(): void {
    if (document.getElementById('pause-menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'pause-menu-styles';
    style.textContent = `
      .pause-menu {
        position: absolute; inset: 0; z-index: 125;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        pointer-events: none;
        background: rgba(15, 15, 28, 0.55);
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .pause-menu--open { opacity: 1; pointer-events: auto; }
      .pause-menu__card {
        width: min(320px, 92vw);
        background: rgba(26, 26, 46, 0.98);
        border: 2px solid rgba(251, 191, 36, 0.45);
        border-radius: 14px;
        padding: 18px 20px 16px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.45);
        transform: scale(0.96);
        transition: transform 0.2s ease;
      }
      .pause-menu--open .pause-menu__card { transform: scale(1); }
      .pause-menu__header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 16px;
      }
      .pause-menu__title {
        margin: 0; font-size: 1.35rem; font-weight: 800; color: #fbbf24;
      }
      .pause-menu__close {
        background: transparent; border: none; color: #94a3b8;
        font-size: 1.75rem; line-height: 1; cursor: pointer; padding: 0 4px;
      }
      .pause-menu__section { margin-bottom: 16px; }
      .pause-menu__label {
        display: block; font-size: 0.85rem; font-weight: 700;
        color: rgba(255,255,255,0.85); margin-bottom: 10px;
      }
      .pause-menu__volume-row {
        display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
      }
      .pause-menu__slider {
        flex: 1; height: 6px; accent-color: #fbbf24; cursor: pointer;
      }
      .pause-menu__volume-value {
        min-width: 3.5rem; text-align: right; font-weight: 700;
        color: #e2e8f0; font-variant-numeric: tabular-nums;
      }
      .pause-menu__mute {
        width: 100%; padding: 10px 14px;
        font-family: inherit; font-size: 0.95rem; font-weight: 700;
        color: #e2e8f0; background: rgba(255,255,255,0.08);
        border: 2px solid rgba(255,255,255,0.2); border-radius: 10px;
        cursor: pointer;
      }
      .pause-menu__mute:active { transform: scale(0.98); }
      .pause-menu__resume {
        width: 100%; padding: 12px 16px;
        font-family: inherit; font-size: 1rem; font-weight: 800;
        color: #1a1a2e; background: #fbbf24; border: none;
        border-radius: 10px; cursor: pointer;
      }
      .pause-menu__resume:active { transform: scale(0.98); }
      .pause-menu__hint {
        margin: 12px 0 0; text-align: center; font-size: 0.82rem;
        color: rgba(255,255,255,0.55);
      }
    `;
    document.head.appendChild(style);
  }
}
