import type { Behavior } from "./behavior";
import type { Event } from "./event";
import { DataEvent } from "./event";
import type { RoomStore } from "./store/store";
import { setState, dataEvent } from "./store/actions";
import { selectById } from "./store/entitySlice";

// ---------------------------------------------------------------------------
// Emit safety limits
// ---------------------------------------------------------------------------

/**
 * Maximum synchronous emit recursion depth. Prevents stack overflow from
 * behaviors that re-emit the same (or chained) events, e.g.:
 *   on tick → emit tick  (self-trigger)
 *   on A → emit B, on B → emit A  (ping-pong)
 *
 * Legitimate chains (tick → seek → moveTo → walk) are ~4 deep.
 * 64 is generous for any realistic pattern while catching runaway recursion.
 */
const MAX_EMIT_DEPTH = 64;

/**
 * Maximum total events processed per frame. Prevents a single behavior from
 * flooding the event system and starving the render loop, e.g.:
 *   on tick → emit 1000 events, each triggering more emissions
 *
 * Reset at the start of each frame via resetEventBudget().
 */
const MAX_EVENTS_PER_FRAME = 10_000;

let emitDepth = 0;
let eventBudget = 0;

/** Reset the per-frame event budget. Call once at the start of each frame. */
export function resetEventBudget(): void {
  eventBudget = 0;
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export class Entity {
  readonly id: string;
  private readonly state = new Map<string, unknown>();
  readonly behaviors: Behavior[];
  readonly children: Entity[] = [];
  parent: Entity | null = null;

  constructor(behaviors: Behavior[] = [], id: string = "") {
    this.id = id;
    this.behaviors = behaviors;
  }

  get<T = unknown>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  /** Walk up the entity tree to find the nearest ancestor (including self) with this key. */
  find<T = unknown>(key: string): T | undefined {
    const value = this.state.get(key);
    if (value !== undefined) return value as T;
    return this.parent?.find<T>(key);
  }

  set(key: string, value: unknown): void {
    this.state.set(key, value);
  }

  delete(key: string): boolean {
    return this.state.delete(key);
  }

  addChild(child: Entity): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
  }

  removeChild(child: Entity): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  emit(event: Event): void {
    // Safety: bail if recursion too deep or frame budget exhausted
    if (emitDepth >= MAX_EMIT_DEPTH || eventBudget >= MAX_EVENTS_PER_FRAME) {
      return;
    }
    emitDepth++;
    eventBudget++;
    try {
      for (const behavior of this.behaviors) {
        if (event.stopped) break;
        if (behavior.eventTypes.has(event.type)) {
          behavior.handle(this, event);
        }
      }
      // DataEvents propagate to children when not consumed
      if (!event.stopped && event instanceof DataEvent) {
        for (const child of this.children) {
          child.emit(event);
        }
      }
    } finally {
      emitDepth--;
    }
  }
}

// ---------------------------------------------------------------------------
// ReduxEntity — bridges old Entity API to Redux store
// ---------------------------------------------------------------------------

/**
 * Entity subclass that reads/writes state through Redux instead of a local Map.
 * Provides backward compatibility: behaviors still call entity.get/set/find/emit
 * and those calls are routed through the Redux store.
 *
 * RenderEvents still use the old Entity.emit() path (they don't go through Redux).
 */
export class ReduxEntity extends Entity {
  private readonly store: RoomStore;

  constructor(behaviors: Behavior[], id: string, store: RoomStore) {
    super(behaviors, id);
    this.store = store;
  }

  override get<T = unknown>(key: string): T | undefined {
    const record = selectById(this.store.getState().entities, this.id);
    return record?.state[key] as T | undefined;
  }

  override set(key: string, value: unknown): void {
    // Dual-write: update both local Entity map (for RenderEvent compat)
    // and Redux store
    super.set(key, value);
    this.store.dispatch(setState({ entityId: this.id, key, value }));
  }

  override delete(key: string): boolean {
    const result = super.delete(key);
    // Set to undefined in Redux to mirror deletion
    this.store.dispatch(setState({ entityId: this.id, key, value: undefined }));
    return result;
  }

  override find<T = unknown>(key: string): T | undefined {
    // Walk Redux parent chain
    let currentId: string | null = this.id;
    while (currentId) {
      const record = selectById(this.store.getState().entities, currentId);
      if (!record) break;
      if (key in record.state && record.state[key] !== undefined) {
        return record.state[key] as T;
      }
      currentId = record.parentId;
    }
    return undefined;
  }

  override emit(event: Event): void {
    if (event instanceof DataEvent) {
      // Route DataEvents through Redux middleware
      const data: Record<string, number | string> = {};
      for (const [k, v] of event.data) {
        data[k] = v;
      }
      this.store.dispatch(
        dataEvent({
          entityId: this.id,
          type: event.type,
          data,
          time: event.time,
          origin: event.origin,
        }),
      );
      return;
    }
    // RenderEvents and other event types use the old path
    super.emit(event);
  }
}
