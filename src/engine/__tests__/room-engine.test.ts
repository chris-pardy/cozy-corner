import { describe, it, expect, vi, afterEach } from "vitest";
import { RoomEngine } from "../../../server/utils/room-engine";
import { ANIM_STATE, MOVE_TARGET } from "../state/movement";
import {
  SPEECH_TEXT,
  SPEECH_BUBBLE,
  SPEECH_DURATION,
  DEFAULT_SPEECH_DURATION,
} from "../state/speech";
import type { BlockingGrid } from "../state/blocking";

/** Open grid with no walls. */
function openGrid(w = 10, h = 10): BlockingGrid {
  return { edges: new Array(w * h).fill(0), width: w, height: h };
}

/** Deterministic RNG that always returns 0. */
const zeroRng = () => 0;

const testIdentity = { type: "did" as const, did: "did:plc:test" };

describe("RoomEngine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates with a room entity", () => {
    const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
    expect(engine.entityRegistry.has("room")).toBe(true);
    expect(engine.tick).toBe(0);
  });

  it("adds a player at spawn position", () => {
    const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
    const pos = engine.addPlayer("player:test", testIdentity, "test.handle");

    // With null spawnTiles, resolveSpawnTiles returns {x:0, y:0}
    expect(pos).toEqual({ x: 0, y: 0 });
    expect(engine.getPosition("player:test")).toEqual({ x: 0, y: 0 });
    expect(engine.getDirection("player:test")).toBe(0);
  });

  it("removes a player", () => {
    const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
    engine.addPlayer("player:test", testIdentity, "test.handle");
    engine.removePlayer("player:test");

    expect(engine.getPosition("player:test")).toBeUndefined();
    expect(engine.isEmpty).toBe(true);
  });

  describe("tick loop", () => {
    it("starts and stops without error", () => {
      const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
      engine.startTickLoop();
      engine.stopTickLoop();
    });

    it("calls onTick callback when state changes", () => {
      vi.useFakeTimers();
      const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
      engine.addPlayer("player:test", testIdentity, "test.handle");

      const ticks: number[] = [];
      engine.onTick = (tick) => {
        ticks.push(tick);
      };

      // Issue a move so state will change on ticks
      engine.dispatchMoveTo("player:test", 0, 1);

      engine.startTickLoop();

      // Advance time by 200ms = 4 ticks
      vi.advanceTimersByTime(200);

      engine.stopTickLoop();
      vi.useRealTimers();

      // Should have received tick callbacks
      expect(ticks.length).toBeGreaterThan(0);
    });

    it("limits catchup ticks after sleep", () => {
      vi.useFakeTimers();
      const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
      engine.addPlayer("player:test", testIdentity, "test.handle");

      let tickCount = 0;
      engine.onTick = () => { tickCount++; };

      // Issue move so state changes
      engine.dispatchMoveTo("player:test", 0, 2);

      engine.startTickLoop();

      // Advance time by 5 seconds (100 ticks) — should be capped
      vi.advanceTimersByTime(5000);

      engine.stopTickLoop();
      vi.useRealTimers();

      // Tick count should be reasonable (not 100)
      expect(tickCount).toBeLessThan(50);
    });
  });

  describe("snapshot building", () => {
    it("returns position and direction", () => {
      const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
      engine.addPlayer("player:a", { type: "did", did: "did:plc:a" }, "a.handle");
      engine.addPlayer("player:b", { type: "did", did: "did:plc:b" }, "b.handle");

      const snapshot = engine.buildTickSnapshot();
      expect(snapshot).toHaveLength(2);
      expect(snapshot[0].id).toEqual({ type: "did", did: "did:plc:a" });
      expect(snapshot[0].x).toBe(0);
      expect(snapshot[0].y).toBe(0);
      expect(snapshot[0].handle).toBe("a.handle");
    });

    it("reflects movement state", () => {
      const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
      engine.addPlayer("player:test", testIdentity, "test.handle");

      engine.dispatchMoveTo("player:test", 0, 1);

      const snapshot = engine.buildTickSnapshot();
      expect(snapshot[0].animState).toBe("walk");
      expect(snapshot[0].moveTargetX).toBe(0);
      expect(snapshot[0].moveTargetY).toBe(1);
    });
  });

  describe("dispatchSay", () => {
    it("sets speech state on entity", () => {
      const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
      engine.addPlayer("player:test", testIdentity, "test.handle");

      engine.dispatchSay("player:test", "👋", "speech");

      const entity = engine.entityRegistry.get("player:test")!;
      expect(entity.get(SPEECH_TEXT)).toBe("👋");
      expect(entity.get(SPEECH_BUBBLE)).toBe("speech");
      expect(entity.get(SPEECH_DURATION)).toBe(DEFAULT_SPEECH_DURATION);
    });

    it("includes speech in snapshot", () => {
      const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
      engine.addPlayer("player:test", testIdentity, "test.handle");

      engine.dispatchSay("player:test", "❤️", "thought");

      const snapshot = engine.buildTickSnapshot();
      expect(snapshot[0].speechText).toBe("❤️");
      expect(snapshot[0].speechBubble).toBe("thought");
      expect(snapshot[0].speechDuration).toBe(DEFAULT_SPEECH_DURATION);
    });
  });

  describe("dispatchMoveTo", () => {
    it("starts movement at current tick", () => {
      const engine = new RoomEngine(openGrid(), 10, 10, null, zeroRng);
      engine.addPlayer("player:test", testIdentity, "test.handle");

      engine.dispatchMoveTo("player:test", 0, 1);

      const entity = engine.entityRegistry.get("player:test")!;
      expect(entity.get(MOVE_TARGET)).toEqual({ x: 0, y: 1 });
      expect(entity.get(ANIM_STATE)).toBe("walk");
    });
  });
});
