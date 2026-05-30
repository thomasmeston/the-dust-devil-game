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
    const move = input.getMovementVector();
    let speed = this.speed;
    this.isBoosting = !!(input.keys.boost && input.boostEnabled);
    if (this.isBoosting) speed *= boostMultiplier;

    const prevX = this.position.x;
    const prevZ = this.position.z;

    this.position.x += move.x * speed * dt;
    this.position.z += move.z * speed * dt;
    this.position.x = Math.max(-this.boundsHalfX, Math.min(this.boundsHalfX, this.position.x));
    this.position.z = Math.max(-this.boundsHalfZ, Math.min(this.boundsHalfZ, this.position.z));

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
  }
}
