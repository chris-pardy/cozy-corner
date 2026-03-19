import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import type { Event } from "../event";
import { DataEvent } from "../event";
import type { ServiceHandler } from "~/atproto/generated/types/at/cozy-corner/settings";
import {
  ACTIVATION_LINK_URI,
  SERVICE_HANDLERS,
  DEFAULT_SERVICE_HANDLERS,
  resolveAtUri,
} from "../state/activation";

/**
 * Handles activation on items with a link action.
 *
 * Reads {@link ACTIVATION_LINK_URI} from the entity and
 * {@link SERVICE_HANDLERS} from the nearest ancestor (or falls back to
 * {@link DEFAULT_SERVICE_HANDLERS}).
 *
 * Resolves the AT URI to an embeddable URL and emits an
 * "activate-response" DataEvent with `{ type: "iframe", url }`.
 */
export class LinkActivationBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["activate"]);

  handle(entity: Entity, event: Event): void {
    if ((event as DataEvent).origin === "remote") return;

    const uri = entity.get<string>(ACTIVATION_LINK_URI);
    if (!uri) return;

    const handlers = entity.find<ServiceHandler[]>(SERVICE_HANDLERS) ?? DEFAULT_SERVICE_HANDLERS;
    const url = resolveAtUri(uri, handlers);
    if (!url) return;

    entity.emit(new DataEvent("activate-response", { type: "iframe", url }, (event as DataEvent).time));
    event.stop();
  }
}
