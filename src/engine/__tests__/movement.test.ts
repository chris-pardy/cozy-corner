import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../entity";
import { DataEvent } from "../event";
import { MovementBehavior } from "../behaviors/movement";
import { AvatarAnimationBehavior } from "../behaviors/avatar-animation";
import { TargetBehavior } from "../behaviors/target";
import { TARGET, TARGET_START_TIME } from "../state/render";
import {
  POSITION,
  DIRECTION,
  ANIM_STATE,
  MOVE_TARGET,
  MOVE_SPEED,
  PATH,
  MOVE_ORIGIN,
} from "../state/movement";
import {
  BLOCKING_GRID,
  type BlockingGrid,
  EDGE_N,
  EDGE_S,
  EDGE_E,
  EDGE_W,
} from "../state/blocking";

/** Open 10x10 grid, no walls. */
function openGrid(w = 10, h = 10): BlockingGrid {
  return { edges: new Array(w * h).fill(0), width: w, height: h };
}

function makeRoom(grid?: BlockingGrid): Entity {
  const room = new Entity();
  room.set(BLOCKING_GRID, grid ?? openGrid());
  return room;
}

function makeAvatar(grid?: BlockingGrid): Entity {
  const room = makeRoom(grid);
  const avatar = new Entity([
    new MovementBehavior(),
    new AvatarAnimationBehavior(),
    new TargetBehavior(),
  ]);
  room.addChild(avatar);
  return avatar;
}

describe("MovementBehavior", () => {
  let entity: Entity;

  beforeEach(() => {
    entity = makeAvatar();
    entity.set(POSITION, { x: 5, y: 5 });
    entity.set(DIRECTION, 0);
    entity.set(ANIM_STATE, "idle");
  });

  describe("moveTo (pathfinding)", () => {
    it("walks one tile south", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 1000));

      expect(entity.get(DIRECTION)).toBe(0);
      expect(entity.get(MOVE_TARGET)).toEqual({ x: 5, y: 6 });
      expect(entity.get(ANIM_STATE)).toBe("walk");
      expect(entity.get(TARGET)).toBe("walk-south");
      expect(entity.get(PATH)).toBeUndefined();
    });

    it("computes multi-step path", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 8 }, 0));

      expect(entity.get(MOVE_TARGET)).toEqual({ x: 5, y: 6 });
      const path = entity.get(PATH);
      expect(path).toEqual([{ x: 5, y: 7 }, { x: 5, y: 8 }]);
    });

    it("routes around a wall", () => {
      // Block entry into (5,6) from the north
      const grid = openGrid();
      const edges = [...grid.edges];
      edges[6 * 10 + 5] = EDGE_N;
      entity.parent!.set(BLOCKING_GRID, { ...grid, edges });

      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));

      // Should route around — first step is not directly south
      const target = entity.get<{ x: number; y: number }>(MOVE_TARGET)!;
      expect(target).toBeDefined();
      // Can't enter (5,6) from north, must go sideways first
      expect(target.y === 5 || target.x !== 5).toBe(true);
    });

    it("can leave a tile with blocked edges (one-way blocking)", () => {
      // Block south edge on the entity's own tile — should NOT prevent leaving
      const grid = openGrid();
      const edges = [...grid.edges];
      edges[5 * 10 + 5] = EDGE_S;
      entity.parent!.set(BLOCKING_GRID, { ...grid, edges });

      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));

      // Should walk directly south — the edge only blocks entry, not exit
      expect(entity.get(MOVE_TARGET)).toEqual({ x: 5, y: 6 });
      expect(entity.get(TARGET)).toBe("walk-south");
    });

    it("moves as close as possible when goal is unreachable", () => {
      // Block all entry into (5,6)
      const grid = openGrid();
      const edges = [...grid.edges];
      edges[6 * 10 + 5] = EDGE_N | EDGE_S | EDGE_E | EDGE_W;
      entity.parent!.set(BLOCKING_GRID, { ...grid, edges });

      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));

      // Should start moving toward an adjacent tile
      const target = entity.get(MOVE_TARGET);
      expect(target).toBeDefined();
    });

    it("ignores moveTo when already at target", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 5 }, 0));
      expect(entity.get(MOVE_TARGET)).toBeUndefined();
    });

    it("overrides an in-progress path", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 8 }, 0));
      expect(entity.get(DIRECTION)).toBe(0); // south

      entity.emit(new DataEvent("moveTo", { x: 8, y: 5 }, 100));
      expect(entity.get(DIRECTION)).toBe(3); // east
      expect(entity.get(MOVE_TARGET)).toEqual({ x: 6, y: 5 });
      expect(entity.get(TARGET)).toBe("walk-east");
    });

    it("does nothing without POSITION", () => {
      const bare = makeAvatar();
      bare.emit(new DataEvent("moveTo", { x: 1, y: 1 }, 0));
      expect(bare.get(MOVE_TARGET)).toBeUndefined();
    });

    it("does nothing without a parent room", () => {
      const bare = new Entity([
        new MovementBehavior(),
        new AvatarAnimationBehavior(),
        new TargetBehavior(),
      ]);
      bare.set(POSITION, { x: 0, y: 0 });
      bare.emit(new DataEvent("moveTo", { x: 1, y: 0 }, 0));
      expect(bare.get(MOVE_TARGET)).toBeUndefined();
    });
  });

  describe("tick (path following)", () => {
    it("does nothing when not moving", () => {
      entity.emit(new DataEvent("tick", {}, 1000));
      expect(entity.get(POSITION)).toEqual({ x: 5, y: 5 });
    });

    it("does not arrive before move speed elapsed", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));
      entity.emit(new DataEvent("tick", {}, 100));
      expect(entity.get(MOVE_TARGET)).toEqual({ x: 5, y: 6 });
      expect(entity.get(POSITION)).toEqual({ x: 5, y: 5 });
    });

    it("arrives and goes idle for single-step path", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));
      entity.emit(new DataEvent("tick", {}, 200));

      expect(entity.get(POSITION)).toEqual({ x: 5, y: 6 });
      expect(entity.get(MOVE_TARGET)).toBeUndefined();
      expect(entity.get(PATH)).toBeUndefined();
      expect(entity.get(ANIM_STATE)).toBe("idle");
      expect(entity.get(TARGET)).toBe("idle-south");
    });

    it("advances to next path step on arrival", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 8 }, 0));

      // Complete first step
      entity.emit(new DataEvent("tick", {}, 200));
      expect(entity.get(POSITION)).toEqual({ x: 5, y: 6 });
      expect(entity.get(MOVE_TARGET)).toEqual({ x: 5, y: 7 });
      expect(entity.get(TARGET)).toBe("walk-south");

      // Complete second step
      entity.emit(new DataEvent("tick", {}, 400));
      expect(entity.get(POSITION)).toEqual({ x: 5, y: 7 });
      expect(entity.get(MOVE_TARGET)).toEqual({ x: 5, y: 8 });

      // Complete final step
      entity.emit(new DataEvent("tick", {}, 600));
      expect(entity.get(POSITION)).toEqual({ x: 5, y: 8 });
      expect(entity.get(ANIM_STATE)).toBe("idle");
      expect(entity.get(TARGET)).toBe("idle-south");
      expect(entity.get(PATH)).toBeUndefined();
    });

    it("respects custom MOVE_SPEED", () => {
      entity.set(MOVE_SPEED, 500);
      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));

      entity.emit(new DataEvent("tick", {}, 300));
      expect(entity.get(POSITION)).toEqual({ x: 5, y: 5 });

      entity.emit(new DataEvent("tick", {}, 500));
      expect(entity.get(POSITION)).toEqual({ x: 5, y: 6 });
    });

    it("allows new move after completing path", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));
      entity.emit(new DataEvent("tick", {}, 200));

      entity.emit(new DataEvent("moveTo", { x: 6, y: 6 }, 300));
      expect(entity.get(MOVE_TARGET)).toEqual({ x: 6, y: 6 });
      expect(entity.get(TARGET)).toBe("walk-east");
    });
  });

  describe("origin propagation", () => {
    it("stores MOVE_ORIGIN from the moveTo event", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0, "remote"));
      expect(entity.get(MOVE_ORIGIN)).toBe("remote");
    });

    it("clears MOVE_ORIGIN when path completes", () => {
      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0, "remote"));
      entity.emit(new DataEvent("tick", {}, 200));
      expect(entity.get(MOVE_ORIGIN)).toBeUndefined();
    });

    it("propagates remote origin to walk events", () => {
      const walkOrigins: string[] = [];
      // Insert before AvatarAnimationBehavior (index 1) since it stops walk events
      entity.behaviors.splice(1, 0, {
        eventTypes: new Set(["walk"]),
        handle(_e, event) {
          walkOrigins.push((event as DataEvent).origin);
        },
      });

      entity.emit(new DataEvent("moveTo", { x: 5, y: 7 }, 0, "remote"));
      // First walk event emitted immediately by startStep
      expect(walkOrigins).toEqual(["remote"]);

      // Tick to advance — second walk event
      entity.emit(new DataEvent("tick", {}, 200));
      expect(walkOrigins).toEqual(["remote", "remote"]);
    });

    it("propagates remote origin to idle event", () => {
      const idleOrigins: string[] = [];
      // Insert before AvatarAnimationBehavior (index 1) since it stops idle events
      entity.behaviors.splice(1, 0, {
        eventTypes: new Set(["idle"]),
        handle(_e, event) {
          idleOrigins.push((event as DataEvent).origin);
        },
      });

      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0, "remote"));
      entity.emit(new DataEvent("tick", {}, 200));
      expect(idleOrigins).toEqual(["remote"]);
    });

    it("defaults to local origin", () => {
      const walkOrigins: string[] = [];
      // Insert before AvatarAnimationBehavior (index 1) since it stops walk events
      entity.behaviors.splice(1, 0, {
        eventTypes: new Set(["walk"]),
        handle(_e, event) {
          walkOrigins.push((event as DataEvent).origin);
        },
      });

      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));
      expect(walkOrigins).toEqual(["local"]);
    });
  });

  describe("turn events", () => {
    const TURN_EVENTS = new Set(["turn-south", "turn-west", "turn-north", "turn-east"]);

    it("emits turn-west when turning south → west", () => {
      const events: string[] = [];
      entity.behaviors.push({
        eventTypes: TURN_EVENTS,
        handle(_e, event) { events.push(event.type); },
      });

      // Start walking south
      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));
      entity.emit(new DataEvent("tick", {}, 200));

      // Now walk west — direction changes from south(0) to west(1)
      entity.emit(new DataEvent("moveTo", { x: 4, y: 6 }, 300));

      expect(events).toContain("turn-west");
    });

    it("emits turn-east when turning south → east", () => {
      const events: string[] = [];
      entity.behaviors.push({
        eventTypes: TURN_EVENTS,
        handle(_e, event) { events.push(event.type); },
      });

      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));
      entity.emit(new DataEvent("tick", {}, 200));

      // Now walk east — direction changes from south(0) to east(3)
      entity.emit(new DataEvent("moveTo", { x: 6, y: 6 }, 300));

      expect(events).toContain("turn-east");
    });

    it("emits turn-north for 180° direction change", () => {
      const events: string[] = [];
      entity.behaviors.push({
        eventTypes: TURN_EVENTS,
        handle(_e, event) { events.push(event.type); },
      });

      entity.emit(new DataEvent("moveTo", { x: 5, y: 6 }, 0));
      entity.emit(new DataEvent("tick", {}, 200));

      // Now walk north — direction changes from south(0) to north(2)
      entity.emit(new DataEvent("moveTo", { x: 5, y: 5 }, 300));

      expect(events).toContain("turn-north");
    });

    it("does not emit turn when direction stays the same", () => {
      const events: string[] = [];
      entity.behaviors.push({
        eventTypes: TURN_EVENTS,
        handle(_e, event) { events.push(event.type); },
      });

      entity.emit(new DataEvent("moveTo", { x: 5, y: 8 }, 0));

      // All steps are south — no turn events
      expect(events).toHaveLength(0);
    });
  });
});

describe("TargetBehavior", () => {
  it("cascades target to children", () => {
    const parent = makeAvatar();
    const child = new Entity([new TargetBehavior()]);
    parent.addChild(child);
    parent.set(POSITION, { x: 0, y: 0 });
    parent.set(ANIM_STATE, "idle");

    parent.emit(new DataEvent("moveTo", { x: 0, y: 1 }, 500));

    expect(child.get(TARGET)).toBe("walk-south");
    expect(child.get(TARGET_START_TIME)).toBe(500);
  });

  it("cascades through multiple levels", () => {
    const root = makeAvatar();
    const mid = new Entity([new TargetBehavior()]);
    const leaf = new Entity([new TargetBehavior()]);
    root.addChild(mid);
    mid.addChild(leaf);
    root.set(POSITION, { x: 0, y: 0 });
    root.set(ANIM_STATE, "idle");

    root.emit(new DataEvent("moveTo", { x: 1, y: 0 }, 0));
    expect(leaf.get(TARGET)).toBe("walk-east");
  });

  it("does not reset start time when target unchanged", () => {
    const parent = makeAvatar();
    parent.set(POSITION, { x: 0, y: 0 });
    parent.set(ANIM_STATE, "idle");

    parent.emit(new DataEvent("moveTo", { x: 0, y: 1 }, 100));
    expect(parent.get(TARGET_START_TIME)).toBe(100);

    // Override with same direction — target string is still "walk-south"
    parent.emit(new DataEvent("moveTo", { x: 0, y: 2 }, 300));
    expect(parent.get(TARGET)).toBe("walk-south");
    expect(parent.get(TARGET_START_TIME)).toBe(100);
  });

  it("cascades idle on arrival", () => {
    const parent = makeAvatar();
    const child = new Entity([new TargetBehavior()]);
    parent.addChild(child);
    parent.set(POSITION, { x: 0, y: 0 });
    parent.set(ANIM_STATE, "idle");

    parent.emit(new DataEvent("moveTo", { x: 0, y: 1 }, 0));
    parent.emit(new DataEvent("tick", {}, 200));

    expect(child.get(TARGET)).toBe("idle-south");
    expect(child.get(TARGET_START_TIME)).toBe(200);
  });
});
