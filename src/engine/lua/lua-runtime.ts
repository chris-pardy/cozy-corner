import { lauxlib, lualib, lua } from "fengari";
import { LuaBehavior } from "./lua-behavior";
import {
  doString,
  setGlobalFn,
  pushValue,
  refValue,
  pushRef,
  isNilOrNone,
} from "./fengari-helpers";
import { mulberry32 } from "../prng";

const { luaL_newstate } = lauxlib;
const { luaL_openlibs } = lualib;
const { lua_close, lua_pushvalue, lua_pop, lua_tojsstring, lua_pcall, LUA_OK } = lua;

/**
 * Singleton Lua VM manager. One LuaRuntime per room — multiple entities
 * share the engine via isolated script environments.
 */
export class LuaRuntime {
  private L: LuaState | null = null;

  /** Create the fengari VM, sandbox globals, register API. */
  init(): void {
    const L = luaL_newstate();
    luaL_openlibs(L);
    this.L = L;

    // Install instruction budget hook before sandboxing debug
    doString(L, `
      local _sethook = debug.sethook
      function __install_budget(limit)
        local count = 0
        _sethook(function()
          count = count + 1
          if count > limit then
            error("script exceeded instruction budget")
          end
        end, "", 1000)
      end
      function __clear_budget()
        _sethook()
      end
    `);

    // Sandbox: nil out dangerous globals
    doString(L, `
      io = nil
      os = nil
      require = nil
      loadfile = nil
      dofile = nil
      debug = nil
    `);

    // Redirect print to no-op
    doString(L, `
      print = function(...) end
    `);

    // Override math.random to call __prng_random (set per-behavior in installApiGlobals).
    // Uses global lookup so swapping __prng_random swaps math.random's implementation.
    doString(L, `
      math.random = function(...)
        return __prng_random(...)
      end
      math.randomseed = function() end
    `);
  }

  /**
   * Compile a Lua script into a LuaBehavior. Runs the script once
   * (initialization phase) to register handlers via on().
   */
  compileScript(code: string, seed: number): LuaBehavior {
    const L = this.L;
    if (!L) {
      throw new Error("LuaRuntime not initialized — call init() first");
    }

    const random = mulberry32(seed);
    const behavior = new LuaBehavior(L, random);

    // Install this behavior's PRNG so init code can use math.random
    LuaBehavior.installPrng(L, random);

    // __behavior_on: register a Lua handler for an event type.
    // Stack: [1] = eventType (string), [2] = handler (function)
    setGlobalFn(L, "__behavior_on", (L) => {
      const eventType = lua_tojsstring(L, 1);
      // Store the Lua function in the registry
      lua_pushvalue(L, 2); // copy function to top
      const ref = refValue(L); // pops and stores in registry

      // Create a JS wrapper that calls the Lua function with eventData
      const handler = (eventData: Record<string, unknown>) => {
        pushRef(L, ref);
        pushValue(L, eventData);
        const status = lua_pcall(L, 1, 0, 0);
        if (status !== LUA_OK) {
          const msg = lua_tojsstring(L, -1);
          lua_pop(L, 1);
          throw new Error(msg);
        }
      };

      behavior.registerHandler(eventType, handler);
      return 0;
    });

    // __behavior_off: unregister handler(s) for an event type.
    setGlobalFn(L, "__behavior_off", (L) => {
      const eventType = lua_tojsstring(L, 1);
      if (isNilOrNone(L, 2)) {
        behavior.unregisterHandler(eventType);
      } else {
        // Can't match Lua function refs — remove last handler
        behavior.unregisterHandler(eventType, true);
      }
      return 0;
    });

    let stopFlag = false;
    setGlobalFn(L, "__behavior_stop", () => {
      stopFlag = true;
      return 0;
    });
    behavior._setStopFlagGetter(() => {
      const val = stopFlag;
      stopFlag = false;
      return val;
    });
    behavior._setStopFlagSetter((val: boolean) => {
      stopFlag = val;
    });

    // Execute the script with on/off/stop/prompt aliases.
    // Wrap in do...end so locals are upvalues captured by handlers,
    // not globals that get overwritten by the next compileScript() call.
    //
    // Handlers are wrapped in coroutines so prompt() can yield.
    // __behavior_yield and __prompt_request are globals set fresh by
    // installApiGlobals() before each handle() call — looked up at runtime.
    const initCode = `
      do
        local _register = __behavior_on
        local off = __behavior_off
        local stop = __behavior_stop

        local function on(event_type, handler)
          _register(event_type, function(eventData)
            local co = coroutine.create(handler)
            local function resume_and_check(...)
              local ok, err = coroutine.resume(co, ...)
              if not ok then return end
              if coroutine.status(co) == "suspended" then
                __behavior_yield(function(response)
                  resume_and_check(response)
                end)
              end
            end
            resume_and_check(eventData)
          end)
        end

        local function prompt(text, options)
          local skip = __prompt_request(text, options)
          if skip then return nil end
          return coroutine.yield()
        end

        local function wait(ms)
          __wait_request(ms)
          coroutine.yield()
        end

        local function move_to(x, y)
          __move_to_request(x, y)
          return coroutine.yield()
        end

        local function say(text, bubble)
          __say_request(text, bubble)
          coroutine.yield()
        end

        ${code}
      end
    `;

    try {
      doString(L, initCode);
    } catch (e) {
      console.warn("Lua script compilation error:", e);
    }

    // Clean up temporary globals
    doString(L, `
      __behavior_on = nil
      __behavior_off = nil
      __behavior_stop = nil
    `);

    return behavior;
  }

  /** Free the Lua state. */
  destroy(): void {
    if (this.L) {
      lua_close(this.L);
      this.L = null;
    }
  }
}
