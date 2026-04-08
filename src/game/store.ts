import { configureStore } from "@reduxjs/toolkit";
import { cameraSlice } from "./camera-slice";
import { entitySlice } from "./entity-slice";
import { roomSlice } from "./room-slice";
import {
  createScriptMiddleware,
  type ScriptEntry,
} from "./scripting/middleware";
import { FengariRuntime } from "./scripting/fengari-runtime";
import type { ScriptRuntime } from "./scripting/types";

export interface CreateStoreOptions {
  /** Pre-loaded scripts to attach. */
  scripts?: ScriptEntry[];
  /** Override the script runtime (defaults to FengariRuntime). */
  scriptRuntime?: ScriptRuntime;
}

export function createGameStore(options: CreateStoreOptions = {}) {
  const runtime = options.scriptRuntime ?? new FengariRuntime();
  const scriptMiddleware = createScriptMiddleware(
    runtime,
    options.scripts ?? [],
  );

  const store = configureStore({
    reducer: {
      entities: entitySlice.reducer,
      room: roomSlice.reducer,
      cameras: cameraSlice.reducer,
    },
    middleware: (getDefault) =>
      getDefault({
        // Typed arrays in selectors trigger false positives.
        serializableCheck: false,
        immutableCheck: false,
      }).concat(scriptMiddleware),
  });

  return { store, runtime };
}

export type GameStore = ReturnType<typeof createGameStore>["store"];
export type GameState = ReturnType<GameStore["getState"]>;
export type GameDispatch = GameStore["dispatch"];
