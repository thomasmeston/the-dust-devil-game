import * as THREE from 'three';
import type { LevelDef, ObjectDef } from '../types/game';
import { BIOME_PALETTES, type StageId } from '../utils/constants';
import {
  createAbsorbableProp,
  resetPropIds,
  type AbsorbableProp,
} from './PropFactory';
import { SpatialGrid } from './SpatialGrid';
import { groundTextureLoader } from './GroundTextureLoader';
import { addLowBoulderRidge, createBorderMountains } from './BorderMountains';
import { playableHalfExtents } from '../utils/bounds';

export class StageManager {
  props: AbsorbableProp[] = [];
  exitPortal: THREE.Group | null = null;
  exitOpen = false;
  level: LevelDef | null = null;
  playableHalfX = 0;
  playableHalfZ = 0;
  private grid: SpatialGrid;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, grid: SpatialGrid) {
    this.scene = scene;
    this.grid = grid;
  }

  load(
    level: LevelDef,
    objectDefs: Record<string, ObjectDef>,
    stageId: StageId
  ): Promise<void> {
    return this.loadAsync(level, objectDefs, stageId);
  }

  async loadAsync(
    level: LevelDef,
    objectDefs: Record<string, ObjectDef>,
    stageId: StageId
  ): Promise<void> {
    this.clear();
    this.level = level;
    resetPropIds();

    const palette = BIOME_PALETTES[stageId];
    const groundMat = groundTextureLoader.createGroundMaterial(
      stageId,
      level.width,
      level.depth,
      palette.ground
    );
    const ground = this.scene.getObjectByName('ground') as THREE.Mesh | undefined;
    if (!ground) {
      const geo = new THREE.PlaneGeometry(level.width, level.depth);
      const mesh = new THREE.Mesh(geo, groundMat);
      mesh.name = 'ground';
      mesh.rotation.x = -Math.PI / 2;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    } else {
      const oldMat = ground.material as THREE.Material;
      oldMat.dispose();
      if (oldMat instanceof THREE.MeshToonMaterial) {
        oldMat.map?.dispose();
        oldMat.normalMap?.dispose();
      }
      (ground.geometry as THREE.PlaneGeometry).dispose();
      ground.geometry = new THREE.PlaneGeometry(level.width, level.depth);
      ground.material = groundMat;
    }

    this.scene.background = new THREE.Color(palette.sky);
    if (palette.fog !== undefined) {
      this.scene.fog = new THREE.Fog(palette.fog, 35, 95);
    } else {
      this.scene.fog = null;
    }

    const { halfX, halfZ } = playableHalfExtents(level.width, level.depth);
    this.playableHalfX = halfX;
    this.playableHalfZ = halfZ;
    this.scene.add(createBorderMountains(stageId, level.width, level.depth));

    for (const placed of level.props) {
      const def = objectDefs[placed.type];
      if (!def) continue;
      const prop = await createAbsorbableProp(
        placed.type,
        def,
        placed.x,
        placed.z,
        placed.y ?? 0,
        placed.rotation ?? 0,
        placed.pitch ?? 0,
        placed.roll ?? 0
      );
      this.props.push(prop);
      this.scene.add(prop.mesh);
      this.grid.insert(prop);
    }

    this.addBiomeDecor(stageId, level.width, level.depth);

    if (level.exitPosition && !level.winProp) {
      this.createExitPortal(level.exitPosition.x, level.exitPosition.z, false);
    }
  }

  createExitPortal(x: number, z: number, open: boolean): void {
    if (this.exitPortal) {
      this.scene.remove(this.exitPortal);
    }
    const group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(2, 0.3, 8, 24);
    const ringMat = new THREE.MeshToonMaterial({
      color: open ? 0x4ade80 : 0x64748b,
      transparent: true,
      opacity: open ? 0.9 : 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.5;
    group.add(ring);

    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 3, 8);
    const pillarMat = new THREE.MeshToonMaterial({ color: 0xa78bfa });
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      const a = (i / 4) * Math.PI * 2;
      p.position.set(Math.cos(a) * 2, 1.5, Math.sin(a) * 2);
      group.add(p);
    }

    group.position.set(x, 0, z);
    group.name = 'exitPortal';
    this.scene.add(group);
    this.exitPortal = group;
    this.exitOpen = open;
  }

  openExit(): void {
    if (!this.level?.exitPosition || this.exitOpen) return;
    this.exitOpen = true;
    this.createExitPortal(this.level.exitPosition.x, this.level.exitPosition.z, true);
  }

  checkExitCollision(playerPos: THREE.Vector3, playerRadius: number): boolean {
    if (!this.exitOpen || !this.level?.exitPosition) return false;
    const ex = this.level.exitPosition.x;
    const ez = this.level.exitPosition.z;
    const dist = Math.sqrt((playerPos.x - ex) ** 2 + (playerPos.z - ez) ** 2);
    return dist < 3 + playerRadius;
  }

  checkWinProp(type: string): boolean {
    return this.level?.winProp === type;
  }

  private addBiomeDecor(stageId: StageId, width: number, depth: number): void {
    const group = new THREE.Group();
    group.name = 'biomeDecor';
    const palette = BIOME_PALETTES[stageId];
    const count =
      stageId === 'desert' ? 40 : stageId === 'downtown' ? 0 : 25;

    for (let i = 0; i < count; i++) {
      const geo =
        stageId === 'mountain'
          ? new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.5, 0)
          : stageId === 'forest'
            ? new THREE.ConeGeometry(0.2, 0.4, 4)
            : new THREE.ConeGeometry(0.15, 0.25, 4);

      const shade = new THREE.Color(palette.accent).lerp(new THREE.Color(palette.ground), Math.random() * 0.6);
      const mat = new THREE.MeshToonMaterial({ color: shade });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * width * 0.9,
        0.12,
        (Math.random() - 0.5) * depth * 0.9
      );
      mesh.rotation.y = Math.random() * Math.PI * 2;
      if (stageId === 'forest') mesh.position.y = 0.2;
      group.add(mesh);
    }

    if (stageId === 'mountain') {
      const baseColor = new THREE.Color(palette.ground);
      const rockColor = new THREE.Color(palette.accent).lerp(baseColor, 0.35);
      const ridges = [
        { x: -14, z: -20, spanX: 11, spanZ: 7 },
        { x: 0, z: -2, spanX: 13, spanZ: 8 },
        { x: 14, z: 16, spanX: 11, spanZ: 7 },
      ];
      for (const ridge of ridges) {
        addLowBoulderRidge(
          group,
          ridge.x,
          ridge.z,
          ridge.spanX,
          ridge.spanZ,
          baseColor,
          rockColor
        );
      }
    }

    if (stageId === 'suburbs') {
      for (let row = -2; row <= 2; row++) {
        const geo = new THREE.PlaneGeometry(4, width * 0.85);
        const mat = new THREE.MeshToonMaterial({ color: 0x4b5563 });
        const road = new THREE.Mesh(geo, mat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(row * 16, 0.02, 0);
        group.add(road);
      }
    }

    this.scene.add(group);
  }

  clear(): void {
    const border = this.scene.getObjectByName('borderMountains');
    if (border) {
      this.scene.remove(border);
      border.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
    }
    const decor = this.scene.getObjectByName('biomeDecor');
    if (decor) {
      this.scene.remove(decor);
      decor.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
    }
    for (const prop of this.props) {
      this.scene.remove(prop.mesh);
      prop.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
    }
    this.props = [];
    this.grid.clear();
    if (this.exitPortal) {
      this.scene.remove(this.exitPortal);
      this.exitPortal = null;
    }
    this.exitOpen = false;
    this.level = null;
    this.playableHalfX = 0;
    this.playableHalfZ = 0;
  }
}
