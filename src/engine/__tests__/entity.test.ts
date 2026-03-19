import { describe, it, expect, vi, beforeEach } from "vitest";
import { Entity, resetEventBudget } from "../entity";
import { Event, DataEvent } from "../event";
import type { Behavior } from "../behavior";

describe("Entity", () => {
  describe("state", () => {
    it("get returns undefined for unset keys", () => {
      const entity = new Entity();
      expect(entity.get("test")).toBeUndefined();
    });

    it("set and get round-trip", () => {
      const entity = new Entity();
      entity.set("name", "hello");
      expect(entity.get("name")).toBe("hello");
    });

    it("delete removes state and returns true", () => {
      const entity = new Entity();
      entity.set("val", 42);
      expect(entity.delete("val")).toBe(true);
      expect(entity.get("val")).toBeUndefined();
    });

    it("delete returns false for missing key", () => {
      const entity = new Entity();
      expect(entity.delete("val")).toBe(false);
    });

    it("different keys store independent values", () => {
      const entity = new Entity();
      entity.set("a", 1);
      entity.set("b", 2);
      expect(entity.get("a")).toBe(1);
      expect(entity.get("b")).toBe(2);
    });
  });

  describe("find", () => {
    it("returns value from self", () => {
      const entity = new Entity();
      entity.set("val", 42);
      expect(entity.find("val")).toBe(42);
    });

    it("walks up to parent", () => {
      const parent = new Entity();
      const child = new Entity();
      parent.addChild(child);
      parent.set("shared", "from-parent");
      expect(child.find("shared")).toBe("from-parent");
    });

    it("walks up to grandparent", () => {
      const grandparent = new Entity();
      const parent = new Entity();
      const child = new Entity();
      grandparent.addChild(parent);
      parent.addChild(child);
      grandparent.set("deep", 99);
      expect(child.find("deep")).toBe(99);
    });

    it("returns nearest ancestor value (self shadows parent)", () => {
      const parent = new Entity();
      const child = new Entity();
      parent.addChild(child);
      parent.set("val", "parent");
      child.set("val", "child");
      expect(child.find("val")).toBe("child");
    });

    it("returns undefined when not found anywhere", () => {
      const parent = new Entity();
      const child = new Entity();
      parent.addChild(child);
      expect(child.find("missing")).toBeUndefined();
    });
  });

  describe("emit", () => {
    it("dispatches to matching behaviors", () => {
      const handler = vi.fn();
      const behavior: Behavior = {
        eventTypes: new Set(["event"]),
        handle: handler,
      };
      const entity = new Entity([behavior]);
      const event = new Event();
      entity.emit(event);
      expect(handler).toHaveBeenCalledWith(entity, event);
    });

    it("skips behaviors that don't match the event type", () => {
      const handler = vi.fn();
      const behavior: Behavior = {
        eventTypes: new Set(["custom"]),
        handle: handler,
      };
      const entity = new Entity([behavior]);
      entity.emit(new Event());
      expect(handler).not.toHaveBeenCalled();
    });

    it("respects event.stop()", () => {
      const handler1 = vi.fn((_entity: Entity, event: Event) => {
        event.stop();
      });
      const handler2 = vi.fn();
      const b1: Behavior = {
        eventTypes: new Set(["event"]),
        handle: handler1,
      };
      const b2: Behavior = {
        eventTypes: new Set(["event"]),
        handle: handler2,
      };
      const entity = new Entity([b1, b2]);
      entity.emit(new Event());
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).not.toHaveBeenCalled();
    });

    it("dispatches to behaviors matching the specific event type string", () => {
      class CustomEvent extends Event {
        override readonly type = "custom";
      }
      const baseHandler = vi.fn();
      const customHandler = vi.fn();
      const b1: Behavior = {
        eventTypes: new Set(["event"]),
        handle: baseHandler,
      };
      const b2: Behavior = {
        eventTypes: new Set(["custom"]),
        handle: customHandler,
      };
      const entity = new Entity([b1, b2]);
      entity.emit(new CustomEvent());
      expect(baseHandler).not.toHaveBeenCalled();
      expect(customHandler).toHaveBeenCalledOnce();
    });
  });

  describe("parent/children", () => {
    it("addChild sets parent and adds to children", () => {
      const parent = new Entity();
      const child = new Entity();
      parent.addChild(child);
      expect(child.parent).toBe(parent);
      expect(parent.children).toContain(child);
    });

    it("removeChild clears parent and removes from children", () => {
      const parent = new Entity();
      const child = new Entity();
      parent.addChild(child);
      parent.removeChild(child);
      expect(child.parent).toBeNull();
      expect(parent.children).not.toContain(child);
    });

    it("addChild re-parents from previous parent", () => {
      const parent1 = new Entity();
      const parent2 = new Entity();
      const child = new Entity();
      parent1.addChild(child);
      parent2.addChild(child);
      expect(child.parent).toBe(parent2);
      expect(parent1.children).not.toContain(child);
      expect(parent2.children).toContain(child);
    });

    it("removeChild is no-op for non-child", () => {
      const parent = new Entity();
      const other = new Entity();
      parent.removeChild(other);
      expect(other.parent).toBeNull();
    });
  });

  describe("emit safety limits", () => {
    beforeEach(() => {
      resetEventBudget();
    });

    it("stops recursive emit after depth limit", () => {
      let callCount = 0;

      // Behavior that re-emits the same event to self (infinite loop)
      const selfTrigger: Behavior = {
        eventTypes: new Set(["tick"]),
        handle(entity) {
          callCount++;
          entity.emit(new DataEvent("tick", {}, 0));
        },
      };

      const entity = new Entity([selfTrigger]);
      entity.emit(new DataEvent("tick", {}, 0));

      // Should have been capped at the depth limit (64), not stack overflow
      expect(callCount).toBe(64);
    });

    it("stops ping-pong emit chains", () => {
      let aCount = 0;
      let bCount = 0;

      const behaviorA: Behavior = {
        eventTypes: new Set(["eventA"]),
        handle(entity) {
          aCount++;
          entity.emit(new DataEvent("eventB", {}, 0));
        },
      };

      const behaviorB: Behavior = {
        eventTypes: new Set(["eventB"]),
        handle(entity) {
          bCount++;
          entity.emit(new DataEvent("eventA", {}, 0));
        },
      };

      const entity = new Entity([behaviorA, behaviorB]);
      entity.emit(new DataEvent("eventA", {}, 0));

      // Each recursion alternates A→B→A→B, capped at depth 64
      expect(aCount).toBeLessThanOrEqual(64);
      expect(bCount).toBeLessThanOrEqual(64);
      // Didn't stack overflow
      expect(aCount + bCount).toBeGreaterThan(0);
    });

    it("enforces per-frame event budget", () => {
      let callCount = 0;

      // Non-recursive behavior that just counts
      const counter: Behavior = {
        eventTypes: new Set(["tick"]),
        handle() {
          callCount++;
        },
      };

      const entity = new Entity([counter]);

      // Emit more than the budget
      for (let i = 0; i < 15_000; i++) {
        entity.emit(new DataEvent("tick", {}, 0));
      }

      // Should have been capped at budget (10,000)
      expect(callCount).toBe(10_000);
    });

    it("resets budget between frames", () => {
      let callCount = 0;

      const counter: Behavior = {
        eventTypes: new Set(["tick"]),
        handle() {
          callCount++;
        },
      };

      const entity = new Entity([counter]);

      // Exhaust the budget
      for (let i = 0; i < 12_000; i++) {
        entity.emit(new DataEvent("tick", {}, 0));
      }
      expect(callCount).toBe(10_000);

      // Reset and verify new frame gets a fresh budget
      resetEventBudget();
      callCount = 0;
      entity.emit(new DataEvent("tick", {}, 0));
      expect(callCount).toBe(1);
    });

    it("depth limit does not affect sibling behaviors on same entity", () => {
      // A legitimate chain: A emits B, B emits C — depth 3, not recursive
      const events: string[] = [];

      const a: Behavior = {
        eventTypes: new Set(["a"]),
        handle(entity) {
          events.push("a");
          entity.emit(new DataEvent("b", {}, 0));
        },
      };
      const b: Behavior = {
        eventTypes: new Set(["b"]),
        handle(entity) {
          events.push("b");
          entity.emit(new DataEvent("c", {}, 0));
        },
      };
      const c: Behavior = {
        eventTypes: new Set(["c"]),
        handle() {
          events.push("c");
        },
      };

      const entity = new Entity([a, b, c]);
      entity.emit(new DataEvent("a", {}, 0));

      expect(events).toEqual(["a", "b", "c"]);
    });
  });
});
