import { useRef, useEffect, useMemo } from "react";
import type {
  AnimationLayer,
  ChannelTint,
  Transform,
} from "~/atproto/generated/types/at/cozy-corner/defs";

export interface PreviewLayerInput {
  image: HTMLImageElement;
  layers: AnimationLayer[];
  tints?: ChannelTint[];
  transform?: Transform;
}

/**
 * Pixi-based animated sprite preview. Supports single sprites and
 * composite avatars (multiple layers with tints/transforms).
 *
 * Replaces the old Entity + RenderEvent pattern used in preview components.
 */
export function PixiSpritePreview({
  previewLayers,
  target,
  size = 192,
}: {
  previewLayers: PreviewLayerInput[];
  target: string;
  size?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<import("pixi.js").Application | null>(null);

  // Compute frame size from the matching layers for this target
  const frameSize = useMemo(() => {
    let w = 0;
    let h = 0;
    for (const pl of previewLayers) {
      for (const layer of pl.layers) {
        if (layer.target === target && layer.frames.length > 0) {
          w = Math.max(w, layer.frames[0].width);
          h = Math.max(h, layer.frames[0].height);
        }
      }
    }
    return { w: w || 1, h: h || 1 };
  }, [previewLayers, target]);

  const scale = Math.max(
    1,
    Math.floor(size / Math.max(frameSize.w, frameSize.h)),
  );
  const cw = frameSize.w * scale;
  const ch = frameSize.h * scale;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let app: import("pixi.js").Application | null = null;

    (async () => {
      const pixi = await import("pixi.js");

      if (destroyed) return;

      pixi.TextureSource.defaultOptions.scaleMode = "nearest";

      app = new pixi.Application();
      await app.init({
        width: cw,
        height: ch,
        antialias: false,
        roundPixels: true,
        backgroundAlpha: 0,
      });

      if (destroyed) { app.destroy(true); return; }

      container.appendChild(app.canvas);
      appRef.current = app;

      // Checkerboard background
      const checkSize = scale * 4;
      const bg = new pixi.Graphics();
      for (let cy = 0; cy < ch; cy += checkSize) {
        for (let cx = 0; cx < cw; cx += checkSize) {
          const dark =
            (Math.floor(cx / checkSize) + Math.floor(cy / checkSize)) % 2 === 0;
          bg.rect(cx, cy, checkSize, checkSize);
          bg.fill(dark ? 0x1a2035 : 0x141a2e);
        }
      }
      app.stage.addChild(bg);

      // Sprite container (scaled)
      const spriteContainer = new pixi.Container();
      spriteContainer.scale.set(scale);
      app.stage.addChild(spriteContainer);

      // Build channel tint map for each layer
      function buildTintMap(tints: ChannelTint[]): Map<string, number> {
        const map = new Map<string, number>();
        for (const { channel, tint } of tints) {
          let h = tint.startsWith("#") ? tint.slice(1) : tint;
          if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
          map.set(channel, parseInt(h, 16));
        }
        return map;
      }

      // Track sprites for frame updates
      const entries: { sprite: import("pixi.js").Sprite; layer: AnimationLayer; startTime: number }[] = [];
      const startTime = performance.now();

      for (const pl of previewLayers) {
        const baseTex = pixi.Texture.from(pl.image);
        const tintMap = buildTintMap(pl.tints ?? []);

        // Apply entity-level transform
        const layerContainer = new pixi.Container();
        if (pl.transform) {
          const t = pl.transform;
          layerContainer.setFromMatrix(
            new pixi.Matrix(
              t.a / 1000,
              t.b / 1000,
              t.c / 1000,
              t.d / 1000,
              t.e / 1000,
              t.f / 1000,
            ),
          );
        }
        spriteContainer.addChild(layerContainer);

        for (const layer of pl.layers) {
          if (layer.target !== target) continue;
          if (layer.frames.length === 0) continue;

          const frame = layer.frames[0];
          const tex = new pixi.Texture({
            source: baseTex.source,
            frame: new pixi.Rectangle(
              frame.x,
              frame.y,
              frame.width,
              frame.height,
            ),
          });

          const sprite = new pixi.Sprite(tex);

          // Apply channel tint
          if (layer.colorChannel) {
            const tint = tintMap.get(layer.colorChannel);
            if (tint !== undefined) sprite.tint = tint;
          }

          layerContainer.addChild(sprite);
          entries.push({ sprite, layer, startTime });
        }
      }

      // Ticker for animation
      app.ticker.add(() => {
        const now = performance.now();
        for (const entry of entries) {
          const elapsed = now - entry.startTime;
          const frameIndex =
            Math.floor(elapsed / entry.layer.frameRate) %
            entry.layer.frames.length;
          const frame = entry.layer.frames[frameIndex];

          const texFrame = entry.sprite.texture.frame;
          if (texFrame.x !== frame.x || texFrame.y !== frame.y) {
            texFrame.x = frame.x;
            texFrame.y = frame.y;
            texFrame.width = frame.width;
            texFrame.height = frame.height;
            entry.sprite.texture.updateUvs();
          }
        }
      });
    })();

    return () => {
      destroyed = true;
      if (app) app.destroy(true);
      appRef.current = null;
      // Clean up any canvas left in the container
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [previewLayers, target, cw, ch, scale]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "inline-block",
        width: cw,
        height: ch,
        imageRendering: "pixelated",
      }}
    />
  );
}
