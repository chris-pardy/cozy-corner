import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Entity } from "../entity";
import { DataEvent } from "../event";
import { MovementBehavior } from "../behaviors/movement";
import { TargetBehavior } from "../behaviors/target";
import { POSITION, MOVE_TARGET } from "../state/movement";
import { BLOCKING_GRID, type BlockingGrid } from "../state/blocking";
import { AttributeMap, ATTRIBUTE_MAP } from "../state/attributes";
import { TARGET } from "../state/render";
import { LuaRuntime } from "../lua/lua-runtime";
import {
  SPEECH_TEXT,
  SPEECH_BUBBLE,
  SPEECH_START,
  SPEECH_DURATION,
} from "../state/speech";
import {
  PROMPT_TEXT,
  PROMPT_OPTIONS,
  PROMPT_RESPONSE,
  PROMPT_ACTIVE,
} from "../state/prompt";

function openGrid(w = 10, h = 10): BlockingGrid {
  return { edges: new Array(w * h).fill(0), width: w, height: h };
}

function makeRoom(w = 10, h = 10): Entity {
  const room = new Entity();
  room.set(BLOCKING_GRID, openGrid(w, h));
  room.set(ATTRIBUTE_MAP, new AttributeMap(w, h));
  return room;
}

let runtime: LuaRuntime;

let nextSeed = 0;
function seed() { return nextSeed++; }

beforeAll(async () => {
  runtime = new LuaRuntime();
  await runtime.init();
});

afterAll(() => {
  runtime.destroy();
});

describe("Lua behavior: chance-based wander", () => {
  let room: Entity;

  it("does not move when chance(0) always fails", () => {
    room = makeRoom();

    const behavior = runtime.compileScript(`
      on("tick", function(event)
        if chance(0) then
          local tile = find_best_tile(1, {})
          if tile then
            move_to(tile.x, tile.y)
          end
        end
      end)
    `, seed());

    const critter = new Entity([behavior, new MovementBehavior(), new TargetBehavior()]);
    room.addChild(critter);
    critter.set(POSITION, { x: 5, y: 5 });

    for (let i = 0; i < 10; i++) {
      critter.emit(new DataEvent("tick", {}, i * 16));
    }

    expect(critter.get(MOVE_TARGET)).toBeUndefined();
  });

  it("always moves when chance(1) always passes", () => {
    room = makeRoom();

    const behavior = runtime.compileScript(`
      on("tick", function(event)
        if chance(1) then
          local tile = find_best_tile(1, {})
          if tile then
            move_to(tile.x, tile.y)
          end
        end
      end)
    `, seed());

    const critter = new Entity([behavior, new MovementBehavior(), new TargetBehavior()]);
    room.addChild(critter);
    critter.set(POSITION, { x: 5, y: 5 });

    critter.emit(new DataEvent("tick", {}, 0));

    expect(critter.get(MOVE_TARGET)).toBeDefined();
  });

  it("chance() is deterministic with the same seed", () => {
    const rt1 = new LuaRuntime();
    rt1.init();
    const rt2 = new LuaRuntime();
    rt2.init();

    const b1 = rt1.compileScript(`
      on("tick", function(event)
        if chance(0.5) then self.hit = (self.hit or 0) + 1 end
      end)
    `, 123);
    const b2 = rt2.compileScript(`
      on("tick", function(event)
        if chance(0.5) then self.hit = (self.hit or 0) + 1 end
      end)
    `, 123);

    const e1 = new Entity([b1]);
    const e2 = new Entity([b2]);

    for (let i = 0; i < 20; i++) {
      e1.emit(new DataEvent("tick", {}, i * 16));
      e2.emit(new DataEvent("tick", {}, i * 16));
    }

    expect(e1.get("hit")).toBe(e2.get("hit"));
    rt1.destroy();
    rt2.destroy();
  });
});

describe("Lua behavior: find_best_tile + move_to", () => {
  it("moves toward attribute sources", () => {
    const room = makeRoom();
    const map = room.get<AttributeMap>(ATTRIBUTE_MAP)!;

    const behavior = runtime.compileScript(`
      on("tick", function(event)
        local tile = find_best_tile(5, {light = 1})
        if tile then
          move_to(tile.x, tile.y)
        end
      end)
    `, seed());

    const critter = new Entity([behavior, new MovementBehavior(), new TargetBehavior()]);
    room.addChild(critter);
    critter.set(POSITION, { x: 5, y: 5 });

    // Light source to the east
    map.add("light", 7, 5, 1);

    critter.emit(new DataEvent("tick", {}, 0));
    expect(critter.get(MOVE_TARGET)).toBeDefined();
  });
});

describe("Lua behavior: timeSince cooldown via self proxy", () => {
  it("only fires after cooldown elapsed", () => {
    const room = makeRoom();

    const behavior = runtime.compileScript(`
      on("tick", function(event)
        local t = time()
        local lastSeek = self.lastSeek
        if lastSeek == nil then
          self.lastSeek = t
          return
        end
        if t - lastSeek > 5000 then
          self.lastSeek = t
          move_to(6, 5)
        end
      end)
    `, seed());

    const critter = new Entity([behavior, new MovementBehavior(), new TargetBehavior()]);
    room.addChild(critter);
    critter.set(POSITION, { x: 5, y: 5 });

    // First tick: seeds lastSeek=0
    critter.emit(new DataEvent("tick", {}, 0));
    expect(critter.get(MOVE_TARGET)).toBeUndefined();

    // 3s later: cooldown not passed
    critter.emit(new DataEvent("tick", {}, 3000));
    expect(critter.get(MOVE_TARGET)).toBeUndefined();

    // 5.5s later: cooldown passed
    critter.emit(new DataEvent("tick", {}, 5500));
    expect(critter.get(MOVE_TARGET)).toBeDefined();
  });
});

describe("Lua behavior: find_nearest", () => {
  it("finds the nearest entity matching state", () => {
    const room = makeRoom();

    const behavior = runtime.compileScript(`
      on("tick", function(event)
        local e = find_nearest(10, {kind = "food"})
        if e then
          move_to(e.x, e.y)
        end
      end)
    `, seed());

    const critter = new Entity([behavior, new MovementBehavior(), new TargetBehavior()]);
    room.addChild(critter);
    critter.set(POSITION, { x: 5, y: 5 });

    // Place food entities at different distances
    const far = new Entity();
    far.set(POSITION, { x: 8, y: 5 });
    far.set("kind", "food");
    room.addChild(far);

    const near = new Entity();
    near.set(POSITION, { x: 6, y: 5 });
    near.set("kind", "food");
    room.addChild(near);

    const wrong = new Entity();
    wrong.set(POSITION, { x: 3, y: 3 });
    wrong.set("kind", "water");
    room.addChild(wrong);

    critter.emit(new DataEvent("tick", {}, 0));
    const target = critter.get(MOVE_TARGET);
    expect(target).toEqual({ x: 6, y: 5 });
  });

  it("returns nil when no entities match", () => {
    const room = makeRoom();

    const behavior = runtime.compileScript(`
      on("tick", function(event)
        local e = find_nearest(5, {kind = "mouse"})
        if e then
          move_to(e.x, e.y)
        end
      end)
    `, seed());

    const critter = new Entity([behavior]);
    room.addChild(critter);
    critter.set(POSITION, { x: 5, y: 5 });

    const other = new Entity();
    other.set(POSITION, { x: 6, y: 5 });
    other.set("kind", "cat");
    room.addChild(other);

    critter.emit(new DataEvent("tick", {}, 0));
    expect(critter.get(MOVE_TARGET)).toBeUndefined();
  });
});

describe("Lua behavior: stop() consumes events", () => {
  it("consumed event stops propagation to other behaviors", () => {
    const calls: string[] = [];

    const b1 = runtime.compileScript(`
      on("tick", function(event)
        stop()
      end)
    `, seed());

    // Wrap to track which fires
    const tracker1 = {
      eventTypes: b1.eventTypes,
      handle(e: Entity, ev: import("../event").Event) {
        b1.handle(e, ev);
        calls.push("b1");
      },
    };

    const b2 = runtime.compileScript(`
      on("tick", function(event)
        -- should not be reached
      end)
    `, seed());

    const tracker2 = {
      eventTypes: b2.eventTypes,
      handle(e: Entity, ev: import("../event").Event) {
        b2.handle(e, ev);
        calls.push("b2");
      },
    };

    const entity = new Entity([tracker1, tracker2]);
    entity.emit(new DataEvent("tick", {}, 0));

    // b1 fires and consumes → b2 never runs
    expect(calls).toEqual(["b1"]);
  });

  it("without stop(), event propagates to children", () => {
    const parent = new Entity();
    const child = new Entity();
    parent.addChild(child);

    child.set(POSITION, { x: 1, y: 1 });

    // Child has a behavior that writes state on tick
    const childBehavior = runtime.compileScript(`
      on("tick", function(event)
        self.seen = 1
      end)
    `, seed());
    child.behaviors.push(childBehavior);

    // Emit tick to parent → should propagate to child
    parent.emit(new DataEvent("tick", {}, 0));

    expect(child.get("seen")).toBe(1);
  });

  it("with stop(), event does NOT propagate to children", () => {
    const parentBehavior = runtime.compileScript(`
      on("tick", function(event)
        stop()
      end)
    `, seed());

    const parent = new Entity([parentBehavior]);
    const child = new Entity();
    parent.addChild(child);

    child.set(POSITION, { x: 1, y: 1 });

    const childBehavior = runtime.compileScript(`
      on("tick", function(event)
        self.seen = 1
      end)
    `, seed());
    child.behaviors.push(childBehavior);

    parent.emit(new DataEvent("tick", {}, 0));

    // Child should NOT have received the tick
    expect(child.get("seen")).toBeUndefined();
  });
});

describe("Lua behavior: self proxy reads/writes", () => {
  it("reads x, y from entity position", () => {
    const room = makeRoom();

    const behavior = runtime.compileScript(`
      on("tick", function(event)
        self.myX = self.x
        self.myY = self.y
      end)
    `, seed());

    const entity = new Entity([behavior]);
    room.addChild(entity);
    entity.set(POSITION, { x: 7, y: 3 });

    entity.emit(new DataEvent("tick", {}, 0));

    expect(entity.get("myX")).toBe(7);
    expect(entity.get("myY")).toBe(3);
  });

  it("writes custom state", () => {
    const behavior = runtime.compileScript(`
      on("tick", function(event)
        self.foo = 42
        self.bar = "hello"
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.emit(new DataEvent("tick", {}, 0));

    expect(entity.get("foo")).toBe(42);
    expect(entity.get("bar")).toBe("hello");
  });
});

describe("Lua behavior: on/off dynamic registration", () => {
  it("on() adds event type to eventTypes", () => {
    const behavior = runtime.compileScript(`
      on("tick", function(event) end)
      on("interact", function(event) end)
    `, seed());

    expect(behavior.eventTypes.has("tick")).toBe(true);
    expect(behavior.eventTypes.has("interact")).toBe(true);
  });

  it("off() removes handler and event type", () => {
    // Lua function references don't survive the JS boundary,
    // so off(type, handler) falls back to removing the last handler.
    const behavior = runtime.compileScript(`
      local handler = function(event) end
      on("tick", handler)
      off("tick", handler)
    `, seed());

    // The handler should be removed (falls back to removing last handler)
    expect(behavior.eventTypes.has("tick")).toBe(false);
  });

  it("off() without handler removes all handlers for event type", () => {
    const behavior = runtime.compileScript(`
      on("tick", function(event) end)
      on("tick", function(event) end)
      off("tick")
    `, seed());

    expect(behavior.eventTypes.has("tick")).toBe(false);
  });
});

describe("Lua behavior: sandboxing", () => {
  it("dangerous globals are nil", () => {
    const behavior = runtime.compileScript(`
      on("tick", function(event)
        if io ~= nil then self.hasIo = 1 end
        if os ~= nil then self.hasOs = 1 end
        if require ~= nil then self.hasRequire = 1 end
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.emit(new DataEvent("tick", {}, 0));

    expect(entity.get("hasIo")).toBeUndefined();
    expect(entity.get("hasOs")).toBeUndefined();
    expect(entity.get("hasRequire")).toBeUndefined();
  });

  it("math.random uses deterministic PRNG", () => {
    const rt1 = new LuaRuntime();
    rt1.init();
    const rt2 = new LuaRuntime();
    rt2.init();

    const b1 = rt1.compileScript(`
      on("tick", function(event)
        self.r1 = math.random()
        self.r2 = math.random(10)
        self.r3 = math.random(5, 20)
      end)
    `, 99);
    const b2 = rt2.compileScript(`
      on("tick", function(event)
        self.r1 = math.random()
        self.r2 = math.random(10)
        self.r3 = math.random(5, 20)
      end)
    `, 99);

    const e1 = new Entity([b1]);
    const e2 = new Entity([b2]);
    e1.emit(new DataEvent("tick", {}, 0));
    e2.emit(new DataEvent("tick", {}, 0));

    expect(e1.get("r1")).toBe(e2.get("r1"));
    expect(e1.get("r2")).toBe(e2.get("r2"));
    expect(e1.get("r3")).toBe(e2.get("r3"));

    // math.random() should return [0,1)
    expect(e1.get("r1")).toBeGreaterThanOrEqual(0);
    expect(e1.get("r1")).toBeLessThan(1);
    // math.random(10) should return [1,10]
    expect(e1.get("r2")).toBeGreaterThanOrEqual(1);
    expect(e1.get("r2")).toBeLessThanOrEqual(10);
    // math.random(5,20) should return [5,20]
    expect(e1.get("r3")).toBeGreaterThanOrEqual(5);
    expect(e1.get("r3")).toBeLessThanOrEqual(20);

    rt1.destroy();
    rt2.destroy();
  });

  // Note: instruction budget via debug.sethook does not reliably terminate
  // infinite loops in wasmoon's WASM environment. The sandboxing of io/os/etc
  // is the primary defense; instruction budgets are a best-effort safeguard
  // for the browser runtime where setTimeout can interrupt the WASM execution.
});

describe("Lua behavior: animate and emit", () => {
  it("animate() emits a target event", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        animate("open")
      end)
    `, seed());

    const entity = new Entity([behavior, new TargetBehavior()]);
    entity.emit(new DataEvent("interact", {}, 0));

    // TargetBehavior should have set the target to "open"
    expect(entity.get(TARGET)).toBe("open");
  });

  it("emit() emits a custom event", () => {
    let received = false;
    const listener = {
      eventTypes: new Set(["custom"]),
      handle() {
        received = true;
      },
    };

    const behavior = runtime.compileScript(`
      on("tick", function(event)
        emit("custom", {value = 42})
      end)
    `, seed());

    const entity = new Entity([behavior, listener]);
    entity.emit(new DataEvent("tick", {}, 0));

    expect(received).toBe(true);
  });
});

describe("Lua behavior: time()", () => {
  it("returns the current event time", () => {
    const behavior = runtime.compileScript(`
      on("tick", function(event)
        self.eventTime = time()
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.emit(new DataEvent("tick", {}, 12345));

    expect(entity.get("eventTime")).toBe(12345);
  });
});

describe("Lua behavior: say()", () => {
  it("sets speech state on the entity", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        say("hello!", "speech")
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.set(POSITION, { x: 0, y: 0 });
    entity.emit(new DataEvent("interact", {}, 1000));

    expect(entity.get(SPEECH_TEXT)).toBe("hello!");
    expect(entity.get(SPEECH_BUBBLE)).toBe("speech");
    expect(entity.get(SPEECH_START)).toBe(1000);
    expect(entity.get(SPEECH_DURATION)).toBe(3000);
  });

  it("defaults to speech bubble style", () => {
    const behavior = runtime.compileScript(`
      on("tick", function(event)
        say("hi")
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.emit(new DataEvent("tick", {}, 0));

    expect(entity.get(SPEECH_BUBBLE)).toBe("speech");
  });

  it("supports thought bubble style", () => {
    const behavior = runtime.compileScript(`
      on("tick", function(event)
        say("hmm", "thought")
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.emit(new DataEvent("tick", {}, 0));

    expect(entity.get(SPEECH_BUBBLE)).toBe("thought");
  });
});

describe("Lua behavior: prompt()", () => {
  it("sets prompt state and blocks until response", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        local choice = prompt("What do you want?", {"Buy", "Sell"})
        self.choice = choice
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.set(POSITION, { x: 0, y: 0 });

    // Trigger the interact → prompt() yields
    entity.emit(new DataEvent("interact", {}, 0));

    // Prompt state should be set
    expect(entity.get(PROMPT_ACTIVE)).toBe(true);
    expect(entity.get(PROMPT_TEXT)).toBe("What do you want?");
    expect(entity.get(PROMPT_OPTIONS)).toEqual(["Buy", "Sell"]);
    // choice should NOT be set yet (handler is suspended)
    expect(entity.get("choice")).toBeUndefined();

    // Simulate user selecting "Buy"
    entity.set(PROMPT_RESPONSE, "Buy");

    // Tick to resume the coroutine
    entity.emit(new DataEvent("tick", {}, 100));

    // Now the handler should have completed
    expect(entity.get("choice")).toBe("Buy");
    // Prompt state should be cleared
    expect(entity.get(PROMPT_ACTIVE)).toBeUndefined();
  });

  it("works with dismiss-only prompt (no options)", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        prompt("Hello there!")
        self.dismissed = 1
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.emit(new DataEvent("interact", {}, 0));

    expect(entity.get(PROMPT_ACTIVE)).toBe(true);
    expect(entity.get(PROMPT_TEXT)).toBe("Hello there!");
    expect(entity.get(PROMPT_OPTIONS)).toBeNull();
    expect(entity.get("dismissed")).toBeUndefined();

    // Simulate dismiss
    entity.set(PROMPT_RESPONSE, "dismiss");
    entity.emit(new DataEvent("tick", {}, 100));

    expect(entity.get("dismissed")).toBe(1);
  });

  it("supports chained prompts", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        local choice = prompt("Choose", {"A", "B"})
        if choice == "A" then
          prompt("You chose A!")
          self.result = "picked-A"
        end
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.emit(new DataEvent("interact", {}, 0));

    // First prompt
    expect(entity.get(PROMPT_TEXT)).toBe("Choose");

    // Select A
    entity.set(PROMPT_RESPONSE, "A");
    entity.emit(new DataEvent("tick", {}, 100));

    // Second prompt
    expect(entity.get(PROMPT_ACTIVE)).toBe(true);
    expect(entity.get(PROMPT_TEXT)).toBe("You chose A!");
    expect(entity.get("result")).toBeUndefined();

    // Dismiss second prompt
    entity.set(PROMPT_RESPONSE, "dismiss");
    entity.emit(new DataEvent("tick", {}, 200));

    expect(entity.get("result")).toBe("picked-A");
  });

  it("blocks other events while waiting for prompt", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        prompt("wait...")
      end)
      on("tick", function(event)
        self.tickCount = (self.tickCount or 0) + 1
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.set(POSITION, { x: 0, y: 0 });

    // Normal tick works
    entity.emit(new DataEvent("tick", {}, 0));
    expect(entity.get("tickCount")).toBe(1);

    // Start prompt
    entity.emit(new DataEvent("interact", {}, 50));
    expect(entity.get(PROMPT_ACTIVE)).toBe(true);

    // Tick while blocked — should NOT increment tickCount
    entity.emit(new DataEvent("tick", {}, 100));
    expect(entity.get("tickCount")).toBe(1);

    // Resolve prompt
    entity.set(PROMPT_RESPONSE, "dismiss");
    entity.emit(new DataEvent("tick", {}, 150));

    // Now tick should work again
    entity.emit(new DataEvent("tick", {}, 200));
    expect(entity.get("tickCount")).toBe(2);
  });
});

describe("Lua behavior: remote origin", () => {
  it("prompt() returns nil immediately for remote events", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        local choice = prompt("Buy?", {"Yes", "No"})
        if choice == nil then
          self.skipped = 1
        else
          self.choice = choice
        end
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.set(POSITION, { x: 0, y: 0 });

    // Remote event — prompt should not activate
    entity.emit(new DataEvent("interact", {}, 0, "remote"));

    // Prompt should NOT be shown
    expect(entity.get(PROMPT_ACTIVE)).toBeUndefined();
    // The handler should have completed immediately with nil
    expect(entity.get("skipped")).toBe(1);
    expect(entity.get("choice")).toBeUndefined();
  });

  it("emit() forwards remote origin", () => {
    let capturedOrigin: string | undefined;
    const listener = {
      eventTypes: new Set(["custom"]),
      handle(_e: Entity, event: import("../event").Event) {
        capturedOrigin = (event as DataEvent).origin;
      },
    };

    const behavior = runtime.compileScript(`
      on("tick", function(event)
        emit("custom", {})
      end)
    `, seed());

    const entity = new Entity([behavior, listener]);
    entity.emit(new DataEvent("tick", {}, 0, "remote"));

    expect(capturedOrigin).toBe("remote");
  });

  it("move_to() forwards remote origin", () => {
    const room = makeRoom();
    const walkOrigins: string[] = [];

    const behavior = runtime.compileScript(`
      on("interact", function(event)
        move_to(6, 5)
      end)
    `, seed());

    const critter = new Entity([
      behavior,
      new MovementBehavior(),
      {
        eventTypes: new Set(["walk"]),
        handle(_e: Entity, event: import("../event").Event) {
          walkOrigins.push((event as DataEvent).origin);
        },
      },
    ]);
    room.addChild(critter);
    critter.set(POSITION, { x: 5, y: 5 });

    critter.emit(new DataEvent("interact", {}, 0, "remote"));
    expect(walkOrigins).toEqual(["remote"]);
  });
});

describe("Lua behavior: wait()", () => {
  it("suspends execution for the given duration", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        self.step = 1
        wait(1000)
        self.step = 2
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.set(POSITION, { x: 0, y: 0 });

    entity.emit(new DataEvent("interact", {}, 0));
    expect(entity.get("step")).toBe(1);

    // Too early — should still be waiting
    entity.emit(new DataEvent("tick", {}, 500));
    expect(entity.get("step")).toBe(1);

    // Time reached — should resume
    entity.emit(new DataEvent("tick", {}, 1000));
    expect(entity.get("step")).toBe(2);
  });

  it("supports chained waits", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        self.step = 1
        wait(500)
        self.step = 2
        wait(500)
        self.step = 3
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.set(POSITION, { x: 0, y: 0 });

    entity.emit(new DataEvent("interact", {}, 0));
    expect(entity.get("step")).toBe(1);

    entity.emit(new DataEvent("tick", {}, 500));
    expect(entity.get("step")).toBe(2);

    entity.emit(new DataEvent("tick", {}, 1000));
    expect(entity.get("step")).toBe(3);
  });

  it("blocks other events while waiting", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        wait(1000)
      end)
      on("tick", function(event)
        self.ticks = (self.ticks or 0) + 1
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.set(POSITION, { x: 0, y: 0 });

    // Normal tick
    entity.emit(new DataEvent("tick", {}, 0));
    expect(entity.get("ticks")).toBe(1);

    // Start wait
    entity.emit(new DataEvent("interact", {}, 50));

    // Ticks while waiting should not run tick handler
    entity.emit(new DataEvent("tick", {}, 100));
    expect(entity.get("ticks")).toBe(1);

    // Resume after wait
    entity.emit(new DataEvent("tick", {}, 1050));

    // Next tick should work again
    entity.emit(new DataEvent("tick", {}, 1100));
    expect(entity.get("ticks")).toBe(2);
  });

  it("works with wait then prompt", () => {
    const behavior = runtime.compileScript(`
      on("interact", function(event)
        wait(500)
        local choice = prompt("Ready?", {"Yes", "No"})
        self.choice = choice
      end)
    `, seed());

    const entity = new Entity([behavior]);
    entity.set(POSITION, { x: 0, y: 0 });

    entity.emit(new DataEvent("interact", {}, 0));

    // Wait phase
    entity.emit(new DataEvent("tick", {}, 500));
    expect(entity.get(PROMPT_ACTIVE)).toBe(true);
    expect(entity.get(PROMPT_TEXT)).toBe("Ready?");

    // Respond to prompt
    entity.set(PROMPT_RESPONSE, "Yes");
    entity.emit(new DataEvent("tick", {}, 600));
    expect(entity.get("choice")).toBe("Yes");
  });
});
