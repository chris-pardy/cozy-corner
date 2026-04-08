import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Extract a rectangular region from a PixelBuffer.
 * Pixels outside the source bounds are left transparent (0).
 */
export function extractRegion(source: PixelBuffer, rect: Rect): PixelBuffer {
    const { x, y, width, height } = rect;
    if (width <= 0 || height <= 0) {
        return { id: 0, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
    }

    const srcW = source.width;
    const srcH = srcW > 0 ? (source.pixelData.length / srcW) | 0 : 0;
    const out = new Uint32Array(width * height);

    for (let dy = 0; dy < height; dy++) {
        const sy = y + dy;
        if (sy < 0 || sy >= srcH) continue;
        for (let dx = 0; dx < width; dx++) {
            const sx = x + dx;
            if (sx < 0 || sx >= srcW) continue;
            out[dy * width + dx] = source.pixelData[sy * srcW + sx];
        }
    }

    return { id: 0, width, xOffset: 0, yOffset: 0, pixelData: out };
}
