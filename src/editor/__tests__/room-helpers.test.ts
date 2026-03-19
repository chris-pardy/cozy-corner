import { describe, it, expect } from "vitest";
import { computeSpawnTiles, computeAmbientLight } from "../room-helpers";

// Helper: build a full floor grid (every tile has renderLayer 0)
function fullFloor(w: number, h: number) {
  const tiles: { x: number; y: number; renderLayer: number }[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      tiles.push({ x, y, renderLayer: 0 });
  return tiles;
}

// Blocking edge constants
const DIR_E = 2;
const DIR_W = 8;

describe("computeSpawnTiles", () => {
  it("returns all zeros when there are no exits", () => {
    const tiles = fullFloor(4, 4);
    const result = computeSpawnTiles(4, 4, tiles, [], new Array(16).fill(0));
    expect(result.every((v) => v === 0)).toBe(true);
  });

  it("fills entire open room from a corner exit", () => {
    const tiles = fullFloor(4, 4);
    const exits = [{ x: 0, y: 0, width: 1, height: 1 }];
    const result = computeSpawnTiles(4, 4, tiles, exits, new Array(16).fill(0));
    expect(result.every((v) => v === 1)).toBe(true);
  });

  it("stops at blocked edges", () => {
    // 4x1 room with a wall between x=1 and x=2
    // Tile 2 blocks its west edge (incoming from tile 1)
    const tiles = fullFloor(4, 1);
    const blocking = [0, 0, DIR_W, 0];
    const exits = [{ x: 0, y: 0 }];
    const result = computeSpawnTiles(4, 1, tiles, exits, blocking);
    // Only tiles 0, 1 are reachable (tile 2 blocks entry from the west)
    expect(result).toEqual([1, 1, 0, 0]);
  });

  it("stops at empty tiles (no floor)", () => {
    // 4x1 room with a gap at x=2 (no floor tile)
    const tiles = [
      { x: 0, y: 0, renderLayer: 0 },
      { x: 1, y: 0, renderLayer: 0 },
      // x=2 is empty
      { x: 3, y: 0, renderLayer: 0 },
    ];
    const exits = [{ x: 0, y: 0 }];
    const result = computeSpawnTiles(4, 1, tiles, exits, new Array(4).fill(0));
    expect(result).toEqual([1, 1, 0, 0]);
  });

  it("handles multi-tile exits", () => {
    const tiles = fullFloor(4, 4);
    const exits = [{ x: 1, y: 0, width: 2, height: 1 }];
    const result = computeSpawnTiles(4, 4, tiles, exits, new Array(16).fill(0));
    expect(result.every((v) => v === 1)).toBe(true);
  });

  it("outgoing edge on source tile does not block (only incoming matters)", () => {
    // 3x1 room, tile 0 blocks east but tile 1 does NOT block west
    // Only the neighbor's incoming edge matters, so fill passes through
    const tiles = fullFloor(3, 1);
    const blocking = [DIR_E, 0, 0];
    const exits = [{ x: 0, y: 0 }];
    const result = computeSpawnTiles(3, 1, tiles, exits, blocking);
    expect(result).toEqual([1, 1, 1]);
  });

  it("neighbor incoming edge blocks fill", () => {
    // 3x1 room, tile 1 blocks west — blocks entry from tile 0
    const tiles = fullFloor(3, 1);
    const blocking = [0, DIR_W, 0];
    const exits = [{ x: 0, y: 0 }];
    const result = computeSpawnTiles(3, 1, tiles, exits, blocking);
    expect(result).toEqual([1, 0, 0]);
  });

  it("ephemeral blocking does not stop fill", () => {
    // 3x1 room, tile 1 has ephemeral west blocking (bit 4-7) but no physical
    const tiles = fullFloor(3, 1);
    const EPHEMERAL_W = DIR_W << 4; // 128
    const blocking = [0, EPHEMERAL_W, 0];
    const exits = [{ x: 0, y: 0 }];
    const result = computeSpawnTiles(3, 1, tiles, exits, blocking);
    expect(result).toEqual([1, 1, 1]);
  });
});

describe("computeAmbientLight", () => {
  it("returns all zeros for an empty room", () => {
    const light = computeAmbientLight(3, 3, []);
    expect(light).toEqual(new Array(9).fill(0));
  });

  it("marks edge tiles as dim", () => {
    // 3x3 room, all floor
    const tiles = fullFloor(3, 3);
    const light = computeAmbientLight(3, 3, tiles);
    // All tiles are at most 1 from edge in a 3x3
    // Corner and edge tiles: dist 1 = 100
    // Center tile is dist 2 from edge (corners are 1 away)
    // Actually center (1,1) is 1 away from any edge (0,1), (2,1), (1,0), (1,2)
    // But those are floor tiles. "Edge" means adjacent to empty or boundary.
    // In a 3x3, every tile is on the boundary → dist 1
    // Center (1,1) is NOT on boundary, but its neighbors (0,1), (2,1) etc are all floor
    // so (1,1) would get dist 2
    expect(light[0]).toBe(100); // corner
    expect(light[4]).toBe(160); // center is dist 2
  });

  it("interior tiles get full brightness", () => {
    // 5x5 room, all floor — center tile (2,2) is 3 from boundary
    const tiles = fullFloor(5, 5);
    const light = computeAmbientLight(5, 5, tiles);
    expect(light[12]).toBe(200); // (2,2) = index 12
    expect(light[6]).toBe(160);  // (1,1) = index 6, dist 2
    expect(light[0]).toBe(100);  // (0,0) = index 0, dist 1
  });

  it("empty tiles get zero light", () => {
    // Sparse floor: only (0,0) and (1,0) have floor
    const tiles = [
      { x: 0, y: 0, renderLayer: 0 },
      { x: 1, y: 0, renderLayer: 0 },
    ];
    const light = computeAmbientLight(3, 3, tiles);
    expect(light[0]).toBe(100); // floor, at edge
    expect(light[1]).toBe(100); // floor, at edge
    expect(light[2]).toBe(0);   // no floor
  });

  it("handles L-shaped rooms", () => {
    // L-shape:
    // X X .
    // X . .
    // X . .
    const tiles = [
      { x: 0, y: 0, renderLayer: 0 },
      { x: 1, y: 0, renderLayer: 0 },
      { x: 0, y: 1, renderLayer: 0 },
      { x: 0, y: 2, renderLayer: 0 },
    ];
    const light = computeAmbientLight(3, 3, tiles);
    // All tiles are dist 1 (all adjacent to empty or boundary)
    expect(light[0]).toBe(100);
    expect(light[1]).toBe(100);
    expect(light[3]).toBe(100);
    expect(light[6]).toBe(100);
    // Empty tiles
    expect(light[2]).toBe(0);
    expect(light[4]).toBe(0);
  });

  it("scales values to custom max", () => {
    // 5x5 room — same layout as "interior tiles" test but max=100
    const tiles = fullFloor(5, 5);
    const light = computeAmbientLight(5, 5, tiles, 100);
    expect(light[12]).toBe(100); // full = 100
    expect(light[6]).toBe(80);   // mid = 100 * 0.8
    expect(light[0]).toBe(50);   // dim = 100 * 0.5
  });

  it("handles max of 0 (completely dark)", () => {
    const tiles = fullFloor(3, 3);
    const light = computeAmbientLight(3, 3, tiles, 0);
    expect(light.every((v) => v === 0)).toBe(true);
  });
});
