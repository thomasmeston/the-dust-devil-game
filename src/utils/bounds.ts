/** Inward margin from the stage edge reserved for border mountains. */
export const BORDER_INSET = 5;

export function playableHalfExtents(
  width: number,
  depth: number
): { halfX: number; halfZ: number } {
  return {
    halfX: width / 2 - BORDER_INSET,
    halfZ: depth / 2 - BORDER_INSET,
  };
}

export function clampXZ(
  x: number,
  z: number,
  halfX: number,
  halfZ: number
): { x: number; z: number } {
  return {
    x: Math.max(-halfX, Math.min(halfX, x)),
    z: Math.max(-halfZ, Math.min(halfZ, z)),
  };
}
