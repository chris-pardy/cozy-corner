import type { Event } from "./event";
import type { Entity } from "./entity";

/** A stateless behavior that handles events on an entity. */
export interface Behavior {
  /** The set of event type strings this behavior handles. */
  readonly eventTypes: ReadonlySet<string>;
  /** Handle an event. All state lives on the entity via string keys. */
  handle(entity: Entity, event: Event): void;
}
