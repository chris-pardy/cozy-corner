import type { PixelBuffer } from './pixel-buffer';

export interface FrameRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Extract a run of frames from an ImageData source.
 *
 * Starting at `rect`, reads `frameCount` adjacent regions stepping in
 * `direction` (by rect.w horizontally or rect.h vertically).
 * Pixels outside the image bounds are left transparent.
 */
export function extractFrames(
    source: ImageData,
    rect: FrameRect,
    direction: 'horizontal' | 'vertical',
    frameCount: number,
): PixelBuffer[] {
    const { w, h } = rect;
    if (w <= 0 || h <= 0 || frameCount <= 0) return [];

    const srcW = source.width;
    const srcH = source.height;
    const src32 = new Uint32Array(source.data.buffer, source.data.byteOffset, (source.data.byteLength / 4) | 0);

    const frames: PixelBuffer[] = [];

    for (let i = 0; i < frameCount; i++) {
        const fx = rect.x + (direction === 'horizontal' ? i * w : 0);
        const fy = rect.y + (direction === 'vertical' ? i * h : 0);

        const pixels = new Uint32Array(w * h);

        for (let y = 0; y < h; y++) {
            const sy = fy + y;
            if (sy < 0 || sy >= srcH) continue;
            for (let x = 0; x < w; x++) {
                const sx = fx + x;
                if (sx < 0 || sx >= srcW) continue;
                pixels[y * w + x] = src32[sy * srcW + sx];
            }
        }

        frames.push({
            id: i,
            width: w,
            xOffset: 0,
            yOffset: 0,
            pixelData: pixels,
        });
    }

    return frames;
}
