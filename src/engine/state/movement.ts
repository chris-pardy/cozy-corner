export interface Position {
  x: number;
  y: number;
}

/** Current tile position. */
export const POSITION = "engine:position";

/** Current animation state (e.g. "walk", "idle"). */
export const ANIM_STATE = "engine:animState";

/** Direction: 0=south, 1=west, 2=north, 3=east. */
export const DIRECTION = "engine:direction";

/** Tile we're walking toward (current single-tile step, cleared on arrival). */
export const MOVE_TARGET = "engine:moveTarget";

/** Remaining path steps (each a tile position). First element is the next step. */
export const PATH = "engine:path";

/** Timestamp (ms) when the current move started. */
export const MOVE_START_TIME = "engine:moveStartTime";

/** Duration in ms to walk one tile. */
export const MOVE_SPEED = "engine:moveSpeed";

/** Default move speed (ms per tile). */
export const DEFAULT_MOVE_SPEED = 200;

/** Origin of the moveTo event that initiated the current path. */
export const MOVE_ORIGIN = "engine:moveOrigin";

/** Mixin interface for entities with movement state. */
export interface MovementMixin {
  [POSITION]: Position;
  [DIRECTION]: number;
  [ANIM_STATE]: string;
}

/** Mixin interface for entities with pathfinding state. */
export interface MovementPathMixin {
  [MOVE_TARGET]: Position;
  [PATH]: Position[] | null;
  [MOVE_START_TIME]: number;
  [MOVE_SPEED]: number;
}

const DIRECTION_NAMES = ["south", "west", "north", "east"] as const;

export function directionName(direction: number): string {
  return DIRECTION_NAMES[direction] ?? "south";
}

/** Delta [dx, dy] per direction index. */
export const DIRECTION_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],   // 0 south
  [-1, 0],  // 1 west
  [0, -1],  // 2 north
  [1, 0],   // 3 east
];

/** Given a delta, return the direction index (defaults to 0/south). */
export function deltaToDirection(dx: number, dy: number): number {
  if (dy > 0) return 0; // south
  if (dx < 0) return 1; // west
  if (dy < 0) return 2; // north
  if (dx > 0) return 3; // east
  return 0;
}
