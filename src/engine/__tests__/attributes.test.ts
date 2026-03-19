import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../entity";
import { DataEvent } from "../event";
import { AttributeEmitBehavior } from "../behaviors/attribute-emit";
import { POSITION } from "../state/movement";
import {
  AttributeMap,
  ATTRIBUTE_MAP,
  ATTRIBUTE_EMISSIONS,
  DIR_S,
  DIR_N,
  DIR_E,
  DIR_W,
} from "../state/attributes";
import {
  BLOCKING_GRID,
  EDGE_S,
  EPHEMERAL_SHIFT,
} from "../state/blocking";

function makeRoom(w = 10, h = 10): Entity {
  const room = new Entity();
  room.set(ATTRIBUTE_MAP, new AttributeMap(w, h));
  return room;
}

function makeRoomWithBlocking(w = 10, h = 10, edges?: number[]): Entity {
  const room = new Entity();
  room.set(ATTRIBUTE_MAP, new AttributeMap(w, h));
  room.set(BLOCKING_GRID, { edges: edges ?? new Array(w * h).fill(0), width: w, height: h });
  return room;
}

function makeEmitter(
  room: Entity,
  x: number,
  y: number,
  emissions: {
    attribute: string;
    value: number;
    width?: number;
    height?: number;
    radius?: number;
    direction?: number;
  }[],
): Entity {
  const e = new Entity([new AttributeEmitBehavior()]);
  e.set(POSITION, { x, y });
  e.set(ATTRIBUTE_EMISSIONS, emissions);
  room.addChild(e);
  return e;
}

const EMIT = new DataEvent("emit-attributes", {}, 0);

describe("AttributeMap", () => {
  it("returns 0 for unset attributes", () => {
    const map = new AttributeMap(5, 5);
    expect(map.get("light", 2, 2)).toBe(0);
  });

  it("accumulates values additively", () => {
    const map = new AttributeMap(5, 5);
    map.add("light", 1, 1, 0.5);
    map.add("light", 1, 1, 0.3);
    expect(map.get("light", 1, 1)).toBeCloseTo(0.8);
  });

  it("keeps attributes separate", () => {
    const map = new AttributeMap(5, 5);
    map.add("light", 0, 0, 1);
    map.add("heat", 0, 0, 0.5);
    expect(map.get("light", 0, 0)).toBe(1);
    expect(map.get("heat", 0, 0)).toBe(0.5);
  });

  it("reset zeros all values", () => {
    const map = new AttributeMap(5, 5);
    map.add("light", 0, 0, 1);
    map.add("heat", 1, 1, 0.5);
    map.reset();
    expect(map.get("light", 0, 0)).toBe(0);
    expect(map.get("heat", 1, 1)).toBe(0);
  });

  it("ignores out-of-bounds writes", () => {
    const map = new AttributeMap(3, 3);
    map.add("light", -1, 0, 1);
    map.add("light", 3, 0, 1);
    map.add("light", 0, -1, 1);
    map.add("light", 0, 3, 1);
    expect(map.get("light", 0, 0)).toBe(0);
  });

  it("returns 0 for out-of-bounds reads", () => {
    const map = new AttributeMap(3, 3);
    expect(map.get("light", -1, 0)).toBe(0);
    expect(map.get("light", 5, 5)).toBe(0);
  });
});

describe("AttributeEmitBehavior", () => {
  let room: Entity;
  let map: AttributeMap;

  beforeEach(() => {
    room = makeRoom();
    map = room.get<AttributeMap>(ATTRIBUTE_MAP)!;
  });

  it("responds to emit-attributes event", () => {
    makeEmitter(room, 3, 3, [{ attribute: "light", value: 1 }]);
    room.children[0].emit(EMIT);
    expect(map.get("light", 3, 3)).toBe(1);
  });

  it("emits a point source at entity position", () => {
    makeEmitter(room, 3, 3, [{ attribute: "light", value: 1 }]);
    room.children[0].emit(EMIT);
    expect(map.get("light", 3, 3)).toBe(1);
    expect(map.get("light", 4, 3)).toBe(0);
  });

  it("emits a rectangular footprint", () => {
    makeEmitter(room, 2, 2, [
      { attribute: "heat", value: 0.5, width: 3, height: 2 },
    ]);
    room.children[0].emit(EMIT);

    for (let x = 2; x <= 4; x++) {
      for (let y = 2; y <= 3; y++) {
        expect(map.get("heat", x, y)).toBe(0.5);
      }
    }
    expect(map.get("heat", 1, 2)).toBe(0);
    expect(map.get("heat", 5, 2)).toBe(0);
  });

  it("applies omnidirectional linear falloff", () => {
    makeEmitter(room, 5, 5, [
      { attribute: "light", value: 1, radius: 2 },
    ]);
    room.children[0].emit(EMIT);

    expect(map.get("light", 5, 5)).toBe(1);
    // 1 tile away in each direction: 50%
    expect(map.get("light", 6, 5)).toBe(0.5);
    expect(map.get("light", 4, 5)).toBe(0.5);
    expect(map.get("light", 5, 4)).toBe(0.5);
    expect(map.get("light", 5, 6)).toBe(0.5);
    // 2 tiles away: 0
    expect(map.get("light", 7, 5)).toBe(0);
  });

  it("multiple emitters are additive", () => {
    makeEmitter(room, 3, 3, [{ attribute: "light", value: 0.6 }]);
    makeEmitter(room, 3, 3, [{ attribute: "light", value: 0.4 }]);

    for (const child of room.children) child.emit(EMIT);

    expect(map.get("light", 3, 3)).toBeCloseTo(1);
  });

  it("multiple attributes from one emitter", () => {
    makeEmitter(room, 1, 1, [
      { attribute: "light", value: 0.8 },
      { attribute: "heat", value: 0.3 },
    ]);
    room.children[0].emit(EMIT);
    expect(map.get("light", 1, 1)).toBeCloseTo(0.8);
    expect(map.get("heat", 1, 1)).toBeCloseTo(0.3);
  });

  it("does nothing without POSITION", () => {
    const e = new Entity([new AttributeEmitBehavior()]);
    e.set(ATTRIBUTE_EMISSIONS, [{ attribute: "light", value: 1 }]);
    room.addChild(e);
    e.emit(EMIT);
    expect(map.get("light", 0, 0)).toBe(0);
  });

  it("does nothing without ATTRIBUTE_EMISSIONS", () => {
    const e = new Entity([new AttributeEmitBehavior()]);
    e.set(POSITION, { x: 0, y: 0 });
    room.addChild(e);
    e.emit(EMIT);
    expect(map.get("light", 0, 0)).toBe(0);
  });

  it("does nothing without ATTRIBUTE_MAP on ancestor", () => {
    const orphan = new Entity([new AttributeEmitBehavior()]);
    orphan.set(POSITION, { x: 0, y: 0 });
    orphan.set(ATTRIBUTE_EMISSIONS, [{ attribute: "light", value: 1 }]);
    orphan.emit(EMIT);
    // No crash
  });

  it("clamps to room bounds", () => {
    const smallRoom = makeRoom(3, 3);
    const smallMap = smallRoom.get<AttributeMap>(ATTRIBUTE_MAP)!;

    makeEmitter(smallRoom, 0, 0, [
      { attribute: "light", value: 1, radius: 5 },
    ]);
    smallRoom.children[0].emit(EMIT);

    expect(smallMap.get("light", 0, 0)).toBe(1);
    expect(smallMap.get("light", 2, 2)).toBeGreaterThan(0);
    expect(smallMap.get("light", 3, 3)).toBe(0);
  });

  it("rectangular footprint with radius falloff", () => {
    makeEmitter(room, 3, 3, [
      { attribute: "food", value: 1, width: 2, height: 2, radius: 1 },
    ]);
    room.children[0].emit(EMIT);

    expect(map.get("food", 3, 3)).toBe(1);
    expect(map.get("food", 4, 4)).toBe(1);
    // 1 tile from footprint edge with radius 1: 0
    expect(map.get("food", 2, 3)).toBe(0);
    expect(map.get("food", 5, 3)).toBe(0);
  });

  it("accumulates after reset", () => {
    makeEmitter(room, 1, 1, [{ attribute: "light", value: 0.5 }]);
    room.children[0].emit(EMIT);
    expect(map.get("light", 1, 1)).toBe(0.5);

    map.reset();
    room.children[0].emit(EMIT);
    expect(map.get("light", 1, 1)).toBe(0.5);
  });

  describe("directional emission", () => {
    it("emits only south", () => {
      makeEmitter(room, 5, 5, [
        { attribute: "light", value: 1, radius: 3, direction: DIR_S },
      ]);
      room.children[0].emit(EMIT);

      // Footprint: full value
      expect(map.get("light", 5, 5)).toBe(1);
      // South: falloff
      expect(map.get("light", 5, 6)).toBeGreaterThan(0);
      expect(map.get("light", 5, 7)).toBeGreaterThan(0);
      // North: nothing
      expect(map.get("light", 5, 4)).toBe(0);
      // East/West: nothing
      expect(map.get("light", 6, 5)).toBe(0);
      expect(map.get("light", 4, 5)).toBe(0);
    });

    it("emits only north", () => {
      makeEmitter(room, 5, 5, [
        { attribute: "light", value: 1, radius: 2, direction: DIR_N },
      ]);
      room.children[0].emit(EMIT);

      expect(map.get("light", 5, 5)).toBe(1);
      expect(map.get("light", 5, 4)).toBe(0.5);
      expect(map.get("light", 5, 6)).toBe(0);
    });

    it("emits east and west", () => {
      makeEmitter(room, 5, 5, [
        { attribute: "heat", value: 1, radius: 2, direction: DIR_E | DIR_W },
      ]);
      room.children[0].emit(EMIT);

      expect(map.get("heat", 5, 5)).toBe(1);
      expect(map.get("heat", 6, 5)).toBe(0.5);
      expect(map.get("heat", 4, 5)).toBe(0.5);
      expect(map.get("heat", 5, 4)).toBe(0);
      expect(map.get("heat", 5, 6)).toBe(0);
    });

    it("south emission includes southeast and southwest tiles", () => {
      // radius 3: diagonal tiles are BFS distance 2 (4-directional), so need radius > 2
      makeEmitter(room, 5, 5, [
        { attribute: "light", value: 1, radius: 3, direction: DIR_S },
      ]);
      room.children[0].emit(EMIT);

      // SE tile (6,6) reachable via (5,5)→(5,6)→(6,6), BFS dist 2
      expect(map.get("light", 6, 6)).toBeGreaterThan(0);
      // SW tile (4,6) reachable via (5,5)→(5,6)→(4,6), BFS dist 2
      expect(map.get("light", 4, 6)).toBeGreaterThan(0);
      // NE has no south component — no match
      expect(map.get("light", 6, 4)).toBe(0);
    });

    it("direction does not affect tiles inside footprint", () => {
      makeEmitter(room, 3, 3, [
        { attribute: "light", value: 1, width: 2, height: 2, radius: 2, direction: DIR_N },
      ]);
      room.children[0].emit(EMIT);

      // All footprint tiles get full value regardless of direction
      expect(map.get("light", 3, 3)).toBe(1);
      expect(map.get("light", 4, 3)).toBe(1);
      expect(map.get("light", 3, 4)).toBe(1);
      expect(map.get("light", 4, 4)).toBe(1);
      // North falloff works
      expect(map.get("light", 3, 2)).toBeGreaterThan(0);
      // South falloff blocked
      expect(map.get("light", 3, 5)).toBe(0);
    });
  });

  it("can contribute immediately when added mid-tick", () => {
    // Simulate: tick already happened, map has values from other emitters
    makeEmitter(room, 0, 0, [{ attribute: "light", value: 0.5 }]);
    room.children[0].emit(EMIT);
    expect(map.get("light", 0, 0)).toBe(0.5);

    // Lamp placed mid-tick — emit immediately without reset
    const lamp = makeEmitter(room, 0, 0, [
      { attribute: "light", value: 0.75, radius: 2 },
    ]);
    lamp.emit(EMIT);

    // Additive: 0.5 + 0.75 = 1.25
    expect(map.get("light", 0, 0)).toBe(1.25);
  });

  describe("ephemeral blocking", () => {
    it("ephemeral wall stops light propagation", () => {
      // 5x1 room, emitter at (0,0) with radius 3
      // Ephemeral south edge on tile (0,1) blocks propagation into (0,1)
      // Direction: moving south (dir index 0) → check neighbor's north entry
      // Ephemeral N on tile (0,1) = EDGE_N << 4 = 16
      const edges = new Array(50).fill(0);
      edges[1 * 10 + 0] = EDGE_S << EPHEMERAL_SHIFT; // tile (0,1) blocks entry from north (ephemeral S on neighbor = entry from N? no)

      // Wait — moving south from (0,0) to (0,1):
      // dir index 0 = south, DIRECTION_ENTRY_EPHEMERAL[0] = EDGE_N << 4 = 16
      // Check grid.edges[(0,1)] & 16
      // So we need tile (0,1) to have ephemeral N bit set
      const edges2 = new Array(100).fill(0);
      // Ephemeral N = 1 << 4 = 16
      edges2[1 * 10 + 0] = 1 << EPHEMERAL_SHIFT; // EDGE_N << EPHEMERAL_SHIFT

      const blockedRoom = makeRoomWithBlocking(10, 10, edges2);
      const blockedMap = blockedRoom.get<AttributeMap>(ATTRIBUTE_MAP)!;

      makeEmitter(blockedRoom, 0, 0, [
        { attribute: "light", value: 1, radius: 3 },
      ]);
      blockedRoom.children[0].emit(EMIT);

      // Footprint: full value
      expect(blockedMap.get("light", 0, 0)).toBe(1);
      // East (no blocking): should have falloff
      expect(blockedMap.get("light", 1, 0)).toBeGreaterThan(0);
      // South (ephemeral blocked): no light
      expect(blockedMap.get("light", 0, 1)).toBe(0);
      // Further south: also blocked (can't reach)
      expect(blockedMap.get("light", 0, 2)).toBe(0);
    });

    it("physical blocking does NOT stop light propagation", () => {
      // Physical south edge on tile — should not affect emission
      const edges = new Array(100).fill(0);
      // Physical N on tile (0,1) = EDGE_N = 1 (bits 0-3)
      edges[1 * 10 + 0] = 1; // EDGE_N (physical only)

      const physRoom = makeRoomWithBlocking(10, 10, edges);
      const physMap = physRoom.get<AttributeMap>(ATTRIBUTE_MAP)!;

      makeEmitter(physRoom, 0, 0, [
        { attribute: "light", value: 1, radius: 3 },
      ]);
      physRoom.children[0].emit(EMIT);

      // Light passes through physical walls
      expect(physMap.get("light", 0, 1)).toBeGreaterThan(0);
    });

    it("light wraps around an ephemeral wall", () => {
      // 3x3 room, emitter at (0,0) with radius 4
      // Ephemeral wall: block east entry on (1,0) — light can't go directly east
      // But can go south then east then north to reach (1,0) if no other blocking
      const edges = new Array(100).fill(0);
      // Block entry from west on tile (1,0): ephemeral W = EDGE_W << 4 = 128
      edges[0 * 10 + 1] = 8 << EPHEMERAL_SHIFT; // EDGE_W << EPHEMERAL_SHIFT

      const wrapRoom = makeRoomWithBlocking(10, 10, edges);
      const wrapMap = wrapRoom.get<AttributeMap>(ATTRIBUTE_MAP)!;

      makeEmitter(wrapRoom, 0, 0, [
        { attribute: "light", value: 1, radius: 4 },
      ]);
      wrapRoom.children[0].emit(EMIT);

      // (1,0) blocked from direct east path but reachable via (0,0)→(0,1)→(1,1)→(1,0)
      // BFS distance = 3, value = 1 * (1 - 3/4) = 0.25
      expect(wrapMap.get("light", 1, 0)).toBe(0.25);
    });
  });
});
