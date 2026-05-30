import * as THREE from 'three';

export const SIZE_CLASSES = ['tiny', 'small', 'medium', 'large', 'huge', 'colossal'] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];

export const SIZE_CLASS_INDEX: Record<SizeClass, number> = {
  tiny: 0,
  small: 1,
  medium: 2,
  large: 3,
  huge: 4,
  colossal: 5,
};

export const STAGE_ORDER = ['desert', 'mountain', 'forest', 'suburbs', 'downtown'] as const;
export type StageId = (typeof STAGE_ORDER)[number];

export const STAGE_TITLES: Record<StageId, string> = {
  desert: 'A Little Spin',
  mountain: 'Upward Spiral',
  forest: 'Rustle & Hum',
  suburbs: 'Almost There',
  downtown: 'Big Enough',
};

export const STAGE_FLAVOR: Record<StageId, string> = {
  desert: 'The wide open desert awaits…',
  mountain: 'Climb toward the dream.',
  forest: 'Rustle through the green.',
  suburbs: 'Almost there. Deep breath.',
  downtown: 'The city skyline calls.',
};

export const BIOME_PALETTES: Record<
  StageId,
  { ground: number; sky: number; accent: number; fog?: number }
> = {
  desert: { ground: 0xe8c872, sky: 0x87ceeb, accent: 0x4a7c59 },
  mountain: { ground: 0x6b7280, sky: 0xb0c4de, accent: 0x2d5016, fog: 0x9ca3af },
  forest: { ground: 0x3d5a3a, sky: 0x7ec8e3, accent: 0xff6b9d },
  suburbs: { ground: 0x86efac, sky: 0x93c5fd, accent: 0xfde68a },
  downtown: { ground: 0x9ca3af, sky: 0x64748b, accent: 0x60a5fa, fog: 0x475569 },
};

export const BASE_RADIUS = 0.4;
export const GROWTH_FACTOR = 0.15;

/** Orthographic zoom — tight at level start, pulls back as radius grows. */
export const CAMERA_FRUSTUM_BASE = 12.5;
export const CAMERA_FRUSTUM_PER_RADIUS = 6;

/** Pre-zoom camera curve (frustum 18 + radius × 2.5) for visual size matching. */
const LEGACY_CAMERA_FRUSTUM_BASE = 18;
const LEGACY_CAMERA_FRUSTUM_PER_RADIUS = 2.5;

export function cameraFrustumHalfSize(radius: number): number {
  return CAMERA_FRUSTUM_BASE + radius * CAMERA_FRUSTUM_PER_RADIUS;
}

/** Scales the dust devil mesh so on-screen size matches the old camera at any radius. */
export function visualScaleMultiplier(radius: number): number {
  const legacy =
    LEGACY_CAMERA_FRUSTUM_BASE + radius * LEGACY_CAMERA_FRUSTUM_PER_RADIUS;
  return legacy / cameraFrustumHalfSize(radius);
}
export const BASE_SPEED = 8;
export const PULL_RADIUS_MULT = 1.25;
export const MAX_ORBIT_SLOTS = 30;
export const GRID_CELL_SIZE = 2;

export const ISOMETRIC_YAW = Math.PI / 4;
export const ISOMETRIC_PITCH = Math.atan(1 / Math.sqrt(2));

export function massToRadius(mass: number, growthFactor = GROWTH_FACTOR): number {
  return BASE_RADIUS + Math.sqrt(Math.max(0, mass)) * growthFactor;
}

export function canAbsorb(playerClass: SizeClass, objectClass: SizeClass): boolean {
  return SIZE_CLASS_INDEX[objectClass] <= SIZE_CLASS_INDEX[playerClass];
}

export function playerSizeClassFromMass(mass: number, stageMinClass: SizeClass): SizeClass {
  const idx = SIZE_CLASS_INDEX[stageMinClass];
  let classIdx = idx;
  if (mass >= 120) classIdx = Math.max(classIdx, 5);
  else if (mass >= 60) classIdx = Math.max(classIdx, 4);
  else if (mass >= 25) classIdx = Math.max(classIdx, 3);
  else if (mass >= 10) classIdx = Math.max(classIdx, 2);
  else if (mass >= 3) classIdx = Math.max(classIdx, 1);
  return SIZE_CLASSES[classIdx];
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function worldToScreen(
  pos: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number
): { x: number; y: number; visible: boolean } {
  const v = pos.clone().project(camera);
  return {
    x: ((v.x + 1) / 2) * width,
    y: ((-v.y + 1) / 2) * height,
    visible: v.z >= -1 && v.z <= 1,
  };
}

export type GameState =
  | 'title'
  | 'stage_intro'
  | 'playing'
  | 'stage_complete'
  | 'credits';
