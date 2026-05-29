import type { LevelDef } from '../types/game';
import { formatObjectLabel } from '../utils/objectLabel';
import { isMobileUi } from '../utils/device';

export class HUD {
  private el: HTMLDivElement;
  private massFill: HTMLDivElement;
  private massLabel: HTMLSpanElement;
  private totalMassValueEl: HTMLSpanElement;
  private timerEl: HTMLSpanElement;
  private levelEl: HTMLSpanElement;
  private starsEl: HTMLDivElement;
  private hintEl: HTMLSpanElement;
  private pickupNameEl: HTMLSpanElement;
  private inventorySignEl: HTMLDivElement;
  private inventoryKeyEl: HTMLElement;
  private pickupFadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-top-left">
          <span class="hud-level"></span>
          <div class="hud-stars"></div>
        </div>
        <div class="hud-top-right">
          <div class="hud-inventory-sign">
            <kbd class="hud-inventory-sign__key">Tab</kbd>
            <span class="hud-inventory-sign__text">Inventory</span>
          </div>
          <span class="hud-pickup-name"></span>
          <span class="hud-timer">0:00</span>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="hud-mass-wrap">
          <span class="hud-mass-label">City awaits… 0% big enough</span>
          <div class="hud-mass-bar"><div class="hud-mass-fill"></div></div>
        </div>
        <div class="hud-total-mass">
          <span class="hud-total-mass__label">Total mass</span>
          <span class="hud-total-mass__value">0.0</span>
        </div>
      </div>
      <span class="hud-hint"></span>
    `;
    container.appendChild(this.el);
    this.massFill = this.el.querySelector('.hud-mass-fill')!;
    this.massLabel = this.el.querySelector('.hud-mass-label')!;
    this.totalMassValueEl = this.el.querySelector('.hud-total-mass__value')!;
    this.timerEl = this.el.querySelector('.hud-timer')!;
    this.levelEl = this.el.querySelector('.hud-level')!;
    this.starsEl = this.el.querySelector('.hud-stars')!;
    this.hintEl = this.el.querySelector('.hud-hint')!;
    this.pickupNameEl = this.el.querySelector('.hud-pickup-name')!;
    this.inventorySignEl = this.el.querySelector('.hud-inventory-sign')!;
    this.inventoryKeyEl = this.el.querySelector('.hud-inventory-sign__key')!;
    this.injectStyles();
    this.setMobileMode(isMobileUi());
    this.setStars(0);
    this.hide();
  }

  private injectStyles(): void {
    if (document.getElementById('hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'hud-styles';
    style.textContent = `
      .hud {
        position: absolute; inset: 0; pointer-events: none; z-index: 50;
        padding: 20px 24px;
        display: flex; flex-direction: column;
      }
      .hud-top { display: flex; justify-content: space-between; align-items: flex-start; }
      .hud-top-left { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
      .hud-level {
        font-size: 0.95rem; font-weight: 800; color: #fff;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        line-height: 1.2;
      }
      .hud-top-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-height: 2.5rem; }
      .hud-inventory-sign {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 10px;
        background: rgba(0,0,0,0.4);
        border: 2px solid rgba(251, 191, 36, 0.55);
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      }
      .hud-inventory-sign--hidden { display: none; }
      .hud-inventory-sign__key {
        display: inline-block;
        min-width: 2.1rem;
        padding: 3px 7px;
        font-family: inherit;
        font-size: 0.8rem;
        font-weight: 800;
        color: #1a1a2e;
        background: #fbbf24;
        border-radius: 5px;
        border: none;
        line-height: 1.2;
        text-align: center;
      }
      .hud-inventory-sign__text {
        font-size: 0.82rem;
        font-weight: 700;
        color: #fff;
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        white-space: nowrap;
      }
      .hud-pickup-name {
        font-size: 1.05rem; font-weight: 800; color: #fff;
        text-shadow: 0 2px 6px rgba(0,0,0,0.55);
        opacity: 0; pointer-events: none; white-space: nowrap;
      }
      .hud-pickup-name--fade { animation: pickup-name-fade 2.2s ease-out forwards; }
      @keyframes pickup-name-fade {
        0% { opacity: 0; transform: translateY(8px); }
        12% { opacity: 1; transform: translateY(0); }
        65% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-6px); }
      }
      .hud-stars { font-size: 1.6rem; letter-spacing: 4px; color: #fff; line-height: 1; }
      .hud-stars .star { color: #fff; opacity: 0.35; text-shadow: 0 2px 4px rgba(0,0,0,0.45); }
      .hud-stars .star.lit { opacity: 1; }
      .hud-timer { font-size: 1.1rem; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); font-weight: 700; }
      .hud-bottom {
        margin-top: auto;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
      }
      .hud-mass-wrap { flex: 1; min-width: 0; }
      .hud-total-mass {
        flex-shrink: 0;
        text-align: right;
        padding: 8px 12px;
        background: rgba(0,0,0,0.35);
        border: 2px solid rgba(255,255,255,0.25);
        border-radius: 10px;
      }
      .hud-total-mass__label {
        display: block;
        font-size: 0.75rem;
        font-weight: 700;
        color: rgba(255,255,255,0.75);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 2px;
      }
      .hud-total-mass__value {
        display: block;
        font-size: 1.35rem;
        font-weight: 800;
        color: #fbbf24;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        font-variant-numeric: tabular-nums;
      }
      .hud-mass-label { display: block; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); margin-bottom: 6px; font-weight: 700; font-size: 0.95rem; }
      .hud-mass-bar { height: 12px; background: rgba(0,0,0,0.35); border-radius: 6px; overflow: hidden; border: 2px solid rgba(255,255,255,0.3); }
      .hud-mass-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #fbbf24, #f97316); border-radius: 4px; transition: width 0.2s; }
      .hud-hint { position: absolute; bottom: 12%; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.7); font-size: 0.85rem; text-align: center; max-width: 90%; }
      .hud-inventory-sign--mobile {
        pointer-events: auto;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .hud-inventory-sign--mobile:active {
        transform: scale(0.97);
      }
      @media (max-width: 768px), (pointer: coarse) {
        .hud {
          padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
            max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
        }
        .hud-level { font-size: 0.82rem; }
        .hud-mass-label { font-size: 0.85rem; }
        .hud-total-mass { min-width: 5.5rem; padding: 8px 10px; }
        .hud-hint { bottom: 28%; font-size: 0.78rem; }
        .hud-bottom { flex-wrap: wrap; gap: 8px; }
      }
    `;
    document.head.appendChild(style);
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  update(mass: number, level: LevelDef, elapsedSec: number, exitOpen: boolean): void {
    const pct = Math.min(100, Math.round((mass / level.targetMass) * 100));
    this.massFill.style.width = `${pct}%`;
    this.massLabel.textContent =
      exitOpen ? 'Exit portal open! Roll on through.' : `City awaits… ${pct}% big enough`;
    this.totalMassValueEl.textContent = mass.toFixed(1);

    const m = Math.floor(elapsedSec / 60);
    const s = Math.floor(elapsedSec % 60);
    this.timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;

    let stars = 0;
    if (mass >= level.targetMass) stars = 1;
    if (mass >= level.threeStarMass || elapsedSec <= level.threeStarTimeSec) stars = Math.max(stars, 2);
    if (mass >= level.threeStarMass && elapsedSec <= level.threeStarTimeSec) stars = 3;
    this.setStars(stars);
  }

  setLevel(stageNumber: number, stageTitle: string, stageTotal = 5): void {
    this.levelEl.textContent = `Level ${stageNumber} of ${stageTotal} · ${stageTitle}`;
  }

  setStars(n: number): void {
    this.starsEl.innerHTML = [1, 2, 3]
      .map((i) => `<span class="star${i <= n ? ' lit' : ''}">★</span>`)
      .join('');
  }

  setHint(text: string): void {
    this.hintEl.textContent = text;
  }

  setInventorySignVisible(visible: boolean): void {
    this.inventorySignEl.classList.toggle('hud-inventory-sign--hidden', !visible);
  }

  setMobileMode(mobile: boolean): void {
    this.inventorySignEl.classList.toggle('hud-inventory-sign--mobile', mobile);
    this.inventoryKeyEl.textContent = mobile ? 'Tap' : 'Tab';
  }

  onInventoryTap(callback: () => void): void {
    this.inventorySignEl.addEventListener('pointerup', (e) => {
      if (!this.inventorySignEl.classList.contains('hud-inventory-sign--mobile')) return;
      if (this.inventorySignEl.classList.contains('hud-inventory-sign--hidden')) return;
      e.preventDefault();
      e.stopPropagation();
      callback();
    });
  }

  /** Shows the absorbed object's display name in the top-right, then fades out. */
  showPickupLabel(objectType: string): void {
    if (this.pickupFadeTimer) {
      clearTimeout(this.pickupFadeTimer);
      this.pickupFadeTimer = null;
    }
    this.pickupNameEl.textContent = formatObjectLabel(objectType);
    this.pickupNameEl.classList.remove('hud-pickup-name--fade');
    void this.pickupNameEl.offsetWidth;
    this.pickupNameEl.classList.add('hud-pickup-name--fade');
    this.pickupFadeTimer = setTimeout(() => {
      this.pickupNameEl.classList.remove('hud-pickup-name--fade');
      this.pickupNameEl.textContent = '';
      this.pickupFadeTimer = null;
    }, 2200);
  }

  flashAbsorb(mass: number): void {
    const pop = document.createElement('span');
    pop.textContent = `+${mass.toFixed(1)}`;
    pop.style.cssText =
      'position:absolute;left:50%;top:45%;color:#fbbf24;font-weight:800;font-size:1.2rem;text-shadow:0 2px 4px #000;animation:float-up 0.8s ease-out forwards;pointer-events:none;';
    if (!document.getElementById('float-up-kf')) {
      const s = document.createElement('style');
      s.id = 'float-up-kf';
      s.textContent = `@keyframes float-up { to { transform: translateY(-40px); opacity: 0; } }`;
      document.head.appendChild(s);
    }
    this.el.appendChild(pop);
    setTimeout(() => pop.remove(), 800);
  }
}
