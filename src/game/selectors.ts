import { createSelector } from "@reduxjs/toolkit";
import { entitySelectors } from "./entity-slice";
import type { CameraSliceState, CameraState } from "./camera-slice";
import type { RoomSliceState } from "./room-slice";
import type { GameEntity, TileAttribute } from "./types";

// ---------------------------------------------------------------------------
// Root state shape (matches store.ts)
// ---------------------------------------------------------------------------

export interface RootState {
  entities: ReturnType<typeof entitySelectors.getInitialState> & {
    ids: string[];
    entities: Record<string, GameEntity>;
  };
  room: RoomSliceState;
  cameras: CameraSliceState;
}

// ---------------------------------------------------------------------------
// Entity selectors
// ---------------------------------------------------------------------------

export const selectAllEntities = (state: RootState) =>
  entitySelectors.selectAll(state.entities);

export const selectEntityById = (state: RootState, id: string) =>
  entitySelectors.selectById(state.entities, id);

export const selectEntitiesByType = createSelector(
  [selectAllEntities, (_s: RootState, type: string) => type],
  (entities, type) => entities.filter((e) => e.type === type),
);

// ---------------------------------------------------------------------------
// Blocking grid
// ---------------------------------------------------------------------------

/**
 * Returns a flat Uint8Array of width*height blocking bitmasks.
 * Combines static tile blocking + dynamic item entity blocking.
 * Index = y * width + x.
 */
export const selectBlockingGrid = createSelector(
  [(s: RootState) => s.room, selectAllEntities],
  (room, entities): Uint8Array => {
    const { width, height, tiles } = room;
    const grid = new Uint8Array(width * height);

    // 1. Static tile blocking
    for (const t of Object.values(tiles)) {
      if (t.x >= 0 && t.x < width && t.y >= 0 && t.y < height) {
        grid[t.y * width + t.x] |= t.blocking;
      }
    }

    // 2. Item entity blocking (multi-tile items stamp their blockedEdges)
    for (const e of entities) {
      if (e.type !== "item") continue;
      for (let dy = 0; dy < e.height; dy++) {
        for (let dx = 0; dx < e.width; dx++) {
          const tx = e.x + dx;
          const ty = e.y + dy;
          if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
          const edgeIdx = dy * e.width + dx;
          grid[ty * width + tx] |= e.blockedEdges[edgeIdx] ?? 0;
        }
      }
    }

    return grid;
  },
);

// ---------------------------------------------------------------------------
// Attribute maps
// ---------------------------------------------------------------------------

/**
 * Returns a Record mapping attribute names → flat Float64Array of width*height values.
 * Each value is 0–100 (100 = neutral). Only tiles with attributes contribute.
 */
export const selectAttributeMaps = createSelector(
  [(s: RootState) => s.room],
  (room): Record<string, Float64Array> => {
    const { width, height, tiles } = room;
    const maps: Record<string, Float64Array> = {};

    for (const t of Object.values(tiles)) {
      if (!t.attributes || t.attributes.length === 0) continue;
      if (t.x < 0 || t.x >= width || t.y < 0 || t.y >= height) continue;

      for (const attr of t.attributes) {
        let arr = maps[attr.attribute];
        if (!arr) {
          // Default to neutral (100) everywhere
          arr = new Float64Array(width * height).fill(100);
          maps[attr.attribute] = arr;
        }
        arr[t.y * width + t.x] = attr.value;
      }
    }

    return maps;
  },
);

// ---------------------------------------------------------------------------
// Spawn tiles
// ---------------------------------------------------------------------------

export const selectSpawnTiles = createSelector(
  [(s: RootState) => s.room.tiles],
  (tiles) =>
    Object.values(tiles).filter((t) => t.spawn),
);

// ---------------------------------------------------------------------------
// Tile at position
// ---------------------------------------------------------------------------

export const selectTileAt = (state: RootState, x: number, y: number) =>
  state.room.tiles[`${x},${y}`];

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export interface CameraPosition {
  x: number;
  y: number;
  radius: number;
}

/** Raw camera state for a PC (or undefined if no camera registered). */
export const selectCamera = (state: RootState, owner: string): CameraState | undefined =>
  state.cameras.cameras[owner];

/**
 * Resolved camera view for a PC. When following an entity, returns the
 * entity's position + the camera's current radius. When static or panning,
 * returns the camera's current (possibly interpolated) position + radius.
 * Returns null if the camera or its follow target doesn't exist.
 */
export const selectCameraPosition = (
  state: RootState,
  owner: string,
): CameraPosition | null => {
  const cam = state.cameras.cameras[owner];
  if (!cam) return null;
  if (cam.followId !== null) {
    const target = entitySelectors.selectById(state.entities, cam.followId);
    if (!target) return null;
    return { x: target.x, y: target.y, radius: cam.radius };
  }
  return { x: cam.x, y: cam.y, radius: cam.radius };
};
