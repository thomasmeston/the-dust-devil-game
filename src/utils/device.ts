const MOBILE_MAX_WIDTH = 768;

export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return navigator.maxTouchPoints > 0;
}

export function isMobileUi(): boolean {
  if (typeof window === 'undefined') return false;
  return isCoarsePointer() || window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
}

export interface ControlHints {
  title: string;
  playing: string;
  playingBoost: string;
  thoughtBubble: string;
  inventoryClose: string;
  pauseClose: string;
}

export const controlHints = {
  desktop: {
    title: 'WASD or click-and-hold to steer · Shift to boost (Forest+) · Space / Enter / Esc to close dialogue',
    playing: 'WASD to swirl · Absorb things smaller than you',
    playingBoost: 'WASD to swirl · Shift to boost · Absorb things smaller than you',
    thoughtBubble: 'Space / Enter to continue',
    inventoryClose: 'Tab to close',
    pauseClose: 'Esc to resume',
  },
  mobile: {
    title: 'Drag lower screen to move · Hold Boost (Forest+) · Tap dialogue to continue',
    playing: '',
    playingBoost: '',
    thoughtBubble: 'Tap to continue',
    inventoryClose: 'Tap × to close',
    pauseClose: 'Tap Resume to continue',
  },
} as const;

export function hintsForDevice(): ControlHints {
  return isMobileUi() ? controlHints.mobile : controlHints.desktop;
}
