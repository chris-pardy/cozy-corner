import { describe, it, expect } from "vitest";
import { findPath } from "../pathfinding";
import { Edge } from "../types";

function emptyGrid(w: number, h: number) {
  return new Uint8Array(w * h);
}

describe("findPath", () => {
  it("returns empty array when start equals end", () => {
    const grid = emptyGrid(4, 4);
    expect(findPath(grid, 4, 4, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });

  it("finds straight-line path on open grid", () => {
    const grid = emptyGrid(5, 5);
    const path = findPath(grid, 5, 5, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3);
    expect(path![path!.length - 1]).toEqual({ x: 3, y: 0 });
  });

  it("navigates around a wall", () => {
    // 5x5 grid with a vertical wall at x=2, y=0..3
    const grid = emptyGrid(5, 5);
    for (let y = 0; y < 4; y++) {
      grid[y * 5 + 2] = Edge.AllPhysical;
    }
    const path = findPath(grid, 5, 5, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path).not.toBeNull();
    // Must go around the wall — path must pass through y >= 4
    expect(path!.some((p) => p.y >= 4)).toBe(true);
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 0 });
  });

  it("returns null when destination is unreachable", () => {
    // Surround (2,2) with walls
    const grid = emptyGrid(5, 5);
    grid[2 * 5 + 2] = Edge.AllPhysical; // block all edges on target
    const path = findPath(grid, 5, 5, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(path).toBeNull();
  });

  it("returns null when destination is out of bounds", () => {
    const grid = emptyGrid(3, 3);
    expect(findPath(grid, 3, 3, { x: 0, y: 0 }, { x: 5, y: 5 })).toBeNull();
  });

  it("respects directional edge blocking (one-way passage)", () => {
    // Block only the north edge of tile (2,1) — can't enter from south (walking north)
    const grid = emptyGrid(4, 4);
    grid[1 * 4 + 2] = Edge.N; // blocks entry from south (walking south → enters north)

    // Walking from (2,0) south to (2,1): enters north edge → blocked
    const blocked = findPath(grid, 4, 4, { x: 2, y: 0 }, { x: 2, y: 1 });
    // Should find alternate path or fail
    // Since only N is blocked on (2,1), you can't enter from above, but can enter from sides
    expect(blocked).not.toBeNull();
    // The direct south path is blocked; must go around
    expect(blocked!.length).toBeGreaterThan(1);
  });

  it("ignores ephemeral blocking bits for pathfinding", () => {
    const grid = emptyGrid(3, 3);
    // Set ephemeral-only blocking (bits 4-7), no physical blocking
    grid[1 * 3 + 1] = Edge.EphN | Edge.EphS | Edge.EphE | Edge.EphW;
    const path = findPath(grid, 3, 3, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(path).not.toBeNull();
    // Tile (1,1) should be passable (ephemeral doesn't block movement)
    expect(path!.some((p) => p.x === 1 && p.y === 1)).toBe(true);
  });

  it("finds optimal path length (Manhattan distance on open grid)", () => {
    const grid = emptyGrid(10, 10);
    const path = findPath(grid, 10, 10, { x: 0, y: 0 }, { x: 5, y: 3 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(8); // 5 + 3
  });
});
