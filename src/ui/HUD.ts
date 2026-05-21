import type { LevelDef } from '../types/game';

export class HUD {
  private el: HTMLDivElement;
  private massFill: HTMLDivElement;
  private massLabel: HTMLSpanElement;
  private timerEl: HTMLSpanElement;
  private starsEl: HTMLDivElement;
  private hintEl: HTMLSpanElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-stars"></div>
        <span class="hud-timer">0:00</span>
      </div>
      <div class="hud-mass-wrap">
        <span class="hud-mass-label">City awaits… 0% big enough</span>
        <div class="hud-mass-bar"><div class="hud-mass-fill"></div></div>
      </div>
      <span class="hud-hint"></span>
    `;
    container.appendChild(this.el);
    this.massFill = this.el.querySelector('.hud-mass-fill')!;
    this.massLabel = this.el.querySelector('.hud-mass-label')!;
    this.timerEl = this.el.querySelector('.hud-timer')!;
    this.starsEl = this.el.querySelector('.hud-stars')!;
    this.hintEl = this.el.querySelector('.hud-hint')!;
    this.injectStyles();
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
      .hud-top { display: flex; justify-content: space-between; align-items: center; }
      .hud-stars { font-size: 1.6rem; letter-spacing: 4px; }
      .hud-stars .star { opacity: 0.25; }
      .hud-stars .star.lit { opacity: 1; }
      .hud-timer { font-size: 1.1rem; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); font-weight: 700; }
      .hud-mass-wrap { margin-top: auto; }
      .hud-mass-label { display: block; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); margin-bottom: 6px; font-weight: 700; font-size: 0.95rem; }
      .hud-mass-bar { height: 12px; background: rgba(0,0,0,0.35); border-radius: 6px; overflow: hidden; border: 2px solid rgba(255,255,255,0.3); }
      .hud-mass-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #fbbf24, #f97316); border-radius: 4px; transition: width 0.2s; }
      .hud-hint { position: absolute; bottom: 12%; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.7); font-size: 0.85rem; }
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

    const m = Math.floor(elapsedSec / 60);
    const s = Math.floor(elapsedSec % 60);
    this.timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;

    let stars = 0;
    if (mass >= level.targetMass) stars = 1;
    if (mass >= level.threeStarMass || elapsedSec <= level.threeStarTimeSec) stars = Math.max(stars, 2);
    if (mass >= level.threeStarMass && elapsedSec <= level.threeStarTimeSec) stars = 3;
    this.setStars(stars);
  }

  setStars(n: number): void {
    this.starsEl.innerHTML = [1, 2, 3]
      .map((i) => `<span class="star${i <= n ? ' lit' : ''}">★</span>`)
      .join('');
  }

  setHint(text: string): void {
    this.hintEl.textContent = text;
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
