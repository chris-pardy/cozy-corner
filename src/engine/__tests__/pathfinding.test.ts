import { describe, it, expect } from "vitest";
import { findPath } from "../pathfinding";
import {
  type BlockingGrid,
  EDGE_N,
  EDGE_S,
  EDGE_E,
  EDGE_W,
} from "../state/blocking";

function openGrid(w = 5, h = 5): BlockingGrid {
  return { edges: new Array(w * h).fill(0), width: w, height: h };
}

describe("findPath", () => {
  it("returns empty array when start equals goal", () => {
    expect(findPath(openGrid(), { x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([]);
  });

  it("finds straight-line path", () => {
    const path = findPath(openGrid(), { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(path).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it("finds L-shaped path", () => {
    const path = findPath(openGrid(), { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(4); // Manhattan distance
    expect(path![path!.length - 1]).toEqual({ x: 2, y: 2 });
  });

  it("routes around a wall", () => {
    // Block west entry at column 2, rows 0-3 — forces going south to row 4
    const grid = openGrid();
    const edges = [...grid.edges];
    edges[0 * 5 + 2] = EDGE_W;
    edges[1 * 5 + 2] = EDGE_W;
    edges[2 * 5 + 2] = EDGE_W;
    edges[3 * 5 + 2] = EDGE_W;
    const blocked = { ...grid, edges };

    const path = findPath(blocked, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(path).not.toBeNull();
    // Must go south past the wall, then east, then north — longer than 3
    expect(path!.length).toBeGreaterThan(3);
    expect(path![path!.length - 1]).toEqual({ x: 3, y: 0 });
  });

  it("paths to closest reachable tile when goal is unreachable", () => {
    // Block all entry into (2,2)
    const grid = openGrid();
    const edges = [...grid.edges];
    edges[2 * 5 + 2] = EDGE_N | EDGE_S | EDGE_E | EDGE_W;
    const blocked = { ...grid, edges };

    const path = findPath(blocked, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(path).not.toBeNull();
    // Should end adjacent to (2,2), not at (2,2) itself
    const end = path![path!.length - 1];
    expect(end).not.toEqual({ x: 2, y: 2 });
    const dist = Math.abs(end.x - 2) + Math.abs(end.y - 2);
    expect(dist).toBe(1);
  });

  it("returns null when goal is out of bounds", () => {
    expect(findPath(openGrid(), { x: 0, y: 0 }, { x: 10, y: 0 })).toBeNull();
  });

  it("allows leaving a tile with blocked edges (one-way)", () => {
    // EDGE_S on (0,0) blocks entry from south, but does NOT block exit south
    const grid = openGrid();
    const edges = [...grid.edges];
    edges[0] = EDGE_S;
    const blocked = { ...grid, edges };

    const path = findPath(blocked, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(path).toEqual([{ x: 0, y: 1 }]); // direct path, length 1
  });

  it("respects entry edge blocking", () => {
    // Block north entry at (0,1) — same as blocking south→(0,1)
    const grid = openGrid();
    const edges = [...grid.edges];
    edges[1 * 5 + 0] = EDGE_N;
    const blocked = { ...grid, edges };

    const path = findPath(blocked, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
  });

  it("handles 1x1 grid", () => {
    const grid = openGrid(1, 1);
    expect(findPath(grid, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([]);
  });

  it("handles adjacent tiles", () => {
    const path = findPath(openGrid(), { x: 1, y: 1 }, { x: 1, y: 2 });
    expect(path).toEqual([{ x: 1, y: 2 }]);
  });
});
