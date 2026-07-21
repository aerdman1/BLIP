export interface VirtualInputState {
  active: boolean;
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  aimX: number;
  aimY: number;
  fire: boolean;
  dashQueued: boolean;
  scanQueued: boolean;
  interactQueued: boolean;
  weaponNextQueued: boolean;
  weaponSlotQueued: 0 | 1 | 2 | null;
}

export const virtualInput: VirtualInputState = {
  active: false,
  moveX: 0,
  moveY: 0,
  aimX: 1,
  aimY: 0,
  fire: false,
  dashQueued: false,
  scanQueued: false,
  interactQueued: false,
  weaponNextQueued: false,
  weaponSlotQueued: null,
};

export function driveVirtualInput(next: Partial<VirtualInputState>): void {
  virtualInput.active = next.active ?? true;
  virtualInput.moveX = next.moveX ?? 0;
  virtualInput.moveY = next.moveY ?? 0;
  virtualInput.aimX = next.aimX ?? virtualInput.aimX;
  virtualInput.aimY = next.aimY ?? virtualInput.aimY;
  virtualInput.fire = next.fire ?? false;
  if (next.dashQueued) virtualInput.dashQueued = true;
  if (next.scanQueued) virtualInput.scanQueued = true;
  if (next.interactQueued) virtualInput.interactQueued = true;
  if (next.weaponNextQueued) virtualInput.weaponNextQueued = true;
  if (next.weaponSlotQueued !== undefined) virtualInput.weaponSlotQueued = next.weaponSlotQueued;
}

export function resetVirtualInput(): void {
  virtualInput.active = false;
  virtualInput.moveX = 0;
  virtualInput.moveY = 0;
  virtualInput.aimX = 1;
  virtualInput.aimY = 0;
  virtualInput.fire = false;
  virtualInput.dashQueued = false;
  virtualInput.scanQueued = false;
  virtualInput.interactQueued = false;
  virtualInput.weaponNextQueued = false;
  virtualInput.weaponSlotQueued = null;
}
