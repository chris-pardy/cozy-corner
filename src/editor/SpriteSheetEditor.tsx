import { useState, useCallback, useMemo } from "react";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import { AnimationLayerEditor, type LayerEvent } from "./AnimationLayerEditor";

export type SpriteSheetEditorProps = {
  target: string;
  spriteSheet: HTMLImageElement;
};

function defaultLayer(
  image: HTMLImageElement,
  target: string,
): AnimationLayer {
  return {
    target,
    frames: [{
      x: 0,
      y: 0,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }],
    frameRate: 100,
    zIndex: 0,
  };
}

export function SpriteSheetEditor({
  target,
  spriteSheet,
}: SpriteSheetEditorProps) {
  const [layers, setLayers] = useState<AnimationLayer[]>(() => [
    defaultLayer(spriteSheet, target),
  ]);
  const [activeLayer, setActiveLayer] = useState<number | null>(0);

  // Layers filtered to the current target, with their original indices.
  const targetLayers = useMemo(() => {
    const result: { layer: AnimationLayer; globalIndex: number }[] = [];
    layers.forEach((layer, i) => {
      if (layer.target === target) result.push({ layer, globalIndex: i });
    });
    return result;
  }, [layers, target]);

  const filteredLayers = useMemo(
    () => targetLayers.map((t) => t.layer),
    [targetLayers],
  );

  // Map a local (filtered) index to the global (all-layers) index.
  const toGlobal = useCallback(
    (localIdx: number) => targetLayers[localIdx]?.globalIndex ?? -1,
    [targetLayers],
  );

  const handleLayerEvent = useCallback(
    (event: LayerEvent) => {
      setLayers((prev) => {
        switch (event.type) {
          case "add":
            return [...prev, event.layer];
          case "update": {
            const gi = toGlobal(event.index);
            if (gi < 0) return prev;
            return prev.map((l, i) =>
              i === gi ? { ...l, ...event.patch } : l,
            );
          }
          case "move": {
            const fromGi = toGlobal(event.fromIndex);
            const toGi = toGlobal(event.toIndex);
            if (fromGi < 0 || toGi < 0) return prev;
            const next = [...prev];
            const [moved] = next.splice(fromGi, 1);
            next.splice(toGi, 0, moved);
            return next;
          }
          case "delete": {
            const gi = toGlobal(event.index);
            if (gi < 0) return prev;
            return prev.filter((_, i) => i !== gi);
          }
        }
      });
    },
    [toGlobal],
  );

  return (
    <AnimationLayerEditor
      image={spriteSheet}
      layers={filteredLayers}
      target={target}
      activeLayer={activeLayer}
      onChangeActiveLayer={setActiveLayer}
      onLayerEvent={handleLayerEvent}
    />
  );
}
