/** Offscreen canvas holding the light overlay at tile resolution. */
export const LIGHT_CANVAS = "engine:lightCanvas";

/** Whether the light overlay needs recomputation. */
export const LIGHT_DIRTY = "engine:lightDirty";

/** Light value at which a tile is fully illuminated (alpha = 0). */
export const MAX_LIGHT = 1;

/**
 * Quantized alpha steps for retro pixel art lighting.
 * Maps continuous light values to discrete darkness levels.
 */
export const LIGHT_STEPS = [255, 204, 153, 102, 51, 0] as const;

/** Sub-pixels per tile for the light canvas. Higher = smoother circle edges. */
export const LIGHT_RESOLUTION = 4;

/** Mixin interface for entities with light overlay state. */
export interface LightMixin {
  [LIGHT_CANVAS]: OffscreenCanvas;
  [LIGHT_DIRTY]: boolean;
}
