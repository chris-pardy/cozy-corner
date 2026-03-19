import { lua } from "fengari";
import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import type { Event } from "../event";
import { DataEvent, type EventOrigin } from "../event";
import { POSITION, DIRECTION, MOVE_TARGET, PATH } from "../state/movement";
import { ATTRIBUTE_MAP, type AttributeMap } from "../state/attributes";
import { BLOCKING_GRID, type BlockingGrid } from "../state/blocking";
import {
  SPEECH_TEXT,
  SPEECH_BUBBLE,
  SPEECH_START,
  SPEECH_DURATION,
  DEFAULT_SPEECH_DURATION,
} from "../state/speech";
import {
  PROMPT_TEXT,
  PROMPT_OPTIONS,
  PROMPT_RESPONSE,
  PROMPT_ACTIVE,
} from "../state/prompt";
import {
  doString,
  setGlobalFn,
  pushValue,
  readValue,
  readTable,
  readArray,
  refValue,
  pushRef,
  isNilOrNone,
} from "./fengari-helpers";

const {
  lua_pushvalue,
  lua_pop,
  lua_tojsstring,
  lua_tonumber,
  lua_pcall,
  lua_type,
  LUA_OK,
  LUA_TTABLE,
} = lua;

// ---------------------------------------------------------------------------
// Module-level context for Lua API functions
// ---------------------------------------------------------------------------

let _currentEntity: Entity | null = null;
let _currentTime = 0;
let _currentOrigin: EventOrigin = "local";

// ---------------------------------------------------------------------------
// LuaBehavior
// ---------------------------------------------------------------------------

/**
 * Implements Behavior interface using Lua script handlers.
 * Each script compiles to one LuaBehavior.
 */
export class LuaBehavior implements Behavior {
  readonly eventTypes: Set<string> = new Set();
  private handlers: Map<string, Array<(eventData: Record<string, unknown>) => void>> = new Map();
  private L: LuaState;
  private _random: () => number;
  private _getStopFlag: () => boolean = () => false;
  private _setStopFlag: (val: boolean) => void = () => {};

  /**
   * Pending coroutine resume function. When a Lua handler yields (via
   * move_to, say, wait, prompt, etc.), this stores the function to call
   * when the resume condition is met.
   */
  private _pendingResume: ((response: unknown) => void) | null = null;

  /**
   * Checked each tick while a coroutine is suspended. Returns a truthy
   * value (passed back to the coroutine) when the action is complete,
   * or undefined to keep waiting.
   */
  private _resumeCondition: ((entity: Entity, time: number) => unknown) | null = null;

  /** Origin of the event that caused the current yield (preserved across ticks). */
  private _suspendedOrigin: EventOrigin = "local";

  constructor(L: LuaState, random: () => number) {
    this.L = L;
    this._random = random;
  }

  /** Install __prng_random global for a given PRNG function. */
  static installPrng(L: LuaState, random: () => number): void {
    setGlobalFn(L, "__prng_random", (L) => {
      const r = random();
      if (isNilOrNone(L, 1)) {
        pushValue(L, r);
      } else if (isNilOrNone(L, 2)) {
        const n = lua_tonumber(L, 1);
        pushValue(L, Math.floor(r * n) + 1);
      } else {
        const m = lua_tonumber(L, 1);
        const n = lua_tonumber(L, 2);
        pushValue(L, Math.floor(r * (n - m + 1)) + m);
      }
      return 1;
    });
  }

  /** Called during script initialization by the on() Lua function. */
  registerHandler(eventType: string, handler: (eventData: Record<string, unknown>) => void): void {
    let list = this.handlers.get(eventType);
    if (!list) {
      list = [];
      this.handlers.set(eventType, list);
    }
    list.push(handler);
    this.eventTypes.add(eventType);
  }

  /** Called by off() Lua function. */
  unregisterHandler(eventType: string, hasHandler?: boolean): void {
    const list = this.handlers.get(eventType);
    if (!list) return;
    if (hasHandler) {
      // Can't match Lua function refs across boundary — remove last handler
      list.pop();
    } else {
      // No handler specified — remove all handlers for this event type
      list.length = 0;
    }
    if (list.length === 0) {
      this.handlers.delete(eventType);
      this.eventTypes.delete(eventType);
    }
  }

  /** @internal */
  _setStopFlagGetter(fn: () => boolean): void {
    this._getStopFlag = fn;
  }

  /** @internal */
  _setStopFlagSetter(fn: (val: boolean) => void): void {
    this._setStopFlag = fn;
  }

  /** Check whether this behavior is blocked waiting for a prompt response. */
  get pendingPrompt(): boolean {
    return this._pendingResume !== null;
  }

  /** Behavior interface: handle an event. */
  handle(entity: Entity, event: Event): void {
    const time = event instanceof DataEvent ? event.time : performance.now();
    const origin = event instanceof DataEvent ? event.origin : "local";

    // --- Yield resume on tick ---
    if (this._pendingResume && event.type === "tick") {
      if (this._resumeCondition) {
        const result = this._resumeCondition(entity, time);
        if (result !== undefined && result !== false) {
          this._resumeCondition = null;
          this._resumeCoroutine(entity, time, result);
        }
      }
      return;
    }

    // If blocked on a yield, skip all non-tick events
    if (this._pendingResume) return;

    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.length === 0) return;

    // Set module-level context
    const prevEntity = _currentEntity;
    const prevTime = _currentTime;
    const prevOrigin = _currentOrigin;

    _currentEntity = entity;
    _currentTime = time;
    _currentOrigin = origin;

    // Install API functions that reference current context
    this.installApiGlobals(entity);
    this.installSelfGlobals(entity);

    try {
      // Build event data table for the handler
      const eventData: Record<string, unknown> = { type: event.type };
      if (event instanceof DataEvent) {
        eventData.time = event.time;
        for (const [k, v] of event.data) {
          eventData[k] = v;
        }
      }

      for (const handler of handlers) {
        try {
          handler(eventData);
        } catch (e) {
          console.warn("Lua handler error:", e);
        }

        // If handler yielded for a prompt, stop processing further handlers
        if (this._pendingResume) break;

        // Check stop flag
        if (this._getStopFlag()) {
          this._setStopFlag(false);
          event.stop();
          break;
        }
      }
    } finally {
      _currentEntity = prevEntity;
      _currentTime = prevTime;
      _currentOrigin = prevOrigin;
    }
  }

  // -----------------------------------------------------------------------
  // Self table — metatable proxy via Lua
  // -----------------------------------------------------------------------

  private installSelfGlobals(entity: Entity): void {
    const L = this.L;

    setGlobalFn(L, "__self_get", (L) => {
      const key = lua_tojsstring(L, 1);
      if (key === "x") {
        const pos = entity.get<{ x: number; y: number }>(POSITION);
        if (pos === undefined) { pushValue(L, undefined); return 1; }
        pushValue(L, pos.x);
        return 1;
      }
      if (key === "y") {
        const pos = entity.get<{ x: number; y: number }>(POSITION);
        if (pos === undefined) { pushValue(L, undefined); return 1; }
        pushValue(L, pos.y);
        return 1;
      }
      if (key === "direction") {
        pushValue(L, entity.get(DIRECTION));
        return 1;
      }
      pushValue(L, entity.get(key));
      return 1;
    });

    setGlobalFn(L, "__self_set", (L) => {
      const key = lua_tojsstring(L, 1);
      const value = readValue(L, 2);
      if (key === "x") {
        const pos = entity.get<{ x: number; y: number }>(POSITION) ?? { x: 0, y: 0 };
        entity.set(POSITION, { ...pos, x: value as number });
      } else if (key === "y") {
        const pos = entity.get<{ x: number; y: number }>(POSITION) ?? { x: 0, y: 0 };
        entity.set(POSITION, { ...pos, y: value as number });
      } else if (key === "direction") {
        entity.set(DIRECTION, value);
      } else {
        entity.set(key, value);
      }
      return 0;
    });

    doString(L, `
      self = setmetatable({}, {
        __index = function(t, key)
          return __self_get(key)
        end,
        __newindex = function(t, key, value)
          __self_set(key, value)
        end
      })
    `);
  }

  // -----------------------------------------------------------------------
  // API globals
  // -----------------------------------------------------------------------

  private installApiGlobals(_entity: Entity): void {
    const L = this.L;

    // Install this behavior's PRNG for math.random and chance()
    LuaBehavior.installPrng(L, this._random);

    setGlobalFn(L, "__move_to_request", (L) => {
      const x = lua_tonumber(L, 1);
      const y = lua_tonumber(L, 2);
      if (!_currentEntity) return 0;
      const data = new Map<string, number | string>();
      data.set("x", x);
      data.set("y", y);
      _currentEntity.emit(new DataEvent("moveTo", data, _currentTime, _currentOrigin));
      this._resumeCondition = (entity) => {
        return !entity.get(MOVE_TARGET) && !entity.get(PATH) ? true : undefined;
      };
      return 0;
    });

    setGlobalFn(L, "animate", (L) => {
      const target = lua_tojsstring(L, 1);
      if (!_currentEntity) return 0;
      const data = new Map<string, number | string>();
      data.set("target", target);
      _currentEntity.emit(new DataEvent("target", data, _currentTime, _currentOrigin));
      return 0;
    });

    setGlobalFn(L, "emit", (L) => {
      const type = lua_tojsstring(L, 1);
      if (!_currentEntity) return 0;
      const data = new Map<string, number | string>();
      if (!isNilOrNone(L, 2) && lua_type(L, 2) === LUA_TTABLE) {
        const tbl = readTable(L, 2);
        for (const [k, v] of Object.entries(tbl)) {
          if (typeof v === "number" || typeof v === "string") {
            data.set(k, v);
          }
        }
      }
      _currentEntity.emit(new DataEvent(type, data, _currentTime, _currentOrigin));
      return 0;
    });

    setGlobalFn(L, "find_best_tile", (L) => {
      if (!_currentEntity) return 0;
      const range = lua_tonumber(L, 1);
      const pos = _currentEntity.get<{ x: number; y: number }>(POSITION);
      const map = _currentEntity.find<AttributeMap>(ATTRIBUTE_MAP);
      if (!pos || !map) return 0;

      const weights = isNilOrNone(L, 2) || lua_type(L, 2) !== LUA_TTABLE
        ? {}
        : readTable(L, 2) as Record<string, number>;
      const weightEntries = Object.entries(weights);

      let bestScore = -Infinity;
      let bestX = 0;
      let bestY = 0;
      let found = false;

      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          if (dx === 0 && dy === 0) continue;
          const tx = pos.x + dx;
          const ty = pos.y + dy;
          if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;

          let score = 0;
          for (const [attr, weight] of weightEntries) {
            score += (weight as number) * map.get(attr, tx, ty);
          }
          if (score > bestScore) {
            bestScore = score;
            bestX = tx;
            bestY = ty;
            found = true;
          }
        }
      }

      if (!found) return 0;
      const result: Record<string, number> = { x: bestX, y: bestY };
      for (const [attr] of weightEntries) {
        result[attr] = map.get(attr, bestX, bestY);
      }
      pushValue(L, result);
      return 1;
    });

    setGlobalFn(L, "find_matching_tile", (L) => {
      if (!_currentEntity) return 0;
      const range = lua_tonumber(L, 1);
      const pos = _currentEntity.get<{ x: number; y: number }>(POSITION);
      const map = _currentEntity.find<AttributeMap>(ATTRIBUTE_MAP);
      if (!pos || !map) return 0;

      const matchers = isNilOrNone(L, 2) || lua_type(L, 2) !== LUA_TTABLE
        ? {}
        : readTable(L, 2) as Record<string, { comparison: string; value: number }>;
      const matcherEntries = Object.entries(matchers);

      let bestDist = Infinity;
      let foundX = 0;
      let foundY = 0;
      let found = false;

      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          if (dx === 0 && dy === 0) continue;
          const tx = pos.x + dx;
          const ty = pos.y + dy;
          if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;

          let meetsAll = true;
          for (const [attr, m] of matcherEntries) {
            const val = map.get(attr, tx, ty);
            if (!matchComparison(val, m.comparison, m.value)) {
              meetsAll = false;
              break;
            }
          }

          if (meetsAll) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < bestDist) {
              bestDist = dist;
              foundX = tx;
              foundY = ty;
              found = true;
            }
          }
        }
      }

      if (!found) return 0;
      const result: Record<string, number> = { x: foundX, y: foundY };
      for (const [attr] of matcherEntries) {
        result[attr] = map.get(attr, foundX, foundY);
      }
      pushValue(L, result);
      return 1;
    });

    setGlobalFn(L, "find_nearest", (L) => {
      if (!_currentEntity) return 0;
      const range = lua_tonumber(L, 1);
      const pos = _currentEntity.get<{ x: number; y: number }>(POSITION);
      if (!pos) return 0;
      const parent = _currentEntity.parent;
      if (!parent) return 0;

      const match = isNilOrNone(L, 2) || lua_type(L, 2) !== LUA_TTABLE
        ? undefined
        : readTable(L, 2) as Record<string, unknown>;

      let bestDist = Infinity;
      let bestX = 0;
      let bestY = 0;
      let found = false;

      for (const child of parent.children) {
        if (child === _currentEntity) continue;
        const childPos = child.get<{ x: number; y: number }>(POSITION);
        if (!childPos) continue;

        const dx = childPos.x - pos.x;
        const dy = childPos.y - pos.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > range) continue;
        if (dist === 0) continue;

        if (match) {
          let matchesAll = true;
          for (const [key, expected] of Object.entries(match)) {
            const actual = child.get(key);
            if (actual !== expected) {
              matchesAll = false;
              break;
            }
          }
          if (!matchesAll) continue;
        }

        if (dist < bestDist) {
          bestDist = dist;
          bestX = childPos.x;
          bestY = childPos.y;
          found = true;
        }
      }

      if (!found) return 0;
      pushValue(L, { x: bestX, y: bestY, distance: bestDist });
      return 1;
    });

    setGlobalFn(L, "get_attribute", (L) => {
      const attr = lua_tojsstring(L, 1);
      const x = lua_tonumber(L, 2);
      const y = lua_tonumber(L, 3);
      if (!_currentEntity) { pushValue(L, 0); return 1; }
      const map = _currentEntity.find<AttributeMap>(ATTRIBUTE_MAP);
      if (!map) { pushValue(L, 0); return 1; }
      pushValue(L, map.get(attr, x, y));
      return 1;
    });

    setGlobalFn(L, "is_blocked", (L) => {
      const x = lua_tonumber(L, 1);
      const y = lua_tonumber(L, 2);
      if (!_currentEntity) { pushValue(L, false); return 1; }
      const grid = _currentEntity.find<BlockingGrid>(BLOCKING_GRID);
      if (!grid) { pushValue(L, false); return 1; }
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
        pushValue(L, true);
        return 1;
      }
      pushValue(L, (grid.edges[y * grid.width + x] & 0x0f) !== 0);
      return 1;
    });

    setGlobalFn(L, "__say_request", (L) => {
      const text = lua_tojsstring(L, 1);
      const bubble = isNilOrNone(L, 2) ? undefined : lua_tojsstring(L, 2);
      if (!_currentEntity) return 0;
      _currentEntity.set(SPEECH_TEXT, String(text));
      _currentEntity.set(
        SPEECH_BUBBLE,
        bubble === "thought" ? "thought" : "speech",
      );
      _currentEntity.set(SPEECH_START, _currentTime);
      _currentEntity.set(SPEECH_DURATION, DEFAULT_SPEECH_DURATION);
      const speechEnd = _currentTime + DEFAULT_SPEECH_DURATION;
      this._resumeCondition = (_entity, time) => {
        return time >= speechEnd ? true : undefined;
      };
      return 0;
    });

    // Prompt support — called from Lua prompt() function.
    // Returns true (1 value) when skipped (remote), 0 values when yielding.
    setGlobalFn(L, "__prompt_request", (L) => {
      // Remote events should not show prompts on the local client
      if (_currentOrigin === "remote") {
        pushValue(L, true);
        return 1;
      }
      const text = lua_tojsstring(L, 1);
      if (!_currentEntity) return 0;
      _currentEntity.set(PROMPT_TEXT, String(text));
      if (!isNilOrNone(L, 2) && lua_type(L, 2) === LUA_TTABLE) {
        const arr = readArray(L, 2);
        _currentEntity.set(PROMPT_OPTIONS, arr.length > 0 ? arr : null);
      } else {
        _currentEntity.set(PROMPT_OPTIONS, null);
      }
      _currentEntity.set(PROMPT_ACTIVE, true);
      this._resumeCondition = (entity) => {
        const response = entity.get<string>(PROMPT_RESPONSE);
        if (response !== undefined) {
          entity.delete(PROMPT_RESPONSE);
          entity.delete(PROMPT_ACTIVE);
          entity.delete(PROMPT_TEXT);
          entity.delete(PROMPT_OPTIONS);
          return response;
        }
        return undefined;
      };
      return 0;
    });

    // Wait support — called from Lua wait() function
    setGlobalFn(L, "__wait_request", (L) => {
      const ms = lua_tonumber(L, 1);
      const wakeTime = _currentTime + ms;
      this._resumeCondition = (_entity, time) => {
        return time >= wakeTime ? true : undefined;
      };
      return 0;
    });

    // Called from Lua coroutine wrapper when handler yields.
    // Stack: [1] = Lua function to call later with the response string.
    setGlobalFn(L, "__behavior_yield", (L) => {
      lua_pushvalue(L, 1); // copy function to top
      const ref = refValue(L);
      this._setPendingResume((response: unknown) => {
        pushRef(L, ref);
        pushValue(L, response);
        const status = lua_pcall(L, 1, 0, 0);
        if (status !== LUA_OK) {
          const msg = lua_tojsstring(L, -1);
          lua_pop(L, 1);
          console.warn("Lua resume error:", msg);
        }
        // Don't unref — the resume callback may re-yield, creating a new ref.
        // The old ref becomes garbage once the coroutine finishes.
      });
      return 0;
    });

    setGlobalFn(L, "time", (callL) => {
      pushValue(callL, _currentTime);
      return 1;
    });

    setGlobalFn(L, "chance", (L) => {
      const p = lua_tonumber(L, 1);
      pushValue(L, this._random() < p);
      return 1;
    });
  }

  private _resumeCoroutine(entity: Entity, time: number, value: unknown): void {
    const prevEntity = _currentEntity;
    const prevTime = _currentTime;
    const prevOrigin = _currentOrigin;
    _currentEntity = entity;
    _currentTime = time;
    _currentOrigin = this._suspendedOrigin;
    this.installApiGlobals(entity);
    this.installSelfGlobals(entity);

    try {
      const resume = this._pendingResume!;
      this._pendingResume = null;
      resume(value);
    } finally {
      _currentEntity = prevEntity;
      _currentTime = prevTime;
      _currentOrigin = prevOrigin;
    }
  }

  /** @internal Set the pending resume callback. */
  _setPendingResume(fn: ((response: unknown) => void) | null): void {
    this._pendingResume = fn;
    // Preserve origin across the yield so resumed code inherits it
    if (fn) {
      this._suspendedOrigin = _currentOrigin;
      this.eventTypes.add("tick");
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchComparison(
  val: number | string | undefined,
  comparison: string,
  target: number | string,
): boolean {
  if (val === undefined) return false;
  switch (comparison) {
    case "gte": return val >= target;
    case "lte": return val <= target;
    case "gt": return val > target;
    case "lt": return val < target;
    case "eq": return val === target;
    case "neq": return val !== target;
    default: return false;
  }
}
