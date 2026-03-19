import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import type { Event } from "../event";
import { POSITION, type Position } from "../state/movement";
import {
  ATTRIBUTE_MAP,
  ATTRIBUTE_EMISSIONS,
  DIR_ALL,
  DIR_S,
  DIR_N,
  DIR_E,
  DIR_W,
  type AttributeEmission,
  type AttributeMap,
} from "../state/attributes";
import {
  BLOCKING_GRID,
  DIRECTION_ENTRY_EPHEMERAL,
  type BlockingGrid,
} from "../state/blocking";
import { DIRECTION_DELTAS } from "../state/movement";

/**
 * Emits attribute values to the room's AttributeMap.
 *
 * Responds to "emit-attributes" — fired by the room after resetting the map
 * each tick, and also when a new emitter is added mid-tick for immediate
 * contribution.
 *
 * Reads POSITION and ATTRIBUTE_EMISSIONS from self.
 * Finds ATTRIBUTE_MAP and BLOCKING_GRID from ancestor (room entity).
 *
 * Each emission covers a rectangular footprint at the entity's position,
 * with linear falloff beyond the footprint edge up to the configured radius.
 * Falloff respects the optional direction bitmask and ephemeral blocking
 * edges — light/sound/heat won't propagate through ephemeral walls.
 */
export class AttributeEmitBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["emit-attributes"]);

  handle(entity: Entity, _event: Event): void {
    const pos = entity.get<Position>(POSITION);
    const emissions = entity.get<AttributeEmission[]>(ATTRIBUTE_EMISSIONS);
    if (!pos || !emissions) return;

    const map = entity.find<AttributeMap>(ATTRIBUTE_MAP);
    if (!map) return;

    const grid = entity.find<BlockingGrid>(BLOCKING_GRID);

    for (const emission of emissions) {
      emitToMap(map, grid ?? null, pos.x, pos.y, emission);
    }
  }
}

function emitToMap(
  map: AttributeMap,
  grid: BlockingGrid | null,
  px: number,
  py: number,
  emission: AttributeEmission,
): void {
  const { attribute, value } = emission;
  const fw = emission.width ?? 1;
  const fh = emission.height ?? 1;
  const radius = emission.radius ?? 0;
  const direction = emission.direction ?? DIR_ALL;

  // 1. Fill the footprint at full value (always, regardless of blocking)
  for (let fy = py; fy < py + fh && fy < map.height; fy++) {
    for (let fx = px; fx < px + fw && fx < map.width; fx++) {
      if (fx >= 0 && fy >= 0) {
        map.add(attribute, fx, fy, value);
      }
    }
  }

  if (radius <= 0) return;

  // 2. BFS from footprint edge outward, respecting ephemeral blocking
  //    Each entry: [tileIndex, distance from footprint]
  const w = map.width;
  const h = map.height;
  const visited = new Uint8Array(w * h);

  // Mark footprint as visited (already emitted)
  for (let fy = Math.max(0, py); fy < Math.min(h, py + fh); fy++) {
    for (let fx = Math.max(0, px); fx < Math.min(w, px + fw); fx++) {
      visited[fy * w + fx] = 1;
    }
  }

  // Seed BFS with footprint-edge tiles
  const queue: [number, number][] = []; // [index, dist]
  for (let fy = Math.max(0, py); fy < Math.min(h, py + fh); fy++) {
    for (let fx = Math.max(0, px); fx < Math.min(w, px + fw); fx++) {
      queue.push([fy * w + fx, 0]);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const [idx, dist] = queue[head++];
    if (dist >= radius) continue;

    const x = idx % w;
    const y = (idx - x) / w;

    for (let dir = 0; dir < 4; dir++) {
      const [dx, dy] = DIRECTION_DELTAS[dir];
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

      const nIdx = ny * w + nx;
      if (visited[nIdx]) continue;

      // Direction filter: tile must be in an allowed emission direction
      // relative to the footprint
      if (!matchesDirection(nx, ny, px, py, fw, fh, direction)) continue;

      // Ephemeral blocking: check the destination tile's incoming edge
      if (grid) {
        const entryBit = DIRECTION_ENTRY_EPHEMERAL[dir];
        if (grid.edges[nIdx] & entryBit) continue;
      }

      visited[nIdx] = 1;
      const nDist = dist + 1;
      map.add(attribute, nx, ny, value * (1 - nDist / radius));
      queue.push([nIdx, nDist]);
    }
  }
}

/** Chebyshev distance from point (tx,ty) to the nearest edge of a rectangle at (rx,ry) with size (rw,rh). */
function rectDistance(
  tx: number,
  ty: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): number {
  const dx = tx < rx ? rx - tx : tx >= rx + rw ? tx - (rx + rw - 1) : 0;
  const dy = ty < ry ? ry - ty : ty >= ry + rh ? ty - (ry + rh - 1) : 0;
  return Math.max(dx, dy);
}

/**
 * Check if a tile outside the footprint falls within the allowed emission directions.
 * A tile matches if ANY of its displacement directions from the footprint
 * are set in the direction bitmask.
 */
function matchesDirection(
  tx: number,
  ty: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  direction: number,
): boolean {
  if (direction === DIR_ALL) return true;
  const dist = rectDistance(tx, ty, rx, ry, rw, rh);
  if (dist === 0) return true; // inside footprint
  let tileDirs = 0;
  if (ty >= ry + rh) tileDirs |= DIR_S;
  if (ty < ry) tileDirs |= DIR_N;
  if (tx >= rx + rw) tileDirs |= DIR_E;
  if (tx < rx) tileDirs |= DIR_W;
  return (tileDirs & direction) !== 0;
}
