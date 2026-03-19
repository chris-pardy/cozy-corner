import { createAction } from "@reduxjs/toolkit";
import type { EntityRecord } from "./entitySlice";

/** Replaces DataEvent. Flows through middleware pipeline. */
export const dataEvent = createAction<{
  entityId: string;
  type: string;
  data: Record<string, number | string>;
  time: number;
  origin?: "local" | "remote";
}>("engine/dataEvent");

/** Replaces entity.set(). Goes to reducer, middleware can intercept. */
export const setState = createAction<{
  entityId: string;
  key: string;
  value: unknown;
}>("engine/setState");

/** Batch version for multiple state changes at once. */
export const setStates = createAction<{
  entityId: string;
  entries: Array<{ key: string; value: unknown }>;
}>("engine/setStates");

/** Structural: add an entity to the tree. */
export const addEntity = createAction<EntityRecord>("engine/addEntity");

/** Structural: remove an entity from the tree by ID. */
export const removeEntity = createAction<string>("engine/removeEntity");
