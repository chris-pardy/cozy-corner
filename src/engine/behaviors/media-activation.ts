import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import type { Event } from "../event";
import { DataEvent } from "../event";
import {
  ACTIVATION_MEDIA_URL,
  ACTIVATION_MEDIA_MIME,
} from "../state/activation";

/**
 * Handles activation on items with a media action.
 *
 * Reads {@link ACTIVATION_MEDIA_URL} and {@link ACTIVATION_MEDIA_MIME}
 * from the entity to determine the media type:
 *
 * - `image/*` → `{ type: "image" }` — shown in a modal
 * - `video/*` → `{ type: "video" }` — shown in a modal
 * - `audio/*` → `{ type: "audio" }` — plays inline (no modal)
 *
 * Emits an "activate-response" DataEvent with `{ type, url }`.
 */
export class MediaActivationBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["activate"]);

  handle(entity: Entity, event: Event): void {
    if ((event as DataEvent).origin === "remote") return;

    const url = entity.get<string>(ACTIVATION_MEDIA_URL);
    const mime = entity.get<string>(ACTIVATION_MEDIA_MIME);
    if (!url || !mime) return;

    let responseType: string;
    if (mime.startsWith("audio/")) {
      responseType = "audio";
    } else if (mime.startsWith("video/")) {
      responseType = "video";
    } else {
      responseType = "image";
    }

    entity.emit(new DataEvent("activate-response", { type: responseType, url }, (event as DataEvent).time));
    event.stop();
  }
}
