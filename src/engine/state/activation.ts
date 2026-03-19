import type { ServiceHandler } from "~/atproto/generated/types/at/cozy-corner/settings";

// ---------------------------------------------------------------------------
// ActivationRequest — what the UI layer should do after an activation
// ---------------------------------------------------------------------------

export type ActivationRequest =
  | { type: "iframe"; url: string }
  | { type: "image"; url: string }
  | { type: "video"; url: string }
  | { type: "audio"; url: string };

// ---------------------------------------------------------------------------
// State keys — set on item entities when wiring up room items
// ---------------------------------------------------------------------------

/** AT URI for a link action (from linkAction.uri or roomItem.actionUri). */
export const ACTIVATION_LINK_URI = "engine:activationLinkUri";

/** Blob URL for a media action (pre-resolved from BlobRef + DID + PDS). */
export const ACTIVATION_MEDIA_URL = "engine:activationMediaUrl";

/** MIME type of the media blob (e.g. "image/png", "video/mp4", "audio/mpeg"). */
export const ACTIVATION_MEDIA_MIME = "engine:activationMediaMime";

/**
 * Service handlers from the viewer's settings.
 * Set on the room/root entity so item entities can find() them.
 */
export const SERVICE_HANDLERS = "engine:serviceHandlers";

// ---------------------------------------------------------------------------
// Default service handlers — used when the user has no settings
// ---------------------------------------------------------------------------

export const DEFAULT_SERVICE_HANDLERS: ServiceHandler[] = [
  {
    collection: "app.bsky.feed.post",
    urlTemplate: "https://bsky.app/profile/{{authority}}/post/{{key}}",
  },
  {
    collection: "com.whtwnd.blog.entry",
    urlTemplate: "https://whtwnd.com/{{authority}}/{{key}}",
  },
];

// ---------------------------------------------------------------------------
// AT URI resolution
// ---------------------------------------------------------------------------

const AT_URI_RE = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/;

/**
 * Parse an AT URI into its components.
 * Returns null if the URI doesn't match the expected format.
 */
export function parseAtUri(
  uri: string,
): { authority: string; collection: string; key: string } | null {
  const m = uri.match(AT_URI_RE);
  if (!m) return null;
  return { authority: m[1], collection: m[2], key: m[3] };
}

/**
 * Resolve an AT URI to an embeddable URL using the provided service handlers.
 * Falls back to {@link DEFAULT_SERVICE_HANDLERS} when no match is found in
 * the primary list.
 *
 * Returns null if no handler matches the URI's collection.
 */
export function resolveAtUri(
  uri: string,
  handlers: ServiceHandler[],
): string | null {
  const parsed = parseAtUri(uri);
  if (!parsed) return null;

  const handler =
    handlers.find((h) => h.collection === parsed.collection) ??
    DEFAULT_SERVICE_HANDLERS.find((h) => h.collection === parsed.collection);

  if (handler) {
    return handler.urlTemplate
      .replace("{{authority}}", parsed.authority)
      .replace("{{collection}}", parsed.collection)
      .replace("{{key}}", parsed.key);
  }

  // Default handler for at.cozy-corner.* records — open in-app
  if (parsed.collection.startsWith("at.cozy-corner.")) {
    return `/${parsed.authority}/${parsed.collection}/${parsed.key}`;
  }

  return null;
}

/** Mixin interface for entities with activation state. */
export interface ActivationMixin {
  [ACTIVATION_LINK_URI]: string;
  [ACTIVATION_MEDIA_URL]: string;
  [ACTIVATION_MEDIA_MIME]: string;
}

/** Mixin interface for entities with service handlers. */
export interface ServiceHandlersMixin {
  [SERVICE_HANDLERS]: ServiceHandler[];
}
