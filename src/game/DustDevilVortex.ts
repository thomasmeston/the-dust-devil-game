import * as THREE from 'three';

interface SpiralParticle {
  angle: number;
  radius: number;
  height: number;
  angularSpeed: number;
  riseSpeed: number;
  size: number;
  phase: number;
  kind: 'dust' | 'debris' | 'ground';
}

/**
 * Visual vortex simulating a dust devil: helical updraft particles,
 * layered spinning funnel wisps, and a ground-hugging debris ring.
 */
export class DustDevilVortex {
  readonly group = new THREE.Group();
  private dustPoints: THREE.Points;
  private positions: Float32Array;
  private particles: SpiralParticle[] = [];
  private funnelLayers: THREE.Mesh[] = [];
  private baseRing: THREE.Mesh;
  private wispRings: THREE.Mesh[] = [];
  private time = 0;
  private columnHeight = 2.5;
  private leanTarget = new THREE.Vector2(0, 0);
  private leanCurrent = new THREE.Vector2(0, 0);

  private static readonly DUST_COUNT = 120;
  private static readonly DUST_COLORS = [0xc4a574, 0xd4b896, 0xa89060, 0xe8d4b8, 0xb8956a];

  constructor() {
    this.positions = new Float32Array(DustDevilVortex.DUST_COUNT * 3);

    for (let i = 0; i < DustDevilVortex.DUST_COUNT; i++) {
      const kind: SpiralParticle['kind'] =
        i < 80 ? 'dust' : i < 105 ? 'debris' : 'ground';
      this.particles.push(this.spawnParticle(kind, true));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.18,
      transparent: true,
      opacity: 0.8,
      color: 0xd4b896,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });

    this.dustPoints = new THREE.Points(geo, mat);
    this.group.add(this.dustPoints);

    this.buildFunnel();
    this.buildWispRings();
    this.baseRing = this.createBaseRing();
    this.group.add(this.baseRing);
  }

  private spawnParticle(kind: SpiralParticle['kind'], randomHeight: boolean): SpiralParticle {
    const baseR = kind === 'ground' ? 0.6 + Math.random() * 0.35 : 0.5 + Math.random() * 0.45;
    return {
      angle: Math.random() * Math.PI * 2,
      radius: baseR,
      height: kind === 'ground' ? 0.05 + Math.random() * 0.12 : randomHeight ? Math.random() * this.columnHeight : 0.05,
      angularSpeed: (2.8 + Math.random() * 2.5) * (kind === 'ground' ? 1.4 : 1),
      riseSpeed: kind === 'ground' ? 0 : 0.6 + Math.random() * 1.2,
      size: kind === 'debris' ? 0.18 + Math.random() * 0.2 : 0.08 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
      kind,
    };
  }

  private buildFunnel(): void {
    const layerCount = 5;
    for (let i = 0; i < layerCount; i++) {
      const t = i / (layerCount - 1);
      const y = t * 2.2 + 0.15;
      const rBottom = THREE.MathUtils.lerp(0.55, 0.15, t);
      const rTop = THREE.MathUtils.lerp(0.7, 0.08, t);
      const geo = new THREE.CylinderGeometry(rTop, rBottom, 0.35, 10, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: DustDevilVortex.DUST_COLORS[i % DustDevilVortex.DUST_COLORS.length],
        transparent: true,
        opacity: THREE.MathUtils.lerp(0.08, 0.22, 1 - t),
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = y;
      mesh.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * (2.5 - t * 1.2);
      mesh.userData.layerIndex = i;
      this.funnelLayers.push(mesh);
      this.group.add(mesh);
    }
  }

  private buildWispRings(): void {
    for (let i = 0; i < 3; i++) {
      const r = 0.35 + i * 0.18;
      const geo = new THREE.TorusGeometry(r, 0.04 + i * 0.015, 6, 20);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe8d4b8,
        transparent: true,
        opacity: 0.25 - i * 0.05,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.4 + i * 0.55;
      ring.userData.spinSpeed = (i % 2 === 0 ? 1 : -1) * (4 + i);
      this.wispRings.push(ring);
      this.group.add(ring);
    }
  }

  private createBaseRing(): THREE.Mesh {
    const geo = new THREE.RingGeometry(0.45, 0.75, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xc4a574,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    return ring;
  }

  setScale(radius: number): void {
    this.columnHeight = Math.max(2, radius * 3.2);
    const s = radius / 0.4;
    this.group.scale.setScalar(s);
  }

  update(
    dt: number,
    moveX: number,
    moveZ: number,
    speed: number,
    isBoosting: boolean
  ): void {
    this.time += dt;
    const spinMult = 1 + speed * 0.08 + (isBoosting ? 0.6 : 0);
    const intensity = Math.min(1, speed / 8);

    this.leanTarget.set(moveX * intensity * 0.35, moveZ * intensity * 0.35);
    this.leanCurrent.x += (this.leanTarget.x - this.leanCurrent.x) * (1 - Math.pow(0.02, dt));
    this.leanCurrent.y += (this.leanTarget.y - this.leanCurrent.y) * (1 - Math.pow(0.02, dt));
    this.group.rotation.x = this.leanCurrent.y * 0.25;
    this.group.rotation.z = -this.leanCurrent.x * 0.25;

    for (const layer of this.funnelLayers) {
      layer.rotation.y += dt * (layer.userData.spinSpeed as number) * spinMult;
      const breathe = 1 + Math.sin(this.time * 3 + (layer.userData.layerIndex as number)) * 0.04;
      layer.scale.set(breathe, 1, breathe);
    }

    for (const ring of this.wispRings) {
      ring.rotation.z += dt * (ring.userData.spinSpeed as number) * spinMult;
    }

    this.baseRing.rotation.z += dt * 6 * spinMult;
    (this.baseRing.material as THREE.MeshBasicMaterial).opacity = 0.25 + intensity * 0.2;

    this.updateParticles(dt, spinMult);
  }

  private updateParticles(dt: number, spinMult: number): void {
    const h = this.columnHeight;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const heightNorm = p.height / h;

      if (p.kind === 'ground') {
        p.angle += p.angularSpeed * spinMult * dt * 1.8;
        p.radius = 0.55 + Math.sin(this.time * 2 + p.phase) * 0.12;
        p.height = 0.05 + Math.abs(Math.sin(this.time * 4 + p.phase)) * 0.15;
      } else {
        const inwardPull = (0.35 + heightNorm * 0.2) * dt;
        p.radius = Math.max(0.06, p.radius - inwardPull);
        p.angle += p.angularSpeed * spinMult * dt * (1.2 + (1 - p.radius) * 0.8);
        p.height += p.riseSpeed * spinMult * dt;

        p.angle += Math.sin(this.time * 5 + p.phase) * dt * 0.4;
        p.radius += Math.cos(this.time * 4 + p.phase * 2) * dt * 0.05;

        const funnelRadius = THREE.MathUtils.lerp(0.65, 0.1, heightNorm);
        if (p.radius > funnelRadius + 0.08) {
          p.radius += (funnelRadius - p.radius) * dt * 2;
        }

        if (p.height >= h) {
          this.particles[i] = this.spawnParticle(p.kind, false);
          continue;
        }
      }

      const wobble = Math.sin(this.time * 6 + p.phase) * 0.03 * (1 - heightNorm);
      const x = Math.cos(p.angle) * (p.radius + wobble);
      const z = Math.sin(p.angle) * (p.radius + wobble);

      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = p.height;
      this.positions[i * 3 + 2] = z;
    }

    this.dustPoints.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.dustPoints.geometry.dispose();
    (this.dustPoints.material as THREE.Material).dispose();
    for (const m of [...this.funnelLayers, ...this.wispRings, this.baseRing]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
