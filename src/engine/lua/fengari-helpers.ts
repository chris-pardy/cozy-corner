/**
 * Thin helpers over fengari's C-style API.
 * Centralises stack manipulation so lua-runtime.ts / lua-behavior.ts stay clean.
 */

import { lua, lauxlib, to_luastring } from "fengari";

const {
  lua_type,
  lua_gettop,
  lua_pop,
  lua_pushnil,
  lua_pushnumber,
  lua_pushboolean,
  lua_pushliteral,
  lua_pushjsfunction,
  lua_setglobal,
  lua_newtable,
  lua_settable,
  lua_next,
  lua_rawseti,
  lua_rawgeti,
  lua_pcall,
  lua_tonumber,
  lua_toboolean,
  lua_tojsstring,
  lua_isnoneornil,
  LUA_REGISTRYINDEX,
  LUA_TNIL,
  LUA_TNONE,
  LUA_TBOOLEAN,
  LUA_TNUMBER,
  LUA_TSTRING,
  LUA_TTABLE,
  LUA_OK,
} = lua;

const { luaL_dostring, luaL_ref, luaL_unref } = lauxlib;

// -------------------------------------------------------------------------
// Execute
// -------------------------------------------------------------------------

/** Execute a Lua string. Throws on error with the Lua error message. */
export function doString(L: LuaState, code: string): void {
  const status = luaL_dostring(L, to_luastring(code));
  if (status !== LUA_OK) {
    const msg = lua_tojsstring(L, -1);
    lua_pop(L, 1);
    throw new Error(msg);
  }
}

// -------------------------------------------------------------------------
// Set globals
// -------------------------------------------------------------------------

/** Register a JS function as a Lua global (C-API style: fn receives L, returns nresults). */
export function setGlobalFn(
  L: LuaState,
  name: string,
  fn: (L: LuaState) => number,
): void {
  lua_pushjsfunction(L, fn);
  lua_setglobal(L, to_luastring(name));
}

/** Set a Lua global to a primitive JS value. */
export function setGlobalValue(
  L: LuaState,
  name: string,
  value: unknown,
): void {
  pushValue(L, value);
  lua_setglobal(L, to_luastring(name));
}

// -------------------------------------------------------------------------
// Push JS → Lua stack
// -------------------------------------------------------------------------

/** Push a JS value onto the Lua stack as the appropriate Lua type. */
export function pushValue(L: LuaState, value: unknown): void {
  if (value === undefined || value === null) {
    lua_pushnil(L);
  } else if (typeof value === "number") {
    lua_pushnumber(L, value);
  } else if (typeof value === "string") {
    lua_pushliteral(L, value);
  } else if (typeof value === "boolean") {
    lua_pushboolean(L, value ? 1 : 0);
  } else if (Array.isArray(value)) {
    lua_newtable(L);
    for (let i = 0; i < value.length; i++) {
      pushValue(L, value[i]);
      lua_rawseti(L, -2, i + 1); // Lua arrays are 1-based
    }
  } else if (typeof value === "object") {
    lua_newtable(L);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      lua_pushliteral(L, k);
      pushValue(L, v);
      lua_settable(L, -3);
    }
  } else {
    lua_pushnil(L);
  }
}

// -------------------------------------------------------------------------
// Read Lua stack → JS
// -------------------------------------------------------------------------

/** Read a Lua stack value as a JS value. Tables become plain objects/arrays. */
export function readValue(L: LuaState, idx: number): unknown {
  const t = lua_type(L, idx);
  switch (t) {
    case LUA_TNIL:
    case LUA_TNONE:
      return undefined;
    case LUA_TBOOLEAN:
      return lua_toboolean(L, idx);
    case LUA_TNUMBER:
      return lua_tonumber(L, idx);
    case LUA_TSTRING:
      return lua_tojsstring(L, idx);
    case LUA_TTABLE:
      return readTable(L, idx);
    default:
      return undefined;
  }
}

/**
 * Read a Lua table at `idx` into a plain JS object.
 * Sequential integer keys (1,2,3…) are NOT turned into an array —
 * callers can use readArray() if they know the shape.
 */
export function readTable(
  L: LuaState,
  idx: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Make idx absolute so it stays valid after pushes
  const absIdx = idx > 0 ? idx : lua_gettop(L) + idx + 1;

  lua_pushnil(L); // first key
  while (lua_next(L, absIdx) !== 0) {
    // key at -2, value at -1
    const keyType = lua_type(L, -2);
    let key: string;
    if (keyType === LUA_TSTRING) {
      key = lua_tojsstring(L, -2);
    } else if (keyType === LUA_TNUMBER) {
      key = String(lua_tonumber(L, -2));
    } else {
      lua_pop(L, 1); // skip non-string/number keys
      continue;
    }
    result[key] = readValue(L, -1);
    lua_pop(L, 1); // pop value, keep key for next iteration
  }
  return result;
}

/** Read a Lua table at `idx` as a JS string array (1-based sequential keys). */
export function readArray(L: LuaState, idx: number): string[] {
  const result: string[] = [];
  const absIdx = idx > 0 ? idx : lua_gettop(L) + idx + 1;

  // Iterate by integer index (1-based) to preserve insertion order
  for (let i = 1; ; i++) {
    lua_rawgeti(L, absIdx, i);
    const t = lua_type(L, -1);
    if (t === LUA_TNIL || t === LUA_TNONE) {
      lua_pop(L, 1);
      break;
    }
    if (t === LUA_TSTRING) {
      result.push(lua_tojsstring(L, -1));
    } else if (t === LUA_TNUMBER) {
      result.push(String(lua_tonumber(L, -1)));
    }
    lua_pop(L, 1);
  }
  return result;
}

// -------------------------------------------------------------------------
// Registry references (for storing Lua functions)
// -------------------------------------------------------------------------

/** Store the value at the top of the stack in the registry and return its ref key. Pops the value. */
export function refValue(L: LuaState): number {
  return luaL_ref(L, LUA_REGISTRYINDEX);
}

/** Push a registry reference back onto the stack. */
export function pushRef(L: LuaState, ref: number): void {
  lua_rawgeti(L, LUA_REGISTRYINDEX, ref);
}

/** Release a registry reference. */
export function unrefValue(L: LuaState, ref: number): void {
  luaL_unref(L, LUA_REGISTRYINDEX, ref);
}

/**
 * Call a Lua function stored as a registry reference.
 * Pushes the function + args, calls lua_pcall. Returns true on success.
 */
export function callRef(
  L: LuaState,
  ref: number,
  args: unknown[],
  nresults = 0,
): boolean {
  pushRef(L, ref);
  for (const arg of args) {
    pushValue(L, arg);
  }
  const status = lua_pcall(L, args.length, nresults, 0);
  if (status !== LUA_OK) {
    const msg = lua_tojsstring(L, -1);
    lua_pop(L, 1);
    console.warn("Lua call error:", msg);
    return false;
  }
  return true;
}

/** Check if a stack position holds nil/none. */
export function isNilOrNone(L: LuaState, idx: number): boolean {
  return lua_isnoneornil(L, idx);
}
