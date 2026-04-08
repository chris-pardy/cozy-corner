import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';
import { flattenAlphaOver } from '@/editor/redux/canvas/pixel-buffer';
import type { AnimationLayer, ChannelTint } from '@/atproto/generated/types/at/cozy-corner/defs';
import type { CompositeInput, CompositeResult, SpriteSheetSource } from './types';
import { extractRegion } from './extract';
import { applyTint } from './tint';
import { packSpritesheet, type PackInput } from './pack';
import { computeCacheKey } from './cache-key';

interface LayerSource {
    layer: AnimationLayer;
    source: SpriteSheetSource;
    tints: ChannelTint[];
    /** Sort key: base = -1, wearables by equipOrder. */
    sourceOrder: number;
}

/**
 * Composite an avatar from its base + wearables into a single spritesheet.
 *
 * Pure function: takes pre-fetched, pre-decoded data and returns a packed
 * composite spritesheet with AnimationLayer metadata.
 */
export async function compositeAvatar(input: CompositeInput): Promise<CompositeResult> {
    // Collect all layers with their source info
    const allLayers: LayerSource[] = [];

    for (const layer of input.base.layers) {
        allLayers.push({
            layer,
            source: input.base,
            tints: input.baseTints,
            sourceOrder: -1,
        });
    }

    for (const w of input.wearables) {
        for (const layer of w.source.layers) {
            allLayers.push({
                layer,
                source: w.source,
                tints: w.tints,
                sourceOrder: w.equipOrder,
            });
        }
    }

    // Group by target
    const byTarget = new Map<string, LayerSource[]>();
    for (const ls of allLayers) {
        const key = ls.layer.target;
        let group = byTarget.get(key);
        if (!group) {
            group = [];
            byTarget.set(key, group);
        }
        group.push(ls);
    }

    // Composite each target
    const packInputs: PackInput[] = [];

    for (const [target, group] of byTarget) {
        // Sort: zIndex ascending, then sourceOrder ascending
        group.sort((a, b) => {
            if (a.layer.zIndex !== b.layer.zIndex) return a.layer.zIndex - b.layer.zIndex;
            return a.sourceOrder - b.sourceOrder;
        });

        // Determine output frame count (max across contributing layers)
        const maxFrames = Math.max(...group.map((ls) => ls.layer.frames.length));
        // Use the lowest frameRate for the output
        const frameRate = Math.min(...group.map((ls) => ls.layer.frameRate));

        const compositedFrames: PixelBuffer[] = [];

        for (let fi = 0; fi < maxFrames; fi++) {
            const frameLayers: PixelBuffer[] = [];

            for (const ls of group) {
                const frameIdx = fi % ls.layer.frames.length;
                const frameRect = ls.layer.frames[frameIdx];
                let pixels = extractRegion(ls.source.pixels, frameRect);

                // Apply tint if this layer has a colorChannel matching a tint
                if (ls.layer.colorChannel) {
                    const tint = ls.tints.find((t) => t.channel === ls.layer.colorChannel);
                    if (tint) {
                        pixels = applyTint(pixels, tint.tint);
                    }
                }

                frameLayers.push(pixels);
            }

            compositedFrames.push(
                frameLayers.length === 1 ? frameLayers[0] : flattenAlphaOver(frameLayers),
            );
        }

        packInputs.push({
            target,
            frameRate,
            zIndex: 0,
            frames: compositedFrames,
        });
    }

    const { pixels, layers } = packSpritesheet(packInputs);
    const cacheKey = await computeCacheKey(input);

    return { pixels, layers, cacheKey };
}
