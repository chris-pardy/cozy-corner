/** Cardinal direction — matches lexicon convention (south=0 is "toward camera"). */
export enum Direction {
  South = 0,
  West = 1,
  North = 2,
  East = 3,
}

/** Bitmask constants for per-edge blocking. Physical blocks movement; ephemeral blocks propagation (light/sound/heat). */
export const Edge = {
  N: 1,
  E: 2,
  S: 4,
  W: 8,
  EphN: 16,
  EphE: 32,
  EphS: 64,
  EphW: 128,
  /** All physical edges blocked. */
  AllPhysical: 15,
  /** All edges (physical + ephemeral) blocked. */
  All: 255,
} as const;

export type EntityType = "pc" | "npc" | "item";

export interface Point {
  x: number;
  y: number;
}

export interface GameEntity {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  direction: Direction;
  /** Current animation target (e.g. "idle-south", "walk-north", variant name for items). */
  animTarget: string;
  /** Arbitrary key-value state readable/writable by scripts. */
  state: Record<string, string>;

  // --- spatial (items can span multiple tiles) ---
  width: number;
  height: number;
  /** Per-tile edge blocking bitmask, row-major, length = width*height. */
  blockedEdges: number[];

  // --- movement ---
  /** Remaining path tiles to walk (excludes current position). Null when idle. */
  movePath: Point[] | null;
  /** Ticks remaining until the next path step. */
  moveTimer: number;
  /** Ticks per tile of movement (lower = faster). Default 5 ≈ 208 ms at 24 fps. */
  moveSpeed: number;
}

export interface TileAttribute {
  attribute: string;
  /** 0–100 where 100 is neutral. */
  value: number;
}

export interface TileExit {
  id: string;
  /** AT URI of target room (omitted for self-exits). */
  target?: string;
  targetExitId?: string;
  /** Direction bitmask the player must walk to trigger (N=1 E=2 S=4 W=8). */
  direction: number;
}

export interface TileState {
  x: number;
  y: number;
  blocking: number;
  spawn: boolean;
  attributes: TileAttribute[];
  exit?: TileExit;
}

export interface RoomConfig {
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DIRECTION_NAMES: Record<Direction, string> = {
  [Direction.South]: "south",
  [Direction.West]: "west",
  [Direction.North]: "north",
  [Direction.East]: "east",
};

export function directionName(d: Direction): string {
  return DIRECTION_NAMES[d];
}

const DX: Record<Direction, number> = {
  [Direction.South]: 0,
  [Direction.West]: -1,
  [Direction.North]: 0,
  [Direction.East]: 1,
};
const DY: Record<Direction, number> = {
  [Direction.South]: 1,
  [Direction.West]: 0,
  [Direction.North]: -1,
  [Direction.East]: 0,
};

export function directionDelta(d: Direction): Point {
  return { x: DX[d], y: DY[d] };
}

/** Infer direction from a (dx, dy) delta. Falls back to South. */
export function directionFromDelta(dx: number, dy: number): Direction {
  if (dy > 0) return Direction.South;
  if (dy < 0) return Direction.North;
  if (dx < 0) return Direction.West;
  if (dx > 0) return Direction.East;
  return Direction.South;
}

/** The blocking edge bit that must be clear on the *destination* tile to enter from `dir`. */
export function entryEdge(dir: Direction): number {
  // Walking south enters from the north edge of the destination.
  switch (dir) {
    case Direction.South:
      return Edge.N;
    case Direction.North:
      return Edge.S;
    case Direction.East:
      return Edge.W;
    case Direction.West:
      return Edge.E;
  }
}
