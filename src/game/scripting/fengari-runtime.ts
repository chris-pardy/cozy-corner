import fengari from "fengari";
import { lintLuaScript, lintPassed } from "./lint";
import type { ScriptAPI, ScriptHandle, ScriptRuntime } from "./types";
import {
  setEntityState,
  setAnimTarget,
  setDirection,
  startMove,
  stopMove,
  MESSAGE,
  type MessagePayload,
} from "../entity-slice";
import { attachCamera, setCameraPosition } from "../camera-slice";
import { selectEntityById, selectBlockingGrid } from "../selectors";
import { findPath } from "../pathfinding";
import { Direction } from "../types";

const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

// ---------------------------------------------------------------------------
// Prelude: sandbox + define `when` as a coroutine yield wrapper
// ---------------------------------------------------------------------------

/** Max Lua VM instructions per resume before aborting. */
const MAX_INSTRUCTIONS_PER_RESUME = 100_000;

const PRELUDE = `
-- Sandbox: remove all dangerous globals
os = nil
io = nil
debug = nil
load = nil
loadstring = nil
dofile = nil
loadfile = nil
require = nil
package = nil
module = nil
rawget = nil
rawset = nil
rawequal = nil
rawlen = nil
setmetatable = nil
getmetatable = nil
collectgarbage = nil
setfenv = nil
getfenv = nil
_G = nil

function when(eventName)
  return coroutine.yield(eventName)
end
`;

// ---------------------------------------------------------------------------
// FengariRuntime
// ---------------------------------------------------------------------------

export class FengariRuntime implements ScriptRuntime {
  private handles: Map<string, FengariHandle[]> = new Map();

  load(entityId: string, code: string, api: ScriptAPI): ScriptHandle {
    const handle = new FengariHandle(entityId, code, api);
    const list = this.handles.get(entityId) ?? [];
    list.push(handle);
    this.handles.set(entityId, list);
    return handle;
  }

  dispose() {
    for (const handles of this.handles.values()) {
      for (const h of handles) h.dispose();
    }
    this.handles.clear();
  }
}

// ---------------------------------------------------------------------------
// Per-script handle — each behavior is a single Lua coroutine
// ---------------------------------------------------------------------------

class FengariHandle implements ScriptHandle {
  readonly entityId: string;
  private L: any; // main Lua state
  private thread: any; // coroutine thread
  private threadRef: number; // registry ref keeping thread alive
  private waitingFor: string | null = null;
  private finished = false;
  private disposed = false;

  constructor(entityId: string, code: string, private api: ScriptAPI) {
    this.entityId = entityId;

    // --- Static lint: reject before touching the VM ---
    const diags = lintLuaScript(code);
    if (!lintPassed(diags)) {
      for (const d of diags) {
        console.warn(`[script:${entityId}] lint ${d.level}: ${d.message}`);
      }
      this.finished = true;
      this.L = null;
      this.thread = null;
      this.threadRef = 0;
      return;
    }

    // Create main state + open libs
    const L = lauxlib.luaL_newstate();
    this.L = L;
    lualib.luaL_openlibs(L);

    // Run prelude (sandbox + define when())
    lauxlib.luaL_dostring(L, to_luastring(PRELUDE));

    // Register JS-backed API functions on main state (threads inherit globals)
    this.registerAPI();

    // Create a thread (coroutine) for the script body
    const thread = lua.lua_newthread(L);
    this.threadRef = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);
    this.thread = thread;

    // Install instruction-count hook to kill runaway scripts
    lua.lua_sethook(
      thread,
      (_L: any) => {
        lauxlib.luaL_error(_L, to_luastring("instruction limit exceeded"));
      },
      lua.LUA_MASKCOUNT,
      MAX_INSTRUCTIONS_PER_RESUME,
    );

    // Load the script code as a function onto the thread's stack
    const loadErr = lauxlib.luaL_loadstring(thread, to_luastring(code));
    if (loadErr !== lua.LUA_OK) {
      const msg = to_jsstring(lua.lua_tostring(thread, -1));
      lua.lua_pop(thread, 1);
      console.warn(`[script:${entityId}] load error: ${msg}`);
      this.finished = true;
      return;
    }

    // Start the coroutine — runs until first when() or completion
    this.resume(0);
  }

  emit(event: string, data: Record<string, string>) {
    if (this.disposed || this.finished || this.waitingFor !== event) return;

    // Push data table onto thread stack, then resume
    this.pushDataTable(data);
    this.resume(1);
  }

  tick() {
    this.emit("tick", {});
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.L) lua.lua_close(this.L);
  }

  // -----------------------------------------------------------------------
  // Coroutine resume
  // -----------------------------------------------------------------------

  private resume(nargs: number) {
    const status = lua.lua_resume(this.thread, this.L, nargs);

    if (status === lua.LUA_YIELD) {
      // The yielded value is the event name passed to when()
      const top = lua.lua_gettop(this.thread);
      if (top >= 1) {
        this.waitingFor = to_jsstring(lua.lua_tostring(this.thread, -1));
        lua.lua_settop(this.thread, 0); // clear stack for next resume
      } else {
        this.waitingFor = null;
      }
    } else if (status === lua.LUA_OK) {
      // Coroutine finished normally
      this.finished = true;
      this.waitingFor = null;
    } else {
      // Runtime error
      const msg = to_jsstring(lua.lua_tostring(this.thread, -1));
      console.warn(`[script:${this.entityId}] runtime error: ${msg}`);
      this.finished = true;
      this.waitingFor = null;
    }
  }

  // -----------------------------------------------------------------------
  // Push a JS Record as a Lua table
  // -----------------------------------------------------------------------

  private pushDataTable(data: Record<string, string>) {
    const T = this.thread;
    lua.lua_createtable(T, 0, Object.keys(data).length);
    for (const [k, v] of Object.entries(data)) {
      lua.lua_pushstring(T, to_luastring(v));
      lua.lua_setfield(T, -2, to_luastring(k));
    }
  }

  // -----------------------------------------------------------------------
  // API registration (on main state — threads inherit globals)
  // -----------------------------------------------------------------------

  private registerAPI() {
    const L = this.L;
    const self = this;

    // getState(key) → string|nil
    lua.lua_pushcclosure(L, (L: any) => {
      const key = to_jsstring(lauxlib.luaL_checkstring(L, 1));
      const entity = selectEntityById(self.api.getState(), self.entityId);
      if (entity && key in entity.state) {
        lua.lua_pushstring(L, to_luastring(entity.state[key]));
      } else {
        lua.lua_pushnil(L);
      }
      return 1;
    }, 0);
    lua.lua_setglobal(L, to_luastring("getState"));

    // setState(key, value)
    lua.lua_pushcclosure(L, (L: any) => {
      const key = to_jsstring(lauxlib.luaL_checkstring(L, 1));
      const value = to_jsstring(lauxlib.luaL_checkstring(L, 2));
      self.api.dispatch(
        setEntityState({ id: self.entityId, key, value }),
      );
      return 0;
    }, 0);
    lua.lua_setglobal(L, to_luastring("setState"));

    // getPosition() → x, y
    lua.lua_pushcclosure(L, (L: any) => {
      const entity = selectEntityById(self.api.getState(), self.entityId);
      if (entity) {
        lua.lua_pushinteger(L, entity.x);
        lua.lua_pushinteger(L, entity.y);
      } else {
        lua.lua_pushnil(L);
        lua.lua_pushnil(L);
      }
      return 2;
    }, 0);
    lua.lua_setglobal(L, to_luastring("getPosition"));

    // getDirection() → number (Direction enum)
    lua.lua_pushcclosure(L, (L: any) => {
      const entity = selectEntityById(self.api.getState(), self.entityId);
      lua.lua_pushinteger(L, entity?.direction ?? Direction.South);
      return 1;
    }, 0);
    lua.lua_setglobal(L, to_luastring("getDirection"));

    // setAnimTarget(target)
    lua.lua_pushcclosure(L, (L: any) => {
      const target = to_jsstring(lauxlib.luaL_checkstring(L, 1));
      self.api.dispatch(setAnimTarget({ id: self.entityId, target }));
      return 0;
    }, 0);
    lua.lua_setglobal(L, to_luastring("setAnimTarget"));

    // moveTo(x, y) — computes path via A* and starts movement
    lua.lua_pushcclosure(L, (L: any) => {
      const tx = lauxlib.luaL_checkinteger(L, 1);
      const ty = lauxlib.luaL_checkinteger(L, 2);
      const state = self.api.getState();
      const entity = selectEntityById(state, self.entityId);
      if (!entity) return 0;
      const grid = selectBlockingGrid(state);
      const path = findPath(
        grid,
        state.room.width,
        state.room.height,
        { x: entity.x, y: entity.y },
        { x: tx, y: ty },
      );
      if (path && path.length > 0) {
        self.api.dispatch(startMove({ id: self.entityId, path }));
        lua.lua_pushboolean(L, 1);
      } else {
        lua.lua_pushboolean(L, 0);
      }
      return 1;
    }, 0);
    lua.lua_setglobal(L, to_luastring("moveTo"));

    // stopMoving()
    lua.lua_pushcclosure(L, (L: any) => {
      self.api.dispatch(stopMove(self.entityId));
      return 0;
    }, 0);
    lua.lua_setglobal(L, to_luastring("stopMoving"));

    // sendMessage(targetEntityId, messageName, data_table?)
    lua.lua_pushcclosure(L, (L: any) => {
      const toId = to_jsstring(lauxlib.luaL_checkstring(L, 1));
      const name = to_jsstring(lauxlib.luaL_checkstring(L, 2));
      const data: Record<string, string> = {};
      if (lua.lua_istable(L, 3)) {
        lua.lua_pushnil(L);
        while (lua.lua_next(L, 3)) {
          const k = to_jsstring(lua.lua_tostring(L, -2));
          const v = to_jsstring(lua.lua_tostring(L, -1));
          data[k] = v;
          lua.lua_pop(L, 1);
        }
      }
      self.api.dispatch({
        type: MESSAGE,
        payload: {
          fromId: self.entityId,
          toId,
          name,
          data,
        } satisfies MessagePayload,
      });
      return 0;
    }, 0);
    lua.lua_setglobal(L, to_luastring("sendMessage"));

    // say(text, bubbleType?)
    lua.lua_pushcclosure(L, (L: any) => {
      const text = to_jsstring(lauxlib.luaL_checkstring(L, 1));
      const bubble = lua.lua_isstring(L, 2)
        ? to_jsstring(lua.lua_tostring(L, 2))
        : "speech";
      self.api.dispatch(
        setEntityState({ id: self.entityId, key: "__speech", value: text }),
      );
      self.api.dispatch(
        setEntityState({
          id: self.entityId,
          key: "__speechBubble",
          value: bubble,
        }),
      );
      return 0;
    }, 0);
    lua.lua_setglobal(L, to_luastring("say"));

    // cameraFollow(pcId, targetEntityId, radius?)
    lua.lua_pushcclosure(L, (L: any) => {
      const owner = to_jsstring(lauxlib.luaL_checkstring(L, 1));
      const followId = to_jsstring(lauxlib.luaL_checkstring(L, 2));
      const radius = lua.lua_isnumber(L, 3) ? lua.lua_tonumber(L, 3) : undefined;
      self.api.dispatch(attachCamera({ owner, followId, radius }));
      return 0;
    }, 0);
    lua.lua_setglobal(L, to_luastring("cameraFollow"));

    // cameraPan(pcId, x, y, radius?, duration?)
    lua.lua_pushcclosure(L, (L: any) => {
      const owner = to_jsstring(lauxlib.luaL_checkstring(L, 1));
      const x = lauxlib.luaL_checkinteger(L, 2);
      const y = lauxlib.luaL_checkinteger(L, 3);
      const radius = lua.lua_isnumber(L, 4) ? lua.lua_tonumber(L, 4) : undefined;
      const duration = lua.lua_isnumber(L, 5) ? lua.lua_tonumber(L, 5) : undefined;
      self.api.dispatch(setCameraPosition({ owner, x, y, radius, duration }));
      return 0;
    }, 0);
    lua.lua_setglobal(L, to_luastring("cameraPan"));

    // Direction constants
    lua.lua_pushinteger(L, Direction.South);
    lua.lua_setglobal(L, to_luastring("SOUTH"));
    lua.lua_pushinteger(L, Direction.West);
    lua.lua_setglobal(L, to_luastring("WEST"));
    lua.lua_pushinteger(L, Direction.North);
    lua.lua_setglobal(L, to_luastring("NORTH"));
    lua.lua_pushinteger(L, Direction.East);
    lua.lua_setglobal(L, to_luastring("EAST"));

    // ENTITY_ID
    lua.lua_pushstring(L, to_luastring(this.entityId));
    lua.lua_setglobal(L, to_luastring("ENTITY_ID"));
  }
}
