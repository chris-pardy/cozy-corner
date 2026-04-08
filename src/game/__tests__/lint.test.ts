import { describe, it, expect } from "vitest";
import { lintLuaScript, lintPassed } from "../scripting/lint";

function errors(code: string) {
  return lintLuaScript(code).filter((d) => d.level === "error");
}

function passes(code: string) {
  return lintPassed(lintLuaScript(code));
}

describe("lint: forbidden globals", () => {
  it.each([
    "debug",
    "load",
    "loadstring",
    "dofile",
    "loadfile",
    "require",
    "package",
    "rawget",
    "rawset",
    "rawequal",
    "rawlen",
    "setmetatable",
    "getmetatable",
    "collectgarbage",
    "module",
    "setfenv",
    "getfenv",
    "_G",
    "_ENV",
  ])("rejects bare use of %s", (name) => {
    const code = `local x = ${name}`;
    expect(passes(code)).toBe(false);
    expect(errors(code).some((e) => e.message.includes(name))).toBe(true);
  });

  it("rejects debug even in a function call", () => {
    expect(passes(`debug.sethook(nil)`)).toBe(false);
  });

  it("does not flag substring matches (debug_mode is fine)", () => {
    expect(passes(`local debug_mode = true\nwhen("tick")`)).toBe(true);
  });

  it("does not flag words inside comments", () => {
    expect(passes(`-- using debug here\nwhen("tick")`)).toBe(true);
  });

  it("does not flag words inside single-quoted strings", () => {
    expect(passes(`local s = 'require'\nwhen("tick")`)).toBe(true);
  });

  it("does not flag words inside double-quoted strings", () => {
    expect(passes(`local s = "loadfile"\nwhen("tick")`)).toBe(true);
  });

  it("does not flag words inside long strings", () => {
    expect(passes(`local s = [[\nrequire debug rawget\n]]\nwhen("tick")`)).toBe(true);
  });

  it("does not flag words inside block comments", () => {
    expect(passes(`--[[\nrequire\ndebug\n]]\nwhen("tick")`)).toBe(true);
  });
});

describe("lint: string.dump", () => {
  it("rejects .dump() calls", () => {
    expect(passes(`string.dump(func)`)).toBe(false);
  });

  it("allows the word dump in other contexts", () => {
    // dump as a variable name is fine
    expect(passes(`local dump = 1\nwhen("tick")`)).toBe(true);
  });
});

describe("lint: loops without when()", () => {
  it("rejects while-true without when", () => {
    const code = `while true do\n  x = x + 1\nend`;
    expect(passes(code)).toBe(false);
    expect(errors(code).some((e) => e.message.includes("loop without when()"))).toBe(true);
  });

  it("rejects repeat-until without when", () => {
    const code = `repeat\n  x = x + 1\nuntil false`;
    expect(passes(code)).toBe(false);
  });

  it("accepts while-true with when", () => {
    const code = `while true do\n  when("tick")\n  x = x + 1\nend`;
    expect(passes(code)).toBe(true);
  });

  it("accepts repeat-until with when", () => {
    const code = `repeat\n  local d = when("interact")\nuntil false`;
    expect(passes(code)).toBe(true);
  });

  it("accepts a finite loop (for) without when", () => {
    // for loops are finite by nature
    const code = `for i = 1, 10 do\n  x = x + 1\nend\nwhen("tick")`;
    expect(passes(code)).toBe(true);
  });

  it("accepts one-shot scripts (no loop at all)", () => {
    const code = `when("interact")\nsetState("done", "true")`;
    expect(passes(code)).toBe(true);
  });
});

describe("lint: size limit", () => {
  it("rejects scripts over 10KB", () => {
    const code = "x = 1\n".repeat(2000); // ~12KB
    expect(passes(code)).toBe(false);
    expect(errors(code).some((e) => e.message.includes("maximum size"))).toBe(true);
  });
});

describe("lint: clean scripts pass", () => {
  it("typical interact handler", () => {
    expect(
      passes(`
      while true do
        local data = when("interact")
        local lit = getState("lit")
        if lit == "false" then
          setState("lit", "true")
        else
          setState("lit", "false")
        end
      end
    `),
    ).toBe(true);
  });

  it("tick counter", () => {
    expect(
      passes(`
      while true do
        when("tick")
        local c = tonumber(getState("count"))
        setState("count", tostring(c + 1))
      end
    `),
    ).toBe(true);
  });

  it("message handler with sendMessage", () => {
    expect(
      passes(`
      while true do
        when("interact")
        sendMessage("door", "toggle", {})
      end
    `),
    ).toBe(true);
  });

  it("camera cutscene", () => {
    expect(
      passes(`
      when("interact")
      cameraPan("player", 5, 5, 8, 24)
      when("tick")
      cameraFollow("player", "npc1", 12)
    `),
    ).toBe(true);
  });
});
