/**
 * Room editor helper functions for computing spawn areas and ambient lighting.
 */

// Direction bitmask constants (physical blocking)
const DIR_N = 1;
const DIR_E = 2;
const DIR_S = 4;
const DIR_W = 8;

interface Tile {
  x: number;
  y: number;
  renderLayer?: number;
}

interface Exit {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// 1. Flood-fill walkable area from exits → spawn tile mask
// ---------------------------------------------------------------------------

/**
 * Starting from all exit tiles, flood-fill across the grid without crossing
 * physically blocked edges. Returns a flat bitmask (width * height, row-major)
 * where 1 = reachable/spawnable tile.
 *
 * A tile is considered "present" if any PlacedTile exists at that (x, y)
 * on render layer 0 (background). Empty grid cells block the fill.
 */
export function computeSpawnTiles(
  width: number,
  height: number,
  tiles: Tile[],
  exits: Exit[],
  blockingEdges: number[],
): number[] {
  // Build set of tiles that have floor
  const hasFloor = new Uint8Array(width * height);
  for (const t of tiles) {
    if ((t.renderLayer ?? 0) === 0 && t.x >= 0 && t.x < width && t.y >= 0 && t.y < height) {
      hasFloor[t.y * width + t.x] = 1;
    }
  }

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  // Seed from all exit tiles
  for (const exit of exits) {
    const ew = exit.width ?? 1;
    const eh = exit.height ?? 1;
    for (let dy = 0; dy < eh; dy++) {
      for (let dx = 0; dx < ew; dx++) {
        const ex = exit.x + dx;
        const ey = exit.y + dy;
        if (ex >= 0 && ex < width && ey >= 0 && ey < height) {
          const idx = ey * width + ex;
          if (!visited[idx] && hasFloor[idx]) {
            visited[idx] = 1;
            queue.push(idx);
          }
        }
      }
    }
  }

  // BFS flood fill
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;
    const neighbors: [number, number, number][] = [
      [0, -1, DIR_S],
      [1, 0, DIR_W],
      [0, 1, DIR_N],
      [-1, 0, DIR_E],
    ];

    for (const [dx, dy, dirIn] of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const nIdx = ny * width + nx;

      if ((blockingEdges[nIdx] ?? 0) & 0x0f & dirIn) continue;

      if (!visited[nIdx] && hasFloor[nIdx]) {
        visited[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  return Array.from(visited);
}

// ---------------------------------------------------------------------------
// 2. Generate blocking edges from wall tiles
// ---------------------------------------------------------------------------

interface PlacedTileInfo {
  x: number;
  y: number;
  renderLayer?: number;
  tileIndex: number;
}

/**
 * Generate blocking edges from wall tiles and void (empty) cells.
 *
 * Cell types:
 * - **Floor**: has at least one placed tile that is not a wall
 * - **Wall**: has at least one placed tile marked as wall (and no floor tiles)
 * - **Void**: no placed tiles at all
 *
 * Blocking rules for transitions between adjacent cells:
 * - Wall→Floor (bottom of wall): physical blocking
 * - Floor→Wall (top of wall): physical + ephemeral blocking
 * - Void↔Floor: physical + ephemeral blocking (void is impassable)
 * - Void↔Wall, Wall↔Wall, Void↔Void: no edges needed (both sides impassable)
 *
 * @param isWall - function that returns true if a tile index is a wall tile
 * @returns flat row-major bitmask array (same format as room blockingEdges)
 */
export function generateBlockingFromWalls(
  width: number,
  height: number,
  tiles: PlacedTileInfo[],
  isWall: (tileIndex: number) => boolean,
): number[] {
  const edges = new Array(width * height).fill(0);

  // Cell type: 0 = void, 1 = floor, 2 = wall
  const cellType = new Uint8Array(width * height);
  for (const t of tiles) {
    if (t.x < 0 || t.x >= width || t.y < 0 || t.y >= height) continue;
    const idx = t.y * width + t.x;
    if (isWall(t.tileIndex)) {
      // Only mark as wall if not already floor
      if (cellType[idx] === 0) cellType[idx] = 2;
    } else {
      // Floor overrides wall (a cell with any floor tile is walkable)
      cellType[idx] = 1;
    }
  }

  // Helper: should we block the edge between cell A and cell B?
  // Returns [physicalBoth, ephemeralBoth] — whether to block both directions
  // Wall→Floor gets physical only; Floor→Wall and Void→Floor get physical+ephemeral
  function edgeBits(typeA: number, typeB: number): [number, number] {
    // Both impassable or both floor — no blocking
    if (typeA === typeB) return [0, 0];
    if (typeA !== 1 && typeB !== 1) return [0, 0]; // wall↔void — both impassable

    // One side is floor, the other is wall or void
    const otherType = typeA === 1 ? typeB : typeA;
    if (otherType === 0) {
      // Void↔Floor: block both physical + ephemeral
      return [1, 1];
    }
    // Wall↔Floor: direction matters
    // If A is wall and B is floor: "bottom of wall" = physical only
    // If A is floor and B is wall: "top of wall" = physical + ephemeral
    if (typeA === 2 && typeB === 1) return [1, 0]; // wall→floor (going south/east)
    return [1, 1]; // floor→wall (going south/east into wall)
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const ct = cellType[idx];

      // South neighbor
      if (y < height - 1) {
        const belowIdx = (y + 1) * width + x;
        const [phys, eph] = edgeBits(ct, cellType[belowIdx]);
        if (phys) {
          edges[idx] |= DIR_S;
          edges[belowIdx] |= DIR_N;
        }
        if (eph) {
          edges[idx] |= DIR_S << 4;
          edges[belowIdx] |= DIR_N << 4;
        }
      }

      // East neighbor
      if (x < width - 1) {
        const rightIdx = y * width + x + 1;
        const [phys, eph] = edgeBits(ct, cellType[rightIdx]);
        if (phys) {
          edges[idx] |= DIR_E;
          edges[rightIdx] |= DIR_W;
        }
        if (eph) {
          edges[idx] |= DIR_E << 4;
          edges[rightIdx] |= DIR_W << 4;
        }
      }
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// 3. Ambient light: dropoff near room edges
// ---------------------------------------------------------------------------

/**
 * Generates a "light" tile attribute array where every tile with floor gets
 * a light value based on its distance to the nearest empty tile (no floor).
 *
 * At the default max of 200:
 * - Tiles 3+ cells from an edge: 200 (full bright)
 * - Tiles 2 cells from an edge: 160 (80%)
 * - Tiles 1 cell from an edge: 100 (50%)
 * - Empty tiles (no floor): 0
 *
 * The dropoff uses a stepped curve rather than linear falloff to give a
 * warm ambient feel — bright interiors with a visible dim band at the edges.
 * Lower max values produce a dimmer room with the same proportional dropoff.
 */
export function computeAmbientLight(
  width: number,
  height: number,
  tiles: Tile[],
  max: number = 200,
): number[] {
  const total = width * height;
  const hasFloor = new Uint8Array(total);
  for (const t of tiles) {
    if ((t.renderLayer ?? 0) === 0 && t.x >= 0 && t.x < width && t.y >= 0 && t.y < height) {
      hasFloor[t.y * width + t.x] = 1;
    }
  }

  // BFS from all empty/out-of-bounds neighbors to compute distance from edge
  // Distance 0 = empty tile, distance 1 = adjacent to empty, etc.
  const dist = new Uint8Array(total); // capped at 3 (we only need 0-3)
  const queue: number[] = [];

  // Seed: floor tiles adjacent to empty or grid boundary
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!hasFloor[idx]) continue;

      // Check if this floor tile is adjacent to empty or boundary
      const atEdge =
        x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
        !hasFloor[idx - 1] || !hasFloor[idx + 1] ||
        !hasFloor[idx - width] || !hasFloor[idx + width];

      if (atEdge) {
        dist[idx] = 1;
        queue.push(idx);
      }
    }
  }

  // BFS to propagate distance inward (only care about 1 and 2)
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const d = dist[idx];
    if (d >= 2) continue; // we only need 2 layers of dropoff

    const x = idx % width;
    const y = (idx - x) / width;

    const neighbors = [
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1,
    ];

    for (const nIdx of neighbors) {
      if (nIdx < 0) continue;
      if (!hasFloor[nIdx] || dist[nIdx] !== 0) continue;
      dist[nIdx] = d + 1;
      queue.push(nIdx);
    }
  }

  // Build light values — proportional steps of the max
  // dist=0 means either empty or 3+ from edge (unvisited floor)
  const light = new Array<number>(total);
  const full = Math.round(max);
  const mid = Math.round(max * 0.8);
  const dim = Math.round(max * 0.5);

  for (let i = 0; i < total; i++) {
    if (!hasFloor[i]) {
      light[i] = 0;
    } else if (dist[i] === 1) {
      light[i] = dim;
    } else if (dist[i] === 2) {
      light[i] = mid;
    } else {
      light[i] = full;
    }
  }

  return light;
}
