import * as THREE from 'three';
import { GRID_CELL_SIZE } from '../utils/constants';
import type { AbsorbableProp } from './PropFactory';

export class SpatialGrid {
  private cells = new Map<string, Set<AbsorbableProp>>();

  private key(x: number, z: number): string {
    const cx = Math.floor(x / GRID_CELL_SIZE);
    const cz = Math.floor(z / GRID_CELL_SIZE);
    return `${cx},${cz}`;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(prop: AbsorbableProp): void {
    const k = this.key(prop.position.x, prop.position.z);
    if (!this.cells.has(k)) this.cells.set(k, new Set());
    this.cells.get(k)!.add(prop);
  }

  remove(prop: AbsorbableProp): void {
    const k = this.key(prop.position.x, prop.position.z);
    this.cells.get(k)?.delete(prop);
  }

  updateProp(prop: AbsorbableProp, oldX: number, oldZ: number): void {
    const oldKey = this.key(oldX, oldZ);
    const newKey = this.key(prop.position.x, prop.position.z);
    if (oldKey === newKey) return;
    this.cells.get(oldKey)?.delete(prop);
    if (!this.cells.has(newKey)) this.cells.set(newKey, new Set());
    this.cells.get(newKey)!.add(prop);
  }

  queryRadius(center: THREE.Vector3, radius: number): AbsorbableProp[] {
    const results: AbsorbableProp[] = [];
    const cellRadius = Math.ceil(radius / GRID_CELL_SIZE);
    const cx = Math.floor(center.x / GRID_CELL_SIZE);
    const cz = Math.floor(center.z / GRID_CELL_SIZE);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const set = this.cells.get(`${cx + dx},${cz + dz}`);
        if (!set) continue;
        for (const prop of set) {
          if (prop.state === 'absorbed') continue;
          const dist = Math.sqrt(
            (prop.position.x - center.x) ** 2 + (prop.position.z - center.z) ** 2
          );
          if (dist <= radius + prop.radius) results.push(prop);
        }
      }
    }
    return results;
  }
}
