import * as THREE from 'three';
import type { ObjectDef } from '../types/game';
import type { SizeClass } from '../utils/constants';
import { fitModelToTarget, meshRadius, modelLoader } from './ModelLoader';

export type PropState = 'grounded' | 'wobble' | 'orbit' | 'absorbed';

export interface AbsorbableProp {
  id: number;
  type: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  sizeClass: SizeClass;
  mass: number;
  radius: number;
  state: PropState;
  orbitAngle: number;
  orbitHeight: number;
  orbitSpeed: number;
  wobblePhase: number;
  flee: boolean;
  fleeSpeed: number;
  setPiece: boolean;
  oldX: number;
  oldZ: number;
}

let nextPropId = 0;

function createGeometry(shape: ObjectDef['shape'], scale: [number, number, number]): THREE.BufferGeometry {
  const [sx, sy, sz] = scale;
  switch (shape) {
    case 'sphere':
      return new THREE.SphereGeometry(Math.max(sx, sy, sz), 8, 6);
    case 'box':
      return new THREE.BoxGeometry(sx, sy, sz);
    case 'cone':
      return new THREE.ConeGeometry(Math.max(sx, sz), sy, 6);
    case 'cylinder':
      return new THREE.CylinderGeometry(sx, sx, sy, 8);
    case 'capsule':
      return new THREE.CapsuleGeometry(sx * 0.5, sy, 4, 8);
    default:
      return new THREE.BoxGeometry(sx, sy, sz);
  }
}

export function createPropMesh(def: ObjectDef): THREE.Mesh {
  const geo = createGeometry(def.shape, def.scale);
  const mat = new THREE.MeshToonMaterial({ color: new THREE.Color(def.color) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const sy = def.scale[1];
  mesh.position.y = sy / 2;
  return mesh;
}

export async function createPropMeshFromDef(def: ObjectDef): Promise<THREE.Object3D> {
  if (def.model) {
    try {
      const model = await modelLoader.load(def.model);
      fitModelToTarget(model, def.scale, def.color);
      return model;
    } catch (e) {
      console.warn(`Failed to load model ${def.model}, using placeholder`, e);
    }
  }
  return createPropMesh(def);
}

export async function createAbsorbableProp(
  type: string,
  def: ObjectDef,
  x: number,
  z: number,
  y = 0,
  rotation = 0
): Promise<AbsorbableProp> {
  const mesh = await createPropMeshFromDef(def);
  mesh.rotation.y = rotation;
  const radius = def.model ? meshRadius(mesh) : Math.max(...def.scale) * 0.6;
  const prop: AbsorbableProp = {
    id: nextPropId++,
    type,
    mesh,
    position: new THREE.Vector3(x, y, z),
    sizeClass: def.sizeClass,
    mass: def.mass,
    radius,
    state: 'grounded',
    orbitAngle: Math.random() * Math.PI * 2,
    orbitHeight: Math.random() * 0.5,
    orbitSpeed: 2 + Math.random() * 2,
    wobblePhase: Math.random() * Math.PI * 2,
    flee: def.flee ?? false,
    fleeSpeed: def.fleeSpeed ?? 5,
    setPiece: def.setPiece ?? false,
    oldX: x,
    oldZ: z,
  };
  mesh.position.set(x, mesh.position.y + y, z);
  return prop;
}

export function resetPropIds(): void {
  nextPropId = 0;
}

export function collectModelIds(defs: Record<string, ObjectDef>): string[] {
  const ids = new Set<string>();
  for (const def of Object.values(defs)) {
    if (def.model) ids.add(def.model);
  }
  return [...ids];
}
