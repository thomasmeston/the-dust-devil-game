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
  onWindPushback?: (
    prop: AbsorbableProp,
    dirX: number,
    dirZ: number
  ) => void;
  onPop?: (prop: AbsorbableProp) => void;
  onSweat?: (prop: AbsorbableProp) => void;
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
      updateTortoiseHeadMove(prop.mesh, prop.wobblePhase, intensity, prop.retractProgress ?? 0);
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

      // Handle gust of wind pushback for moving objects (animals in levels 1 & 2)
      const isAnimalLvl12 =
        prop.type === 'jackrabbit' ||
        prop.type === 'tortoise' ||
        prop.type === 'snake' ||
        prop.type === 'goat';
      if (isAnimalLvl12 && prop.state === 'grounded') {
        if (prop.pushbackTimer && prop.pushbackTimer > 0) {
          prop.pushbackTimer -= dt;
          const pushSpeed = 12.0;
          prop.position.x += prop.pushbackDir!.x * pushSpeed * dt;
          prop.position.z += prop.pushbackDir!.z * pushSpeed * dt;

          this.clampPropXZ(prop, boundsHalfX + 1.0, boundsHalfZ + 1.0);
          prop.mesh.position.x = prop.position.x;
          prop.mesh.position.z = prop.position.z;

          prop.mesh.rotation.y = Math.atan2(prop.pushbackDir!.x, prop.pushbackDir!.z);

          this.tickCritterMotion(prop, dt, true);
          this.grid.updateProp(prop, prop.oldX, prop.oldZ);
          prop.oldX = prop.position.x;
          prop.oldZ = prop.position.z;
          continue;
        }

        const isOutOfBoundsX = Math.abs(prop.position.x) > boundsHalfX;
        const isOutOfBoundsZ = Math.abs(prop.position.z) > boundsHalfZ;
        if (isOutOfBoundsX || isOutOfBoundsZ) {
          let pushX = 0;
          let pushZ = 0;
          if (prop.position.x > boundsHalfX) pushX = -1;
          else if (prop.position.x < -boundsHalfX) pushX = 1;
          if (prop.position.z > boundsHalfZ) pushZ = -1;
          else if (prop.position.z < -boundsHalfZ) pushZ = 1;

          if (pushX !== 0 || pushZ !== 0) {
            prop.pushbackDir = prop.pushbackDir || new THREE.Vector3();
            prop.pushbackDir.set(pushX, 0, pushZ).normalize();
            prop.pushbackTimer = 0.35;

            prop.wanderHeading = Math.atan2(pushX, pushZ) + (Math.random() - 0.5) * 1.0;

            callbacks.onWindPushback?.(prop, pushX, pushZ);

            prop.pushbackTimer -= dt;
            const pushSpeed = 12.0;
            prop.position.x += prop.pushbackDir.x * pushSpeed * dt;
            prop.position.z += prop.pushbackDir.z * pushSpeed * dt;
            this.clampPropXZ(prop, boundsHalfX + 1.0, boundsHalfZ + 1.0);
            prop.mesh.position.x = prop.position.x;
            prop.mesh.position.z = prop.position.z;
            prop.mesh.rotation.y = Math.atan2(pushX, pushZ);

            this.tickCritterMotion(prop, dt, true);
            this.grid.updateProp(prop, prop.oldX, prop.oldZ);
            prop.oldX = prop.position.x;
            prop.oldZ = prop.position.z;
            continue;
          }
        }
      }

      const distToPlayer = distanceXZ(player.position, prop.position);
      const playerThreatens = distToPlayer < player.pullRadius + 4;

      // Tortoise custom behavior: pop, stop, and hide in shell when chased
      if (prop.type === 'tortoise' && prop.state === 'grounded') {
        prop.tortoiseState = prop.tortoiseState || 'normal';
        prop.retractProgress = prop.retractProgress || 0;

        if (prop.tortoiseState === 'normal') {
          if (playerThreatens) {
            prop.tortoiseState = 'pop';
            prop.tortoisePopTimer = 0.35;
            callbacks.onPop?.(prop);
          }
        }

        if (prop.tortoiseState === 'pop') {
          prop.tortoisePopTimer = (prop.tortoisePopTimer ?? 0) - dt;
          const t = Math.max(0, prop.tortoisePopTimer / 0.35); // 1 down to 0
          const jumpHeight = 0.45; // hop height
          prop.mesh.position.y = Math.sin(t * Math.PI) * jumpHeight;
          
          // scale pop
          const scalePulse = 1.0 + Math.sin(t * Math.PI) * 0.25;
          prop.mesh.scale.setScalar(scalePulse);

          // retract head quickly
          prop.retractProgress = Math.min(1, (prop.retractProgress ?? 0) + dt * 4);

          updateTortoiseHeadMove(prop.mesh, prop.wobblePhase, 0, prop.retractProgress);

          if (prop.tortoisePopTimer <= 0) {
            prop.tortoiseState = 'hiding';
            prop.tortoiseHidingTimer = 2.5;
            prop.mesh.position.y = 0;
            prop.mesh.scale.setScalar(1.0);
          }
        } else if (prop.tortoiseState === 'hiding') {
          prop.retractProgress = Math.min(1, (prop.retractProgress ?? 0) + dt * 4);
          updateTortoiseHeadMove(prop.mesh, prop.wobblePhase, 0, prop.retractProgress);
          
          prop.sweatTimer = (prop.sweatTimer ?? 0) - dt;
          if (prop.sweatTimer <= 0) {
            callbacks.onSweat?.(prop);
            prop.sweatTimer = 0.3 + Math.random() * 0.4;
          }

          // Small shaking effect while hiding/stopped
          const shakeIntensity = 0.025;
          const shakeFreq = 50; // high frequency shiver
          const time = Date.now() * 0.001;
          prop.mesh.position.x = prop.position.x + Math.sin(time * shakeFreq) * shakeIntensity;
          prop.mesh.position.z = prop.position.z + Math.cos(time * shakeFreq * 0.85) * shakeIntensity;
          
          if (playerThreatens) {
            prop.tortoiseHidingTimer = 2.5; // keep hiding as long as player is near
          } else {
            prop.tortoiseHidingTimer = (prop.tortoiseHidingTimer ?? 0) - dt;
            if (prop.tortoiseHidingTimer <= 0) {
              prop.tortoiseState = 'normal';
              // Reset mesh position back to actual position
              prop.mesh.position.x = prop.position.x;
              prop.mesh.position.z = prop.position.z;
            }
          }
        } else {
          // normal peeking out
          prop.retractProgress = Math.max(0, (prop.retractProgress ?? 0) - dt * 2);
        }
      }

      const isTortoiseHiding = prop.type === 'tortoise' && prop.tortoiseState && prop.tortoiseState !== 'normal';

      if (prop.wander && prop.state === 'grounded' && !(prop.flee && playerThreatens) && !isTortoiseHiding) {
        prop.wanderTurnTimer -= dt;
        if (prop.wanderTurnTimer <= 0) {
          prop.wanderHeading = Math.random() * Math.PI * 2;
          prop.wanderTurnTimer = 1.2 + Math.random() * 2.8;
        }
        let heading = prop.wanderHeading;
        if (prop.type === 'snake') {
          heading += Math.sin(prop.wobblePhase * 2.5) * 0.6;
        }
        const vx = Math.cos(heading) * prop.wanderSpeed;
        const vz = Math.sin(heading) * prop.wanderSpeed;
        prop.position.x += vx * dt;
        prop.position.z += vz * dt;
        this.clampPropXZ(prop, boundsHalfX, boundsHalfZ);
        prop.mesh.position.x = prop.position.x;
        prop.mesh.position.z = prop.position.z;
        if (prop.type === 'snake' || prop.type === 'tortoise') {
          prop.mesh.rotation.y = facingAngleY(vx, vz, prop.mesh.rotation.y);
        } else {
          prop.mesh.rotation.y = heading;
        }
        this.emitMovementTrail(
          prop,
          vx,
          vz,
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

      if (prop.flee && prop.state === 'grounded' && playerThreatens && !isTortoiseHiding) {
        directionAway(prop.position, player.position, this.fleeDir);
        let heading = Math.atan2(this.fleeDir.x, this.fleeDir.z);
        if (prop.type === 'snake') {
          heading += Math.sin(prop.wobblePhase * 2.5) * 0.6;
        }
        const fleeVx = Math.sin(heading) * prop.fleeSpeed;
        const fleeVz = Math.cos(heading) * prop.fleeSpeed;
        prop.position.x += fleeVx * dt;
        prop.position.z += fleeVz * dt;
        this.clampPropXZ(prop, boundsHalfX, boundsHalfZ);
        prop.mesh.position.x = prop.position.x;
        prop.mesh.position.z = prop.position.z;
        if (prop.type === 'snake' || prop.type === 'tortoise') {
          prop.mesh.rotation.y = facingAngleY(fleeVx, fleeVz, prop.mesh.rotation.y);
        } else {
          prop.mesh.rotation.y = heading;
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
