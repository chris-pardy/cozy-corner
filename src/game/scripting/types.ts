import type { Dispatch } from "@reduxjs/toolkit";
import type { RootState } from "../selectors";

/** API handle that script code uses to interact with the game store. */
export interface ScriptAPI {
  dispatch: Dispatch;
  getState: () => RootState;
  entityId: string;
}

/** A loaded behavior attached to a single entity. */
export interface ScriptHandle {
  entityId: string;
  /** Deliver an event to this script's registered handlers. */
  emit(event: string, data: Record<string, string>): void;
  /** Advance per-tick handlers. */
  tick(): void;
  /** Release resources. */
  dispose(): void;
}

/** Pluggable script runtime — owns the Lua VM and manages per-entity scripts. */
export interface ScriptRuntime {
  /**
   * Compile and attach a behavior script to an entity.
   * The script's top-level code runs immediately (registers `on` handlers).
   */
  load(entityId: string, code: string, api: ScriptAPI): ScriptHandle;
  /** Tear down the entire runtime (all scripts). */
  dispose(): void;
}
