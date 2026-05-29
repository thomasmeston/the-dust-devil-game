import { computeStars } from '../utils/math';
import type { LevelDef } from '../types/game';
import { STAGE_FLAVOR, STAGE_TITLES, type StageId } from '../utils/constants';
import { hintsForDevice, isMobileUi } from '../utils/device';

export class UIManager {
  private overlay: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'ui-overlay';
    container.appendChild(this.overlay);
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById('ui-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'ui-overlay-styles';
    style.textContent = `
      .ui-overlay {
        position: absolute; inset: 0; z-index: 200;
        pointer-events: none;
      }
      .ui-overlay .screen {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        background: rgba(26, 26, 46, 0.92);
        pointer-events: auto;
        text-align: center;
        padding: 2rem;
        animation: fade-in 0.4s ease;
      }
      @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      .screen h1 { font-size: 2.8rem; color: #fbbf24; margin-bottom: 0.5rem; font-weight: 800; }
      .screen h2 { font-size: 1.8rem; color: #fff; margin-bottom: 1rem; }
      .screen p { color: #cbd5e1; font-size: 1.1rem; max-width: 520px; line-height: 1.6; margin-bottom: 1.5rem; font-style: italic; }
      .screen .btn {
        background: #fbbf24; color: #1a1a2e; border: none;
        padding: 14px 36px; font-size: 1.1rem; font-weight: 800;
        border-radius: 12px; cursor: pointer; font-family: inherit;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .screen .btn:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(251,191,36,0.4); }
      @media (max-width: 768px), (pointer: coarse) {
        .screen { padding: max(1.25rem, env(safe-area-inset-top)) 1rem max(1.25rem, env(safe-area-inset-bottom)); }
        .screen h1 { font-size: clamp(1.6rem, 8vw, 2.4rem); }
        .screen h2 { font-size: clamp(1.2rem, 5vw, 1.6rem); }
        .screen p { font-size: 1rem; }
        .screen .btn {
          width: 100%;
          max-width: 280px;
          min-height: 48px;
        }
        .stage-intro-card { pointer-events: auto; touch-action: manipulation; cursor: pointer; }
      }
      .screen .stars-big { font-size: 2.5rem; letter-spacing: 8px; margin: 1rem 0; }
      .screen .stars-big .lit { color: #fbbf24; }
      .screen .stars-big span { color: #475569; }
      .screen .controls { color: #94a3b8; font-size: 0.9rem; margin-top: 1rem; font-style: normal; }
      .screen .credits-block { margin: 1.5rem 0 1rem; }
      .screen .credits-heading {
        color: #fbbf24; font-size: 1rem; font-weight: 800;
        letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 0.75rem;
        font-style: normal;
      }
      .screen .credits-names {
        list-style: none; padding: 0; margin: 0;
        font-size: 1.15rem; color: #e2e8f0; line-height: 1.8; font-style: normal;
      }
      .screen .credits-names li { font-weight: 700; }
      .stage-intro-card {
        position: absolute; inset: 0; z-index: 150;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: rgba(26,26,46,0.75); pointer-events: none;
        animation: fade-in 0.3s ease;
      }
      .stage-intro-card h2 { color: #fbbf24; font-size: 2rem; }
      .stage-intro-card p { color: #e2e8f0; font-size: 1.1rem; font-style: italic; }
    `;
    document.head.appendChild(style);
  }

  showTitle(onPlay: () => void, onMute: () => boolean): void {
    this.clear();
    const screen = document.createElement('div');
    screen.className = 'screen';
    screen.innerHTML = `
      <h1>The Little Dust Devil</h1>
      <p>Somewhere in the wide quiet desert, a very small whirlwind woke up with a very big dream.</p>
      <button class="btn" id="btn-play">Play</button>
      <button class="btn" id="btn-mute" style="margin-top:12px;background:#475569;color:#fff;">Sound: On</button>
      <p class="controls">${hintsForDevice().title}</p>
    `;
    this.overlay.appendChild(screen);
    screen.querySelector('#btn-play')!.addEventListener('click', () => {
      this.clear();
      onPlay();
    });
    const muteBtn = screen.querySelector('#btn-mute') as HTMLButtonElement;
    muteBtn.addEventListener('click', () => {
      const muted = onMute();
      muteBtn.textContent = muted ? 'Sound: Off' : 'Sound: On';
    });
  }

  showStageIntro(stageId: StageId, onDone: () => void): void {
    const card = document.createElement('div');
    card.className = 'stage-intro-card';
    card.innerHTML = `
      <h2>${STAGE_TITLES[stageId]}</h2>
      <p>${STAGE_FLAVOR[stageId]}</p>
    `;
    this.overlay.appendChild(card);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      card.remove();
      onDone();
    };
    const timer = window.setTimeout(finish, 2200);
    if (isMobileUi()) {
      card.addEventListener('pointerup', () => {
        window.clearTimeout(timer);
        finish();
      });
    }
  }

  showStageComplete(
    level: LevelDef,
    mass: number,
    elapsedSec: number,
    onContinue: () => void
  ): void {
    this.clear();
    const stars = computeStars(
      mass,
      elapsedSec,
      level.targetMass,
      level.threeStarMass,
      level.threeStarTimeSec
    );
    const screen = document.createElement('div');
    screen.className = 'screen';
    screen.innerHTML = `
      <h2>${level.name} — Complete!</h2>
      <div class="stars-big">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'lit' : ''}">★</span>`).join('')}</div>
      <p>Mass: ${mass.toFixed(1)} · Time: ${Math.floor(elapsedSec / 60)}:${Math.floor(elapsedSec % 60).toString().padStart(2, '0')}</p>
      <button class="btn" id="btn-continue">Continue</button>
    `;
    this.overlay.appendChild(screen);
    screen.querySelector('#btn-continue')!.addEventListener('click', () => {
      this.clear();
      onContinue();
    });
  }

  showCredits(
    ending: string,
    credits: string[],
    musicBy: string | undefined,
    onRestart: () => void
  ): void {
    this.clear();
    const screen = document.createElement('div');
    screen.className = 'screen';
    const lines = ending.split('\n').map((l) => `<p>${l}</p>`).join('');
    const madeByHtml =
      credits.length > 0
        ? `<div class="credits-block">
            <p class="credits-heading">Made by</p>
            <ul class="credits-names">${credits.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>
          </div>`
        : '';
    const musicByHtml = musicBy
      ? `<div class="credits-block">
          <p class="credits-heading">Music by</p>
          <ul class="credits-names"><li>${escapeHtml(musicBy)}</li></ul>
        </div>`
      : '';
    const creditsHtml = `${madeByHtml}${musicByHtml}`;
    screen.innerHTML = `
      <h1>The End</h1>
      ${lines}
      ${creditsHtml}
      <button class="btn" id="btn-restart">Play Again</button>
    `;
    this.overlay.appendChild(screen);
    screen.querySelector('#btn-restart')!.addEventListener('click', () => {
      this.clear();
      onRestart();
    });
  }

  clear(): void {
    this.overlay.innerHTML = '';
  }

  getOverlay(): HTMLElement {
    return this.overlay;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
