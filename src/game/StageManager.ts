import * as THREE from 'three';
import type { LevelDef, ObjectDef } from '../types/game';
import { BIOME_PALETTES, type StageId } from '../utils/constants';
import {
  createAbsorbableProp,
  disposePropMesh,
  rebuildPropMesh,
  resetPropIds,
  type AbsorbableProp,
} from './PropFactory';
import { SpatialGrid } from './SpatialGrid';
import { groundTextureLoader } from './GroundTextureLoader';
import { generateLowBoulderRidgePlacements } from './BorderMountains';
import { createForestRiver, getForestRiverDecorPlacements, isInForestRiver, updateForestRiver } from './ForestRiver';
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
  private forestRiverGroup: THREE.Group | null = null;
  private forestRiverTime = 0;
  private activeStageId: StageId | null = null;

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
    this.activeStageId = stageId;
    resetPropIds();

    const palette = BIOME_PALETTES[stageId];
    // Extend the ground visually to 3.5x to blend seamlessly into sky fog
    const visualWidth = level.width * 3.5;
    const visualDepth = level.depth * 3.5;
    const groundMat = groundTextureLoader.createGroundMaterial(
      stageId,
      visualWidth,
      visualDepth,
      palette.ground
    );
    const ground = this.scene.getObjectByName('ground') as THREE.Mesh | undefined;
    if (!ground) {
      const geo = new THREE.PlaneGeometry(visualWidth, visualDepth);
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
      ground.geometry = new THREE.PlaneGeometry(visualWidth, visualDepth);
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
    // this.scene.add(createBorderMountains(stageId, level.width, level.depth)); // Temporarily removed for boundary testing

    // River first so prop placement can avoid the water corridor
    if (stageId === 'forest') {
      this.forestRiverGroup = await createForestRiver(level.width, level.depth);
      this.forestRiverTime = 0;
      this.scene.add(this.forestRiverGroup);
    }

    for (const placed of level.props) {
      const def = objectDefs[placed.type];
      if (!def) continue;
      if (
        stageId === 'forest' &&
        isForestRiverBlockedType(placed.type) &&
        isInForestRiver(placed.x, placed.z)
      ) {
        continue;
      }
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

    if (stageId === 'mountain') {
      await this.spawnMountainRidgeRocks(objectDefs);
    }

    if (stageId === 'forest') {
      await this.spawnForestRiverProps(objectDefs);
      await this.spawnForestPines(objectDefs, level.width, level.depth);
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

  /** Unique absorbable prop types currently present on the level. */
  getLevelObjectTypes(): string[] {
    const types = new Set<string>();
    for (const prop of this.props) {
      if (prop.state !== 'absorbed') types.add(prop.type);
    }
    return [...types].sort();
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
      if (stageId === 'forest' && isInForestRiver(mesh.position.x, mesh.position.z)) {
        i--;
        continue;
      }
      mesh.rotation.y = Math.random() * Math.PI * 2;
      if (stageId === 'forest') mesh.position.y = 0.2;
      group.add(mesh);
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

  private async spawnMountainRidgeRocks(
    objectDefs: Record<string, ObjectDef>
  ): Promise<void> {
    const defSmall = objectDefs.ridge_rock;
    const defLarge = objectDefs.ridge_boulder;
    if (!defSmall && !defLarge) return;

    const ridges = [
      { x: -14, z: -20, spanX: 11, spanZ: 7 },
      { x: 0, z: -2, spanX: 13, spanZ: 8 },
      { x: 14, z: 16, spanX: 11, spanZ: 7 },
    ];

    for (const ridge of ridges) {
      const placements = generateLowBoulderRidgePlacements(
        ridge.x,
        ridge.z,
        ridge.spanX,
        ridge.spanZ
      );
      for (const placement of placements) {
        const useLarge = placement.radius >= 0.82;
        const baseDef = useLarge ? defLarge : defSmall;
        if (!baseDef) continue;

        const type = useLarge ? 'ridge_boulder' : 'ridge_rock';
        const sizeT = placement.radius / (useLarge ? 0.95 : 0.65);
        const [stretchX, stretchY, stretchZ] = placement.stretch;
        const scaledDef: ObjectDef = {
          ...baseDef,
          scale: [
            baseDef.scale[0] * sizeT * stretchX,
            baseDef.scale[1] * sizeT * stretchY,
            baseDef.scale[2] * sizeT * stretchZ,
          ],
        };

        const prop = await createAbsorbableProp(
          type,
          scaledDef,
          placement.x,
          placement.z,
          0,
          placement.rotation
        );
        this.props.push(prop);
        this.scene.add(prop.mesh);
        this.grid.insert(prop);
      }
    }
  }

  update(dt: number): void {
    if (this.activeStageId === 'forest' && this.forestRiverGroup) {
      this.forestRiverTime += dt;
      updateForestRiver(this.forestRiverGroup, this.forestRiverTime);
    }
  }

  private async spawnForestRiverProps(
    objectDefs: Record<string, ObjectDef>
  ): Promise<void> {
    // Only rocks in the channel — never camping props
    const rockDef = objectDefs.rock_small;
    if (!rockDef) return;

    const decor = getForestRiverDecorPlacements();
    for (const p of decor.rocks) {
      const prop = await createAbsorbableProp('rock_small', rockDef, p.x, p.z, 0, p.rotation);
      this.props.push(prop);
      this.scene.add(prop.mesh);
      this.grid.insert(prop);
    }
  }

  /** Dense pine cover on dry land around the river corridor. */
  private async spawnForestPines(
    objectDefs: Record<string, ObjectDef>,
    width: number,
    depth: number
  ): Promise<void> {
    const pineDef = objectDefs.pine_sapling;
    const smallDef = objectDefs.tree_small;
    const largeDef = objectDefs.tree_large;
    if (!pineDef && !smallDef && !largeDef) return;

    const halfW = width * 0.46;
    const halfD = depth * 0.46;
    const targetCount = 240;
    let placed = 0;
    let attempts = 0;

    while (placed < targetCount && attempts < targetCount * 10) {
      attempts++;
      const x = (Math.random() * 2 - 1) * halfW;
      const z = (Math.random() * 2 - 1) * halfD;
      if (isInForestRiver(x, z)) continue;
      // Narrow clear lane near the player path / exit
      if (Math.abs(z) < 1.6 && Math.abs(x) > 10) continue;

      const roll = Math.random();
      let type = 'pine_sapling';
      let def = pineDef;
      if (roll > 0.82 && largeDef) {
        type = 'tree_large';
        def = largeDef;
      } else if (roll > 0.55 && smallDef) {
        type = 'tree_small';
        def = smallDef;
      } else if (!pineDef) {
        def = smallDef ?? largeDef;
        type = smallDef ? 'tree_small' : 'tree_large';
      }
      if (!def) continue;

      const prop = await createAbsorbableProp(
        type,
        def,
        x,
        z,
        0,
        Math.random() * Math.PI * 2
      );
      this.props.push(prop);
      this.scene.add(prop.mesh);
      this.grid.insert(prop);
      placed++;
    }
  }

  async spawnRandomProp(
    type: string,
    def: ObjectDef
  ): Promise<AbsorbableProp | null> {
    if (!this.level) return null;

    const margin = 3;
    const halfX = Math.max(1, this.playableHalfX - margin);
    const halfZ = Math.max(1, this.playableHalfZ - margin);
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 24; attempt++) {
      x = (Math.random() * 2 - 1) * halfX;
      z = (Math.random() * 2 - 1) * halfZ;
      if (
        this.activeStageId === 'forest' &&
        isForestRiverBlockedType(type) &&
        isInForestRiver(x, z)
      ) {
        continue;
      }
      break;
    }
    const rotation = Math.random() * Math.PI * 2;

    const prop = await createAbsorbableProp(type, def, x, z, 0, rotation);
    this.props.push(prop);
    this.scene.add(prop.mesh);
    this.grid.insert(prop);
    return prop;
  }

  async refreshPropsOfType(type: string, def: ObjectDef): Promise<void> {
    for (const prop of this.props) {
      if (prop.type !== type) continue;
      if (prop.state === 'orbit' || prop.state === 'absorbed') continue;

      const oldMesh = await rebuildPropMesh(prop, type, def);
      this.scene.remove(oldMesh);
      disposePropMesh(oldMesh);
      this.scene.add(prop.mesh);
    }
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
    const river = this.scene.getObjectByName('forestRiver');
    if (river) {
      this.scene.remove(river);
      const disposedTextures = new Set<THREE.Texture>();
      river.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const mat = child.material;
          if (Array.isArray(mat)) mat.forEach((m) => disposeRiverMaterial(m, disposedTextures));
          else disposeRiverMaterial(mat, disposedTextures);
        }
      });
    }
    this.forestRiverGroup = null;
    this.forestRiverTime = 0;
    this.activeStageId = null;
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

const FOREST_RIVER_BLOCKED_TYPES = new Set([
  'camping_gear',
  'campfire',
  'camp_log',
  'picnic_table',
  'pine_sapling',
  'tree_small',
  'tree_large',
]);

function isForestRiverBlockedType(type: string): boolean {
  return FOREST_RIVER_BLOCKED_TYPES.has(type);
}

function disposeRiverMaterial(
  material: THREE.Material,
  disposedTextures?: Set<THREE.Texture>
): void {
  const disposeTex = (tex?: THREE.Texture | null) => {
    if (!tex) return;
    if (disposedTextures) {
      if (disposedTextures.has(tex)) return;
      disposedTextures.add(tex);
    }
    tex.dispose();
  };

  if (material instanceof THREE.ShaderMaterial) {
    for (const uniform of Object.values(material.uniforms)) {
      if (uniform.value instanceof THREE.Texture) disposeTex(uniform.value);
    }
  } else if (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshLambertMaterial
  ) {
    disposeTex(material.map);
    disposeTex(material.normalMap);
  }
  material.dispose();
}
