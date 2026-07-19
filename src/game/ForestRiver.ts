import * as THREE from 'three';
import { publicUrl } from '../utils/publicUrl';

/**
 * Low-poly forest river for a top-down camera.
 *
 * Cross-section (center → outward):
 *   water → mud lip → grass berm
 * Edge polylines use clamped miters so bends stay smooth (no square ears).
 */

export const FOREST_RIVER_HALF_WIDTH = 3.0;
const MUD_WIDTH = 1.55;
const GRASS_WIDTH = 2.4;
const PATH_SAMPLES = 160;
const RIVER_SEGMENTS = 160;
const WATER_ACROSS = 5;
const CURRENT_SPEED = 0.12; // path t per second
/** Extra arc points inserted at bends so banks don't grow triangular ears. */
const BEND_ARC_STEPS = 5;

/** Keep water clearly above the ground plane so it never z-fights. */
export const FOREST_RIVER_WATER_Y = 0.12;
const WATER_Y = FOREST_RIVER_WATER_Y;
const MUD_NEAR_Y = 0.1;
const MUD_FAR_Y = 0.13;
const GRASS_NEAR_Y = 0.13;
const GRASS_FAR_Y = 0.2;

let riverCurve: THREE.CatmullRomCurve3 | null = null;
let riverPathSamples: THREE.Vector3[] = [];

const WATER_COLORS = [
  new THREE.Color(0x1a5fa8),
  new THREE.Color(0x2680c8),
  new THREE.Color(0x3aa0dc),
  new THREE.Color(0x52b8e8),
  new THREE.Color(0x1e70b8),
  new THREE.Color(0x4498d4),
];

export function isInForestRiver(x: number, z: number): boolean {
  if (riverPathSamples.length < 2) return false;
  return distanceToRiverPath(x, z) < FOREST_RIVER_HALF_WIDTH + MUD_WIDTH + GRASS_WIDTH + 0.35;
}

/** True only over the water channel (not the mud/grass banks). */
export function isInForestRiverWater(x: number, z: number): boolean {
  if (riverPathSamples.length < 2) return false;
  return distanceToRiverPath(x, z) < FOREST_RIVER_HALF_WIDTH;
}

export interface RiverDecorPlacement {
  x: number;
  z: number;
  rotation: number;
}

export function getForestRiverDecorPlacements(): {
  rocks: RiverDecorPlacement[];
  logs: RiverDecorPlacement[];
} {
  if (!riverCurve) return { rocks: [], logs: [] };
  const rocks: RiverDecorPlacement[] = [];
  // Absorbable rocks only — decorative floating logs are animated separately
  for (let i = 0; i < 6; i++) {
    const p = sampleAt(0.14 + i * 0.12, ((i % 3) - 1) * 0.5);
    rocks.push({ x: p.x, z: p.z, rotation: p.angle + (i % 2) * 0.4 });
  }
  return { rocks, logs: [] };
}

export async function createForestRiver(
  levelWidth: number,
  levelDepth: number
): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'forestRiver';
  group.userData.riverAnimator = {
    waterMesh: null as unknown as THREE.Mesh,
    boat: null as unknown as THREE.Group,
    foamMeshes: [] as THREE.Mesh[],
    floatingLogs: [] as FloatingLog[],
    basePositions: new Float32Array(0),
    colorBase: new Float32Array(0),
  };

  riverCurve = buildRiverCurve(levelWidth, levelDepth);
  riverPathSamples = sampleCurve(riverCurve, PATH_SAMPLES);
  const centerline = sampleCurve(riverCurve, RIVER_SEGMENTS);

  // Poly Haven CC0 — wet muddy leaves at waterline, forest underbrush on the berm
  // (matches real riverbanks: dark damp mud → grassy leaf litter)
  const [mudTex, grassTex] = await Promise.all([
    loadBankTextureAsync(publicUrl('textures/river_mud_diff.jpg'), 3.5),
    loadBankTextureAsync(publicUrl('textures/river_grass_diff.jpg'), 4.5),
  ]);
  const mudMat = texturedLambert(mudTex, 0xffffff, true);
  const grassMat = texturedLambert(grassTex, 0xffffff, true);
  const rockMat = lambert(0x8a8f96, true);
  const rockDark = lambert(0x6b7078, true);
  const reedStem = lambert(0xc4a35a, true);
  const reedHead = lambert(0x6b4423, true);
  const logMat = lambert(0x5c4033, true);
  const cliffMat = lambert(0x6d737c, true);

  const water = buildLowPolyWater(centerline);
  water.name = 'riverWater';
  group.add(water);

  const mudNear = FOREST_RIVER_HALF_WIDTH + 0.1;
  const mudFar = mudNear + MUD_WIDTH;
  const grassNear = mudFar;
  const grassFar = mudFar + GRASS_WIDTH;

  group.add(buildMiteredBank(centerline, +1, mudNear, mudFar, MUD_NEAR_Y, MUD_FAR_Y, mudMat));
  group.add(buildMiteredBank(centerline, -1, mudNear, mudFar, MUD_NEAR_Y, MUD_FAR_Y, mudMat));
  group.add(buildMiteredBank(centerline, +1, grassNear, grassFar, GRASS_NEAR_Y, GRASS_FAR_Y, grassMat));
  group.add(buildMiteredBank(centerline, -1, grassNear, grassFar, GRASS_NEAR_Y, GRASS_FAR_Y, grassMat));

  // Waterfall at left screen edge (where river enters from off-screen)
  const fallT = findCurveTNearX(riverCurve, -41);
  const fallPoint = riverCurve.getPointAt(fallT);
  const fallTangent = riverCurve.getTangentAt(fallT).normalize();
  buildLowPolyWaterfall(group, fallPoint, fallTangent, cliffMat, rockMat);

  scatterLowPolyRocks(group, rockMat, rockDark);
  const floatingLogs = spawnFloatingLogs(group, logMat);
  scatterReeds(group, reedStem, reedHead);
  scatterBushesAndBramble(group);

  const boat = buildSailboat();
  const boatSpot = sampleAt(0.45, 0.08);
  boat.position.set(boatSpot.x, WATER_Y + 0.08, boatSpot.z);
  boat.rotation.y = boatSpot.angle;
  boat.name = 'riverBoat';
  group.add(boat);

  const anim = group.userData.riverAnimator as RiverAnimator;
  anim.waterMesh = water;
  anim.boat = boat;
  anim.floatingLogs = floatingLogs;
  anim.basePositions = (water.geometry.getAttribute('position').array as Float32Array).slice();
  anim.colorBase = (water.geometry.getAttribute('color').array as Float32Array).slice();

  return group;
}

interface FloatingLog {
  mesh: THREE.Mesh;
  t: number;
  lateral: number;
  bobPhase: number;
  spin: number;
}

interface RiverAnimator {
  waterMesh: THREE.Mesh;
  boat: THREE.Group;
  foamMeshes: THREE.Mesh[];
  floatingLogs: FloatingLog[];
  basePositions: Float32Array;
  colorBase: Float32Array;
}

export function updateForestRiver(group: THREE.Group, elapsedSec: number): void {
  const anim = group.userData.riverAnimator as RiverAnimator | undefined;
  if (!anim?.waterMesh || !riverCurve) return;

  const pos = anim.waterMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const col = anim.waterMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  const base = anim.basePositions;
  const colorBase = anim.colorBase;
  const across = WATER_ACROSS + 1;
  const segs = Math.floor(pos.count / across);

  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3];
    const row = Math.floor(i / across);
    const tAlong = row / Math.max(1, segs - 1);
    // Gentle downstream ripple — keep amplitude small so water stays above ground
    const wave =
      Math.sin(tAlong * 28 - elapsedSec * 12) * 0.018 +
      Math.cos(x * 0.45 + elapsedSec * 5.5) * 0.008;
    pos.setY(i, base[i * 3 + 1] + wave);

    // Soft current pulse (avoid harsh diamond banding)
    const shift = ((tAlong * 8 - elapsedSec * 3.8) % 1 + 1) % 1;
    const pulse = 0.92 + 0.08 * Math.sin(shift * Math.PI * 2);
    col.setXYZ(
      i,
      colorBase[i * 3] * pulse,
      colorBase[i * 3 + 1] * pulse,
      Math.min(1, colorBase[i * 3 + 2] * pulse)
    );
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;

  // Drive logs from absolute time for stable current speed
  for (const log of anim.floatingLogs) {
    const t = ((log.t + elapsedSec * CURRENT_SPEED) % 0.9) + 0.08;
    const p = sampleAt(t, log.lateral);
    log.mesh.position.set(
      p.x,
      WATER_Y + 0.12 + Math.sin(elapsedSec * 3.5 + log.bobPhase) * 0.03,
      p.z
    );
    log.mesh.rotation.y = p.angle + Math.PI / 2;
    log.mesh.rotation.x = Math.sin(elapsedSec * 2.2 + log.bobPhase) * 0.08;
    log.mesh.rotation.z = Math.PI / 2 + Math.sin(elapsedSec * 1.4 + log.spin) * 0.05;
  }

  if (anim.boat) {
    const boatT = ((0.4 + elapsedSec * CURRENT_SPEED * 0.35) % 0.7) + 0.15;
    const bp = sampleAt(boatT, 0.1);
    anim.boat.position.set(
      bp.x,
      WATER_Y + 0.1 + Math.sin(elapsedSec * 2.2) * 0.025,
      bp.z
    );
    anim.boat.rotation.y = bp.angle;
    anim.boat.rotation.z = Math.sin(elapsedSec * 1.6) * 0.04;
  }

  for (const foam of anim.foamMeshes) {
    const mat = foam.material as THREE.MeshLambertMaterial;
    mat.opacity = 0.55 + Math.sin(elapsedSec * 4.5 + foam.userData.phase) * 0.22;
  }
}

function lambert(color: number, flat = false): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (flat) mat.flatShading = true;
  return mat;
}

function texturedLambert(
  map: THREE.Texture,
  tint: number,
  flat = false
): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    map,
    color: tint,
    // Slight emissive so bank detail reads under the game's soft lighting
    emissive: new THREE.Color(tint),
    emissiveMap: map,
    emissiveIntensity: 0.35,
  });
  if (flat) mat.flatShading = true;
  return mat;
}

function loadBankTextureAsync(url: string, repeat: number): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat, repeat);
        tex.anisotropy = 8;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

/**
 * River starts west off-screen, waterfall at left view edge near spawn,
 * then meanders east and exits off the right side of the map.
 */
function buildRiverCurve(levelWidth: number, levelDepth: number): THREE.CatmullRomCurve3 {
  const playHalfX = levelWidth * 0.5;
  const hz = levelDepth * 0.14;
  // Player starts near x=-30; ortho frustum ~12.5 → left view edge ≈ -41
  const startX = -playHalfX - 22;
  const waterfallX = -41; // left edge of screen at forest spawn
  const endX = playHalfX + 22;

  // Gentle S-curve — soft amplitude keeps bank offsets from folding
  const points = [
    new THREE.Vector3(startX, 0, hz * 0.12),
    new THREE.Vector3(waterfallX, 0, hz * 0.1),
    new THREE.Vector3(-playHalfX * 0.55, 0, hz * 0.55),
    new THREE.Vector3(-playHalfX * 0.1, 0, -hz * 0.4),
    new THREE.Vector3(playHalfX * 0.35, 0, hz * 0.45),
    new THREE.Vector3(playHalfX * 0.78, 0, -hz * 0.28),
    new THREE.Vector3(endX, 0, hz * 0.1),
  ];
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.05);
}

function sampleCurve(curve: THREE.CatmullRomCurve3, count: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= count; i++) pts.push(curve.getPointAt(i / count));
  // Chaikin-style smooth pass softens corners that create bank "squares"
  return smoothPolyline(pts, 1);
}

function smoothPolyline(pts: THREE.Vector3[], passes: number): THREE.Vector3[] {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    if (cur.length < 3) break;
    const next: THREE.Vector3[] = [cur[0].clone()];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i];
      const b = cur[i + 1];
      next.push(
        new THREE.Vector3(a.x * 0.75 + b.x * 0.25, 0, a.z * 0.75 + b.z * 0.25),
        new THREE.Vector3(a.x * 0.25 + b.x * 0.75, 0, a.z * 0.25 + b.z * 0.75)
      );
    }
    next.push(cur[cur.length - 1].clone());
    cur = next;
  }
  return cur;
}

function findCurveTNearX(curve: THREE.CatmullRomCurve3, targetX: number): number {
  let bestT = 0.08;
  let bestDist = Infinity;
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const d = Math.abs(curve.getPointAt(t).x - targetX);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }
  return bestT;
}

function distanceToRiverPath(x: number, z: number): number {
  let min = Infinity;
  for (let i = 0; i < riverPathSamples.length - 1; i++) {
    const a = riverPathSamples[i];
    const b = riverPathSamples[i + 1];
    min = Math.min(min, distToSegment(x, z, a.x, a.z, b.x, b.z));
  }
  return min;
}

function distToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function sampleAt(t: number, lateral: number): { x: number; z: number; angle: number } {
  if (!riverCurve) return { x: 0, z: 0, angle: 0 };
  const clamped = Math.max(0, Math.min(1, t));
  const pt = riverCurve.getPointAt(clamped);
  const tan = riverCurve.getTangentAt(clamped).normalize();
  const normal = new THREE.Vector3(-tan.z, 0, tan.x);
  return {
    x: pt.x + normal.x * lateral,
    z: pt.z + normal.z * lateral,
    angle: Math.atan2(tan.x, tan.z),
  };
}

/**
 * Offset a centerline by a constant distance using round joins.
 * Avoids miter spikes / triangular bank ears at bends.
 */
function offsetPolyline(centerline: THREE.Vector3[], distance: number): THREE.Vector3[] {
  const n = centerline.length;
  if (n < 2) return centerline.map((p) => p.clone());
  const out: THREE.Vector3[] = [];

  for (let i = 0; i < n; i++) {
    const prev = centerline[Math.max(0, i - 1)];
    const curr = centerline[i];
    const next = centerline[Math.min(n - 1, i + 1)];

    const d0 = new THREE.Vector3(curr.x - prev.x, 0, curr.z - prev.z);
    const d1 = new THREE.Vector3(next.x - curr.x, 0, next.z - curr.z);
    if (d0.lengthSq() < 1e-8) d0.copy(d1);
    if (d1.lengthSq() < 1e-8) d1.copy(d0);
    d0.normalize();
    d1.normalize();

    const n0 = new THREE.Vector3(-d0.z, 0, d0.x);
    const n1 = new THREE.Vector3(-d1.z, 0, d1.x);

    // Endpoints: single normal
    if (i === 0 || i === n - 1) {
      const nn = i === 0 ? n1 : n0;
      out.push(new THREE.Vector3(curr.x + nn.x * distance, 0, curr.z + nn.z * distance));
      continue;
    }

    const cos = THREE.MathUtils.clamp(n0.dot(n1), -1, 1);
    // Nearly straight — one averaged normal (no miter length blow-up)
    if (cos > 0.97) {
      const mid = n0.clone().add(n1).normalize();
      out.push(new THREE.Vector3(curr.x + mid.x * distance, 0, curr.z + mid.z * distance));
      continue;
    }

    // Round join: fan of normals from n0 → n1 so the outer edge stays a smooth arc
    const cross = n0.x * n1.z - n0.z * n1.x;
    let ang = Math.acos(cos);
    if (cross < 0) ang = -ang;
    for (let s = 0; s <= BEND_ARC_STEPS; s++) {
      const t = s / BEND_ARC_STEPS;
      const a = ang * t;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = n0.x * ca - n0.z * sa;
      const nz = n0.x * sa + n0.z * ca;
      out.push(new THREE.Vector3(curr.x + nx * distance, 0, curr.z + nz * distance));
    }
  }
  return out;
}

function buildLowPolyWater(centerline: THREE.Vector3[]): THREE.Mesh {
  const left = offsetPolyline(centerline, FOREST_RIVER_HALF_WIDTH);
  const right = offsetPolyline(centerline, -FOREST_RIVER_HALF_WIDTH);
  const edgeCount = Math.min(left.length, right.length);
  const across = WATER_ACROSS;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < edgeCount; i++) {
    for (let j = 0; j <= across; j++) {
      const u = j / across;
      const x = THREE.MathUtils.lerp(right[i].x, left[i].x, u);
      const z = THREE.MathUtils.lerp(right[i].z, left[i].z, u);
      positions.push(x, WATER_Y, z);

      // Smooth blue gradient across the channel (no faceted checker pattern)
      const edge = Math.abs(u - 0.5) * 2;
      const along = i / Math.max(1, edgeCount - 1);
      const c = WATER_COLORS[Math.floor(along * WATER_COLORS.length) % WATER_COLORS.length]
        .clone()
        .lerp(WATER_COLORS[(Math.floor(along * WATER_COLORS.length) + 1) % WATER_COLORS.length], 0.35);
      const tint = c.lerp(new THREE.Color(0x7ec8e8), edge * 0.22);
      colors.push(tint.r, tint.g, tint.b);
    }
  }

  for (let i = 0; i < edgeCount - 1; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + 1;
      const c = a + (across + 1);
      const d = c + 1;
      if ((i + j) % 2 === 0) indices.push(a, b, c, b, d, c);
      else indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  // Soft shading reads cleaner than flat diamonds from top-down
  mat.flatShading = false;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 0;
  return mesh;
}

function buildMiteredBank(
  centerline: THREE.Vector3[],
  side: 1 | -1,
  nearDist: number,
  farDist: number,
  nearY: number,
  farY: number,
  material: THREE.MeshLambertMaterial
): THREE.Mesh {
  const nearEdge = offsetPolyline(centerline, side * nearDist);
  const farEdge = offsetPolyline(centerline, side * farDist);
  const edgeCount = Math.min(nearEdge.length, farEdge.length);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let distAcc = 0;

  for (let i = 0; i < edgeCount; i++) {
    if (i > 0) {
      distAcc += nearEdge[i].distanceTo(nearEdge[i - 1]);
    }
    const v = distAcc * 0.55;
    positions.push(nearEdge[i].x, nearY, nearEdge[i].z, farEdge[i].x, farY, farEdge[i].z);
    // U across bank width, V along river
    uvs.push(0, v, 1, v);
  }

  for (let i = 0; i < edgeCount - 1; i++) {
    const n0 = i * 2;
    const f0 = n0 + 1;
    const n1 = n0 + 2;
    const f1 = n0 + 3;
    if (side > 0) indices.push(n0, f0, n1, f0, f1, n1);
    else indices.push(n0, n1, f0, f0, n1, f1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Share the source map (do not clone mid-load — that drops the texture)
  const mat = material.clone();
  mat.map = material.map;
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  return mesh;
}

function buildLowPolyWaterfall(
  group: THREE.Group,
  origin: THREE.Vector3,
  flow: THREE.Vector3,
  cliffMat: THREE.MeshLambertMaterial,
  rockMat: THREE.MeshLambertMaterial
): void {
  const cliff = new THREE.Group();
  cliff.position.copy(origin);
  cliff.rotation.y = Math.atan2(flow.x, flow.z);

  for (let i = 0; i < 4; i++) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(1.8 + (i % 2) * 0.4, 1.1 + (i % 3) * 0.35, 1.6),
      cliffMat
    );
    block.position.set((i - 1.5) * 1.5, 0.7 + (i % 2) * 0.25, -1.8);
    block.castShadow = true;
    cliff.add(block);
  }

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(7, 0.55, 1.8), rockMat);
  shelf.position.set(0, 1.9, -1.2);
  shelf.castShadow = true;
  cliff.add(shelf);

  const cascadeColors = [0x2a8fd4, 0x3db5e8, 0x1e6bb8, 0x52b8e8];
  for (let col = 0; col < 5; col++) {
    const m = new THREE.MeshLambertMaterial({
      color: cascadeColors[col % cascadeColors.length],
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    m.flatShading = true;
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.8), m);
    sheet.position.set((col - 2) * 1.1, 1.15, -0.15);
    sheet.rotation.x = -0.55;
    cliff.add(sheet);
  }

  const foamMat = new THREE.MeshLambertMaterial({
    color: 0xf0f9ff,
    transparent: true,
    opacity: 0.8,
  });
  foamMat.flatShading = true;
  const foamList = (group.userData.riverAnimator as RiverAnimator).foamMeshes;
  for (let i = 0; i < 7; i++) {
    const foam = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.4 + (i % 3) * 0.12, 0),
      foamMat.clone()
    );
    foam.scale.set(1.6, 0.28, 1.3);
    foam.position.set((i - 3) * 0.85, WATER_Y + 0.04, 1.1 + (i % 2) * 0.35);
    foam.userData.phase = i * 1.1;
    cliff.add(foam);
    foamList.push(foam);
  }

  group.add(cliff);
}

function scatterLowPolyRocks(
  group: THREE.Group,
  rockMat: THREE.MeshLambertMaterial,
  rockDark: THREE.MeshLambertMaterial
): void {
  if (!riverCurve) return;
  const specs: [number, number, number][] = [
    [0.12, -1.2, 0.48],
    [0.22, 1.5, 0.36],
    [0.32, -1.7, 0.55],
    [0.44, 1.0, 0.4],
    [0.56, -0.9, 0.5],
    [0.68, 1.8, 0.34],
    [0.78, -1.4, 0.45],
    [0.88, 1.1, 0.42],
  ];
  for (let i = 0; i < specs.length; i++) {
    const [t, lat, r] = specs[i];
    const p = sampleAt(t, lat);
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r, 0),
      i % 2 === 0 ? rockMat : rockDark
    );
    rock.position.set(p.x, r * 0.45, p.z);
    rock.rotation.set(i * 0.5, i * 0.9, i * 0.3);
    rock.castShadow = true;
    group.add(rock);
  }
}

function spawnFloatingLogs(group: THREE.Group, logMat: THREE.MeshLambertMaterial): FloatingLog[] {
  const logs: FloatingLog[] = [];
  const starts = [0.16, 0.3, 0.44, 0.58, 0.72, 0.84];
  for (let i = 0; i < starts.length; i++) {
    const lateral = ((i % 2) * 2 - 1) * (0.25 + (i % 3) * 0.2);
    const length = 1.35 + (i % 3) * 0.25;
    const radius = 0.2 + (i % 2) * 0.05;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.05, length, 6),
      logMat
    );
    mesh.castShadow = true;
    mesh.renderOrder = 3;
    group.add(mesh);
    logs.push({
      mesh,
      t: starts[i],
      lateral,
      bobPhase: i * 1.7,
      spin: i * 0.9,
    });
  }
  return logs;
}

function scatterReeds(
  group: THREE.Group,
  stemMat: THREE.MeshLambertMaterial,
  headMat: THREE.MeshLambertMaterial
): void {
  if (!riverCurve) return;
  const edge = FOREST_RIVER_HALF_WIDTH + MUD_WIDTH * 0.55;
  const clusters: [number, number][] = [
    [0.14, edge],
    [0.24, -edge],
    [0.36, edge + 0.15],
    [0.48, -edge],
    [0.6, edge],
    [0.72, -edge - 0.1],
    [0.84, edge],
    [0.92, -edge],
  ];
  for (let c = 0; c < clusters.length; c++) {
    const [t, lat] = clusters[c];
    const base = sampleAt(t, lat);
    const count = 3 + (c % 3);
    for (let i = 0; i < count; i++) {
      const ox = (i - 1) * 0.16;
      const oz = ((c + i) % 3) * 0.1 - 0.1;
      const h = 0.5 + ((c + i) % 4) * 0.1;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, h, 4), stemMat);
      stem.position.set(base.x + ox, h * 0.5, base.z + oz);
      group.add(stem);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 5), headMat);
      head.position.set(base.x + ox, h + 0.05, base.z + oz);
      group.add(head);
    }
  }
}

/** Leafy bushes + tangled bramble along the mud/grass shoreline (both banks). */
function scatterBushesAndBramble(group: THREE.Group): void {
  if (!riverCurve) return;

  const bushGreen = lambert(0x3d6b2e, true);
  const bushDark = lambert(0x2a4a22, true);
  const brambleMat = lambert(0x4a3a28, true);
  const brambleGreen = lambert(0x3f5c28, true);

  // Shoreline lateral: outer mud → inner grass edge
  const shore = FOREST_RIVER_HALF_WIDTH + MUD_WIDTH * 0.85;

  for (let i = 0; i < 36; i++) {
    const t = 0.1 + (i / 35) * 0.82;
    const side = i % 2 === 0 ? 1 : -1;
    const lat = side * (shore + (i % 5) * 0.22);
    const p = sampleAt(t, lat);

    // Low rounded bush cluster
    const bush = new THREE.Group();
    const lobes = 2 + (i % 3);
    for (let L = 0; L < lobes; L++) {
      const r = 0.28 + ((i + L) % 4) * 0.08;
      const lobe = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 0),
        L % 2 === 0 ? bushGreen : bushDark
      );
      lobe.position.set((L - 1) * 0.22, r * 0.55, ((L + i) % 3) * 0.12 - 0.12);
      lobe.scale.set(1.1, 0.75 + (L % 2) * 0.15, 1.0);
      lobe.castShadow = true;
      bush.add(lobe);
    }
    bush.position.set(p.x, 0, p.z);
    bush.rotation.y = p.angle + i * 0.4;
    group.add(bush);
  }

  // Tangled bramble sticks near the waterline
  for (let i = 0; i < 48; i++) {
    const t = 0.08 + (i / 47) * 0.86;
    const side = i % 2 === 0 ? 1 : -1;
    const lat = side * (FOREST_RIVER_HALF_WIDTH + MUD_WIDTH * 0.35 + (i % 4) * 0.15);
    const p = sampleAt(t, lat);
    const sticks = 3 + (i % 3);
    for (let s = 0; s < sticks; s++) {
      const len = 0.45 + ((i + s) % 4) * 0.12;
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.028, len, 4),
        s % 2 === 0 ? brambleMat : brambleGreen
      );
      stick.position.set(
        p.x + (s - 1) * 0.1,
        len * 0.35,
        p.z + ((s + i) % 3) * 0.08 - 0.08
      );
      stick.rotation.z = (Math.PI / 2) * (0.55 + (s % 3) * 0.15);
      stick.rotation.y = p.angle + s * 0.7 + i * 0.2;
      stick.rotation.x = (s - 1) * 0.35;
      group.add(stick);
    }
  }
}

function buildSailboat(): THREE.Group {
  const boat = new THREE.Group();
  const hullMat = lambert(0x8b5a2b, true);
  const sailMat = lambert(0xf5f5f0, true);
  const mastMat = lambert(0x5c4033, true);

  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.45), hullMat);
  hull.position.y = 0.1;
  boat.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), hullMat);
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(0.65, 0.12, 0);
  boat.add(bow);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), mastMat);
  mast.position.y = 0.7;
  boat.add(mast);

  const sail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.95, 3), sailMat);
  sail.rotation.z = Math.PI;
  sail.position.set(0.15, 0.75, 0);
  boat.add(sail);

  return boat;
}
