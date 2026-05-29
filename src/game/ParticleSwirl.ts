import * as THREE from 'three';
import type { AbsorbableProp } from './PropFactory';

/** Debris orbit visuals for objects being absorbed + one-shot dust puffs. */
export class ParticleSwirl {
  private debrisMeshes: THREE.Mesh[] = [];
  private scene: THREE.Scene;
  private maxDebris: number;
  private trailPool: THREE.Mesh[] = [];
  private trailIndex = 0;
  private fleeTrailPool: THREE.Mesh[] = [];
  private fleeTrailIndex = 0;
  private dirtTrailPool: THREE.Mesh[] = [];
  private dirtTrailIndex = 0;
  private fleeTrailCooldowns = new Map<number, number>();

  constructor(scene: THREE.Scene, maxDebris = 30) {
    this.scene = scene;
    this.maxDebris = maxDebris;
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    for (let i = 0; i < maxDebris; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.08 + Math.random() * 0.05, 0.45, 0.55),
        transparent: true,
        opacity: 0.65,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.debrisMeshes.push(mesh);
    }

    const trailGeo = new THREE.PlaneGeometry(0.25, 0.25);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd4b896,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(trailGeo, mat);
      m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
      this.trailPool.push(m);
    }

    const fleeGeo = new THREE.PlaneGeometry(0.18, 0.18);
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xc9a87c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(fleeGeo, mat);
      m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
      this.fleeTrailPool.push(m);
    }

    const dirtGeo = new THREE.PlaneGeometry(0.22, 0.22);
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x6b5344,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(dirtGeo, mat);
      m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
      this.dirtTrailPool.push(m);
    }
  }

  syncOrbiters(
    orbiters: AbsorbableProp[],
    center: THREE.Vector3,
    playerRadius: number
  ): void {
    for (let i = 0; i < this.maxDebris; i++) {
      const p = this.debrisMeshes[i];
      if (i < orbiters.length && orbiters[i].mesh.parent) {
        p.visible = true;
        const o = orbiters[i];
        const r = playerRadius * 0.75 + o.orbitHeight * 0.5;
        const helix = Math.sin(o.orbitAngle * 3) * 0.3;
        p.position.set(
          center.x + Math.cos(o.orbitAngle) * r,
          0.4 + o.orbitHeight * 1.5 + helix,
          center.z + Math.sin(o.orbitAngle) * r
        );
        p.rotation.set(o.orbitAngle, o.orbitAngle * 2, 0);
        const s = 0.25 + o.mass * 0.04;
        p.scale.setScalar(Math.min(s, 1.2));
      } else {
        p.visible = false;
      }
    }
  }

  spawnTrail(pos: THREE.Vector3, moveX: number, moveZ: number): void {
    const m = this.trailPool[this.trailIndex % this.trailPool.length];
    this.trailIndex++;
    m.position.set(pos.x - moveX * 0.05, 0.08, pos.z - moveZ * 0.05);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.35;
    m.scale.setScalar(0.8);
    let life = 0.5;
    const fade = () => {
      life -= 0.016;
      (m.material as THREE.MeshBasicMaterial).opacity = life * 0.5;
      m.scale.multiplyScalar(1.02);
      if (life > 0) requestAnimationFrame(fade);
      else (m.material as THREE.MeshBasicMaterial).opacity = 0;
    };
    fade();
  }

  /** Small dust/dirt puffs left behind fleeing animals. */
  spawnFleeTrail(
    propId: number,
    pos: THREE.Vector3,
    velX: number,
    velZ: number,
    dt: number,
    variant: 'dust' | 'dirt' = 'dust'
  ): void {
    const speed = Math.sqrt(velX * velX + velZ * velZ);
    if (speed < 0.35) return;

    const cooldown = this.fleeTrailCooldowns.get(propId) ?? 0;
    if (cooldown > 0) {
      this.fleeTrailCooldowns.set(propId, cooldown - dt);
      return;
    }
    const cooldownSec =
      variant === 'dirt' ? 0.06 : speed < 2 ? 0.08 : 0.05;
    this.fleeTrailCooldowns.set(propId, cooldownSec);

    const pool = variant === 'dirt' ? this.dirtTrailPool : this.fleeTrailPool;
    const index = variant === 'dirt' ? this.dirtTrailIndex++ : this.fleeTrailIndex++;
    const m = pool[index % pool.length];

    const nx = velX / speed;
    const nz = velZ / speed;
    m.position.set(pos.x - nx * 0.25, variant === 'dirt' ? 0.1 : 0.12, pos.z - nz * 0.25);
    (m.material as THREE.MeshBasicMaterial).opacity = variant === 'dirt' ? 0.48 : 0.42;
    m.scale.setScalar((variant === 'dirt' ? 0.65 : 0.55) + speed * 0.04);

    let life = variant === 'dirt' ? 0.45 : 0.38;
    const fade = () => {
      life -= 0.016;
      (m.material as THREE.MeshBasicMaterial).opacity = life * (variant === 'dirt' ? 0.6 : 0.55);
      m.scale.multiplyScalar(1.03);
      if (life > 0) requestAnimationFrame(fade);
      else (m.material as THREE.MeshBasicMaterial).opacity = 0;
    };
    fade();
  }

  resetFleeTrails(): void {
    this.fleeTrailCooldowns.clear();
    for (const m of this.fleeTrailPool) {
      (m.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    for (const m of this.dirtTrailPool) {
      (m.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  spawnPuff(scene: THREE.Scene, pos: THREE.Vector3): void {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.12 + Math.random() * 0.15, 5, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd4b896,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(geo, mat);
      puff.position.copy(pos);
      puff.position.y = 0.3 + Math.random() * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      scene.add(puff);
      let life = 0.35 + Math.random() * 0.2;
      const vx = Math.cos(angle) * speed;
      const vz = Math.sin(angle) * speed;
      let vy = 0.8 + Math.random() * 1.2;
      const animate = () => {
        life -= 0.016;
        puff.position.x += vx * 0.016;
        puff.position.z += vz * 0.016;
        puff.position.y += vy * 0.016;
        vy -= 0.02;
        puff.scale.multiplyScalar(1.04);
        (puff.material as THREE.MeshBasicMaterial).opacity = life * 1.2;
        if (life > 0) requestAnimationFrame(animate);
        else {
          scene.remove(puff);
          geo.dispose();
          mat.dispose();
        }
      };
      animate();
    }
  }

  dispose(): void {
    for (const p of this.debrisMeshes) {
      this.scene.remove(p);
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
    for (const t of this.trailPool) {
      this.scene.remove(t);
      t.geometry.dispose();
      (t.material as THREE.Material).dispose();
    }
    for (const t of this.fleeTrailPool) {
      this.scene.remove(t);
      t.geometry.dispose();
      (t.material as THREE.Material).dispose();
    }
    for (const t of this.dirtTrailPool) {
      this.scene.remove(t);
      t.geometry.dispose();
      (t.material as THREE.Material).dispose();
    }
  }
}
