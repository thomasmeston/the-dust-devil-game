import * as THREE from 'three';

const FLY_HEIGHT = 28;
const SPEED = 14;
const WAYPOINT_REACH = 2.5;
const MARGIN = 4;
const UFO_RENDER_ORDER = 20;

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

/** Flying saucer that patrols the desert stage sky. */
export class DesertUfo {
  private group = new THREE.Group();
  private lights: THREE.Mesh[] = [];
  private lightPhase = 0;
  private active = false;

  private halfX = 0;
  private halfZ = 0;
  private target = new THREE.Vector3();
  private velocity = new THREE.Vector3();

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

    this.group.position.set(0, FLY_HEIGHT, 0);
    this.pickWaypoint();
    this.scene.add(this.group);
  }

  update(dt: number): void {
    if (!this.active) return;

    const pos = this.group.position;
    const toTarget = this.target.clone().sub(pos);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist < WAYPOINT_REACH) {
      this.pickWaypoint();
      toTarget.copy(this.target).sub(pos);
      toTarget.y = 0;
    }

    if (toTarget.lengthSq() > 0.0001) {
      toTarget.normalize();
      this.velocity.lerp(toTarget.multiplyScalar(SPEED), Math.min(1, dt * 2.5));
    }

    pos.x += this.velocity.x * dt;
    pos.z += this.velocity.z * dt;
    pos.y = FLY_HEIGHT + Math.sin(this.lightPhase * 1.3) * 0.6;

    const clamped = this.clampXZ(pos.x, pos.z);
    if (clamped.x !== pos.x || clamped.z !== pos.z) {
      this.pickWaypoint();
    }
    pos.x = clamped.x;
    pos.z = clamped.z;

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
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
    this.group.clear();
    this.lights = [];
    this.velocity.set(0, 0, 0);
    this.active = false;
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

  private clampXZ(x: number, z: number): { x: number; z: number } {
    const limitX = Math.max(2, this.halfX - 2);
    const limitZ = Math.max(2, this.halfZ - 2);
    return {
      x: Math.max(-limitX, Math.min(limitX, x)),
      z: Math.max(-limitZ, Math.min(limitZ, z)),
    };
  }
}
