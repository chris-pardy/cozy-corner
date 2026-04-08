import { describe, it, expect } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { entitySlice, addEntity } from "../entity-slice";
import { roomSlice, initRoom } from "../room-slice";
import { Edge } from "../types";
import {
  selectBlockingGrid,
  selectAttributeMaps,
  selectSpawnTiles,
  selectAllEntities,
  type RootState,
} from "../selectors";

function makeStore() {
  return configureStore({
    reducer: {
      entities: entitySlice.reducer,
      room: roomSlice.reducer,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, immutableCheck: false }),
  });
}

describe("selectBlockingGrid", () => {
  it("returns zero grid for empty room", () => {
    const store = makeStore();
    store.dispatch(initRoom({ config: { width: 3, height: 3 }, tiles: [] }));
    const grid = selectBlockingGrid(store.getState() as RootState);
    expect(grid.length).toBe(9);
    expect(grid.every((v) => v === 0)).toBe(true);
  });

  it("includes static tile blocking", () => {
    const store = makeStore();
    store.dispatch(
      initRoom({
        config: { width: 4, height: 4 },
        tiles: [
          { x: 1, y: 2, blocking: Edge.AllPhysical, spawn: false, attributes: [] },
        ],
      }),
    );
    const grid = selectBlockingGrid(store.getState() as RootState);
    expect(grid[2 * 4 + 1]).toBe(Edge.AllPhysical);
    expect(grid[0]).toBe(0);
  });

  it("merges item entity blockedEdges", () => {
    const store = makeStore();
    store.dispatch(initRoom({ config: { width: 4, height: 4 }, tiles: [] }));
    store.dispatch(
      addEntity({
        id: "table",
        type: "item",
        x: 1,
        y: 1,
        width: 2,
        height: 1,
        blockedEdges: [Edge.N | Edge.S, Edge.E],
      }),
    );
    const grid = selectBlockingGrid(store.getState() as RootState);
    // (1,1) → row-major idx 0 of blockedEdges
    expect(grid[1 * 4 + 1]).toBe(Edge.N | Edge.S);
    // (2,1) → row-major idx 1
    expect(grid[1 * 4 + 2]).toBe(Edge.E);
  });

  it("ORs tile and item blocking together", () => {
    const store = makeStore();
    store.dispatch(
      initRoom({
        config: { width: 4, height: 4 },
        tiles: [{ x: 0, y: 0, blocking: Edge.N, spawn: false, attributes: [] }],
      }),
    );
    store.dispatch(
      addEntity({
        id: "chair",
        type: "item",
        x: 0,
        y: 0,
        blockedEdges: [Edge.S],
      }),
    );
    const grid = selectBlockingGrid(store.getState() as RootState);
    expect(grid[0]).toBe(Edge.N | Edge.S);
  });
});

describe("selectAttributeMaps", () => {
  it("returns empty object when no tiles have attributes", () => {
    const store = makeStore();
    store.dispatch(initRoom({ config: { width: 2, height: 2 }, tiles: [] }));
    const maps = selectAttributeMaps(store.getState() as RootState);
    expect(Object.keys(maps)).toHaveLength(0);
  });

  it("builds per-attribute float64 arrays defaulting to 100", () => {
    const store = makeStore();
    store.dispatch(
      initRoom({
        config: { width: 3, height: 3 },
        tiles: [
          {
            x: 1,
            y: 1,
            blocking: 0,
            spawn: false,
            attributes: [{ attribute: "light", value: 80 }],
          },
        ],
      }),
    );
    const maps = selectAttributeMaps(store.getState() as RootState);
    expect(maps.light).toBeDefined();
    expect(maps.light.length).toBe(9);
    // (1,1) = index 4
    expect(maps.light[4]).toBe(80);
    // Other tiles default to 100
    expect(maps.light[0]).toBe(100);
  });
});

describe("selectSpawnTiles", () => {
  it("returns only tiles with spawn=true", () => {
    const store = makeStore();
    store.dispatch(
      initRoom({
        config: { width: 4, height: 4 },
        tiles: [
          { x: 0, y: 0, blocking: 0, spawn: true, attributes: [] },
          { x: 1, y: 0, blocking: 0, spawn: false, attributes: [] },
          { x: 2, y: 0, blocking: 0, spawn: true, attributes: [] },
        ],
      }),
    );
    const spawns = selectSpawnTiles(store.getState() as RootState);
    expect(spawns).toHaveLength(2);
    expect(spawns.map((s) => s.x).sort()).toEqual([0, 2]);
  });
});

describe("selectAllEntities", () => {
  it("returns all entities from the store", () => {
    const store = makeStore();
    store.dispatch(initRoom({ config: { width: 4, height: 4 }, tiles: [] }));
    store.dispatch(addEntity({ id: "a", type: "pc", x: 0, y: 0 }));
    store.dispatch(addEntity({ id: "b", type: "npc", x: 1, y: 1 }));
    const all = selectAllEntities(store.getState() as RootState);
    expect(all).toHaveLength(2);
  });
});
