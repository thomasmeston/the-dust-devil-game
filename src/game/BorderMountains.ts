import * as THREE from 'three';
import { BIOME_PALETTES, type StageId } from '../utils/constants';
import { BORDER_INSET } from '../utils/bounds';

function addBoulderToGroup(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  radius: number,
  shade: THREE.Color,
  stretch: [number, number, number],
  rot: [number, number, number]
): void {
  const mat = new THREE.MeshToonMaterial({ color: shade });
  const boulder = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), mat);
  boulder.position.set(x, y, z);
  boulder.scale.set(stretch[0], stretch[1], stretch[2]);
  boulder.rotation.set(rot[0], rot[1], rot[2]);
  boulder.castShadow = true;
  boulder.receiveShadow = true;
  group.add(boulder);
}

/** Low, rounded ridge of boulders — visual terrain the player rolls over (no collision). */
export function addLowBoulderRidge(
  group: THREE.Group,
  centerX: number,
  centerZ: number,
  spanX: number,
  spanZ: number,
  baseColor: THREE.Color,
  rockColor: THREE.Color
): void {
  const count = 12 + Math.floor(Math.random() * 8);
  for (let i = 0; i < count; i++) {
    const radius = 0.45 + Math.random() * 0.8;
    const stretchY = 0.4 + Math.random() * 0.22;
    const shade = rockColor.clone().lerp(baseColor, 0.2 + Math.random() * 0.55);
    addBoulderToGroup(
      group,
      centerX + (Math.random() - 0.5) * spanX,
      radius * stretchY * 0.72,
      centerZ + (Math.random() - 0.5) * spanZ,
      radius,
      shade,
      [
        0.8 + Math.random() * 0.35,
        stretchY,
        0.8 + Math.random() * 0.35,
      ],
      [
        (Math.random() - 0.5) * 0.45,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.45,
      ]
    );
  }
}

export function createBorderMountains(
  stageId: StageId,
  width: number,
  depth: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'borderMountains';

  const palette = BIOME_PALETTES[stageId];
  const halfW = width / 2;
  const halfD = depth / 2;
  const innerHalfW = halfW - BORDER_INSET;
  const innerHalfD = halfD - BORDER_INSET;

  const baseColor = new THREE.Color(palette.ground);
  const rockColor = new THREE.Color(palette.accent).lerp(baseColor, 0.35);

  const addBoulderCluster = (x: number, z: number): void => {
    const cluster = 0.85 + Math.random() * 0.95;
    const mainRadius = (1.1 + Math.random() * 1.4) * cluster;
    const mainShade = rockColor.clone().lerp(baseColor, Math.random() * 0.4);
    addBoulderToGroup(
      group,
      x,
      mainRadius * 0.82,
      z,
      mainRadius,
      mainShade,
      [
        0.9 + Math.random() * 0.25,
        0.7 + Math.random() * 0.28,
        0.9 + Math.random() * 0.25,
      ],
      [
        (Math.random() - 0.5) * 0.35,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.35,
      ]
    );

    const satelliteCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < satelliteCount; i++) {
      const r = (0.35 + Math.random() * 0.55) * cluster;
      const shade = rockColor.clone().lerp(baseColor, 0.3 + Math.random() * 0.45);
      const spread = 1.1 * cluster;
      addBoulderToGroup(
        group,
        x + (Math.random() - 0.5) * spread,
        r * (0.55 + Math.random() * 0.25),
        z + (Math.random() - 0.5) * spread,
        r,
        shade,
        [
          0.85 + Math.random() * 0.35,
          0.6 + Math.random() * 0.35,
          0.85 + Math.random() * 0.35,
        ],
        [
          (Math.random() - 0.5) * 0.5,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.5,
        ]
      );
    }
  };

  const spacing = 3.4;
  const jitter = () => (Math.random() - 0.5) * 1.2;

  for (let x = -innerHalfW; x <= innerHalfW; x += spacing) {
    addBoulderCluster(x + jitter(), -halfD + BORDER_INSET * 0.45);
    addBoulderCluster(x + jitter(), halfD - BORDER_INSET * 0.45);
  }

  for (let z = -innerHalfD; z <= innerHalfD; z += spacing) {
    addBoulderCluster(-halfW + BORDER_INSET * 0.45, z + jitter());
    addBoulderCluster(halfW - BORDER_INSET * 0.45, z + jitter());
  }

  return group;
}
