import { describe, it, expect } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import {
  entitySlice,
  entitySelectors,
  addEntity,
  removeEntity,
  setPosition,
  setDirection,
  setAnimTarget,
  setEntityState,
  startMove,
  stopMove,
  TICK,
} from "../entity-slice";
import { Direction } from "../types";

function makeStore() {
  return configureStore({
    reducer: { entities: entitySlice.reducer },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, immutableCheck: false }),
  });
}

function tick(store: ReturnType<typeof makeStore>, n = 1) {
  for (let i = 0; i < n; i++) {
    store.dispatch({ type: TICK, payload: { tick: i } });
  }
}

describe("entity slice", () => {
  it("adds an entity with defaults", () => {
    const store = makeStore();
    store.dispatch(addEntity({ id: "p1", type: "pc", x: 3, y: 5 }));
    const e = entitySelectors.selectById(store.getState().entities, "p1");
    expect(e).toBeDefined();
    expect(e!.x).toBe(3);
    expect(e!.y).toBe(5);
    expect(e!.direction).toBe(Direction.South);
    expect(e!.animTarget).toBe("idle-south");
    expect(e!.width).toBe(1);
    expect(e!.height).toBe(1);
    expect(e!.movePath).toBeNull();
    expect(e!.moveSpeed).toBe(5);
  });

  it("removes an entity", () => {
    const store = makeStore();
    store.dispatch(addEntity({ id: "p1", type: "pc", x: 0, y: 0 }));
    store.dispatch(removeEntity("p1"));
    expect(entitySelectors.selectById(store.getState().entities, "p1")).toBeUndefined();
  });

  it("setPosition updates x/y", () => {
    const store = makeStore();
    store.dispatch(addEntity({ id: "p1", type: "pc", x: 0, y: 0 }));
    store.dispatch(setPosition({ id: "p1", x: 7, y: 2 }));
    const e = entitySelectors.selectById(store.getState().entities, "p1")!;
    expect(e.x).toBe(7);
    expect(e.y).toBe(2);
  });

  it("setDirection updates facing", () => {
    const store = makeStore();
    store.dispatch(addEntity({ id: "p1", type: "pc", x: 0, y: 0 }));
    store.dispatch(setDirection({ id: "p1", direction: Direction.North }));
    expect(
      entitySelectors.selectById(store.getState().entities, "p1")!.direction,
    ).toBe(Direction.North);
  });

  it("setAnimTarget changes target", () => {
    const store = makeStore();
    store.dispatch(addEntity({ id: "p1", type: "pc", x: 0, y: 0 }));
    store.dispatch(setAnimTarget({ id: "p1", target: "dance" }));
    expect(
      entitySelectors.selectById(store.getState().entities, "p1")!.animTarget,
    ).toBe("dance");
  });

  it("setEntityState sets key-value pairs", () => {
    const store = makeStore();
    store.dispatch(addEntity({ id: "p1", type: "pc", x: 0, y: 0 }));
    store.dispatch(setEntityState({ id: "p1", key: "mood", value: "happy" }));
    expect(
      entitySelectors.selectById(store.getState().entities, "p1")!.state.mood,
    ).toBe("happy");
  });
});

describe("movement via tick", () => {
  it("advances one tile immediately on first tick, then waits moveSpeed ticks", () => {
    const store = makeStore();
    store.dispatch(addEntity({ id: "p1", type: "pc", x: 0, y: 0, moveSpeed: 3 }));
    store.dispatch(
      startMove({
        id: "p1",
        path: [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
      }),
    );

    // First tick: moves to (1,0), timer set to 3
    tick(store);
    let e = entitySelectors.selectById(store.getState().entities, "p1")!;
    expect(e.x).toBe(1);
    expect(e.y).toBe(0);
    expect(e.direction).toBe(Direction.East);
    expect(e.animTarget).toBe("walk-east");

    // Next 3 ticks: timer 3→2→1→0, no movement
    tick(store, 3);
    e = entitySelectors.selectById(store.getState().entities, "p1")!;
    expect(e.x).toBe(1);

    // Tick 5: timer is 0 → moves to (2,0) and path is done → idle
    tick(store);
    e = entitySelectors.selectById(store.getState().entities, "p1")!;
    expect(e.x).toBe(2);
    expect(e.y).toBe(0);
    expect(e.movePath).toBeNull();
    expect(e.animTarget).toBe("idle-east");
  });

  it("stopMove cancels movement and idles", () => {
    const store = makeStore();
    store.dispatch(addEntity({ id: "p1", type: "pc", x: 0, y: 0 }));
    store.dispatch(
      startMove({ id: "p1", path: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }),
    );
    tick(store); // move to (1,0)
    store.dispatch(stopMove("p1"));
    const e = entitySelectors.selectById(store.getState().entities, "p1")!;
    expect(e.movePath).toBeNull();
    expect(e.animTarget).toMatch(/^idle-/);
  });

  it("handles southward movement direction", () => {
    const store = makeStore();
    store.dispatch(addEntity({ id: "p1", type: "pc", x: 0, y: 0 }));
    store.dispatch(startMove({ id: "p1", path: [{ x: 0, y: 1 }] }));
    tick(store);
    const e = entitySelectors.selectById(store.getState().entities, "p1")!;
    expect(e.direction).toBe(Direction.South);
    expect(e.y).toBe(1);
  });
});
