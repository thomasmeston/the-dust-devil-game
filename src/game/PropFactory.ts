import * as THREE from 'three';
import type { ObjectDef } from '../types/game';
import type { SizeClass } from '../utils/constants';
import { facingAngleY } from '../utils/math';
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
  wander: boolean;
  wanderSpeed: number;
  wanderHeading: number;
  wanderTurnTimer: number;
  setPiece: boolean;
  oldX: number;
  oldZ: number;
  pushbackTimer?: number;
  pushbackDir?: THREE.Vector3;
  tortoiseState?: 'normal' | 'pop' | 'hiding';
  tortoisePopTimer?: number;
  tortoiseHidingTimer?: number;
  retractProgress?: number;
  sweatTimer?: number;
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

/** Low-poly goat with horns, head, and four legs on the ground. */
export function createSheepMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const wool = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const legMat = new THREE.MeshToonMaterial({ color: new THREE.Color('#3f3830') });
  const hornMat = new THREE.MeshToonMaterial({ color: new THREE.Color('#5c5348') });
  const faceMat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#2a2520'), 0.3),
  });

  const legH = sy * 0.3;
  const legGeo = new THREE.CylinderGeometry(sx * 0.08, sx * 0.1, legH, 5);
  const legOffsets: [number, number][] = [
    [-sx * 0.3, -sz * 0.26],
    [sx * 0.3, -sz * 0.26],
    [-sx * 0.3, sz * 0.26],
    [sx * 0.3, sz * 0.26],
  ];
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, legH * 0.5, lz);
    group.add(leg);
  }

  const bodyH = sy * 0.46;
  const bodyY = legH + bodyH * 0.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(sx * 1.05, bodyH, sz * 0.82), wool);
  body.position.y = bodyY;
  group.add(body);

  const puff = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.32, 6, 5), wool);
  puff.position.set(0, bodyY + bodyH * 0.35, -sz * 0.04);
  puff.scale.set(1.15, 0.65, 1.05);
  group.add(puff);

  const headY = legH + bodyH * 0.72;
  const head = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.4, sy * 0.3, sz * 0.36), wool);
  head.position.set(0, headY, sz * 0.5);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.2, sy * 0.14, sz * 0.16), faceMat);
  snout.position.set(0, headY - sy * 0.04, sz * 0.68);
  group.add(snout);

  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.09, sy * 0.1, sz * 0.05), legMat);
    ear.position.set(side * sx * 0.2, headY + sy * 0.1, sz * 0.46);
    ear.rotation.z = side * 0.35;
    group.add(ear);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(sx * 0.1, sy * 0.38, 5), hornMat);
    horn.position.set(side * sx * 0.17, headY + sy * 0.16, sz * 0.38);
    horn.rotation.z = side * -0.65;
    horn.rotation.x = -0.4;
    group.add(horn);
  }

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}

/** Low-poly desert tortoise — shell, big legs, tail, and head. */
export function createTortoiseMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const shellMat = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const skinMat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#8B9A5B'), 0.45),
  });

  const legH = sy * 0.38;
  const legGeo = new THREE.CylinderGeometry(sx * 0.13, sx * 0.17, legH, 6);
  const footGeo = new THREE.CylinderGeometry(sx * 0.2, sx * 0.22, sy * 0.06, 6);
  for (const [lx, lz] of [
    [-sx * 0.38, -sz * 0.3],
    [sx * 0.38, -sz * 0.3],
    [-sx * 0.38, sz * 0.3],
    [sx * 0.38, sz * 0.3],
  ] as [number, number][]) {
    const leg = new THREE.Mesh(legGeo, skinMat);
    leg.position.set(lx, legH * 0.5, lz);
    group.add(leg);

    const foot = new THREE.Mesh(footGeo, skinMat);
    foot.position.set(lx, sy * 0.03, lz);
    group.add(foot);
  }

  const shell = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.55, 8, 6), shellMat);
  shell.position.y = sy * 0.42;
  shell.scale.set(1.1, 0.55, 1.25);

  const shellBase = new THREE.Color(color);
  const hexLight = new THREE.MeshToonMaterial({
    color: shellBase.clone().lerp(new THREE.Color('#e8f0c8'), 0.38),
  });
  const hexDark = new THREE.MeshToonMaterial({
    color: shellBase.clone().lerp(new THREE.Color('#1a2410'), 0.45),
  });
  const hexGeo = new THREE.CylinderGeometry(1, 1, 0.055, 6);
  const hexPlates: [number, number, number, number, boolean][] = [
    [0, 0.54, 0, 0.22, false],
    [0, 0.5, 0.22, 0.15, true],
    [0, 0.5, -0.22, 0.15, false],
    [0.2, 0.48, 0.12, 0.14, true],
    [-0.2, 0.48, 0.12, 0.14, false],
    [0.2, 0.48, -0.12, 0.14, false],
    [-0.2, 0.48, -0.12, 0.14, true],
    [0.26, 0.46, 0, 0.13, false],
    [-0.26, 0.46, 0, 0.13, true],
    [0, 0.46, -0.3, 0.12, true],
    [0, 0.47, 0.3, 0.12, false],
    [0.14, 0.45, 0.24, 0.11, true],
    [-0.14, 0.45, -0.24, 0.11, true],
  ];
  for (const [lx, ly, lz, r, dark] of hexPlates) {
    const hex = new THREE.Mesh(hexGeo, dark ? hexDark : hexLight);
    hex.position.set(lx * sx, ly * sy, lz * sz);
    hex.scale.set(r * sx, 1, r * sz);
    shell.add(hex);
  }

  group.add(shell);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.18, sy * 0.16, sz * 0.34), skinMat);
  tail.position.set(0, sy * 0.2, -sz * 0.6);
  group.add(tail);

  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.1, 6, 5), skinMat);
  tailTip.position.set(0, sy * 0.17, -sz * 0.9);
  tailTip.scale.set(0.75, 0.55, 1.1);
  group.add(tailTip);

  const headY = sy * 0.18;
  const headParts: { mesh: THREE.Mesh; rest: THREE.Vector3 }[] = [];

  const addHeadPart = (mesh: THREE.Mesh, pos: THREE.Vector3): void => {
    mesh.position.copy(pos);
    group.add(mesh);
    headParts.push({ mesh, rest: pos.clone() });
  };

  const head = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.46, sy * 0.3, sz * 0.38), skinMat);
  addHeadPart(head, new THREE.Vector3(0, headY, sz * 0.5));

  const faceMat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#4A5A32'), 0.35),
  });
  const snout = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.28, sy * 0.16, sz * 0.2), faceMat);
  addHeadPart(snout, new THREE.Vector3(0, headY - sy * 0.02, sz * 0.72));

  const eyeWhiteMat = new THREE.MeshToonMaterial({ color: 0xf8fafc });
  const eyeMat = new THREE.MeshToonMaterial({ color: 0x1a1a2e });
  for (const side of [-1, 1] as const) {
    const eyeY = headY + sy * 0.1;
    const eyeX = side * sx * 0.24;
    const eyeZ = sz * 0.56;

    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.2, 8, 6), eyeWhiteMat);
    eyeWhite.scale.set(1, 1.15, 0.8);
    addHeadPart(eyeWhite, new THREE.Vector3(eyeX, eyeY, eyeZ));

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.13, 6, 5), eyeMat);
    addHeadPart(pupil, new THREE.Vector3(eyeX, eyeY, eyeZ + sz * 0.06));
  }

  group.userData = {
    ...group.userData,
    isTortoise: true,
    headParts,
    scale: [sx, sy, sz] as [number, number, number],
  };

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

interface TortoiseMotionData {
  isTortoise: true;
  headParts: { mesh: THREE.Mesh; rest: THREE.Vector3 }[];
  scale: [number, number, number];
}

/** Bob and stretch tortoise head while walking. */
export function updateTortoiseHeadMove(
  mesh: THREE.Object3D,
  phase: number,
  intensity: number,
  retractT = 0
): void {
  const data = mesh.userData as Partial<TortoiseMotionData>;
  if (!data.isTortoise || !data.headParts || !data.scale) return;

  const amp = Math.max(0, Math.min(1, intensity)) * (1 - retractT);
  const [sx, sy, sz] = data.scale;
  const sway = Math.sin(phase * 2.5) * sx * 0.06 * amp;
  const bob = Math.sin(phase * 4) * sy * 0.07 * amp;
  const reach = Math.sin(phase * 3) * sz * 0.14 * amp;

  const scaleMult = 1 - retractT * 0.85;
  const pullZ = -sz * 0.45 * retractT;
  const pullY = -sy * 0.12 * retractT;

  for (const part of data.headParts) {
    part.mesh.scale.setScalar(scaleMult);
    part.mesh.position.set(
      part.rest.x * scaleMult + sway,
      part.rest.y + pullY + bob,
      part.rest.z + pullZ + reach
    );
  }
}

interface SnakeWiggleData {
  isSnake: true;
  segmentMeshes: THREE.Mesh[];
  restPositions: THREE.Vector3[];
  headRest: THREE.Vector3;
  headMesh: THREE.Mesh;
  eyeMeshes: THREE.Mesh[];
  scale: [number, number, number];
  lateralAmp: number;
  liftAmp: number;
}

/** Slithering body wave while the snake moves. */
export function updateSnakeWiggle(mesh: THREE.Object3D, phase: number, intensity: number): void {
  const data = mesh.userData as Partial<SnakeWiggleData>;
  if (
    !data.isSnake ||
    !data.segmentMeshes ||
    !data.restPositions ||
    !data.headMesh ||
    !data.headRest ||
    !data.eyeMeshes ||
    !data.scale ||
    data.lateralAmp === undefined ||
    data.liftAmp === undefined
  ) {
    return;
  }

  const amp = Math.max(0, Math.min(1, intensity));
  const segments = data.segmentMeshes;
  const rests = data.restPositions;
  const lateralAmp = data.lateralAmp;
  const liftAmp = data.liftAmp;

  // Calculate phase scale based on segment count to keep the wave shape consistent (spanning ~1.35 cycles for S-shape)
  const phaseScale = 8.5 / Math.max(1, segments.length - 1);
  const liftScale = 5.0 / Math.max(1, segments.length - 1);
  const surgeScale = 3.5 / Math.max(1, segments.length - 1);

  for (let i = 0; i < segments.length; i++) {
    const rest = rests[i];
    // Wave propagates from head (last segment) to tail (first segment)
    const distFromHead = segments.length - 1 - i;
    const wave = Math.sin(phase * 2.5 - distFromHead * phaseScale) * lateralAmp * amp;
    const lift = Math.sin(phase * 2.0 - distFromHead * liftScale) * liftAmp * amp * 0.35;
    const surge = Math.sin(phase * 1.5 - distFromHead * surgeScale) * amp * 0.06;
    segments[i].position.set(rest.x + wave, rest.y + lift, rest.z + surge);
  }

  const headRest = data.headRest;
  const [sx, sy, sz] = data.scale;
  // Head is slightly ahead of the neck segment (index segments.length - 1)
  const headWave = Math.sin(phase * 2.5 + phaseScale) * lateralAmp * amp * 0.55;
  const headLift = Math.sin(phase * 2.0 + liftScale) * liftAmp * amp * 0.35;
  const headReach = Math.sin(phase * 2.5 + phaseScale) * sz * 0.12 * amp;
  data.headMesh.position.set(
    headRest.x + headWave,
    headRest.y + headLift,
    headRest.z + Math.sin(phase * 1.5 + surgeScale) * amp * 0.06 + headReach
  );

  const h = data.headMesh.position;
  for (const eye of data.eyeMeshes) {
    const side = (eye.userData.eyeSide as number) ?? 1;
    eye.position.set(h.x + side * sx * 0.35, h.y + sy * 0.08, h.z + sz * 0.06);
  }
}

/** Low-poly snake — segmented body with head. */
export function createSnakeMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const bodyMat = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const bellyMat = new THREE.MeshToonMaterial({
    color: new THREE.Color('#e0c296'),
  });
  const segmentCount = 12;
  const spacing = (sz * 0.8) / (segmentCount - 1);
  const segmentMeshes: THREE.Mesh[] = [];
  const restPositions: THREE.Vector3[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const t = i / (segmentCount - 1);
    const taper = 0.55 + (1 - Math.abs(t - 0.5) * 1.4) * 0.45;
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(sx * taper, 6, 5),
      i % 2 === 0 ? bodyMat : bellyMat
    );
    const rest = new THREE.Vector3(0, sy * 0.45, -sz * 0.4 + i * spacing);
    seg.position.copy(rest);
    seg.scale.set(1, 0.65, 1.1);
    group.add(seg);
    segmentMeshes.push(seg);
    restPositions.push(rest);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.9, 6, 5), bodyMat);
  const headRest = new THREE.Vector3(0, sy * 0.5, sz * 0.46);
  head.position.copy(headRest);
  head.scale.set(1.1, 0.75, 1.2);
  group.add(head);

  const eyeMat = new THREE.MeshToonMaterial({ color: 0x1a1a2e });
  const eyeMeshes: THREE.Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.12, 4, 4), eyeMat);
    eye.position.set(side * sx * 0.35, sy * 0.58, sz * 0.48);
    eye.userData.eyeSide = side;
    group.add(eye);
    eyeMeshes.push(eye);
  }

  const wiggleData: SnakeWiggleData = {
    isSnake: true,
    segmentMeshes,
    restPositions,
    headRest,
    headMesh: head,
    eyeMeshes,
    scale: [sx, sy, sz],
    lateralAmp: sx * 2.8,
    liftAmp: sy * 0.2,
  };
  group.userData = { ...group.userData, ...wiggleData };

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

function enablePropShadows(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/** Suburban ranch house — siding, gabled roof, garage, porch, chimney. */
export function createSuburbanHouseMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const base = new THREE.Color(color);
  const siding = new THREE.MeshToonMaterial({ color: base });
  const sidingDark = new THREE.MeshToonMaterial({
    color: base.clone().lerp(new THREE.Color('#9CA3AF'), 0.22),
  });
  const roof = new THREE.MeshToonMaterial({
    color: base.clone().lerp(new THREE.Color('#7F1D1D'), 0.55),
  });
  const trim = new THREE.MeshToonMaterial({ color: '#F5F5F4' });
  const foundation = new THREE.MeshToonMaterial({
    color: base.clone().lerp(new THREE.Color('#57534E'), 0.5),
  });
  const glass = new THREE.MeshToonMaterial({ color: '#93C5FD' });
  const door = new THREE.MeshToonMaterial({ color: '#78350F' });
  const brick = new THREE.MeshToonMaterial({ color: '#9A3412' });

  const slab = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.98, sy * 0.06, sz * 0.92), foundation);
  slab.position.y = sy * 0.03;
  group.add(slab);

  const mainH = sy * 0.42;
  const main = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.72, mainH, sz * 0.62), siding);
  main.position.set(-sx * 0.06, sy * 0.06 + mainH * 0.5, -sz * 0.04);
  group.add(main);

  const garageH = sy * 0.34;
  const garage = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.34, garageH, sz * 0.38), sidingDark);
  garage.position.set(sx * 0.3, sy * 0.06 + garageH * 0.5, sz * 0.14);
  group.add(garage);

  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.28, garageH * 0.78, sz * 0.04), trim);
  doorPanel.position.set(sx * 0.3, sy * 0.06 + garageH * 0.42, sz * 0.34);
  group.add(doorPanel);

  const roofY = sy * 0.06 + mainH + sy * 0.08;
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.4, sy * 0.12, sz * 0.72), roof);
  roofL.position.set(-sx * 0.22, roofY, -sz * 0.04);
  roofL.rotation.z = 0.52;
  group.add(roofL);

  const roofR = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.4, sy * 0.12, sz * 0.72), roof);
  roofR.position.set(sx * 0.1, roofY, -sz * 0.04);
  roofR.rotation.z = -0.52;
  group.add(roofR);

  const garageRoof = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.36, sy * 0.1, sz * 0.42), roof);
  garageRoof.position.set(sx * 0.3, sy * 0.06 + garageH + sy * 0.05, sz * 0.14);
  group.add(garageRoof);

  const porch = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.22, sy * 0.05, sz * 0.2), trim);
  porch.position.set(-sx * 0.06, sy * 0.09, sz * 0.38);
  group.add(porch);

  const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.1, sy * 0.2, sz * 0.04), door);
  frontDoor.position.set(-sx * 0.06, sy * 0.22, sz * 0.36);
  group.add(frontDoor);

  const winGeo = new THREE.BoxGeometry(sx * 0.1, sy * 0.12, sz * 0.03);
  for (const [wx, wz] of [
    [-sx * 0.28, -sz * 0.22],
    [sx * 0.08, -sz * 0.22],
    [-sx * 0.28, sz * 0.08],
  ] as [number, number][]) {
    const win = new THREE.Mesh(winGeo, glass);
    win.position.set(wx, sy * 0.34, wz);
    group.add(win);
  }

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.1, sy * 0.28, sz * 0.1), brick);
  chimney.position.set(-sx * 0.24, sy * 0.62, -sz * 0.2);
  group.add(chimney);

  const shrub = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.08, 6, 5), new THREE.MeshToonMaterial({ color: '#166534' }));
  shrub.position.set(-sx * 0.38, sy * 0.1, sz * 0.32);
  shrub.scale.set(1.2, 0.7, 1.2);
  group.add(shrub);

  enablePropShadows(group);
  return group;
}

/** Suburban sedan — body, cabin, wheels, lights, and glass. */
export function createSuburbanCarMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const bodyColor = new THREE.Color(color);
  const paint = new THREE.MeshToonMaterial({ color: bodyColor });
  const paintDark = new THREE.MeshToonMaterial({
    color: bodyColor.clone().lerp(new THREE.Color('#1F2937'), 0.35),
  });
  const trim = new THREE.MeshToonMaterial({ color: '#E5E7EB' });
  const glass = new THREE.MeshToonMaterial({ color: '#BFDBFE' });
  const tire = new THREE.MeshToonMaterial({ color: '#1F2937' });
  const hub = new THREE.MeshToonMaterial({ color: '#9CA3AF' });
  const lamp = new THREE.MeshToonMaterial({ color: '#FEF9C3' });

  const wheelR = sy * 0.2;
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, sx * 0.22, 10);
  const hubGeo = new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, sx * 0.24, 8);
  for (const [wx, wz] of [
    [-sx * 0.42, sz * 0.3],
    [sx * 0.42, sz * 0.3],
    [-sx * 0.42, -sz * 0.3],
    [sx * 0.42, -sz * 0.3],
  ] as [number, number][]) {
    const wheel = new THREE.Mesh(wheelGeo, tire);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wheelR, wz);
    group.add(wheel);

    const cap = new THREE.Mesh(hubGeo, hub);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(wx, wheelR, wz);
    group.add(cap);
  }

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.92, sy * 0.28, sz * 0.88), paintDark);
  chassis.position.y = sy * 0.2;
  group.add(chassis);

  const body = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.88, sy * 0.32, sz * 0.72), paint);
  body.position.set(0, sy * 0.38, -sz * 0.04);
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.78, sy * 0.3, sz * 0.42), paint);
  cabin.position.set(0, sy * 0.62, -sz * 0.06);
  group.add(cabin);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.7, sy * 0.22, sz * 0.06), glass);
  windshield.position.set(0, sy * 0.64, sz * 0.16);
  windshield.rotation.x = -0.35;
  group.add(windshield);

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.68, sy * 0.18, sz * 0.05), glass);
  rearGlass.position.set(0, sy * 0.6, -sz * 0.28);
  rearGlass.rotation.x = 0.25;
  group.add(rearGlass);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.82, sy * 0.12, sz * 0.28), paint);
  hood.position.set(0, sy * 0.46, sz * 0.34);
  group.add(hood);

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.86, sy * 0.1, sz * 0.08), trim);
  bumperF.position.set(0, sy * 0.18, sz * 0.46);
  group.add(bumperF);

  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.86, sy * 0.1, sz * 0.08), trim);
  bumperR.position.set(0, sy * 0.18, -sz * 0.46);
  group.add(bumperR);

  for (const side of [-1, 1] as const) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.14, sy * 0.1, sz * 0.06), lamp);
    head.position.set(side * sx * 0.34, sy * 0.3, sz * 0.42);
    group.add(head);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.12, sy * 0.08, sz * 0.05), new THREE.MeshToonMaterial({ color: '#DC2626' }));
    tail.position.set(side * sx * 0.34, sy * 0.32, -sz * 0.42);
    group.add(tail);
  }

  enablePropShadows(group);
  return group;
}

type RockMeshProfile = 'boulder' | 'ridge';

function createRockMesh(
  color: string,
  scale: [number, number, number],
  profile: RockMeshProfile
): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const base = new THREE.Color(color);
  const rockLight = new THREE.MeshToonMaterial({
    color: base.clone().lerp(new THREE.Color('#D6D3D1'), profile === 'ridge' ? 0.38 : 0.32),
  });
  const rockMid = new THREE.MeshToonMaterial({ color: base });
  const rockDark = new THREE.MeshToonMaterial({
    color: base.clone().lerp(new THREE.Color('#292524'), profile === 'ridge' ? 0.52 : 0.48),
  });
  const rockWarm = new THREE.MeshToonMaterial({
    color: base.clone().lerp(new THREE.Color('#78716C'), 0.25),
  });
  const rockGranite = new THREE.MeshToonMaterial({
    color: base.clone().lerp(new THREE.Color('#E7E5E4'), 0.42),
  });
  const mossMat = new THREE.MeshToonMaterial({
    color: base.clone().lerp(new THREE.Color('#4D7C0F'), 0.55),
  });
  const lichenMat = new THREE.MeshToonMaterial({
    color: base.clone().lerp(new THREE.Color('#64748B'), 0.35),
  });
  const mats = [rockMid, rockLight, rockDark, rockWarm];
  const flatness = profile === 'ridge' ? 0.58 : 0.74;

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(sx * 0.46, 2), rockMid);
  core.position.y = sy * 0.44;
  core.scale.set(1.08, (sy / sx) * flatness, (sz / sx) * 1.02);
  core.rotation.set(0.12, 0.48, -0.18);
  group.add(core);

  const lobe = new THREE.Mesh(new THREE.IcosahedronGeometry(sx * 0.28, 1), rockWarm);
  lobe.position.set(-sx * 0.18, sy * (profile === 'ridge' ? 0.5 : 0.56), sz * 0.14);
  lobe.scale.set(1.1, profile === 'ridge' ? 0.72 : 0.85, 1.15);
  lobe.rotation.set(-0.35, 0.9, 0.2);
  group.add(lobe);

  if (profile === 'ridge') {
    const shelf = new THREE.Mesh(new THREE.IcosahedronGeometry(sx * 0.22, 1), rockDark);
    shelf.position.set(sx * 0.2, sy * 0.28, -sz * 0.16);
    shelf.scale.set(1.2, 0.55, 1.05);
    shelf.rotation.set(0.2, -0.6, 0.15);
    group.add(shelf);
  }

  const chunks: [number, number, number, number, number, number][] =
    profile === 'ridge'
      ? [
          [sx * 0.34, sy * 0.26, sz * 0.12, sx * 0.2, 1, 0],
          [-sx * 0.3, sy * 0.22, -sz * 0.18, sx * 0.17, 2, 1],
          [sx * 0.08, sy * 0.52, sz * 0.24, sx * 0.15, 0, 0],
          [-sx * 0.12, sy * 0.44, -sz * 0.28, sx * 0.13, 1, 1],
          [sx * 0.22, sy * 0.16, -sz * 0.3, sx * 0.11, 2, 0],
          [-sx * 0.02, sy * 0.58, -sz * 0.06, sx * 0.1, 3, 1],
          [sx * 0.38, sy * 0.34, -sz * 0.04, sx * 0.09, 0, 1],
          [-sx * 0.34, sy * 0.3, sz * 0.24, sx * 0.08, 2, 0],
          [sx * 0.14, sy * 0.36, sz * 0.32, sx * 0.07, 3, 2],
          [-sx * 0.24, sy * 0.14, sz * 0.08, sx * 0.06, 1, 2],
        ]
      : [
          [sx * 0.36, sy * 0.3, sz * 0.14, sx * 0.22, 1, 0],
          [-sx * 0.32, sy * 0.24, -sz * 0.2, sx * 0.19, 2, 1],
          [sx * 0.1, sy * 0.66, sz * 0.28, sx * 0.18, 0, 0],
          [-sx * 0.14, sy * 0.54, -sz * 0.3, sx * 0.16, 1, 1],
          [sx * 0.24, sy * 0.2, -sz * 0.34, sx * 0.13, 2, 0],
          [-sx * 0.04, sy * 0.72, -sz * 0.08, sx * 0.12, 3, 1],
          [sx * 0.42, sy * 0.42, -sz * 0.06, sx * 0.11, 0, 1],
          [-sx * 0.38, sy * 0.38, sz * 0.28, sx * 0.1, 2, 0],
        ];

  for (let i = 0; i < chunks.length; i++) {
    const [cx, cy, cz, r, matIdx, geoKind] = chunks[i];
    const geo =
      geoKind === 0
        ? new THREE.DodecahedronGeometry(r, 0)
        : geoKind === 1
          ? new THREE.OctahedronGeometry(r, 0)
          : new THREE.IcosahedronGeometry(r, 0);
    const chunk = new THREE.Mesh(geo, mats[matIdx % mats.length]);
    chunk.position.set(cx, cy, cz);
    chunk.rotation.set((i + 1) * 0.61, (i + 2) * 1.07, (i + 3) * 0.39);
    chunk.scale.set(1, 0.7 + (i % 3) * 0.08, 1.04 + (i % 2) * 0.06);
    group.add(chunk);
  }

  if (profile === 'boulder') {
    for (const [mx, my, mz, rx, ry, mossScale] of [
      [sx * 0.12, sy * 0.58, sz * 0.18, 0.4, 0.2, 1.2],
      [-sx * 0.22, sy * 0.48, -sz * 0.12, -0.25, 0.55, 0.95],
      [sx * 0.28, sy * 0.34, -sz * 0.22, 0.15, -0.35, 1.05],
    ] as [number, number, number, number, number, number][]) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.11, 5, 4), mossMat);
      patch.position.set(mx, my, mz);
      patch.rotation.set(rx, ry, 0.3);
      patch.scale.set(mossScale, 0.35, mossScale * 0.9);
      group.add(patch);
    }
  } else {
    for (const [lx, ly, lz, lichenScale] of [
      [sx * 0.1, sy * 0.42, sz * 0.2, 1.15],
      [-sx * 0.18, sy * 0.34, -sz * 0.1, 0.9],
      [sx * 0.24, sy * 0.28, -sz * 0.18, 1.05],
    ] as [number, number, number, number][]) {
      const lichen = new THREE.Mesh(new THREE.SphereGeometry(sx * 0.09, 5, 4), lichenMat);
      lichen.position.set(lx, ly, lz);
      lichen.scale.set(lichenScale, 0.28, lichenScale * 0.85);
      group.add(lichen);
    }

    const fleckGeo = new THREE.SphereGeometry(sx * 0.035, 4, 3);
    for (let i = 0; i < 14; i++) {
      const angle = i * 1.37;
      const fleck = new THREE.Mesh(fleckGeo, i % 2 === 0 ? rockGranite : rockLight);
      fleck.position.set(
        Math.cos(angle) * sx * (0.18 + (i % 4) * 0.08),
        sy * (0.22 + (i % 5) * 0.08),
        Math.sin(angle) * sz * (0.16 + (i % 3) * 0.07)
      );
      group.add(fleck);
    }
  }

  const creviceGeo = new THREE.BoxGeometry(sx * 0.04, sy * 0.55, sz * 0.03);
  const creviceCount = profile === 'ridge' ? 5 : 3;
  for (let i = 0; i < creviceCount; i++) {
    const crevice = new THREE.Mesh(creviceGeo, rockDark);
    crevice.position.set(
      (i - 1) * sx * 0.07,
      sy * (0.38 + (i % 3) * 0.08),
      ((i % 2) * 2 - 1) * sz * 0.07
    );
    crevice.rotation.set(0.1 + i * 0.12, 0.35 + i * 0.18, (i % 2) * 0.08);
    group.add(crevice);
  }

  const chipGeo = new THREE.TetrahedronGeometry(sx * 0.07, 0);
  const flakeGeo = new THREE.OctahedronGeometry(sx * 0.05, 0);
  const chipCount = profile === 'ridge' ? 10 : 8;
  for (let i = 0; i < chipCount; i++) {
    const angle = i * 0.85;
    const chip = new THREE.Mesh(i % 2 === 0 ? chipGeo : flakeGeo, i % 3 === 0 ? rockLight : rockDark);
    chip.position.set(
      Math.cos(angle) * sx * 0.44,
      sy * (0.05 + (i % 4) * 0.04),
      Math.sin(angle) * sz * 0.38
    );
    chip.rotation.set(angle * 0.7, angle * 1.3, angle * 0.4);
    chip.scale.setScalar(0.75 + (i % 3) * 0.15);
    group.add(chip);
  }

  const bed = new THREE.Mesh(
    new THREE.CylinderGeometry(sx * 0.52, sx * 0.58, sy * 0.06, 7),
    rockDark
  );
  bed.position.y = sy * 0.03;
  bed.scale.set(1, 1, sz / sx);
  group.add(bed);

  enablePropShadows(group);
  return group;
}

/** Faceted boulder — layered rock chunks, moss, cracks, and scatter chips. */
export function createBoulderMesh(color: string, scale: [number, number, number]): THREE.Group {
  return createRockMesh(color, scale, 'boulder');
}

/** Ridge scatter rock — flat granite mass with lichen flecks and heavy facet detail. */
export function createRidgeRockMesh(color: string, scale: [number, number, number]): THREE.Group {
  return createRockMesh(color, scale, 'ridge');
}

/** Joshua tree — forked trunk with spiky yucca crowns. */
export function createJoshuaTreeMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const bark = new THREE.MeshToonMaterial({
    color: new THREE.Color('#6B5B45').lerp(new THREE.Color(color), 0.25),
  });
  const leafMat = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const leafDark = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#3D4A32'), 0.35),
  });

  // 1. Lower Trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(sx * 0.12, sx * 0.16, sy * 0.45, 6), bark);
  trunk.position.set(0, sy * 0.225, 0);
  group.add(trunk);

  // Helper to add a branch segment
  const addBranch = (midX: number, midY: number, midZ: number, height: number, rotX: number, rotZ: number): void => {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(sx * 0.08, sx * 0.11, height, 5), bark);
    branch.position.set(midX, midY, midZ);
    branch.rotation.set(rotX, 0, rotZ);
    group.add(branch);
  };

  // Shared geometries for performance
  const coreGeo = new THREE.SphereGeometry(sx * 0.08, 5, 4);
  const spikeGeo = new THREE.ConeGeometry(sx * 0.036, sy * 0.32, 3);

  // Helper to add a spiky yucca ball crown
  const addCrown = (cx: number, cy: number, cz: number, rotZ: number): void => {
    const crownGroup = new THREE.Group();
    crownGroup.position.set(cx, cy, cz);
    crownGroup.rotation.z = rotZ;

    // Central core
    const core = new THREE.Mesh(coreGeo, leafMat);
    crownGroup.add(core);

    // 15 spikes uniformly distributed on a sphere using Fibonacci sphere algorithm
    const numSpikes = 15;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // Golden angle (~2.399 rad)
    
    for (let i = 0; i < numSpikes; i++) {
      const y = 1 - (i / (numSpikes - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * goldenAngle;

      const dx = Math.cos(theta) * radiusAtY;
      const dz = Math.sin(theta) * radiusAtY;
      const dy = y;

      const spike = new THREE.Mesh(spikeGeo, i % 2 === 0 ? leafMat : leafDark);
      const offset = sy * 0.12;
      spike.position.set(dx * offset, dy * offset, dz * offset);

      // Point the spike outward from core
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      
      crownGroup.add(spike);
    }

    group.add(crownGroup);
  };

  // 2. Main Branch Segments
  // Left side
  addBranch(-sx * 0.11, sy * 0.55, sz * 0.025, sy * 0.26, 0.1, 0.8);
  addBranch(-sx * 0.3, sy * 0.735, sz * 0.075, sy * 0.24, 0.2, 0.7);
  addBranch(-sx * 0.2, sy * 0.75, 0, sy * 0.24, 0, -0.2);

  // Right side
  addBranch(sx * 0.12, sy * 0.535, -sz * 0.015, sy * 0.26, 0, -0.8);
  addBranch(sx * 0.21, sy * 0.74, sz * 0.01, sy * 0.26, 0, 0.2);
  addBranch(sx * 0.31, sy * 0.7, -sz * 0.05, sy * 0.22, 0, -0.8);

  // Center/Back
  addBranch(0, sy * 0.565, -sz * 0.075, sy * 0.25, -0.6, 0);
  addBranch(0, sy * 0.79, -sz * 0.175, sy * 0.24, -0.3, 0);

  // 3. Spiky Yucca Crowns
  // Left Outer
  addCrown(-sx * 0.38, sy * 0.82, sz * 0.1, -0.6);
  // Left Inner
  addCrown(-sx * 0.18, sy * 0.85, -sz * 0.05, -0.15);
  // Right Inner
  addCrown(sx * 0.18, sy * 0.86, sz * 0.05, 0.15);
  // Right Outer
  addCrown(sx * 0.38, sy * 0.78, -sz * 0.08, 0.6);
  // Center Back
  addCrown(0, sy * 0.9, -sz * 0.2, 0);

  enablePropShadows(group);
  return group;
}

/** Weathered desert fence section — crooked posts and sagging rails. */
export function createWoodFenceMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const wood = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const woodDark = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#4A3F32'), 0.4),
  });

  const postGeo = new THREE.BoxGeometry(sx * 0.08, sy * 0.92, sz * 1.4);
  const postXs = [-sx * 0.46, -sx * 0.15, sx * 0.18, sx * 0.46];
  const leans = [0.08, -0.04, 0.06, -0.1];
  for (let i = 0; i < postXs.length; i++) {
    const post = new THREE.Mesh(postGeo, i % 2 === 0 ? wood : woodDark);
    post.position.set(postXs[i], sy * 0.46, 0);
    post.rotation.z = leans[i];
    if (i === 1) post.scale.y = 0.88;
    group.add(post);
  }

  const railGeo = new THREE.BoxGeometry(sx * 0.96, sy * 0.1, sz * 0.55);
  for (const [y, tilt] of [
    [sy * 0.68, -0.06],
    [sy * 0.38, 0.05],
  ] as [number, number][]) {
    const rail = new THREE.Mesh(railGeo, wood);
    rail.position.set(0, y, 0);
    rail.rotation.z = tilt;
    group.add(rail);
  }

  const broken = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.22, sy * 0.14, sz * 0.5), woodDark);
  broken.position.set(sx * 0.32, sy * 0.1, sz * 0.35);
  broken.rotation.z = 0.4;
  broken.rotation.y = 0.5;
  group.add(broken);

  enablePropShadows(group);
  return group;
}

/** Solar panel farm — tilted arrays on a metal frame. */
export function createSolarFarmMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const panelMat = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const frameMat = new THREE.MeshToonMaterial({ color: new THREE.Color('#64748B') });
  const glintMat = new THREE.MeshToonMaterial({
    color: new THREE.Color('#7DD3FC').lerp(new THREE.Color(color), 0.5),
  });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.98, sy * 0.12, sz * 0.92), frameMat);
  frame.position.y = sy * 0.08;
  group.add(frame);

  const legGeo = new THREE.CylinderGeometry(sx * 0.03, sx * 0.04, sy * 0.35, 5);
  for (const [lx, lz] of [
    [-sx * 0.42, -sz * 0.38],
    [sx * 0.42, -sz * 0.38],
    [-sx * 0.42, sz * 0.38],
    [sx * 0.42, sz * 0.38],
  ] as [number, number][]) {
    const leg = new THREE.Mesh(legGeo, frameMat);
    leg.position.set(lx, sy * 0.2, lz);
    group.add(leg);
  }

  const panelGeo = new THREE.BoxGeometry(sx * 0.38, sy * 0.04, sz * 0.32);
  const rows = 2;
  const cols = 3;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const panel = new THREE.Mesh(panelGeo, col % 2 === 0 ? panelMat : glintMat);
      const px = (col - (cols - 1) / 2) * sx * 0.34;
      const pz = (row - (rows - 1) / 2) * sz * 0.36;
      panel.position.set(px, sy * 0.42 + row * sy * 0.06, pz);
      panel.rotation.x = -0.55;
      group.add(panel);
    }
  }

  const box = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.12, sy * 0.18, sz * 0.1), frameMat);
  box.position.set(-sx * 0.44, sy * 0.14, sz * 0.42);
  group.add(box);

  enablePropShadows(group);
  return group;
}

/** A-frame camping tent — Kenney Survival Kit–inspired procedural mesh (CC0 reference). */
export function createAFrameTentMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const canvas = new THREE.MeshToonMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide });
  const canvasDark = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#292524'), 0.32),
    side: THREE.DoubleSide,
  });
  const canvasLight = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#FEF3C7'), 0.28),
    side: THREE.DoubleSide,
  });

  const ridgeH = sy * 0.92;
  const halfW = sx * 0.48;
  const halfD = sz * 0.46;
  const wallDepth = halfD * 2;

  const makePanelShape = (left: boolean): THREE.Shape => {
    const shape = new THREE.Shape();
    if (left) {
      shape.moveTo(-halfW, 0);
      shape.lineTo(0, ridgeH);
      shape.lineTo(0, 0);
    } else {
      shape.moveTo(0, 0);
      shape.lineTo(0, ridgeH);
      shape.lineTo(halfW, 0);
    }
    shape.closePath();
    return shape;
  };

  const panelGeo = (left: boolean) =>
    new THREE.ExtrudeGeometry(makePanelShape(left), { depth: wallDepth, bevelEnabled: false });

  const leftPanel = new THREE.Mesh(panelGeo(true), canvas);
  leftPanel.position.z = -halfD;
  group.add(leftPanel);

  const rightPanel = new THREE.Mesh(panelGeo(false), canvasDark);
  rightPanel.position.z = -halfD;
  group.add(rightPanel);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.04, ridgeH * 0.7, wallDepth * 0.92), canvasDark);
  backWall.position.set(0, ridgeH * 0.35, -halfD + wallDepth * 0.04);
  group.add(backWall);

  const frontFlap = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.32, ridgeH * 0.5, sz * 0.04), canvasLight);
  frontFlap.position.set(0, ridgeH * 0.25, halfD - sz * 0.02);
  frontFlap.rotation.x = -0.3;
  group.add(frontFlap);

  enablePropShadows(group);

  const bounds = new THREE.Box3().setFromObject(group);
  group.position.y -= bounds.min.y;

  return group;
}

/** Stone-ring campfire with crossed logs and low-poly flames. */
export function createCampfireMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const rockMat = new THREE.MeshToonMaterial({ color: '#78716C' });
  const rockDark = new THREE.MeshToonMaterial({ color: '#57534E' });
  const logMat = new THREE.MeshToonMaterial({ color: '#5C4033' });
  const emberMat = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const flameMat = new THREE.MeshToonMaterial({ color: '#FBBF24' });
  const flameHot = new THREE.MeshToonMaterial({ color: '#F97316' });

  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(sx * (0.09 + (i % 3) * 0.015), 0),
      i % 2 === 0 ? rockMat : rockDark
    );
    rock.position.set(
      Math.cos(angle) * sx * 0.42,
      sy * 0.14,
      Math.sin(angle) * sz * 0.42
    );
    rock.scale.set(1.05, 0.55 + (i % 2) * 0.15, 1);
    rock.rotation.y = angle;
    group.add(rock);
  }

  const logGeo = new THREE.CylinderGeometry(sx * 0.055, sx * 0.065, sx * 0.52, 5);
  for (const rot of [0.55, -0.55, 0.15] as const) {
    const log = new THREE.Mesh(logGeo, logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rot;
    log.position.y = sy * 0.16;
    group.add(log);
  }

  const ash = new THREE.Mesh(
    new THREE.CylinderGeometry(sx * 0.2, sx * 0.24, sy * 0.07, 7),
    emberMat
  );
  ash.position.y = sy * 0.1;
  group.add(ash);

  const flameSpecs: [number, number, number, number, number][] = [
    [0, sy * 0.42, 0, sx * 0.11, sy * 0.48],
    [-sx * 0.1, sy * 0.34, sz * 0.04, sx * 0.08, sy * 0.38],
    [sx * 0.09, sy * 0.36, -sz * 0.03, sx * 0.09, sy * 0.42],
  ];
  for (let i = 0; i < flameSpecs.length; i++) {
    const [fx, fy, fz, fr, fh] = flameSpecs[i];
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(fr, fh, 4),
      i === 0 ? flameHot : flameMat
    );
    flame.position.set(fx, fy, fz);
    flame.rotation.y = i * 1.2;
    group.add(flame);
  }

  enablePropShadows(group);
  return group;
}

/** Wooden picnic table with paired benches. */
export function createPicnicTableMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const wood = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const woodDark = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#292524'), 0.38),
  });

  const legH = sy * 0.42;
  const legGeo = new THREE.BoxGeometry(sx * 0.07, legH, sz * 0.07);
  const tableLegs: [number, number][] = [
    [-sx * 0.38, -sz * 0.18],
    [sx * 0.38, -sz * 0.18],
    [-sx * 0.38, sz * 0.18],
    [sx * 0.38, sz * 0.18],
  ];
  for (const [lx, lz] of tableLegs) {
    const leg = new THREE.Mesh(legGeo, woodDark);
    leg.position.set(lx, legH * 0.5, lz);
    group.add(leg);
  }

  const top = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.96, sy * 0.08, sz * 0.42), wood);
  top.position.y = legH + sy * 0.04;
  group.add(top);

  const benchH = legH * 0.52;
  const benchLegGeo = new THREE.BoxGeometry(sx * 0.05, benchH, sz * 0.05);
  for (const bz of [-sz * 0.38, sz * 0.38]) {
    for (const bx of [-sx * 0.34, sx * 0.34]) {
      const leg = new THREE.Mesh(benchLegGeo, woodDark);
      leg.position.set(bx, benchH * 0.5, bz);
      group.add(leg);
    }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.88, sy * 0.06, sz * 0.11), wood);
    bench.position.set(0, benchH + sy * 0.03, bz);
    group.add(bench);
  }

  enablePropShadows(group);
  return group;
}

/** Split log bench for campsite seating. */
export function createCampLogMesh(color: string, scale: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  const [sx, sy, sz] = scale;
  const bark = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
  const barkDark = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#292524'), 0.45),
  });
  const woodEnd = new THREE.MeshToonMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color('#D6D3D1'), 0.35),
  });

  const log = new THREE.Mesh(new THREE.CylinderGeometry(sy * 0.42, sy * 0.46, sz, 7), bark);
  log.rotation.x = Math.PI / 2;
  log.position.y = sy * 0.42;
  group.add(log);

  const flat = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.92, sy * 0.08, sx * 0.78), barkDark);
  flat.position.set(0, sy * 0.78, 0);
  group.add(flat);

  for (const side of [-1, 1] as const) {
    const end = new THREE.Mesh(new THREE.CircleGeometry(sy * 0.44, 8), woodEnd);
    end.rotation.y = Math.PI / 2;
    end.position.set(0, sy * 0.42, side * sz * 0.5);
    end.rotation.x = Math.PI / 2;
    group.add(end);
  }

  enablePropShadows(group);
  return group;
}

function createCustomPropMesh(type: string, def: ObjectDef): THREE.Group | null {
  if (type === 'goat') return createSheepMesh(def.color, def.scale);
  if (type === 'tortoise') return createTortoiseMesh(def.color, def.scale);
  if (type === 'snake') return createSnakeMesh(def.color, def.scale);
  if (type === 'car') return createSuburbanCarMesh(def.color, def.scale);
  if (type === 'small_house') return createSuburbanHouseMesh(def.color, def.scale);
  if (type === 'boulder') return createBoulderMesh(def.color, def.scale);
  if (type === 'ridge_rock' || type === 'ridge_boulder') {
    return createRidgeRockMesh(def.color, def.scale);
  }
  if (type === 'joshua_tree') return createJoshuaTreeMesh(def.color, def.scale);
  if (type === 'wood_fence') return createWoodFenceMesh(def.color, def.scale);
  if (type === 'solar_farm') return createSolarFarmMesh(def.color, def.scale);
  if (type === 'camping_gear') return createAFrameTentMesh(def.color, def.scale);
  if (type === 'campfire') return createCampfireMesh(def.color, def.scale);
  if (type === 'camp_log') return createCampLogMesh(def.color, def.scale);
  if (type === 'picnic_table') return createPicnicTableMesh(def.color, def.scale);
  return null;
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

function groundAlignMesh(mesh: THREE.Object3D, groundY: number): void {
  const box = new THREE.Box3().setFromObject(mesh);
  mesh.position.y = groundY - box.min.y;
}

export async function createAbsorbableProp(
  type: string,
  def: ObjectDef,
  x: number,
  z: number,
  y = 0,
  rotation = 0,
  pitch = 0,
  roll = 0
): Promise<AbsorbableProp> {
  const custom = createCustomPropMesh(type, def);
  const mesh = custom ?? (await createPropMeshFromDef(def));
  mesh.rotation.set(pitch, rotation, roll);
  if (pitch !== 0 || roll !== 0) {
    groundAlignMesh(mesh, y);
  } else if (custom || def.model) {
    groundAlignMesh(mesh, y);
  } else {
    mesh.position.y = def.scale[1] / 2;
  }
  const radius =
    custom || def.model ? meshRadius(mesh) : Math.max(...def.scale) * 0.6;
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
    wander: def.wander ?? false,
    wanderSpeed: def.wanderSpeed ?? 1.5,
    wanderHeading: rotation || Math.random() * Math.PI * 2,
    wanderTurnTimer: 1 + Math.random() * 2,
    setPiece: def.setPiece ?? false,
    oldX: x,
    oldZ: z,
  };
  mesh.position.set(x, mesh.position.y, z);
  mesh.userData.devPropType = type;
  mesh.userData.devPropId = prop.id;
  if (type === 'snake' || type === 'tortoise') {
    const h = prop.wanderHeading;
    mesh.rotation.y = facingAngleY(Math.cos(h), Math.sin(h), mesh.rotation.y);
  }
  return prop;
}

export function resetPropIds(): void {
  nextPropId = 0;
}

export function disposePropMesh(mesh: THREE.Object3D): void {
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) mat.dispose();
    }
  });
}

/** Rebuild a grounded prop mesh from an updated object definition. */
export async function rebuildPropMesh(
  prop: AbsorbableProp,
  type: string,
  def: ObjectDef
): Promise<THREE.Object3D> {
  const oldMesh = prop.mesh;
  const { x: rotX, y: rotY, z: rotZ } = oldMesh.rotation;
  const groundY = prop.position.y;

  const custom = createCustomPropMesh(type, def);
  const newMesh = custom ?? (await createPropMeshFromDef(def));
  newMesh.rotation.set(rotX, rotY, rotZ);

  if (custom || def.model || rotX !== 0 || rotZ !== 0) {
    groundAlignMesh(newMesh, groundY);
  } else {
    newMesh.position.y = def.scale[1] / 2;
  }

  newMesh.position.x = prop.position.x;
  newMesh.position.z = prop.position.z;

  prop.radius = custom || def.model ? meshRadius(newMesh) : Math.max(...def.scale) * 0.6;
  prop.mass = def.mass;
  prop.sizeClass = def.sizeClass;
  prop.mesh = newMesh;
  newMesh.userData.devPropType = type;
  newMesh.userData.devPropId = prop.id;

  return oldMesh;
}

export function collectModelIds(defs: Record<string, ObjectDef>): string[] {
  const ids = new Set<string>();
  for (const def of Object.values(defs)) {
    if (def.model) ids.add(def.model);
  }
  return [...ids];
}
