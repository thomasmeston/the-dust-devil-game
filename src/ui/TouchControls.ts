import type { InputManager } from '../game/InputManager';
import { isMobileUi } from '../utils/device';

const JOY_RADIUS = 70;
const MOVE_ZONE_SIZE = JOY_RADIUS * 2;

export class TouchControls {
  private el: HTMLDivElement;
  private moveZone: HTMLDivElement;
  private boostBtn: HTMLButtonElement;
  private activePointerId: number | null = null;
  private knobOffset = { x: 0, y: 0 };
  private visible = false;
  private controlsEnabled = true;

  constructor(
    container: HTMLElement,
    private input: InputManager
  ) {
    this.el = document.createElement('div');
    this.el.className = 'touch-controls';
    this.el.hidden = !isMobileUi();
    this.el.innerHTML = `
      <div class="touch-controls__move-zone" aria-hidden="true"></div>
      <button type="button" class="touch-controls__boost" hidden>Boost</button>
    `;
    container.appendChild(this.el);
    this.moveZone = this.el.querySelector('.touch-controls__move-zone')!;
    this.boostBtn = this.el.querySelector('.touch-controls__boost')!;
    this.injectStyles();
    this.bindMoveZone();
    this.bindBoost();
  }

  setPlayingVisible(visible: boolean): void {
    this.visible = visible;
    this.updateVisibility();
  }

  setEnabled(enabled: boolean): void {
    this.controlsEnabled = enabled;
    if (!enabled) {
      this.resetJoystick();
      this.input.keys.boost = false;
    }
    this.boostBtn.disabled = !enabled;
  }

  setBoostVisible(visible: boolean): void {
    this.boostBtn.hidden = !visible;
  }

  hide(): void {
    this.setPlayingVisible(false);
    this.resetJoystick();
    this.input.keys.boost = false;
  }

  private updateVisibility(): void {
    this.el.hidden = !isMobileUi() || !this.visible;
  }

  private bindMoveZone(): void {
    const onPointerDown = (e: PointerEvent) => {
      if (!this.controlsEnabled || !this.visible) return;
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      this.moveZone.setPointerCapture(e.pointerId);
      this.updateMoveFromEvent(e);
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      this.updateMoveFromEvent(e);
      e.preventDefault();
    };

    const endPointer = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this.resetJoystick();
      e.preventDefault();
    };

    this.moveZone.addEventListener('pointerdown', onPointerDown);
    this.moveZone.addEventListener('pointermove', onPointerMove);
    this.moveZone.addEventListener('pointerup', endPointer);
    this.moveZone.addEventListener('pointercancel', endPointer);
  }

  private bindBoost(): void {
    const press = (e: PointerEvent) => {
      if (!this.controlsEnabled || !this.input.boostEnabled) return;
      this.input.keys.boost = true;
      e.preventDefault();
    };
    const release = () => {
      this.input.keys.boost = false;
    };
    this.boostBtn.addEventListener('pointerdown', press);
    this.boostBtn.addEventListener('pointerup', release);
    this.boostBtn.addEventListener('pointerleave', release);
    this.boostBtn.addEventListener('pointercancel', release);
  }

  private updateMoveFromEvent(e: PointerEvent): void {
    const rect = this.moveZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) {
      dx = (dx / dist) * JOY_RADIUS;
      dy = (dy / dist) * JOY_RADIUS;
    }
    this.knobOffset.x = dx;
    this.knobOffset.y = dy;

    const nx = dx / JOY_RADIUS;
    const nz = dy / JOY_RADIUS;
    this.input.setTouchMove(nx, nz);
  }

  private resetJoystick(): void {
    this.knobOffset.x = 0;
    this.knobOffset.y = 0;
    this.input.setTouchMove(0, 0);
    if (this.activePointerId !== null) {
      try {
        this.moveZone.releasePointerCapture(this.activePointerId);
      } catch {
        /* already released */
      }
      this.activePointerId = null;
    }
  }

  private injectStyles(): void {
    if (document.getElementById('touch-controls-styles')) return;
    const style = document.createElement('style');
    style.id = 'touch-controls-styles';
    style.textContent = `
      .touch-controls {
        position: absolute;
        inset: 0;
        z-index: 120;
        pointer-events: none;
      }
      .touch-controls__move-zone {
        position: absolute;
        left: 50%;
        bottom: max(24px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        width: ${MOVE_ZONE_SIZE}px;
        height: ${MOVE_ZONE_SIZE}px;
        pointer-events: auto;
        touch-action: none;
      }
      .touch-controls__boost {
        position: absolute;
        right: max(16px, env(safe-area-inset-right));
        bottom: max(28px, env(safe-area-inset-bottom));
        min-width: 72px;
        min-height: 48px;
        padding: 12px 18px;
        font-family: inherit;
        font-size: 0.95rem;
        font-weight: 800;
        color: #1a1a2e;
        background: #fbbf24;
        border: 2px solid rgba(255, 255, 255, 0.5);
        border-radius: 12px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        pointer-events: auto;
        touch-action: none;
        cursor: pointer;
      }
      .touch-controls__boost:active {
        transform: scale(0.96);
        background: #f59e0b;
      }
      .touch-controls__boost:disabled {
        opacity: 0.45;
      }
    `;
    document.head.appendChild(style);
  }
}
