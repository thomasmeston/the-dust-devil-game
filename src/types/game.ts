import type { SizeClass } from '../utils/constants';

export interface ObjectDef {
  sizeClass: SizeClass;
  mass: number;
  color: string;
  model?: string;
  shape: 'sphere' | 'box' | 'cone' | 'cylinder' | 'capsule';
  scale: [number, number, number];
  sfx?: string;
  setPiece?: boolean;
  flee?: boolean;
  fleeSpeed?: number;
  wander?: boolean;
  wanderSpeed?: number;
}

export interface PlacedProp {
  type: string;
  x: number;
  z: number;
  y?: number;
  /** Yaw (radians). */
  rotation?: number;
  /** Pitch — tilt forward/back (radians). Use ~1.57 to lay cylinders on their side. */
  pitch?: number;
  /** Roll — tilt left/right (radians). */
  roll?: number;
}

export interface LevelDef {
  id: string;
  name: string;
  width: number;
  depth: number;
  playerStart: { x: number; z: number };
  minSizeClass: SizeClass;
  growthFactor?: number;
  targetMass: number;
  threeStarMass: number;
  threeStarTimeSec: number;
  props: PlacedProp[];
  exitPosition?: { x: number; z: number };
  winProp?: string;
  enableBoost?: boolean;
}

export interface StoryBeat {
  id: string;
  stage: string;
  trigger: 'stage_start' | 'first_pickup' | 'mass' | 'exit_opens' | 'object_type' | 'boost_unlock' | 'win';
  value?: number | string;
  text: string;
  pauseInput?: boolean;
}

export interface StoryScript {
  opening: string;
  ending: string;
  credits?: string[];
  musicBy?: string;
  beats: StoryBeat[];
}
