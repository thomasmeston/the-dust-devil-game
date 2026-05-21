import * as THREE from 'three';
import { clamp, lerp } from './constants';

export function createFlatMaterial(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color });
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

export function distanceXZ(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function directionAway(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  out.subVectors(from, to);
  out.y = 0;
  if (out.lengthSq() < 0.001) {
    out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
  }
  return out.normalize();
}

export { clamp, lerp };

export function computeStars(
  mass: number,
  elapsedSec: number,
  targetMass: number,
  threeStarMass: number,
  threeStarTimeSec: number
): number {
  if (mass < targetMass) return 0;
  const massBonus = mass >= threeStarMass;
  const timeBonus = elapsedSec <= threeStarTimeSec;
  if (massBonus && timeBonus) return 3;
  if (massBonus || timeBonus) return 2;
  return 1;
}
