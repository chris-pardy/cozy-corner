import type { Container, Sprite, Texture } from "pixi.js";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";

export interface LayerStackState {
  /** The pixi container holding all layer sprites. */
  container: Container;
  /** Per-layer sprite data for frame updates. */
  entries: LayerEntry[];
  /** Current animation target (e.g. "walk-south"). */
  target: string;
  /** Timestamp when the current target started. */
  targetStartTime: number;
}

interface LayerEntry {
  sprite: Sprite;
  layer: AnimationLayer;
  /** Base texture for creating frame sub-textures. */
  baseTexture: Texture;
}

/**
 * Parse a hex color string (#rgb or #rrggbb) to a 0xRRGGBB number for pixi tinting.
 */
function hexToTint(hex: string): number {
  let h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return parseInt(h, 16);
}

/**
 * Create a pixi Container with child sprites for the animation layers
 * matching the given target. Each layer becomes a Sprite with the correct
 * sub-texture for its current frame.
 */
export async function createLayerStack(
  spriteSheet: CanvasImageSource,
  layers: AnimationLayer[],
  target: string,
  targetStartTime: number,
  tileSize: number | undefined,
  tintMap: ReadonlyMap<string, string>,
): Promise<LayerStackState> {
  const { Container, Sprite, Texture, Rectangle } = await import("pixi.js");

  const container = new Container();
  const entries: LayerEntry[] = [];

  const baseTexture = Texture.from(spriteSheet as HTMLImageElement);

  for (const layer of layers) {
    if (layer.target !== target) continue;

    const frame = layer.frames[0];
    if (!frame) continue;

    const fw = frame.width;
    const fh = frame.height;

    const tex = new Texture({
      source: baseTexture.source,
      frame: new Rectangle(frame.x, frame.y, fw, fh),
    });

    const sprite = new Sprite(tex);

    // Scale sprite to tile size
    const scale = tileSize ? tileSize / Math.min(fw, fh) : 1;
    sprite.width = fw * scale;
    sprite.height = fh * scale;

    // Apply channel-based tint
    if (layer.colorChannel) {
      const tint = tintMap.get(layer.colorChannel);
      if (tint) {
        sprite.tint = hexToTint(tint);
      }
    }

    container.addChild(sprite);
    entries.push({ sprite, layer, baseTexture });
  }

  return { container, entries, target, targetStartTime };
}

/**
 * Update layer stack sprites for the current time.
 * Advances animation frames based on elapsed time.
 */
export function updateLayerStack(
  state: LayerStackState,
  time: number,
): void {
  const elapsedMS = time - state.targetStartTime;

  for (const entry of state.entries) {
    const { sprite, layer } = entry;
    const frameIndex =
      Math.floor(elapsedMS / layer.frameRate) % layer.frames.length;
    const frame = layer.frames[frameIndex];

    // Update texture frame if it changed
    const currentFrame = sprite.texture.frame;
    if (currentFrame.x !== frame.x || currentFrame.y !== frame.y) {
      currentFrame.x = frame.x;
      currentFrame.y = frame.y;
      currentFrame.width = frame.width;
      currentFrame.height = frame.height;
      sprite.texture.updateUvs();
    }
  }
}

/**
 * Update tints on an existing layer stack from a channel tint map.
 */
export function updateLayerStackTints(
  state: LayerStackState,
  tintMap: ReadonlyMap<string, string>,
): void {
  for (const entry of state.entries) {
    if (entry.layer.colorChannel) {
      const tint = tintMap.get(entry.layer.colorChannel);
      entry.sprite.tint = tint ? hexToTint(tint) : 0xffffff;
    }
  }
}
