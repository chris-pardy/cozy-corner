import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RoomRuntime } from "../runtime";

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
  });
}

/** Wait for the microtask that loads __behaviors scripts. */
function afterLoad(): Promise<void> {
  return new Promise((r) => queueMicrotask(r));
}

describe("fengari scripting — when() coroutine model", () => {
  let runtime: RoomRuntime;

  beforeEach(() => {
    runtime = makeRuntime();
  });

  afterEach(() => {
    runtime.dispose();
  });

  it("blocks at when() and resumes on matching event", async () => {
    runtime.addEntity({
      id: "lamp",
      type: "item",
      x: 2,
      y: 2,
      state: {
        lit: "false",
        __behaviors: JSON.stringify([
          `while true do
            when("interact")
            local current = getState("lit")
            if current == "false" then
              setState("lit", "true")
            else
              setState("lit", "false")
            end
          end`,
        ]),
      },
    });

    await afterLoad();

    runtime.interact("player", "lamp");
    expect(runtime.getEntity("lamp")!.state.lit).toBe("true");

    runtime.interact("player", "lamp");
    expect(runtime.getEntity("lamp")!.state.lit).toBe("false");
  });

  it("when() returns event data as a table", async () => {
    runtime.addEntity({
      id: "npc1",
      type: "npc",
      x: 5,
      y: 3,
      state: {
        __behaviors: JSON.stringify([
          `while true do
            local data = when("interact")
            setState("who", data.sourceId)
          end`,
        ]),
      },
    });

    await afterLoad();

    runtime.interact("hero", "npc1");
    expect(runtime.getEntity("npc1")!.state.who).toBe("hero");
  });

  it("getPosition reads current entity position", async () => {
    runtime.addEntity({
      id: "npc1",
      type: "npc",
      x: 5,
      y: 3,
      state: {
        __behaviors: JSON.stringify([
          `when("interact")
          local x, y = getPosition()
          setState("pos", x .. "," .. y)`,
        ]),
      },
    });

    await afterLoad();

    runtime.interact("player", "npc1");
    expect(runtime.getEntity("npc1")!.state.pos).toBe("5,3");
  });

  it("moveTo starts pathfinding", async () => {
    runtime.addEntity({
      id: "cat",
      type: "npc",
      x: 0,
      y: 0,
      state: {
        __behaviors: JSON.stringify([
          `when("interact")
          moveTo(3, 0)`,
        ]),
      },
    });

    await afterLoad();

    runtime.interact("player", "cat");
    const cat = runtime.getEntity("cat")!;
    expect(cat.movePath).not.toBeNull();
    expect(cat.movePath!.length).toBeGreaterThan(0);
  });

  it("say() sets speech state keys", async () => {
    runtime.addEntity({
      id: "npc2",
      type: "npc",
      x: 1,
      y: 1,
      state: {
        __behaviors: JSON.stringify([
          `when("interact")
          say("Hello!", "thought")`,
        ]),
      },
    });

    await afterLoad();

    runtime.interact("player", "npc2");
    const npc = runtime.getEntity("npc2")!;
    expect(npc.state.__speech).toBe("Hello!");
    expect(npc.state.__speechBubble).toBe("thought");
  });

  it("tick event resumes scripts waiting for tick", async () => {
    runtime.addEntity({
      id: "counter",
      type: "item",
      x: 0,
      y: 0,
      state: {
        count: "0",
        __behaviors: JSON.stringify([
          `while true do
            when("tick")
            local c = tonumber(getState("count"))
            setState("count", tostring(c + 1))
          end`,
        ]),
      },
    });

    await afterLoad();

    for (let i = 0; i < 3; i++) {
      runtime.store.dispatch({ type: "game/tick", payload: { tick: i } });
    }
    expect(runtime.getEntity("counter")!.state.count).toBe("3");
  });

  it("sendMessage + when('message') enables script-to-script communication", async () => {
    runtime.addEntity({
      id: "switch",
      type: "item",
      x: 0,
      y: 0,
      state: {
        __behaviors: JSON.stringify([
          `while true do
            when("interact")
            sendMessage("door", "toggle", {})
          end`,
        ]),
      },
    });

    runtime.addEntity({
      id: "door",
      type: "item",
      x: 3,
      y: 0,
      state: {
        open: "false",
        __behaviors: JSON.stringify([
          `while true do
            local data = when("message")
            if data.name == "toggle" then
              local cur = getState("open")
              if cur == "false" then
                setState("open", "true")
              else
                setState("open", "false")
              end
            end
          end`,
        ]),
      },
    });

    await afterLoad();

    runtime.interact("player", "switch");
    expect(runtime.getEntity("door")!.state.open).toBe("true");

    runtime.interact("player", "switch");
    expect(runtime.getEntity("door")!.state.open).toBe("false");
  });

  it("direction constants are available", async () => {
    runtime.addEntity({
      id: "probe",
      type: "item",
      x: 0,
      y: 0,
      state: {
        __behaviors: JSON.stringify([
          `when("interact")
          setState("south", tostring(SOUTH))
          setState("west", tostring(WEST))
          setState("north", tostring(NORTH))
          setState("east", tostring(EAST))`,
        ]),
      },
    });

    await afterLoad();

    runtime.interact("player", "probe");
    const e = runtime.getEntity("probe")!;
    expect(e.state.south).toBe("0");
    expect(e.state.west).toBe("1");
    expect(e.state.north).toBe("2");
    expect(e.state.east).toBe("3");
  });

  it("malformed Lua code does not crash the runtime", async () => {
    runtime.addEntity({
      id: "bad",
      type: "item",
      x: 0,
      y: 0,
      state: {
        // This passes lint (no forbidden identifiers, no loops) but is
        // syntactically invalid Lua — caught at VM load time.
        __behaviors: JSON.stringify([`when("x") @@@ bad syntax`]),
      },
    });

    await afterLoad();

    expect(() => runtime.interact("player", "bad")).not.toThrow();
  });

  it("lint-rejected script is silently ignored", async () => {
    runtime.addEntity({
      id: "evil",
      type: "item",
      x: 0,
      y: 0,
      state: {
        __behaviors: JSON.stringify([
          `local d = debug.getinfo(1)\nwhen("interact")`,
        ]),
      },
    });

    await afterLoad();

    // Script was rejected at lint time — interact is a no-op
    expect(() => runtime.interact("player", "evil")).not.toThrow();
  });

  it("script that finishes without looping is inert after completion", async () => {
    runtime.addEntity({
      id: "oneshot",
      type: "item",
      x: 0,
      y: 0,
      state: {
        count: "0",
        __behaviors: JSON.stringify([
          `-- no loop: runs once then coroutine finishes
          when("interact")
          setState("count", "1")`,
        ]),
      },
    });

    await afterLoad();

    runtime.interact("player", "oneshot");
    expect(runtime.getEntity("oneshot")!.state.count).toBe("1");

    // Second interact does nothing — coroutine already finished
    runtime.interact("player", "oneshot");
    expect(runtime.getEntity("oneshot")!.state.count).toBe("1");
  });

  it("multiple behaviors on the same entity run independently", async () => {
    runtime.addEntity({
      id: "multi",
      type: "item",
      x: 0,
      y: 0,
      state: {
        ticks: "0",
        interacts: "0",
        __behaviors: JSON.stringify([
          // Behavior 1: counts ticks
          `while true do
            when("tick")
            local t = tonumber(getState("ticks"))
            setState("ticks", tostring(t + 1))
          end`,
          // Behavior 2: counts interacts
          `while true do
            when("interact")
            local i = tonumber(getState("interacts"))
            setState("interacts", tostring(i + 1))
          end`,
        ]),
      },
    });

    await afterLoad();

    // 2 ticks, then an interact, then 1 more tick
    runtime.store.dispatch({ type: "game/tick", payload: { tick: 1 } });
    runtime.store.dispatch({ type: "game/tick", payload: { tick: 2 } });
    runtime.interact("player", "multi");
    runtime.store.dispatch({ type: "game/tick", payload: { tick: 3 } });

    const e = runtime.getEntity("multi")!;
    expect(e.state.ticks).toBe("3");
    expect(e.state.interacts).toBe("1");
  });
});
