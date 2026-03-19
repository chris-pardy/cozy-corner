import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import type { LayerTint, Transform } from "~/atproto/generated/types/at/cozy-corner/defs";

/** Animation layers for this entity's sprite sheet. */
export const LAYERS = "engine:layers";

/** The sprite sheet image source. */
export const SPRITE_SHEET = "engine:spriteSheet";

/** Current animation target (e.g. "idle-south", "walk-north"). */
export const TARGET = "engine:target";

/** Timestamp (ms) when the current target started, for frame calculation. */
export const TARGET_START_TIME = "engine:targetStartTime";

export interface ChildRenderConfig {
  tints: LayerTint[];
  transform?: Transform;
}

/** Per-child render configuration (tints, transform) on a composite entity. */
export const CHILD_RENDER_CONFIG = "engine:childRenderConfig";

/**
 * Secondary sort key for y-sorted rendering. Higher values render later
 * (on top). Stable sort preserves children's insertion order for ties.
 *
 * Well-known values:
 * - BEHIND (-1): items behind avatars (RoomItem.foreground = 0)
 * - DEFAULT (0): avatars and other entities
 * - FRONT (1): items in front of avatars (RoomItem.foreground = 1)
 * - FOREGROUND_TILES (2): foreground tile row entities
 */
export const RENDER_ORDER = "engine:renderOrder";

export const RENDER_ORDER_BEHIND = -1;
export const RENDER_ORDER_DEFAULT = 0;
export const RENDER_ORDER_FRONT = 1;
export const RENDER_ORDER_FOREGROUND_TILES = 2;

/** Mixin interface for entities with render state. */
export interface RenderMixin {
  [LAYERS]: AnimationLayer[];
  [SPRITE_SHEET]: CanvasImageSource;
  [TARGET]: string;
  [TARGET_START_TIME]: number;
  [RENDER_ORDER]: number;
}
