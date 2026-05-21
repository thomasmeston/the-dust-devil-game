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

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  private isDismissKey(code: string): boolean {
    return code === 'Space' || code === 'Enter' || code === 'Escape';
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.isDismissKey(e.code)) {
      this.dismissPressed = true;
      e.preventDefault();
      return;
    }
    if (!this.enabled) return;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
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

  getMovementVector(): { x: number; z: number } {
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
    }
    return { x, z };
  }
}
