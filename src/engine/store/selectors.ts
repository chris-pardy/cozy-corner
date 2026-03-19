import {
  selectById as adapterSelectById,
  selectAll as adapterSelectAll,
  type EntityRecord,
} from "./entitySlice";
import type { RootState } from "./store";

/** Select a single entity record by ID. */
export function selectEntityById(
  state: RootState,
  id: string,
): EntityRecord | undefined {
  return adapterSelectById(state.entities, id);
}

/** Select all entity records. */
export function selectAllEntities(state: RootState): EntityRecord[] {
  return adapterSelectAll(state.entities);
}

/**
 * Cast an entity's state bag to a typed mixin interface.
 * This is a TypeScript-level convenience — the Redux store remains untyped.
 */
export function selectAs<T>(
  state: RootState,
  id: string,
): T | undefined {
  const entity = selectEntityById(state, id);
  return entity?.state as unknown as T | undefined;
}

/**
 * Walk up the entity tree to find the nearest ancestor (including self)
 * with the given state key. Mirrors Entity.find().
 */
export function selectFind<T>(
  state: RootState,
  id: string,
  key: string,
): T | undefined {
  let currentId: string | null = id;
  while (currentId) {
    const entity = selectEntityById(state, currentId);
    if (!entity) break;
    if (key in entity.state) return entity.state[key] as T;
    currentId = entity.parentId;
  }
  return undefined;
}

/** Select the child IDs of an entity. */
export function selectChildIds(
  state: RootState,
  id: string,
): string[] {
  return selectEntityById(state, id)?.childIds ?? [];
}

/** Room config selectors. */
export function selectRoomConfig(state: RootState) {
  return state.room;
}

/** Count of online players (local + remote entities in Redux state). */
export function selectOnlineCount(state: RootState): number {
  let count = 1; // local player
  for (const id of state.entities.ids) {
    if (
      typeof id === "string" &&
      id.startsWith("remote:") &&
      !id.includes(":layer")
    ) {
      count++;
    }
  }
  return count;
}
