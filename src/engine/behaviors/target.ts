import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import type { Event } from "../event";
import type { DataEvent } from "../event";
import { TARGET, TARGET_START_TIME } from "../state/render";

/**
 * Sets TARGET / TARGET_START_TIME on itself.
 * The "target" DataEvent auto-propagates to children via Entity.emit(),
 * so each child's TargetBehavior will also handle it.
 */
export class TargetBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["target"]);

  handle(entity: Entity, event: Event): void {
    const de = event as DataEvent;
    const target = de.data.get("target") as string;
    const { time } = de;
    if (entity.get<string>(TARGET) !== target) {
      entity.set(TARGET, target);
      entity.set(TARGET_START_TIME, time);
    }
  }
}
