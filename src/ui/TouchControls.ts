import type { InputManager } from '../game/InputManager';
import { isMobileUi } from '../utils/device';

const JOY_RADIUS = 70;
const KNOB_RADIUS = 32;
const JOY_BASE_SIZE = JOY_RADIUS * 2;

export class TouchControls {
  private el: HTMLDivElement;
  private joystickBase: HTMLDivElement;
  private joystickKnob: HTMLDivElement;
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
      <div class="touch-controls__joystick" aria-hidden="true">
        <div class="touch-controls__joystick-base">
          <div class="touch-controls__joystick-knob"></div>
        </div>
      </div>
      <button type="button" class="touch-controls__boost" hidden>Boost</button>
    `;
    container.appendChild(this.el);
    this.joystickBase = this.el.querySelector('.touch-controls__joystick-base')!;
    this.joystickKnob = this.el.querySelector('.touch-controls__joystick-knob')!;
    this.boostBtn = this.el.querySelector('.touch-controls__boost')!;
    this.injectStyles();
    this.bindJoystick();
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

  private bindJoystick(): void {
    const onPointerDown = (e: PointerEvent) => {
      if (!this.controlsEnabled || !this.visible) return;
      if (this.activePointerId !== null) return;
      this.activePointerId = e.pointerId;
      this.joystickBase.setPointerCapture(e.pointerId);
      this.updateKnobFromEvent(e);
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      this.updateKnobFromEvent(e);
      e.preventDefault();
    };

    const endPointer = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this.resetJoystick();
      e.preventDefault();
    };

    this.joystickBase.addEventListener('pointerdown', onPointerDown);
    this.joystickBase.addEventListener('pointermove', onPointerMove);
    this.joystickBase.addEventListener('pointerup', endPointer);
    this.joystickBase.addEventListener('pointercancel', endPointer);
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

  private updateKnobFromEvent(e: PointerEvent): void {
    const rect = this.joystickBase.getBoundingClientRect();
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
    this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    const nx = dx / JOY_RADIUS;
    const nz = dy / JOY_RADIUS;
    this.input.setTouchMove(nx, nz);
  }

  private resetJoystick(): void {
    this.knobOffset.x = 0;
    this.knobOffset.y = 0;
    this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    this.input.setTouchMove(0, 0);
    if (this.activePointerId !== null) {
      try {
        this.joystickBase.releasePointerCapture(this.activePointerId);
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
      .touch-controls__joystick {
        position: absolute;
        left: 50%;
        bottom: max(24px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        pointer-events: auto;
        touch-action: none;
      }
      .touch-controls__joystick-base {
        width: ${JOY_BASE_SIZE}px;
        height: ${JOY_BASE_SIZE}px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.16);
        border: 2px solid rgba(255, 255, 255, 0.2);
        position: relative;
        touch-action: none;
      }
      .touch-controls__joystick-knob {
        position: absolute;
        left: 50%;
        top: 50%;
        width: ${KNOB_RADIUS * 2}px;
        height: ${KNOB_RADIUS * 2}px;
        margin-left: -${KNOB_RADIUS}px;
        margin-top: -${KNOB_RADIUS}px;
        border-radius: 50%;
        background: rgba(251, 191, 36, 0.42);
        border: 2px solid rgba(255, 255, 255, 0.3);
        transform: translate(-50%, -50%);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        touch-action: none;
        pointer-events: none;
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
