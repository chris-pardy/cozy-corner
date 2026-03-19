/* eslint-disable @typescript-eslint/no-explicit-any */

/** Opaque Lua state handle */
type LuaState = any;

declare module "fengari" {
  export function to_luastring(s: string): Uint8Array;
  export function to_jsstring(s: Uint8Array): string;

  export const lua: {
    LUA_REGISTRYINDEX: number;
    LUA_TNONE: number;
    LUA_TNIL: number;
    LUA_TBOOLEAN: number;
    LUA_TNUMBER: number;
    LUA_TSTRING: number;
    LUA_TTABLE: number;
    LUA_TFUNCTION: number;
    LUA_TUSERDATA: number;
    LUA_OK: number;
    LUA_MULTRET: number;
    LUA_YIELD: number;

    lua_close(L: LuaState): void;
    lua_createtable(L: LuaState, narr: number, nrec: number): void;
    lua_newtable(L: LuaState): void;
    lua_getfield(L: LuaState, idx: number, k: Uint8Array): number;
    lua_getglobal(L: LuaState, name: Uint8Array): number;
    lua_gettable(L: LuaState, idx: number): number;
    lua_gettop(L: LuaState): number;
    lua_insert(L: LuaState, idx: number): void;
    lua_isboolean(L: LuaState, idx: number): boolean;
    lua_isfunction(L: LuaState, idx: number): boolean;
    lua_isnil(L: LuaState, idx: number): boolean;
    lua_isnone(L: LuaState, idx: number): boolean;
    lua_isnoneornil(L: LuaState, idx: number): boolean;
    lua_isnumber(L: LuaState, idx: number): boolean;
    lua_isstring(L: LuaState, idx: number): boolean;
    lua_istable(L: LuaState, idx: number): boolean;
    lua_next(L: LuaState, idx: number): number;
    lua_pcall(L: LuaState, nargs: number, nresults: number, msgh: number): number;
    lua_pop(L: LuaState, n: number): void;
    lua_pushboolean(L: LuaState, b: boolean | number): void;
    lua_pushcclosure(L: LuaState, fn: (L: LuaState) => number, n: number): void;
    lua_pushcfunction(L: LuaState, fn: (L: LuaState) => number): void;
    lua_pushinteger(L: LuaState, n: number): void;
    lua_pushjsfunction(L: LuaState, fn: (L: LuaState) => number): void;
    lua_pushliteral(L: LuaState, s: string): void;
    lua_pushnil(L: LuaState): void;
    lua_pushnumber(L: LuaState, n: number): void;
    lua_pushstring(L: LuaState, s: Uint8Array): void;
    lua_pushvalue(L: LuaState, idx: number): void;
    lua_rawgeti(L: LuaState, idx: number, n: number): number;
    lua_rawseti(L: LuaState, idx: number, n: number): void;
    lua_remove(L: LuaState, idx: number): void;
    lua_setfield(L: LuaState, idx: number, k: Uint8Array): void;
    lua_setglobal(L: LuaState, name: Uint8Array): void;
    lua_settable(L: LuaState, idx: number): void;
    lua_settop(L: LuaState, idx: number): void;
    lua_toboolean(L: LuaState, idx: number): boolean;
    lua_tojsstring(L: LuaState, idx: number): string;
    lua_tonumber(L: LuaState, idx: number): number;
    lua_tointeger(L: LuaState, idx: number): number;
    lua_type(L: LuaState, idx: number): number;
  };

  export const lauxlib: {
    LUA_NOREF: number;
    LUA_REFNIL: number;
    luaL_newstate(): LuaState;
    luaL_dostring(L: LuaState, s: Uint8Array): number;
    luaL_loadstring(L: LuaState, s: Uint8Array): number;
    luaL_ref(L: LuaState, t: number): number;
    luaL_unref(L: LuaState, t: number, ref: number): void;
    luaL_tolstring(L: LuaState, idx: number, len?: null): Uint8Array;
  };

  export const lualib: {
    luaL_openlibs(L: LuaState): void;
  };
}

declare module "fengari-interop" {
  export function push(L: LuaState, value: unknown): void;
  export function tojs(L: LuaState, idx: number): unknown;
  export function pushjs(L: LuaState, value: unknown): void;
  export function luaopen_js(L: LuaState): number;
}
