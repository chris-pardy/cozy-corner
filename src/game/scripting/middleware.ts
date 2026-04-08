import type { Middleware } from "@reduxjs/toolkit";
import {
  TICK,
  INTERACT,
  MESSAGE,
  type InteractPayload,
  type MessagePayload,
  addEntity,
  removeEntity,
} from "../entity-slice";
import type { RootState } from "../selectors";
import type { ScriptHandle, ScriptRuntime, ScriptAPI } from "./types";

export interface ScriptEntry {
  entityId: string;
  code: string;
}

/**
 * Creates Redux middleware that bridges the store to a ScriptRuntime.
 *
 * - On `game/tick`: calls tick() on every loaded script.
 * - On `game/interact`: delivers "interact" event to the target entity's scripts.
 * - On `game/message`: delivers "message" event to the target entity's scripts.
 * - On `entities/addEntity`: auto-loads scripts if the action payload includes behaviors.
 * - On `entities/removeEntity`: disposes scripts for that entity.
 */
export function createScriptMiddleware(
  runtime: ScriptRuntime,
  initialScripts: ScriptEntry[] = [],
): Middleware {
  const handles: Map<string, ScriptHandle[]> = new Map();

  function loadScripts(
    entityId: string,
    codes: string[],
    api: ScriptAPI,
  ) {
    const list: ScriptHandle[] = [];
    for (const code of codes) {
      list.push(runtime.load(entityId, code, api));
    }
    handles.set(entityId, list);
  }

  function disposeEntity(entityId: string) {
    const list = handles.get(entityId);
    if (list) {
      for (const h of list) h.dispose();
      handles.delete(entityId);
    }
  }

  return (storeApi) => {
    // Load initial scripts once the store is ready.
    // We defer to a microtask so the store is fully constructed.
    queueMicrotask(() => {
      const api: ScriptAPI = {
        dispatch: storeApi.dispatch,
        getState: storeApi.getState as () => RootState,
        entityId: "", // overridden per-entity
      };
      for (const entry of initialScripts) {
        loadScripts(entry.entityId, [entry.code], {
          ...api,
          entityId: entry.entityId,
        });
      }
    });

    return (next) => (action: any) => {
      const result = next(action);
      const state = storeApi.getState() as RootState;

      // --- tick: advance all scripts ---
      if (action.type === TICK) {
        for (const list of handles.values()) {
          for (const h of list) h.tick();
        }
        return result;
      }

      // --- interact: deliver to target ---
      if (action.type === INTERACT) {
        const payload = action.payload as InteractPayload;
        const list = handles.get(payload.targetId);
        if (list) {
          for (const h of list) {
            h.emit("interact", { sourceId: payload.sourceId });
          }
        }
        return result;
      }

      // --- message: deliver to target ---
      if (action.type === MESSAGE) {
        const payload = action.payload as MessagePayload;
        const list = handles.get(payload.toId);
        if (list) {
          for (const h of list) {
            h.emit("message", {
              fromId: payload.fromId,
              name: payload.name,
              ...payload.data,
            });
          }
        }
        return result;
      }

      // --- entity removed: dispose scripts ---
      if (removeEntity.match(action)) {
        disposeEntity(action.payload as string);
        return result;
      }

      // --- entity added with __behaviors metadata: auto-load ---
      if (addEntity.match(action)) {
        const entity = action.payload;
        const behaviors = entity.state.__behaviors;
        if (behaviors) {
          try {
            const codes: string[] = JSON.parse(behaviors);
            if (Array.isArray(codes) && codes.length > 0) {
              const api: ScriptAPI = {
                dispatch: storeApi.dispatch,
                getState: storeApi.getState as () => RootState,
                entityId: entity.id,
              };
              loadScripts(entity.id, codes, api);
            }
          } catch {
            // invalid JSON — skip
          }
        }
      }

      return result;
    };
  };
}
