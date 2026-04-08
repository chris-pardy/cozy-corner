import type { PixelBuffer } from './pixel-buffer';

export interface Layer {
    id: number;
    name: string;
    colorChannel: string;
    hidden: boolean;
    /** 0 = behind (background), 1 = in front (foreground). */
    zIndex: number;
    frames: PixelBuffer[];
}

/** Get the pixel buffer at a given frame offset, or undefined if out of range. */
export function getFrame(layer: Layer, offset: number): PixelBuffer | undefined {
    return layer.frames[offset];
}

export type GrowStrategy = 'blank' | 'loop' | 'extend' | 'duplicate';
export type ShrinkStrategy = 'drop' | 'trim';

/**
 * Resize a layer's frame list to `newCount`.
 *
 * When growing:
 *  - **blank**     — append empty frames
 *  - **loop**      — cycle existing frames from the start
 *  - **extend**    — repeat the last frame
 *  - **duplicate** — spread existing frames evenly across the new length
 *
 * When shrinking:
 *  - **trim** — keep the first `newCount` frames
 *  - **drop** — evenly sample `newCount` frames from across the animation
 */
export function resizeFrames(
    layer: Layer,
    newCount: number,
    options: { grow: GrowStrategy; shrink: ShrinkStrategy },
): Layer {
    const current = layer.frames.length;
    if (newCount === current || newCount < 0) return layer;

    if (newCount > current) {
        return { ...layer, frames: grow(layer.frames, newCount, options.grow) };
    }
    return { ...layer, frames: shrink(layer.frames, newCount, options.shrink) };
}

// ---------------------------------------------------------------------------

function blankFrame(id: number): PixelBuffer {
    return { id, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
}

function cloneFrame(src: PixelBuffer, newId: number): PixelBuffer {
    return {
        id: newId,
        width: src.width,
        xOffset: src.xOffset,
        yOffset: src.yOffset,
        pixelData: src.pixelData, // copy-on-write: shared until modified
    };
}

function grow(
    frames: readonly PixelBuffer[],
    newCount: number,
    strategy: GrowStrategy,
): PixelBuffer[] {
    const current = frames.length;

    if (current === 0) {
        return Array.from({ length: newCount }, (_, i) => blankFrame(i));
    }

    let nextId = Math.max(...frames.map((f) => f.id)) + 1;

    switch (strategy) {
        case 'blank': {
            const blanks = Array.from(
                { length: newCount - current },
                () => blankFrame(nextId++),
            );
            return [...frames, ...blanks];
        }
        case 'loop':
            return Array.from({ length: newCount }, (_, i) =>
                i < current ? frames[i] : cloneFrame(frames[i % current], nextId++),
            );
        case 'extend':
            return Array.from({ length: newCount }, (_, i) =>
                i < current ? frames[i] : cloneFrame(frames[current - 1], nextId++),
            );
        case 'duplicate': {
            const placed = new Set<number>();
            return Array.from({ length: newCount }, (_, i) => {
                const srcIdx = Math.floor(i * current / newCount);
                if (!placed.has(srcIdx)) {
                    placed.add(srcIdx);
                    return frames[srcIdx];
                }
                return cloneFrame(frames[srcIdx], nextId++);
            });
        }
    }
}

function shrink(
    frames: readonly PixelBuffer[],
    newCount: number,
    strategy: ShrinkStrategy,
): PixelBuffer[] {
    if (newCount <= 0) return [];

    switch (strategy) {
        case 'trim':
            return frames.slice(0, newCount);
        case 'drop':
            return Array.from(
                { length: newCount },
                (_, i) => frames[Math.floor(i * frames.length / newCount)],
            );
    }
}
