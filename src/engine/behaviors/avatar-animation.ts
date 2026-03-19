import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import type { Event } from "../event";
import { DataEvent } from "../event";
import { ANIM_STATE, DIRECTION, directionName } from "../state/movement";

/**
 * Default avatar animation behavior.
 *
 * Maps entity ANIM_STATE + DIRECTION → "target" DataEvent.
 * E.g. state="walk" + direction=2 (north) → target="walk-north".
 *
 * Responds to "walk" and "idle" events emitted by MovementBehavior.
 * Emits a "target" DataEvent on the entity, then stops the original
 * event to prevent further propagation.
 *
 * Place after any custom animation behaviors from the base avatar
 * so they can override by handling and stopping the event first.
 */
export class AvatarAnimationBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["walk", "idle"]);

  handle(entity: Entity, event: Event): void {
    const de = event as DataEvent;
    const state = entity.get<string>(ANIM_STATE) ?? "idle";
    const direction = entity.get<number>(DIRECTION) ?? 0;
    const target = `${state}-${directionName(direction)}`;

    entity.emit(new DataEvent("target", { target }, de.time, de.origin));
    event.stop();
  }
}
