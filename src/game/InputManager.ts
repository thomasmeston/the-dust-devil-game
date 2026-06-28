const TOUCH_DEAD_ZONE = 0.15;
const MOUSE_STEER_DEAD_ZONE = 0.35;

export class InputManager {
  keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
  };
  enabled = true;
  boostEnabled = false;
  private dismissPressed = false;
  private inventoryPressed = false;
  private escapePressed = false;
  private touchMove = { x: 0, z: 0 };
  private mouseSteering = false;
  private mouseSteerTarget: { x: number; z: number } | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  setTouchMove(x: number, z: number): void {
    this.touchMove.x = x;
    this.touchMove.z = z;
    if (Math.hypot(x, z) > TOUCH_DEAD_ZONE) {
      this.stopMouseSteer();
    }
  }

  setMouseSteering(active: boolean): void {
    this.mouseSteering = active;
    if (!active) this.mouseSteerTarget = null;
  }

  setMouseSteerTarget(x: number, z: number): void {
    this.mouseSteerTarget = { x, z };
  }

  stopMouseSteer(): void {
    this.mouseSteering = false;
    this.mouseSteerTarget = null;
  }

  private clearMovementOverrides(): void {
    this.stopMouseSteer();
  }

  requestInventoryToggle(): void {
    this.inventoryPressed = true;
  }

  requestDismiss(): void {
    this.dismissPressed = true;
  }

  private isDismissKey(code: string): boolean {
    return code === 'Space' || code === 'Enter';
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Escape') {
      this.escapePressed = true;
      e.preventDefault();
      return;
    }
    if (this.isDismissKey(e.code)) {
      this.dismissPressed = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'Tab') {
      this.inventoryPressed = true;
      e.preventDefault();
      return;
    }
    if (!this.enabled) return;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        this.clearMovementOverrides();
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        this.clearMovementOverrides();
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        this.clearMovementOverrides();
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        this.clearMovementOverrides();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        if (this.boostEnabled) this.keys.boost = true;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.boost = false;
        break;
    }
  }

  consumeDismiss(): boolean {
    if (!this.dismissPressed) return false;
    this.dismissPressed = false;
    return true;
  }

  consumeInventoryToggle(): boolean {
    if (!this.inventoryPressed) return false;
    this.inventoryPressed = false;
    return true;
  }

  consumeEscape(): boolean {
    if (!this.escapePressed) return false;
    this.escapePressed = false;
    return true;
  }

  getMovementVector(playerX = 0, playerZ = 0): { x: number; z: number } {
    const touchLen = Math.hypot(this.touchMove.x, this.touchMove.z);
    if (touchLen > TOUCH_DEAD_ZONE) {
      return { x: this.touchMove.x / touchLen, z: this.touchMove.z / touchLen };
    }

    let x = 0;
    let z = 0;
    if (this.keys.forward) z -= 1;
    if (this.keys.backward) z += 1;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;
    const len = Math.sqrt(x * x + z * z);
    if (len > 0) {
      x /= len;
      z /= len;
      return { x, z };
    }

    if (this.mouseSteering && this.mouseSteerTarget) {
      const dx = this.mouseSteerTarget.x - playerX;
      const dz = this.mouseSteerTarget.z - playerZ;
      const dist = Math.hypot(dx, dz);
      if (dist <= MOUSE_STEER_DEAD_ZONE) {
        return { x: 0, z: 0 };
      }
      return { x: dx / dist, z: dz / dist };
    }

    return { x: 0, z: 0 };
  }
}
