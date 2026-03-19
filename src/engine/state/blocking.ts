import { DIRECTION_DELTAS } from "./movement";

/**
 * Edge blocking bitmask per direction (physical blocking, bits 0-3):
 *   N = 1, E = 2, S = 4, W = 8
 *
 * Ephemeral blocking (bits 4-7) uses the same directions shifted left by 4:
 *   N = 16, E = 32, S = 64, W = 128
 * Ephemeral edges block light/sound/heat propagation but not movement.
 */
export const EDGE_N = 1;
export const EDGE_E = 2;
export const EDGE_S = 4;
export const EDGE_W = 8;

/** Mask for physical blocking bits (0-3). */
export const PHYSICAL_MASK = 0x0f;
/** Mask for ephemeral blocking bits (4-7). */
export const EPHEMERAL_MASK = 0xf0;
/** Shift to convert physical edge constants to ephemeral. */
export const EPHEMERAL_SHIFT = 4;

/**
 * Maps direction index (0=south,1=west,2=north,3=east) to the entry
 * bitmask on the neighbor tile. Blocking is one-way: a blocked edge
 * prevents entry but not exit (ledge semantics).
 */
export const DIRECTION_ENTRY: ReadonlyArray<number> = [
  EDGE_N, // 0 south: neighbor entered from N
  EDGE_E, // 1 west:  neighbor entered from E
  EDGE_S, // 2 north: neighbor entered from S
  EDGE_W, // 3 east:  neighbor entered from W
];

/**
 * Same as DIRECTION_ENTRY but for ephemeral blocking (bits 4-7).
 */
export const DIRECTION_ENTRY_EPHEMERAL: ReadonlyArray<number> = [
  EDGE_N << EPHEMERAL_SHIFT, // 0 south: 16
  EDGE_E << EPHEMERAL_SHIFT, // 1 west:  32
  EDGE_S << EPHEMERAL_SHIFT, // 2 north: 64
  EDGE_W << EPHEMERAL_SHIFT, // 3 east:  128
];

export interface BlockingGrid {
  /** Flat row-major array of bitmasks, length = width * height. */
  readonly edges: readonly number[];
  readonly width: number;
  readonly height: number;
}

/** The room's blocking grid. */
export const BLOCKING_GRID = "engine:blockingGrid";

/** Mixin interface for entities with blocking state. */
export interface BlockingMixin {
  [BLOCKING_GRID]: BlockingGrid;
}

/**
 * Check if physical movement from (x,y) in the given direction index is blocked.
 * Blocking is one-way: only the destination tile's entry edge is checked.
 * An entity can always leave a tile regardless of that tile's edges.
 */
export function isEdgeBlocked(
  grid: BlockingGrid,
  x: number,
  y: number,
  direction: number,
): boolean {
  const entryBit = DIRECTION_ENTRY[direction];
  const [dx, dy] = DIRECTION_DELTAS[direction];
  const nx = x + dx;
  const ny = y + dy;

  if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) return true;

  return (grid.edges[ny * grid.width + nx] & entryBit) !== 0;
}

/**
 * Check if ephemeral propagation (light/sound/heat) from (x,y) in the given
 * direction index is blocked. Only checks ephemeral bits (4-7) — physical
 * walls do NOT block ephemeral propagation, allowing light to spill into
 * wall tile space.
 */
export function isEphemeralBlocked(
  grid: BlockingGrid,
  x: number,
  y: number,
  direction: number,
): boolean {
  const entryBit = DIRECTION_ENTRY_EPHEMERAL[direction];
  const [dx, dy] = DIRECTION_DELTAS[direction];
  const nx = x + dx;
  const ny = y + dy;

  if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) return true;

  return (grid.edges[ny * grid.width + nx] & entryBit) !== 0;
}
