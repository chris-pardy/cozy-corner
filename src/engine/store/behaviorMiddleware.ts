import type { Middleware } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { dataEvent } from "./actions";
import { selectById } from "./entitySlice";
import type { ReduxEntity } from "../entity";
import { DataEvent } from "../event";

/**
 * Creates a single Redux middleware that replicates Entity.emit() behavior dispatch.
 *
 * On each `dataEvent` action:
 * 1. Looks up the target entity from the registry
 * 2. Walks entity's behaviors in order, calling handle() for type matches
 * 3. If a behavior calls event.stop(), stops processing further behaviors
 *    AND prevents propagation to children
 * 4. If not stopped, propagates to children (same as DataEvent propagation)
 *
 * When behaviors call entity.set() -> dispatches setState action (goes to reducer)
 * When behaviors call entity.emit() -> dispatches new dataEvent action (re-enters middleware)
 */
export function createBehaviorMiddleware(
  entityRegistry: Map<string, ReduxEntity>,
): Middleware<object, RootState> {
  return (store) => (next) => (action) => {
    if (!dataEvent.match(action)) return next(action);

    const { entityId, type, data, time, origin } = action.payload;

    function processEntity(id: string): void {
      const entity = entityRegistry.get(id);
      if (!entity) return;

      // Create a synthetic DataEvent for the behavior
      const event = new DataEvent(type, data, time, origin ?? "local");

      // Run behaviors in order (same as current Entity.emit)
      for (const behavior of entity.behaviors) {
        if (event.stopped) break;
        if (behavior.eventTypes.has(type)) {
          behavior.handle(entity, event);
        }
      }

      // If stopped, don't propagate to children
      if (event.stopped) return;

      // Propagate to children (same as DataEvent propagation in Entity.emit)
      const record = selectById(store.getState().entities, id);
      if (record) {
        for (const childId of record.childIds) {
          processEntity(childId);
        }
      }
    }

    processEntity(entityId);

    // Pass through to next middleware / reducer
    return next(action);
  };
}
