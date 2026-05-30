import * as THREE from 'three';
import { BASE_RADIUS, visualScaleMultiplier } from '../utils/constants';

interface SpiralParticle {
  angle: number;
  radius: number;
  height: number;
  angularSpeed: number;
  riseSpeed: number;
  phase: number;
  kind: 'dust' | 'debris' | 'ground' | 'cloud';
  color: number;
}

const HISTORY_LEN = 36;
const SNAKE_LAG = 0.1;
const HISTORY_DECAY = 0.74;
/** Tail lag multiplier (>1 = looser whip at the top). */
const TAIL_LAG_SCALE = 1.75;
const WHIP_LAG_POWER = 1.12;
const LOOSENESS_MAX = 1.4;
const WHIP_VELOCITY_BASE = 0.42;
const WHIP_VELOCITY_SPEED = 0.095;

/**
 * Tall, narrow dust devil: base leads movement, upper column trails behind (snake-like).
 */
export class DustDevilVortex {
  readonly group = new THREE.Group();
  private dustPoints: THREE.Points;
  private cloudPoints: THREE.Points;
  private basePoints: THREE.Points;
  private positions: Float32Array;
  private cloudPositions: Float32Array;
  private cloudColors: Float32Array;
  private basePositions: Float32Array;
  private particles: SpiralParticle[] = [];
  private cloudParticles: SpiralParticle[] = [];
  private baseParticles: SpiralParticle[] = [];
  private columnSegments: THREE.Mesh[] = [];
  private baseRing: THREE.Mesh;
  private time = 0;
  private columnHeight = 3.2;
  private visualScale = 1;
  private moveHistory: THREE.Vector2[] = Array.from(
    { length: HISTORY_LEN },
    () => new THREE.Vector2()
  );
  private historyHead = 0;
  private snakeSample = new THREE.Vector2();
  private trailVel = new THREE.Vector2();
  private basePointSize = 0.2;
  private cloudPointSize = 0.22;

  private static readonly DUST_COUNT = 150;
  private static readonly CLOUD_COUNT = 220;
  private static readonly BASE_COUNT = 320;
  private static readonly DUST_COLORS = [0xd4c4a8, 0xe0d4bc, 0xc9b896, 0xefe6d8, 0xf5efe4];
  private static readonly WHITE_CLOUD_COLORS = [
    0xfffaf5, 0xf8f4ec, 0xf0ebe3, 0xeae4d8, 0xfffdf8, 0xf5f0e8,
  ];

  constructor() {
    this.positions = new Float32Array(DustDevilVortex.DUST_COUNT * 3);
    this.cloudPositions = new Float32Array(DustDevilVortex.CLOUD_COUNT * 3);
    this.cloudColors = new Float32Array(DustDevilVortex.CLOUD_COUNT * 3);
    this.basePositions = new Float32Array(DustDevilVortex.BASE_COUNT * 3);

    for (let i = 0; i < DustDevilVortex.DUST_COUNT; i++) {
      const kind: SpiralParticle['kind'] = i < 110 ? 'dust' : 'debris';
      this.particles.push(this.spawnParticle(kind, true));
    }

    for (let i = 0; i < DustDevilVortex.CLOUD_COUNT; i++) {
      this.cloudParticles.push(this.spawnCloudParticle(true));
    }

    for (let i = 0; i < DustDevilVortex.BASE_COUNT; i++) {
      this.baseParticles.push(this.spawnBaseParticle());
    }

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.13,
      transparent: true,
      opacity: 0.78,
      color: 0xe8dcc8,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.group.add(this.dustPoints);

    const cloudGeo = new THREE.BufferGeometry();
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(this.cloudPositions, 3));
    cloudGeo.setAttribute('color', new THREE.BufferAttribute(this.cloudColors, 3));
    const cloudMat = new THREE.PointsMaterial({
      size: 0.22,
      transparent: true,
      opacity: 0.68,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });
    this.cloudPoints = new THREE.Points(cloudGeo, cloudMat);
    this.group.add(this.cloudPoints);

    const baseGeo = new THREE.BufferGeometry();
    baseGeo.setAttribute('position', new THREE.BufferAttribute(this.basePositions, 3));
    const baseMat = new THREE.PointsMaterial({
      size: 0.2,
      transparent: true,
      opacity: 0.92,
      color: 0xe0d4c0,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });
    this.basePoints = new THREE.Points(baseGeo, baseMat);
    this.group.add(this.basePoints);

    this.buildColumn();
    this.baseRing = this.createBaseRing();
    this.group.add(this.baseRing);
  }

  private pickColor(palette: number[]): number {
    return palette[Math.floor(Math.random() * palette.length)];
  }

  private spawnParticle(kind: SpiralParticle['kind'], randomHeight: boolean): SpiralParticle {
    return {
      angle: Math.random() * Math.PI * 2,
      radius: 0.08 + Math.random() * 0.14,
      height: randomHeight ? 0.15 + Math.random() * this.columnHeight * 0.85 : 0.12,
      angularSpeed: 3 + Math.random() * 3,
      riseSpeed: 0.7 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      kind,
      color: this.pickColor(DustDevilVortex.DUST_COLORS),
    };
  }

  private spawnCloudParticle(randomHeight: boolean): SpiralParticle {
    return {
      angle: Math.random() * Math.PI * 2,
      radius: 0.04 + Math.random() * 0.22,
      height: randomHeight ? 0.08 + Math.random() * this.columnHeight * 0.95 : 0.1,
      angularSpeed: 2 + Math.random() * 2.5,
      riseSpeed: 0.45 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      kind: 'cloud',
      color: this.pickColor(DustDevilVortex.WHITE_CLOUD_COLORS),
    };
  }

  private spawnBaseParticle(): SpiralParticle {
    const light = Math.random() < 0.35;
    return {
      angle: Math.random() * Math.PI * 2,
      radius: 0.08 + Math.random() * 0.38,
      height: 0.01 + Math.random() * 0.45,
      angularSpeed: 4 + Math.random() * 8,
      riseSpeed: 0.25 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2,
      kind: 'ground',
      color: light
        ? this.pickColor(DustDevilVortex.WHITE_CLOUD_COLORS)
        : this.pickColor(DustDevilVortex.DUST_COLORS),
    };
  }

  private buildColumn(): void {
    const segmentCount = 11;
    const segH = 0.32;
    for (let i = 0; i < segmentCount; i++) {
      const t = i / (segmentCount - 1);
      const y = 0.08 + t * (this.columnHeight - 0.2);
      const rBottom = THREE.MathUtils.lerp(0.2, 0.04, t);
      const rTop = THREE.MathUtils.lerp(0.24, 0.03, t);
      const geo = new THREE.CylinderGeometry(rTop, rBottom, segH, 8, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: DustDevilVortex.DUST_COLORS[i % DustDevilVortex.DUST_COLORS.length],
        transparent: true,
        opacity: THREE.MathUtils.lerp(0.22, 0.08, t),
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = y;
      mesh.userData.heightT = t;
      mesh.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * (3.5 - t * 2);
      this.columnSegments.push(mesh);
      this.group.add(mesh);
    }
  }

  private createBaseRing(): THREE.Mesh {
    const geo = new THREE.RingGeometry(0.12, 0.32, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xc4a574,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    return ring;
  }

  private pushMoveHistory(vx: number, vz: number, dt: number): void {
    this.historyHead = (this.historyHead + 1) % HISTORY_LEN;
    const cur = this.moveHistory[this.historyHead];
    const prev = this.moveHistory[(this.historyHead - 1 + HISTORY_LEN) % HISTORY_LEN];
    cur.x = prev.x * HISTORY_DECAY + vx * dt * SNAKE_LAG;
    cur.y = prev.y * HISTORY_DECAY + vz * dt * SNAKE_LAG;
  }

  /** 0 at the ground contact; snake lag only applies above the base. */
  private columnHeightT(heightT: number): number {
    return Math.min(1, Math.max(0, (heightT - 0.14) / 0.86));
  }

  private sampleSnakeOffset(heightT: number, out: THREE.Vector2): THREE.Vector2 {
    const columnT = this.columnHeightT(heightT);
    const sway = Math.sin(this.time * 3.2 + heightT * 8) * 0.15 * columnT;
    if (columnT <= 0) {
      out.set(sway * 0.3, -sway * 0.2);
      return out;
    }
    const maxLag = HISTORY_LEN - 1;
    const lag = Math.min(
      maxLag,
      Math.floor(Math.pow(columnT, WHIP_LAG_POWER) * maxLag * TAIL_LAG_SCALE)
    );
    const idx = (this.historyHead - lag + HISTORY_LEN) % HISTORY_LEN;
    const olderLag = Math.min(maxLag, lag + Math.floor(6 + columnT * 11));
    const idxOld = (this.historyHead - olderLag + HISTORY_LEN) % HISTORY_LEN;
    const sample = this.moveHistory[idx];
    const older = this.moveHistory[idxOld];
    const whipBlend = columnT * columnT * 0.6;
    const blendX = THREE.MathUtils.lerp(sample.x, older.x, whipBlend);
    const blendY = THREE.MathUtils.lerp(sample.y, older.y, whipBlend);
    const looseness = 1 + columnT * LOOSENESS_MAX;
    out.set(blendX * looseness + sway, blendY * looseness - sway * 0.8);

    const speed = this.trailVel.length();
    if (speed > 0.25) {
      const whipLen =
        columnT * columnT * (WHIP_VELOCITY_BASE + speed * WHIP_VELOCITY_SPEED);
      out.x -= (this.trailVel.x / speed) * whipLen;
      out.y -= (this.trailVel.y / speed) * whipLen;
    }
    return out;
  }

  private applyColumnLean(dt: number, intensity: number): void {
    const leanX = -this.trailVel.y * 0.1 * intensity;
    const leanZ = this.trailVel.x * 0.1 * intensity;
    const smooth = 1 - Math.pow(0.05, dt);
    for (const seg of this.columnSegments) {
      const t = this.columnHeightT(seg.userData.heightT as number);
      seg.rotation.x = THREE.MathUtils.lerp(seg.rotation.x, leanX * t, smooth);
      seg.rotation.z = THREE.MathUtils.lerp(seg.rotation.z, leanZ * t, smooth);
    }
  }

  setScale(radius: number): void {
    const match = visualScaleMultiplier(radius);
    this.columnHeight = Math.max(2.8, radius * 4.5 * match);
    this.visualScale = (radius / BASE_RADIUS) * match;
    this.group.scale.setScalar(this.visualScale);
    (this.dustPoints.material as THREE.PointsMaterial).size =
      (0.11 + radius * 0.045) * match;
    this.cloudPointSize = (0.2 + radius * 0.07) * match;
    (this.cloudPoints.material as THREE.PointsMaterial).size = this.cloudPointSize;
    this.basePointSize = (0.18 + radius * 0.08) * match;
    (this.basePoints.material as THREE.PointsMaterial).size = this.basePointSize;
  }

  update(
    dt: number,
    velX: number,
    velZ: number,
    speed: number,
    isBoosting: boolean
  ): void {
    this.time += dt;
    const spinMult = 1 + speed * 0.1 + (isBoosting ? 0.7 : 0);
    const intensity = Math.min(1, speed / 7);

    this.pushMoveHistory(velX, velZ, dt);
    const velSmooth = 1 - Math.pow(0.02, dt);
    this.trailVel.x = THREE.MathUtils.lerp(this.trailVel.x, velX, velSmooth);
    this.trailVel.y = THREE.MathUtils.lerp(this.trailVel.y, velZ, velSmooth);

    for (const seg of this.columnSegments) {
      const t = seg.userData.heightT as number;
      this.sampleSnakeOffset(t, this.snakeSample);
      seg.position.x = this.snakeSample.x;
      seg.position.z = this.snakeSample.y;
      seg.rotation.y += dt * (seg.userData.spinSpeed as number) * spinMult;
      const breathe = 1 + Math.sin(this.time * 4 + t * 6) * 0.03;
      seg.scale.set(breathe, 1 + intensity * 0.08, breathe);
    }

    this.applyColumnLean(dt, intensity);

    this.baseRing.position.set(0, 0.02, 0);
    this.baseRing.rotation.x = -Math.PI / 2;
    this.baseRing.rotation.y = 0;
    this.baseRing.rotation.z += dt * 8 * spinMult;
    this.baseRing.scale.set(1, 1, 1);

    this.group.rotation.set(0, 0, 0);

    this.updateColumnParticles(dt, spinMult);
    this.updateCloudParticles(dt, spinMult);
    this.updateBaseParticles(dt, spinMult);
  }

  private updateColumnParticles(dt: number, spinMult: number): void {
    const h = this.columnHeight;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const heightNorm = p.height / h;
      this.sampleSnakeOffset(heightNorm, this.snakeSample);

      const inwardPull = (0.2 + heightNorm * 0.15) * dt;
      p.radius = Math.max(0.03, p.radius - inwardPull);
      p.angle += p.angularSpeed * spinMult * dt * (1.1 + (1 - p.radius) * 0.5);
      p.height += p.riseSpeed * spinMult * dt;
      p.angle += Math.sin(this.time * 5 + p.phase) * dt * 0.35;

      const maxR = THREE.MathUtils.lerp(0.22, 0.05, heightNorm);
      if (p.radius > maxR) p.radius += (maxR - p.radius) * dt * 3;

      if (p.height >= h * 0.92) {
        this.particles[i] = this.spawnParticle(p.kind, false);
        continue;
      }

      const wobble = Math.sin(this.time * 7 + p.phase) * 0.02 * heightNorm;
      this.positions[i * 3] = this.snakeSample.x + Math.cos(p.angle) * (p.radius + wobble);
      this.positions[i * 3 + 1] = p.height;
      this.positions[i * 3 + 2] = this.snakeSample.y + Math.sin(p.angle) * (p.radius + wobble);
    }

    this.dustPoints.geometry.attributes.position.needsUpdate = true;
  }

  private updateCloudParticles(dt: number, spinMult: number): void {
    const h = this.columnHeight;
    const color = new THREE.Color();

    for (let i = 0; i < this.cloudParticles.length; i++) {
      let p = this.cloudParticles[i];
      const heightNorm = p.height / h;
      this.sampleSnakeOffset(heightNorm, this.snakeSample);

      p.angle += p.angularSpeed * spinMult * dt * 0.85;
      p.radius += Math.sin(this.time * 2.5 + p.phase) * dt * 0.04;
      p.radius = THREE.MathUtils.clamp(p.radius, 0.03, 0.28);
      p.height += p.riseSpeed * spinMult * dt * 0.75;
      p.angle += Math.sin(this.time * 4 + p.phase) * dt * 0.25;

      const maxR = THREE.MathUtils.lerp(0.26, 0.08, heightNorm);
      if (p.radius > maxR) p.radius += (maxR - p.radius) * dt * 2;

      if (p.height >= h * 0.96) {
        this.cloudParticles[i] = this.spawnCloudParticle(false);
        p = this.cloudParticles[i];
      }

      const puff = Math.sin(this.time * 5 + p.phase * 2) * 0.04 * (0.4 + heightNorm);
      this.cloudPositions[i * 3] = this.snakeSample.x + Math.cos(p.angle) * (p.radius + puff);
      this.cloudPositions[i * 3 + 1] = p.height;
      this.cloudPositions[i * 3 + 2] = this.snakeSample.y + Math.sin(p.angle) * (p.radius + puff);

      color.setHex(p.color);
      this.cloudColors[i * 3] = color.r;
      this.cloudColors[i * 3 + 1] = color.g;
      this.cloudColors[i * 3 + 2] = color.b;
    }

    this.cloudPoints.geometry.attributes.position.needsUpdate = true;
    this.cloudPoints.geometry.attributes.color.needsUpdate = true;
  }

  private updateBaseParticles(dt: number, spinMult: number): void {
    for (let i = 0; i < this.baseParticles.length; i++) {
      const p = this.baseParticles[i];

      p.angle += p.angularSpeed * spinMult * dt * 2.8;
      p.radius = 0.12 + Math.sin(this.time * 3 + p.phase) * 0.14;
      p.height += p.riseSpeed * spinMult * dt;
      if (p.height > 0.55) {
        p.height = 0.01 + Math.random() * 0.1;
        p.angle = Math.random() * Math.PI * 2;
        p.radius = 0.1 + Math.random() * 0.3;
      }

      const kick = Math.sin(this.time * 8 + p.phase) * 0.03;
      this.basePositions[i * 3] = Math.cos(p.angle) * (p.radius + kick);
      this.basePositions[i * 3 + 1] = p.height;
      this.basePositions[i * 3 + 2] = Math.sin(p.angle) * (p.radius + kick);
    }

    this.basePoints.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.dustPoints.geometry.dispose();
    (this.dustPoints.material as THREE.Material).dispose();
    this.cloudPoints.geometry.dispose();
    (this.cloudPoints.material as THREE.Material).dispose();
    this.basePoints.geometry.dispose();
    (this.basePoints.material as THREE.Material).dispose();
    for (const m of [...this.columnSegments, this.baseRing]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
