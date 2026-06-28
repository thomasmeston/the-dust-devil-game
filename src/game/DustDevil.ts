import * as THREE from 'three';
import {
  BASE_RADIUS,
  BASE_SPEED,
  GROWTH_FACTOR,
  PULL_RADIUS_MULT,
  massToRadius,
  playerSizeClassFromMass,
  type SizeClass,
} from '../utils/constants';
import type { InputManager } from './InputManager';
import { DustDevilVortex } from './DustDevilVortex';

export class DustDevil {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly vortex: DustDevilVortex;
  mass = 0;
  radius = BASE_RADIUS;
  sizeClass: SizeClass = 'tiny';
  minSizeClass: SizeClass = 'tiny';
  growthFactor = GROWTH_FACTOR;
  private boundsHalfX = 40;
  private boundsHalfZ = 40;
  private lastMoveX = 0;
  private lastMoveZ = 0;
  private isBoosting = false;

  pushbackTimer = 0;
  pushbackCooldown = 0;
  readonly pushbackDir = new THREE.Vector3();
  justTriggeredPushback = false;

  constructor() {
    this.vortex = new DustDevilVortex();
    this.group.add(this.vortex.group);
  }

  get pullRadius(): number {
    return this.radius * PULL_RADIUS_MULT;
  }

  get speed(): number {
    const penalty = this.radius * 0.15;
    return Math.max(BASE_SPEED * 0.4, BASE_SPEED - penalty);
  }

  get moveSpeed(): number {
    return Math.sqrt(this.lastMoveX * this.lastMoveX + this.lastMoveZ * this.lastMoveZ);
  }

  setBounds(halfWidth: number, halfDepth: number): void {
    this.boundsHalfX = halfWidth;
    this.boundsHalfZ = halfDepth;
  }

  reset(x: number, z: number, minClass: SizeClass, growthFactor?: number): void {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.mass = 0;
    this.minSizeClass = minClass;
    this.sizeClass = minClass;
    this.growthFactor = growthFactor ?? GROWTH_FACTOR;
    this.radius = massToRadius(0, this.growthFactor);
    this.updateVisuals();
    this.group.position.copy(this.position);
  }

  addMass(amount: number): void {
    this.mass += amount;
    this.radius = massToRadius(this.mass, this.growthFactor);
    this.sizeClass = playerSizeClassFromMass(this.mass, this.minSizeClass);
    this.updateVisuals();
  }

  private updateVisuals(): void {
    this.vortex.setScale(this.radius);
  }

  update(input: InputManager, dt: number, boostMultiplier = 1.5): void {
    this.justTriggeredPushback = false;
    this.pushbackCooldown = Math.max(0, this.pushbackCooldown - dt);

    if (this.pushbackTimer > 0) {
      this.pushbackTimer -= dt;
      const windPushSpeed = 16.0;
      const prevX = this.position.x;
      const prevZ = this.position.z;

      this.position.x += this.pushbackDir.x * windPushSpeed * dt;
      this.position.z += this.pushbackDir.z * windPushSpeed * dt;

      // Hard safety clamp to prevent escaping completely (e.g. clipping through mountains)
      const hardLimitX = this.boundsHalfX + 2.5;
      const hardLimitZ = this.boundsHalfZ + 2.5;
      this.position.x = Math.max(-hardLimitX, Math.min(hardLimitX, this.position.x));
      this.position.z = Math.max(-hardLimitZ, Math.min(hardLimitZ, this.position.z));

      if (dt > 0) {
        this.velocity.set(
          (this.position.x - prevX) / dt,
          0,
          (this.position.z - prevZ) / dt
        );
      }
      this.lastMoveX = this.pushbackDir.x * windPushSpeed;
      this.lastMoveZ = this.pushbackDir.z * windPushSpeed;

      this.vortex.update(dt, this.velocity.x, this.velocity.z, windPushSpeed, false);
      this.group.position.copy(this.position);
      return;
    }

    const move = input.getMovementVector(this.position.x, this.position.z);
    let speed = this.speed;
    this.isBoosting = !!(input.keys.boost && input.boostEnabled);
    if (this.isBoosting) speed *= boostMultiplier;

    // Apply speed penalty if out of bounds and trying to move further out
    let speedPenalty = 1.0;
    const isOutOfBoundsX = Math.abs(this.position.x) > this.boundsHalfX;
    const isOutOfBoundsZ = Math.abs(this.position.z) > this.boundsHalfZ;
    if (isOutOfBoundsX || isOutOfBoundsZ) {
      const movingOutX = (this.position.x > this.boundsHalfX && move.x > 0) || (this.position.x < -this.boundsHalfX && move.x < 0);
      const movingOutZ = (this.position.z > this.boundsHalfZ && move.z > 0) || (this.position.z < -this.boundsHalfZ && move.z < 0);
      if (movingOutX || movingOutZ) {
        speedPenalty = 0.35; // 65% speed reduction when pushing against boundaries
      }
    }
    speed *= speedPenalty;

    const prevX = this.position.x;
    const prevZ = this.position.z;

    this.position.x += move.x * speed * dt;
    this.position.z += move.z * speed * dt;

    // Apply soft spring restoration force towards the playable boundaries
    const springK = 9.0;
    if (this.position.x > this.boundsHalfX) {
      const excess = this.position.x - this.boundsHalfX;
      this.position.x -= excess * springK * dt;
    } else if (this.position.x < -this.boundsHalfX) {
      const excess = -this.boundsHalfX - this.position.x;
      this.position.x += excess * springK * dt;
    }

    if (this.position.z > this.boundsHalfZ) {
      const excess = this.position.z - this.boundsHalfZ;
      this.position.z -= excess * springK * dt;
    } else if (this.position.z < -this.boundsHalfZ) {
      const excess = -this.boundsHalfZ - this.position.z;
      this.position.z += excess * springK * dt;
    }

    // Hard safety clamp to prevent escaping completely (e.g. clipping through mountains)
    const hardLimitX = this.boundsHalfX + 2.5;
    const hardLimitZ = this.boundsHalfZ + 2.5;
    this.position.x = Math.max(-hardLimitX, Math.min(hardLimitX, this.position.x));
    this.position.z = Math.max(-hardLimitZ, Math.min(hardLimitZ, this.position.z));

    if (dt > 0) {
      this.velocity.set(
        (this.position.x - prevX) / dt,
        0,
        (this.position.z - prevZ) / dt
      );
    }

    this.lastMoveX = move.x * speed;
    this.lastMoveZ = move.z * speed;

    this.vortex.update(dt, this.velocity.x, this.velocity.z, this.moveSpeed, this.isBoosting);
    this.group.position.copy(this.position);

    // Check if player crossed playable bounds to trigger a Gust of Wind pushback
    if (this.pushbackCooldown <= 0) {
      let pushX = 0;
      let pushZ = 0;
      if (this.position.x > this.boundsHalfX) pushX = -1;
      else if (this.position.x < -this.boundsHalfX) pushX = 1;
      if (this.position.z > this.boundsHalfZ) pushZ = -1;
      else if (this.position.z < -this.boundsHalfZ) pushZ = 1;

      if (pushX !== 0 || pushZ !== 0) {
        this.pushbackDir.set(pushX, 0, pushZ).normalize();
        this.pushbackTimer = 0.4;
        this.pushbackCooldown = 1.5;
        this.justTriggeredPushback = true;
        this.velocity.copy(this.pushbackDir).multiplyScalar(16.0);
      }
    }
  }
}
