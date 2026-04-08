import { describe, it, expect, afterEach } from "vitest";
import { RoomRuntime } from "../runtime";
import { Direction } from "../types";

function makeRuntime() {
  return new RoomRuntime({
    config: { width: 8, height: 8 },
    tiles: Array.from({ length: 64 }, (_, i) => ({
      x: i % 8,
      y: Math.floor(i / 8),
      blocking: 0,
      spawn: i === 0,
      attributes: [],
    })),
    entities: [
      { id: "player", type: "pc" as const, x: 0, y: 0 },
      { id: "cat", type: "npc" as const, x: 4, y: 4 },
    ],
  });
}

describe("RoomRuntime", () => {
  let rt: RoomRuntime;

  afterEach(() => {
    rt?.dispose();
  });

  it("initializes with config, tiles, and entities", () => {
    rt = makeRuntime();
    const state = rt.getState();
    expect(state.room.width).toBe(8);
    expect(state.room.height).toBe(8);
    expect(rt.getAllEntities()).toHaveLength(2);
    expect(rt.getEntity("player")!.x).toBe(0);
    expect(rt.getEntity("cat")!.x).toBe(4);
  });

  it("addEntity and removeEntity work", () => {
    rt = makeRuntime();
    rt.addEntity({ id: "lamp", type: "item", x: 2, y: 2 });
    expect(rt.getAllEntities()).toHaveLength(3);
    rt.removeEntity("lamp");
    expect(rt.getAllEntities()).toHaveLength(2);
  });

  it("moveTo computes path and starts movement", () => {
    rt = makeRuntime();
    const success = rt.moveTo("player", 3, 0);
    expect(success).toBe(true);
    const player = rt.getEntity("player")!;
    expect(player.movePath).not.toBeNull();
    expect(player.movePath!.length).toBe(3);
  });

  it("moveTo returns false for unreachable targets", () => {
    rt = new RoomRuntime({
      config: { width: 3, height: 1 },
      tiles: [
        { x: 0, y: 0, blocking: 0, spawn: true, attributes: [] },
        { x: 1, y: 0, blocking: 15, spawn: false, attributes: [] },
        { x: 2, y: 0, blocking: 0, spawn: false, attributes: [] },
      ],
      entities: [{ id: "p", type: "pc", x: 0, y: 0 }],
    });
    expect(rt.moveTo("p", 2, 0)).toBe(false);
  });

  it("setEntityState updates entity state", () => {
    rt = makeRuntime();
    rt.setEntityState("cat", "mood", "happy");
    expect(rt.getEntity("cat")!.state.mood).toBe("happy");
  });

  it("setDirection updates facing", () => {
    rt = makeRuntime();
    rt.setDirection("player", Direction.North);
    expect(rt.getEntity("player")!.direction).toBe(Direction.North);
  });

  it("setAnimTarget changes target", () => {
    rt = makeRuntime();
    rt.setAnimTarget("player", "dance");
    expect(rt.getEntity("player")!.animTarget).toBe("dance");
  });

  it("getBlockingGrid returns a grid", () => {
    rt = makeRuntime();
    const grid = rt.getBlockingGrid();
    expect(grid.length).toBe(64);
  });

  it("getSpawnTiles returns spawn tiles", () => {
    rt = makeRuntime();
    const spawns = rt.getSpawnTiles();
    expect(spawns.length).toBe(1);
    expect(spawns[0].x).toBe(0);
    expect(spawns[0].y).toBe(0);
  });

  it("subscribe notifies on state changes", () => {
    rt = makeRuntime();
    let count = 0;
    const unsub = rt.subscribe(() => count++);
    rt.setEntityState("cat", "k", "v");
    expect(count).toBeGreaterThan(0);
    unsub();
  });

  it("serialize returns serializable state", () => {
    rt = makeRuntime();
    const snap = rt.serialize();
    // Should be JSON-round-trippable (ignoring typed arrays in selectors)
    expect(snap.room.width).toBe(8);
    expect(snap.entities.ids).toContain("player");
  });

  it("start/stop controls tick loop", () => {
    rt = makeRuntime();
    expect(rt.running).toBe(false);
    rt.start();
    expect(rt.running).toBe(true);
    rt.stop();
    expect(rt.running).toBe(false);
  });
});
