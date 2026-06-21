import * as THREE from 'three';
import { distanceXZ } from '../utils/math';
import type { DustDevil } from './DustDevil';

const FLY_HEIGHT = 28;
const SPEED = 14;
const WAYPOINT_REACH = 2.5;
const MARGIN = 4;
const UFO_RENDER_ORDER = 20;

export type UfoState = 'inactive' | 'spawning' | 'patrolling' | 'exiting' | 'absorbing' | 'absorbed';

function ufoMaterial(color: number): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({ color });
  mat.fog = false;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -4;
  mat.polygonOffsetUnits = -4;
  return mat;
}

function addUfoPart(group: THREE.Group, mesh: THREE.Mesh): void {
  mesh.frustumCulled = false;
  mesh.renderOrder = UFO_RENDER_ORDER;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
}

/** Flying saucer that patrols the desert stage sky dynamically and can be absorbed when player is large. */
export class DesertUfo {
  private group = new THREE.Group();
  private lights: THREE.Mesh[] = [];
  private lightPhase = 0;
  private active = false;
  private state: UfoState = 'inactive';
  private shadowMesh: THREE.Mesh | null = null;

  private halfX = 0;
  private halfZ = 0;
  private target = new THREE.Vector3();
  private velocity = new THREE.Vector3();

  private cooldownTimer = 15; // Initial delay before first entry
  private waypointsPatrolled = 0;
  private targetPatrolCount = 0;

  // Orbit/Absorption animation variables
  private orbitAngle = 0;
  private orbitSpeed = 6;
  private orbitRadius = 0;
  private orbitHeight = 0;

  constructor(private scene: THREE.Scene) {
    this.group.name = 'desertUfo';
    this.group.frustumCulled = false;
    this.group.renderOrder = UFO_RENDER_ORDER;
  }

  build(halfX: number, halfZ: number): void {
    this.dispose();
    this.halfX = halfX;
    this.halfZ = halfZ;
    this.active = true;
    this.state = 'inactive';
    this.cooldownTimer = 15; // 15 seconds before first fly-by

    // Build the 3D model group
    addUfoPart(
      this.group,
      new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 0.45, 24), ufoMaterial(0xb8c4d0))
    );

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      ufoMaterial(0x7dd3fc)
    );
    dome.position.y = 0.35;
    addUfoPart(this.group, dome);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.12, 8, 32), ufoMaterial(0x64748b));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.05;
    addUfoPart(this.group, rim);

    const lightColors = [0x22d3ee, 0xa78bfa, 0xf472b6, 0xfacc15, 0x4ade80, 0x38bdf8];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        ufoMaterial(lightColors[i % lightColors.length])
      );
      bulb.position.set(Math.cos(angle) * 2.35, -0.12, Math.sin(angle) * 2.35);
      addUfoPart(this.group, bulb);
      this.lights.push(bulb);
    }

    // Build flat blob shadow on the ground (y = 0.025)
    const shadowGeo = new THREE.RingGeometry(0, 2.7, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.name = 'ufoShadow';
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.set(0, 0.025, 0);
  }

  update(dt: number, player: DustDevil, onAbsorb: (mass: number) => void): void {
    if (!this.active) return;

    if (this.state === 'absorbed') {
      return;
    }

    if (this.state === 'inactive') {
      // UFO only starts appearing when player size class is medium (mass >= 10)
      if (player.mass >= 10) {
        this.cooldownTimer -= dt;
        if (this.cooldownTimer <= 0) {
          this.spawnUfo();
        }
      }
      return;
    }

    if (this.state === 'absorbing') {
      this.tickAbsorption(dt, player, onAbsorb);
      return;
    }

    // Spawning, Patrolling, Exiting: check if player has reached 130 mass to absorb
    if (player.mass >= 130) {
      const distToPlayer = distanceXZ(player.position, this.group.position);
      if (distToPlayer < player.pullRadius) {
        this.state = 'absorbing';
        this.orbitAngle = Math.atan2(
          this.group.position.z - player.position.z,
          this.group.position.x - player.position.x
        );
        this.orbitSpeed = 5.5 + Math.random() * 2;
        this.orbitRadius = distToPlayer;
        this.orbitHeight = this.group.position.y;
        this.tickAbsorption(dt, player, onAbsorb);
        return;
      }
    }

    // Normal fly-by movement
    const pos = this.group.position;
    const toTarget = this.target.clone().sub(pos);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist < WAYPOINT_REACH) {
      if (this.state === 'spawning') {
        this.state = 'patrolling';
        this.waypointsPatrolled = 0;
        this.targetPatrolCount = 2 + Math.floor(Math.random() * 2); // Patrol 2 or 3 waypoints
        this.pickWaypoint();
      } else if (this.state === 'patrolling') {
        this.waypointsPatrolled++;
        if (this.waypointsPatrolled >= this.targetPatrolCount) {
          this.state = 'exiting';
          const exitAngle = Math.random() * Math.PI * 2;
          this.target.set(
            Math.cos(exitAngle) * (this.halfX + 35),
            FLY_HEIGHT,
            Math.sin(exitAngle) * (this.halfZ + 35)
          );
        } else {
          this.pickWaypoint();
        }
      } else if (this.state === 'exiting') {
        this.scene.remove(this.group);
        if (this.shadowMesh && this.shadowMesh.parent === this.scene) {
          this.scene.remove(this.shadowMesh);
        }
        this.state = 'inactive';
        this.cooldownTimer = 40 + Math.random() * 25; // Delay of 40s to 65s between fly-bys
        return;
      }
    }

    if (toTarget.lengthSq() > 0.0001) {
      toTarget.normalize();
      this.velocity.lerp(toTarget.multiplyScalar(SPEED), Math.min(1, dt * 2.5));
    }

    pos.x += this.velocity.x * dt;
    pos.z += this.velocity.z * dt;
    pos.y = FLY_HEIGHT + Math.sin(this.lightPhase * 1.3) * 0.6;

    // Update blob shadow position directly under the UFO
    if (this.shadowMesh) {
      this.shadowMesh.position.set(pos.x, 0.025, pos.z);
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.5) {
      const yaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.group.rotation.y = yaw;
      this.group.rotation.z = Math.sin(this.lightPhase * 2) * 0.06;
      this.group.rotation.x = -this.velocity.x * 0.008;
    }

    this.lightPhase += dt * 5;
    for (let i = 0; i < this.lights.length; i++) {
      const bulb = this.lights[i];
      const pulse = 0.85 + 0.15 * Math.sin(this.lightPhase * 3 + i * 0.9);
      bulb.scale.setScalar(pulse);
    }
  }

  dispose(): void {
    if (this.group.parent === this.scene) {
      this.scene.remove(this.group);
    }
    if (this.shadowMesh) {
      if (this.shadowMesh.parent === this.scene) {
        this.scene.remove(this.shadowMesh);
      }
      this.shadowMesh.geometry.dispose();
      (this.shadowMesh.material as THREE.Material).dispose();
      this.shadowMesh = null;
    }
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
    this.group.clear();
    this.group.scale.setScalar(1);
    this.lights = [];
    this.velocity.set(0, 0, 0);
    this.active = false;
  }

  private spawnUfo(): void {
    // Spawn off-screen at one of the 4 outer sides
    const side = Math.floor(Math.random() * 4);
    let entryX = 0;
    let entryZ = 0;
    const offset = 35;
    if (side === 0) {
      entryX = -this.halfX - offset;
      entryZ = (Math.random() * 2 - 1) * this.halfZ;
    } else if (side === 1) {
      entryX = this.halfX + offset;
      entryZ = (Math.random() * 2 - 1) * this.halfZ;
    } else if (side === 2) {
      entryX = (Math.random() * 2 - 1) * this.halfX;
      entryZ = -this.halfZ - offset;
    } else {
      entryX = (Math.random() * 2 - 1) * this.halfX;
      entryZ = this.halfZ + offset;
    }

    this.group.position.set(entryX, FLY_HEIGHT, entryZ);
    this.group.scale.setScalar(1);
    this.velocity.set(0, 0, 0);

    // Position and add ground shadow
    if (this.shadowMesh) {
      this.shadowMesh.position.set(entryX, 0.025, entryZ);
      this.shadowMesh.scale.setScalar(1);
      this.scene.add(this.shadowMesh);
    }

    // Pick first waypoint inside bounds
    this.pickWaypoint();
    this.scene.add(this.group);
    this.state = 'spawning';
  }

  private tickAbsorption(dt: number, player: DustDevil, onAbsorb: (mass: number) => void): void {
    this.orbitAngle += this.orbitSpeed * dt * 1.3;
    // Spiral in horizontally and pull down vertically
    this.orbitRadius = Math.max(player.radius * 0.4, this.orbitRadius - dt * 13);
    this.orbitHeight = Math.max(player.position.y + player.radius * 0.7, this.orbitHeight - dt * 18);

    const targetX = player.position.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const targetZ = player.position.z + Math.sin(this.orbitAngle) * this.orbitRadius;

    this.group.position.set(targetX, this.orbitHeight, targetZ);

    // Keep ground shadow the same size as the UFO spirals in
    if (this.shadowMesh) {
      this.shadowMesh.position.set(targetX, 0.025, targetZ);
      this.shadowMesh.scale.setScalar(1);
    }

    // Keep UFO the same size as it gets sucked in
    this.group.scale.setScalar(1);

    // Spin rapidly on multiple axes for a wild vortex-pull animation
    this.group.rotation.y += dt * 30;
    this.group.rotation.x += dt * 15;
    this.group.rotation.z += dt * 10;

    this.lightPhase += dt * 10;
    for (let i = 0; i < this.lights.length; i++) {
      const bulb = this.lights[i];
      const pulse = 0.85 + 0.15 * Math.sin(this.lightPhase * 3 + i * 0.9);
      bulb.scale.setScalar(pulse);
    }

    // Complete absorption once sucked deep into the vortex
    if (this.orbitRadius <= player.radius * 0.5 && this.orbitHeight <= player.position.y + player.radius * 2.5) {
      this.scene.remove(this.group);
      if (this.shadowMesh && this.shadowMesh.parent === this.scene) {
        this.scene.remove(this.shadowMesh);
      }
      this.dispose();
      this.state = 'absorbed';
      onAbsorb(45);
    }
  }

  private pickWaypoint(): void {
    const rangeX = Math.max(4, this.halfX - MARGIN);
    const rangeZ = Math.max(4, this.halfZ - MARGIN);
    this.target.set(
      (Math.random() * 2 - 1) * rangeX,
      FLY_HEIGHT,
      (Math.random() * 2 - 1) * rangeZ
    );
  }
}
