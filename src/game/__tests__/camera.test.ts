import { describe, it, expect, afterEach } from "vitest";
import { RoomRuntime } from "../runtime";
import { TICK } from "../entity-slice";

function makeRuntime() {
  return new RoomRuntime({
    config: { width: 8, height: 8 },
    tiles: Array.from({ length: 64 }, (_, i) => ({
      x: i % 8,
      y: Math.floor(i / 8),
      blocking: 0,
      spawn: false,
      attributes: [],
    })),
    entities: [
      { id: "player", type: "pc" as const, x: 2, y: 3 },
      { id: "npc1", type: "npc" as const, x: 6, y: 1 },
    ],
  });
}

function tick(rt: RoomRuntime, n = 1) {
  for (let i = 0; i < n; i++) {
    rt.store.dispatch({ type: TICK, payload: { tick: i } });
  }
}

function afterLoad(): Promise<void> {
  return new Promise((r) => queueMicrotask(r));
}

describe("camera basics", () => {
  let rt: RoomRuntime;
  afterEach(() => rt?.dispose());

  it("defaults to following its owner with default radius", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    const pos = rt.getCameraPosition("player");
    expect(pos).toEqual({ x: 2, y: 3, radius: 8 });
  });

  it("respects custom radius on creation", () => {
    rt = makeRuntime();
    rt.addCamera("player", undefined, 5);
    expect(rt.getCameraPosition("player")!.radius).toBe(5);
  });

  it("can follow a different entity", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.attachCamera("player", "npc1");
    expect(rt.getCameraPosition("player")).toEqual({ x: 6, y: 1, radius: 8 });
  });

  it("attachCamera can change radius", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.attachCamera("player", "npc1", 12);
    expect(rt.getCameraPosition("player")!.radius).toBe(12);
  });

  it("tracks followed entity as it moves", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.attachCamera("player", "npc1");
    rt.store.dispatch({
      type: "entities/setPosition",
      payload: { id: "npc1", x: 7, y: 5 },
    });
    expect(rt.getCameraPosition("player")).toEqual({ x: 7, y: 5, radius: 8 });
  });

  it("instant setCameraPosition snaps to static position", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.setCameraPosition("player", 4, 4);
    const cam = rt.getCamera("player")!;
    expect(cam.followId).toBeNull();
    expect(cam.pan).toBeNull();
    expect(rt.getCameraPosition("player")).toEqual({ x: 4, y: 4, radius: 8 });
  });

  it("instant setCameraPosition with radius", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.setCameraPosition("player", 4, 4, 3);
    expect(rt.getCameraPosition("player")).toEqual({ x: 4, y: 4, radius: 3 });
  });

  it("static position is independent of entity movement", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.setCameraPosition("player", 4, 4);
    rt.store.dispatch({
      type: "entities/setPosition",
      payload: { id: "player", x: 0, y: 0 },
    });
    expect(rt.getCameraPosition("player")).toEqual({ x: 4, y: 4, radius: 8 });
  });

  it("can re-attach after being static", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.setCameraPosition("player", 4, 4);
    rt.attachCamera("player", "player");
    expect(rt.getCameraPosition("player")).toEqual({ x: 2, y: 3, radius: 8 });
  });

  it("returns null for unknown camera owner", () => {
    rt = makeRuntime();
    expect(rt.getCamera("nobody")).toBeUndefined();
    expect(rt.getCameraPosition("nobody")).toBeNull();
  });

  it("detaches when followed entity is removed", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.attachCamera("player", "npc1");
    rt.removeEntity("npc1");
    expect(rt.getCamera("player")!.followId).toBeNull();
  });

  it("camera is removed when its owning PC is removed", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.removeEntity("player");
    expect(rt.getCamera("player")).toBeUndefined();
  });

  it("multiple PCs have independent cameras", () => {
    rt = makeRuntime();
    rt.addEntity({ id: "player2", type: "pc", x: 1, y: 1 });
    rt.addCamera("player", "player", 6);
    rt.addCamera("player2", "npc1", 10);
    expect(rt.getCameraPosition("player")).toEqual({ x: 2, y: 3, radius: 6 });
    expect(rt.getCameraPosition("player2")).toEqual({ x: 6, y: 1, radius: 10 });
  });
});

describe("camera pan transition", () => {
  let rt: RoomRuntime;
  afterEach(() => rt?.dispose());

  it("pans linearly from current position over duration", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    // Start at a known static position
    rt.setCameraPosition("player", 0, 0);
    // Pan to (4, 4) over 4 ticks
    rt.setCameraPosition("player", 4, 4, undefined, 4);

    expect(rt.getCamera("player")!.pan).not.toBeNull();

    tick(rt, 1); // 25%
    let pos = rt.getCameraPosition("player")!;
    expect(pos.x).toBeCloseTo(1);
    expect(pos.y).toBeCloseTo(1);

    tick(rt, 1); // 50%
    pos = rt.getCameraPosition("player")!;
    expect(pos.x).toBeCloseTo(2);
    expect(pos.y).toBeCloseTo(2);

    tick(rt, 2); // 100%
    pos = rt.getCameraPosition("player")!;
    expect(pos.x).toBe(4);
    expect(pos.y).toBe(4);
    expect(rt.getCamera("player")!.pan).toBeNull();
  });

  it("pans radius alongside position", () => {
    rt = makeRuntime();
    rt.addCamera("player", undefined, 4);
    rt.setCameraPosition("player", 0, 0);
    rt.setCameraPosition("player", 0, 0, 12, 4);

    tick(rt, 2); // 50%
    expect(rt.getCameraPosition("player")!.radius).toBeCloseTo(8);

    tick(rt, 2); // 100%
    expect(rt.getCameraPosition("player")!.radius).toBe(12);
  });

  it("attachCamera cancels an active pan", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.setCameraPosition("player", 0, 0);
    rt.setCameraPosition("player", 10, 10, undefined, 100);

    // Mid-pan, reattach
    tick(rt, 2);
    rt.attachCamera("player", "player");
    expect(rt.getCamera("player")!.pan).toBeNull();
    expect(rt.getCameraPosition("player")).toEqual({ x: 2, y: 3, radius: 8 });
  });

  it("a new setCameraPosition replaces an in-progress pan", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.setCameraPosition("player", 0, 0);
    rt.setCameraPosition("player", 10, 10, undefined, 10);
    tick(rt, 2); // at (2, 2)

    // Start a new pan from current position to (6, 6) over 2 ticks
    rt.setCameraPosition("player", 6, 6, undefined, 2);

    tick(rt, 1); // 50% of new pan
    const pos = rt.getCameraPosition("player")!;
    expect(pos.x).toBeCloseTo(4);
    expect(pos.y).toBeCloseTo(4);

    tick(rt, 1); // 100%
    expect(rt.getCameraPosition("player")!.x).toBe(6);
    expect(rt.getCameraPosition("player")!.y).toBe(6);
  });

  it("zero duration snaps even when a pan was active", () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.setCameraPosition("player", 0, 0);
    rt.setCameraPosition("player", 10, 10, undefined, 100);
    tick(rt, 5);

    // Snap
    rt.setCameraPosition("player", 7, 7);
    expect(rt.getCamera("player")!.pan).toBeNull();
    expect(rt.getCameraPosition("player")!.x).toBe(7);
  });
});

describe("camera via Lua scripts", () => {
  let rt: RoomRuntime;
  afterEach(() => rt?.dispose());

  it("cameraFollow with radius from Lua", async () => {
    rt = makeRuntime();
    rt.addCamera("player");

    rt.addEntity({
      id: "trigger",
      type: "item",
      x: 0,
      y: 0,
      state: {
        __behaviors: JSON.stringify([
          `when("interact")
          cameraFollow("player", "npc1", 12)`,
        ]),
      },
    });

    await afterLoad();
    rt.interact("player", "trigger");
    const pos = rt.getCameraPosition("player")!;
    expect(pos).toEqual({ x: 6, y: 1, radius: 12 });
  });

  it("cameraPan with radius and duration from Lua", async () => {
    rt = makeRuntime();
    rt.addCamera("player");
    rt.setCameraPosition("player", 0, 0);

    rt.addEntity({
      id: "trigger",
      type: "item",
      x: 0,
      y: 0,
      state: {
        __behaviors: JSON.stringify([
          `when("interact")
          cameraPan("player", 6, 6, 10, 3)`,
        ]),
      },
    });

    await afterLoad();
    rt.interact("player", "trigger");

    expect(rt.getCamera("player")!.pan).not.toBeNull();

    tick(rt, 3);
    const pos = rt.getCameraPosition("player")!;
    expect(pos.x).toBe(6);
    expect(pos.y).toBe(6);
    expect(pos.radius).toBe(10);
    expect(rt.getCamera("player")!.pan).toBeNull();
  });
});
