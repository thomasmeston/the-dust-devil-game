import * as THREE from 'three';
import { canAbsorb, MAX_ORBIT_SLOTS } from '../utils/constants';
import { clampXZ } from '../utils/bounds';
import { directionAway, distanceXZ, facingAngleY } from '../utils/math';
import type { DustDevil } from './DustDevil';
import type { AbsorbableProp } from './PropFactory';
import { updateSnakeWiggle, updateTortoiseHeadMove } from './PropFactory';
import { SpatialGrid } from './SpatialGrid';

export interface AbsorptionCallbacks {
  onAbsorb: (prop: AbsorbableProp) => void;
  onBounce: (prop: AbsorbableProp) => void;
  onFleeTrail?: (
    prop: AbsorbableProp,
    velX: number,
    velZ: number,
    variant: 'dust' | 'dirt'
  ) => void;
}

export class AbsorptionSystem {
  private orbiters: AbsorbableProp[] = [];
  private fleeDir = new THREE.Vector3();

  constructor(
    private grid: SpatialGrid,
    private scene: THREE.Scene
  ) {}

  get orbitingProps(): readonly AbsorbableProp[] {
    return this.orbiters;
  }

  private tickCritterMotion(prop: AbsorbableProp, dt: number, moving: boolean): void {
    if (
      prop.state === 'absorbed' ||
      (prop.type !== 'snake' && prop.type !== 'tortoise')
    ) {
      return;
    }

    let intensity = (prop.mesh.userData.moveIntensity as number) ?? 0;
    intensity *= Math.exp(-dt * 10);
    if (moving) intensity = 1;
    prop.mesh.userData.moveIntensity = intensity;

    if (intensity <= 0.04) return;

    const phaseSpeed = prop.type === 'tortoise' ? 2.8 : 3.5;
    prop.wobblePhase += dt * (phaseSpeed + intensity * 3);

    if (prop.type === 'snake') {
      updateSnakeWiggle(prop.mesh, prop.wobblePhase, intensity);
    } else {
      updateTortoiseHeadMove(prop.mesh, prop.wobblePhase, intensity);
    }
  }

  private emitMovementTrail(
    prop: AbsorbableProp,
    velX: number,
    velZ: number,
    callbacks: AbsorptionCallbacks
  ): void {
    if (
      prop.type === 'jackrabbit' ||
      prop.type === 'tortoise' ||
      prop.type === 'snake'
    ) {
      callbacks.onFleeTrail?.(prop, velX, velZ, 'dust');
    } else if (prop.type === 'goat') {
      callbacks.onFleeTrail?.(prop, velX, velZ, 'dirt');
    }
  }

  update(
    player: DustDevil,
    props: AbsorbableProp[],
    dt: number,
    callbacks: AbsorptionCallbacks,
    boundsHalfX: number,
    boundsHalfZ: number
  ): void {
    const nearby = this.grid.queryRadius(player.position, player.pullRadius + 3);

    for (const prop of props) {
      if (prop.state === 'absorbed') continue;

      const distToPlayer = distanceXZ(player.position, prop.position);
      const playerThreatens = distToPlayer < player.pullRadius + 4;

      if (prop.wander && prop.state === 'grounded' && !(prop.flee && playerThreatens)) {
        prop.wanderTurnTimer -= dt;
        if (prop.wanderTurnTimer <= 0) {
          prop.wanderHeading = Math.random() * Math.PI * 2;
          prop.wanderTurnTimer = 1.2 + Math.random() * 2.8;
        }
        prop.position.x += Math.cos(prop.wanderHeading) * prop.wanderSpeed * dt;
        prop.position.z += Math.sin(prop.wanderHeading) * prop.wanderSpeed * dt;
        this.clampPropXZ(prop, boundsHalfX, boundsHalfZ);
        prop.mesh.position.x = prop.position.x;
        prop.mesh.position.z = prop.position.z;
        const vx = Math.cos(prop.wanderHeading) * prop.wanderSpeed;
        const vz = Math.sin(prop.wanderHeading) * prop.wanderSpeed;
        if (prop.type === 'snake' || prop.type === 'tortoise') {
          prop.mesh.rotation.y = facingAngleY(vx, vz, prop.mesh.rotation.y);
        } else {
          prop.mesh.rotation.y = prop.wanderHeading;
        }
        this.emitMovementTrail(
          prop,
          Math.cos(prop.wanderHeading) * prop.wanderSpeed,
          Math.sin(prop.wanderHeading) * prop.wanderSpeed,
          callbacks
        );
        this.tickCritterMotion(
          prop,
          dt,
          prop.type === 'snake' || prop.type === 'tortoise'
        );
        this.grid.updateProp(prop, prop.oldX, prop.oldZ);
        prop.oldX = prop.position.x;
        prop.oldZ = prop.position.z;
      }

      if (prop.flee && prop.state === 'grounded' && playerThreatens) {
        directionAway(prop.position, player.position, this.fleeDir);
        prop.position.x += this.fleeDir.x * prop.fleeSpeed * dt;
        prop.position.z += this.fleeDir.z * prop.fleeSpeed * dt;
        this.clampPropXZ(prop, boundsHalfX, boundsHalfZ);
        prop.mesh.position.x = prop.position.x;
        prop.mesh.position.z = prop.position.z;
        const fleeVx = this.fleeDir.x * prop.fleeSpeed;
        const fleeVz = this.fleeDir.z * prop.fleeSpeed;
        if (prop.type === 'snake' || prop.type === 'tortoise') {
          prop.mesh.rotation.y = facingAngleY(fleeVx, fleeVz, prop.mesh.rotation.y);
        } else {
          prop.mesh.rotation.y = Math.atan2(this.fleeDir.x, this.fleeDir.z);
        }
        this.emitMovementTrail(
          prop,
          fleeVx,
          fleeVz,
          callbacks
        );
        this.tickCritterMotion(
          prop,
          dt,
          prop.type === 'snake' || prop.type === 'tortoise'
        );
        this.grid.updateProp(prop, prop.oldX, prop.oldZ);
        prop.oldX = prop.position.x;
        prop.oldZ = prop.position.z;
      }

      const dist = distanceXZ(player.position, prop.position);

      if (prop.state === 'grounded' || prop.state === 'wobble') {
        if (dist <= player.pullRadius) {
          if (canAbsorb(player.sizeClass, prop.sizeClass)) {
            if (this.orbiters.length < MAX_ORBIT_SLOTS) {
              prop.state = 'orbit';
              prop.mesh.userData.baseY = prop.mesh.position.y;
              if (!this.orbiters.includes(prop)) this.orbiters.push(prop);
            } else {
              this.completeAbsorb(prop, player, callbacks);
            }
          } else if (dist < player.radius + prop.radius) {
            directionAway(prop.position, player.position, this.fleeDir);
            prop.position.x += this.fleeDir.x * 2 * dt;
            prop.position.z += this.fleeDir.z * 2 * dt;
            this.clampPropXZ(prop, boundsHalfX, boundsHalfZ);
            prop.mesh.position.x = prop.position.x;
            prop.mesh.position.z = prop.position.z;
            callbacks.onBounce(prop);
          } else {
            prop.state = 'wobble';
            prop.wobblePhase += dt * 8;
            prop.mesh.rotation.z = Math.sin(prop.wobblePhase) * 0.15;
            this.spiralPullToward(player, prop, dist, dt, boundsHalfX, boundsHalfZ);
          }
        } else if (prop.state === 'wobble' && dist <= player.pullRadius * 1.2) {
          this.spiralPullToward(player, prop, dist, dt, boundsHalfX, boundsHalfZ);
        } else {
          prop.state = 'grounded';
          prop.mesh.rotation.z *= 0.9;
        }
      }
    }

    for (let i = this.orbiters.length - 1; i >= 0; i--) {
      const prop = this.orbiters[i];
      prop.orbitAngle += prop.orbitSpeed * dt * 1.4;
      const r = Math.max(0.15, player.radius * 0.7 + prop.orbitHeight - prop.orbitAngle * 0.08);
      const rise = Math.min(player.radius * 2.5, prop.orbitAngle * 0.35);
      prop.position.set(
        player.position.x + Math.cos(prop.orbitAngle) * r,
        prop.mesh.position.y,
        player.position.z + Math.sin(prop.orbitAngle) * r
      );
      prop.mesh.position.x = prop.position.x;
      prop.mesh.position.z = prop.position.z;
      prop.mesh.position.y = (prop.mesh.userData.baseY as number ?? prop.mesh.position.y) + rise;
      prop.mesh.rotation.y += dt * 6;
      prop.mesh.rotation.x = Math.sin(prop.orbitAngle * 2) * 0.2;

      if (prop.orbitAngle > Math.PI * 1.5 + i * 0.3) {
        this.completeAbsorb(prop, player, callbacks);
        this.orbiters.splice(i, 1);
      }
    }

    void nearby;
  }

  private completeAbsorb(
    prop: AbsorbableProp,
    player: DustDevil,
    callbacks: AbsorptionCallbacks
  ): void {
    if (prop.state === 'absorbed') return;
    prop.state = 'absorbed';
    this.scene.remove(prop.mesh);
    prop.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
    this.grid.remove(prop);
    player.addMass(prop.mass);
    callbacks.onAbsorb(prop);
  }

  clear(): void {
    this.orbiters = [];
  }

  private clampPropXZ(
    prop: AbsorbableProp,
    halfX: number,
    halfZ: number
  ): void {
    const clamped = clampXZ(prop.position.x, prop.position.z, halfX, halfZ);
    prop.position.x = clamped.x;
    prop.position.z = clamped.z;
  }

  /** Draw loose objects inward along a tightening spiral before they enter orbit. */
  private spiralPullToward(
    player: DustDevil,
    prop: AbsorbableProp,
    dist: number,
    dt: number,
    boundsHalfX: number,
    boundsHalfZ: number
  ): void {
    const dx = player.position.x - prop.position.x;
    const dz = player.position.z - prop.position.z;
    const pull = (1 - dist / player.pullRadius) * 3.5 * dt;
    const tangentX = -dz / (dist || 1);
    const tangentZ = dx / (dist || 1);
    prop.wobblePhase += dt * 10;
    prop.position.x += dx * pull * 0.4 + tangentX * pull * 0.6;
    prop.position.z += dz * pull * 0.4 + tangentZ * pull * 0.6;
    this.clampPropXZ(prop, boundsHalfX, boundsHalfZ);
    prop.mesh.position.x = prop.position.x;
    prop.mesh.position.z = prop.position.z;
    prop.mesh.position.y += Math.sin(prop.wobblePhase) * dt * 0.3 + dt * 0.15;
    this.grid.updateProp(prop, prop.oldX, prop.oldZ);
    prop.oldX = prop.position.x;
    prop.oldZ = prop.position.z;
  }
}
