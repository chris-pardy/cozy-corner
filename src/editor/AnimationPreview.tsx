import { useMemo } from "react";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import { PixiSpritePreview } from "~/engine/pixi/PixiSpritePreview";

export type AnimationPreviewProps = {
  image: HTMLImageElement;
  layers: AnimationLayer[];
  /** Which animation target to preview. */
  target: string;
  /** Max dimension in px for the preview canvas. Default 128. */
  size?: number;
};

export function AnimationPreview({
  image,
  layers,
  target,
  size = 128,
}: AnimationPreviewProps) {
  const previewLayers = useMemo(
    () => [{ image, layers }],
    [image, layers],
  );

  return (
    <div className="ale-preview-canvas" style={{ display: "inline-block" }}>
      <PixiSpritePreview
        previewLayers={previewLayers}
        target={target}
        size={size}
      />
    </div>
  );
}
