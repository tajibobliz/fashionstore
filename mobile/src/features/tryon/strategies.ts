import type { GarmentPlacementInput } from './posePlacement';
import { posePlacement } from './posePlacement';
import { facePlacement } from './facePlacement';
export { getHatOverlayFromPose } from './facePlacement';
export type { HatOverlayResult } from './facePlacement';

export type GarmentType = 'GORRA' | 'CAMISA' | 'BLUSA' | 'TOP' | 'VESTIDO' | 'FALDA' | 'PANTALON' | 'CARTERA' | 'OTRO';
export { smoothPlacement } from './geometry';
export type { Placement, Landmark } from './geometry';

export function getGarmentPlacement(type: GarmentType, input: GarmentPlacementInput) {
  return type === 'GORRA' ? facePlacement(input) : posePlacement(type, input);
}
