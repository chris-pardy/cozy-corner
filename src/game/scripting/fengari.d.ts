declare module "fengari" {
  interface LuaState {}

  interface Lua {
    LUA_OK: number;
    LUA_YIELD: number;
    LUA_ERRRUN: number;
    LUA_TFUNCTION: number;
    LUA_REGISTRYINDEX: number;
    LUA_MASKCOUNT: number;

    lua_close(L: LuaState): void;
    lua_createtable(L: LuaState, narr: number, nrec: number): void;
    lua_getglobal(L: LuaState, name: Uint8Array): number;
    lua_gettop(L: LuaState): number;
    lua_isnoneornil(L: LuaState, index: number): boolean;
    lua_isnumber(L: LuaState, index: number): boolean;
    lua_isstring(L: LuaState, index: number): boolean;
    lua_istable(L: LuaState, index: number): boolean;
    lua_newthread(L: LuaState): LuaState;
    lua_next(L: LuaState, index: number): number;
    lua_pcall(L: LuaState, nargs: number, nresults: number, msgh: number): number;
    lua_pop(L: LuaState, n: number): void;
    lua_pushboolean(L: LuaState, b: number): void;
    lua_pushcclosure(L: LuaState, fn: (L: LuaState) => number, n: number): void;
    lua_pushinteger(L: LuaState, n: number): void;
    lua_pushnil(L: LuaState): void;
    lua_pushstring(L: LuaState, s: Uint8Array): void;
    lua_pushvalue(L: LuaState, index: number): void;
    lua_rawgeti(L: LuaState, index: number, n: number): number;
    lua_resume(L: LuaState, from: LuaState | null, nargs: number): number;
    lua_sethook(L: LuaState, f: (L: LuaState, ar: unknown) => void, mask: number, count: number): void;
    lua_setfield(L: LuaState, index: number, k: Uint8Array): void;
    lua_setglobal(L: LuaState, name: Uint8Array): void;
    lua_settop(L: LuaState, index: number): void;
    lua_tonumber(L: LuaState, index: number): number;
    lua_tostring(L: LuaState, index: number): Uint8Array;
  }

  interface LAuxLib {
    luaL_checkinteger(L: LuaState, arg: number): number;
    luaL_checkstring(L: LuaState, arg: number): Uint8Array;
    luaL_checktype(L: LuaState, arg: number, t: number): void;
    luaL_dostring(L: LuaState, s: Uint8Array): number;
    luaL_loadstring(L: LuaState, s: Uint8Array): number;
    luaL_newstate(): LuaState;
    luaL_ref(L: LuaState, t: number): number;
  }

  interface LuaLib {
    luaL_openlibs(L: LuaState): void;
  }

  export const lua: Lua;
  export const lauxlib: LAuxLib;
  export const lualib: LuaLib;
  export function to_luastring(s: string): Uint8Array;
  export function to_jsstring(s: Uint8Array): string;
}
