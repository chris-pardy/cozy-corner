import { describe, it, expect } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { roomSlice, initRoom, setTile, removeTile } from "../room-slice";

function makeStore() {
  return configureStore({ reducer: { room: roomSlice.reducer } });
}

describe("room slice", () => {
  it("initializes with config and tiles", () => {
    const store = makeStore();
    store.dispatch(
      initRoom({
        config: { width: 8, height: 8 },
        tiles: [
          { x: 0, y: 0, blocking: 0, spawn: true, attributes: [] },
          { x: 1, y: 0, blocking: 15, spawn: false, attributes: [] },
        ],
      }),
    );
    const room = store.getState().room;
    expect(room.width).toBe(8);
    expect(room.height).toBe(8);
    expect(room.tiles["0,0"]).toBeDefined();
    expect(room.tiles["0,0"].spawn).toBe(true);
    expect(room.tiles["1,0"].blocking).toBe(15);
  });

  it("setTile adds/overwrites a tile", () => {
    const store = makeStore();
    store.dispatch(initRoom({ config: { width: 4, height: 4 }, tiles: [] }));
    store.dispatch(
      setTile({ x: 2, y: 3, blocking: 5, spawn: false, attributes: [] }),
    );
    expect(store.getState().room.tiles["2,3"].blocking).toBe(5);

    // overwrite
    store.dispatch(
      setTile({ x: 2, y: 3, blocking: 10, spawn: false, attributes: [] }),
    );
    expect(store.getState().room.tiles["2,3"].blocking).toBe(10);
  });

  it("removeTile deletes a tile", () => {
    const store = makeStore();
    store.dispatch(
      initRoom({
        config: { width: 4, height: 4 },
        tiles: [{ x: 1, y: 1, blocking: 0, spawn: false, attributes: [] }],
      }),
    );
    expect(store.getState().room.tiles["1,1"]).toBeDefined();
    store.dispatch(removeTile({ x: 1, y: 1 }));
    expect(store.getState().room.tiles["1,1"]).toBeUndefined();
  });

  it("initRoom replaces previous state entirely", () => {
    const store = makeStore();
    store.dispatch(
      initRoom({
        config: { width: 10, height: 10 },
        tiles: [{ x: 5, y: 5, blocking: 0, spawn: false, attributes: [] }],
      }),
    );
    store.dispatch(
      initRoom({
        config: { width: 2, height: 2 },
        tiles: [],
      }),
    );
    expect(store.getState().room.width).toBe(2);
    expect(store.getState().room.tiles["5,5"]).toBeUndefined();
  });
});
