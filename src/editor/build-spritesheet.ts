import type { SpriteEditorResult } from "./SpritePixelEditor";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";

export interface SpritesheetResult {
  blob: Blob;
  mimeType: "image/webp" | "image/png";
  layers: AnimationLayer[];
}

/** Returns true if the browser can encode WebP via canvas.toBlob. */
let webpSupported: boolean | undefined;
function supportsWebp(): Promise<boolean> {
  if (webpSupported !== undefined) return Promise.resolve(webpSupported);
  return new Promise((resolve) => {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    c.toBlob(
      (b) => {
        webpSupported = b !== null && b.type === "image/webp";
        resolve(webpSupported);
      },
      "image/webp",
      1,
    );
  });
}

/**
 * Packs multiple animation strips into a single spritesheet.
 * Each target's frames are laid out as a horizontal row; rows are stacked
 * vertically. Prefers WebP when the browser supports it, falling back to PNG.
 */
export async function buildSpriteSheet(
  targets: string[],
  sprites: Map<string, SpriteEditorResult>,
): Promise<SpritesheetResult> {
  // Calculate canvas dimensions
  let totalHeight = 0;
  let maxWidth = 0;
  const rows: { target: string; sprite: SpriteEditorResult; y: number }[] = [];

  for (const target of targets) {
    const sprite = sprites.get(target);
    if (!sprite) continue;
    const rowWidth = sprite.frameWidth * sprite.frameCount;
    rows.push({ target, sprite, y: totalHeight });
    totalHeight += sprite.frameHeight;
    if (rowWidth > maxWidth) maxWidth = rowWidth;
  }

  if (rows.length === 0) {
    throw new Error("No sprite data to save");
  }

  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d")!;

  // Draw each target's strip
  for (const { sprite, y } of rows) {
    ctx.drawImage(sprite.image, 0, y);
  }

  // Build layer metadata
  const layers: AnimationLayer[] = rows.map(({ target, sprite, y }) => ({
    $type: "at.cozy-corner.defs#animationLayer" as const,
    target,
    frames: Array.from({ length: sprite.frameCount }, (_, i) => ({
      x: i * sprite.frameWidth,
      y,
      width: sprite.frameWidth,
      height: sprite.frameHeight,
    })),
    frameRate: Math.round(1000 / sprite.fps),
    zIndex: 0,
  }));

  // Prefer WebP, fall back to PNG
  const useWebp = await supportsWebp();
  const mimeType = useWebp ? "image/webp" : "image/png";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error(`Failed to generate ${mimeType}`));
      },
      mimeType,
      useWebp ? 1 : undefined,
    );
  });

  return { blob, mimeType, layers };
}
