import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';

/**
 * Parse a hex color string (#RGB or #RRGGBB) to [r, g, b] in 0-255.
 */
function parseHex(hex: string): [number, number, number] {
    const h = hex.startsWith('#') ? hex.slice(1) : hex;
    if (h.length === 3) {
        return [
            parseInt(h[0] + h[0], 16),
            parseInt(h[1] + h[1], 16),
            parseInt(h[2] + h[2], 16),
        ];
    }
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ];
}

/**
 * Apply a multiply-blend tint to a PixelBuffer.
 *
 * For each pixel: outR = srcR * tintR / 255 (same for G, B). Alpha is unchanged.
 * Returns a new PixelBuffer (does not mutate the input).
 */
export function applyTint(buffer: PixelBuffer, tintHex: string): PixelBuffer {
    const [tR, tG, tB] = parseHex(tintHex);
    const src = new Uint8Array(
        buffer.pixelData.buffer,
        buffer.pixelData.byteOffset,
        buffer.pixelData.byteLength,
    );
    const out32 = new Uint32Array(buffer.pixelData.length);
    const out8 = new Uint8Array(out32.buffer);

    for (let i = 0; i < src.length; i += 4) {
        out8[i] = (src[i] * tR + 127) / 255 | 0;
        out8[i + 1] = (src[i + 1] * tG + 127) / 255 | 0;
        out8[i + 2] = (src[i + 2] * tB + 127) / 255 | 0;
        out8[i + 3] = src[i + 3];
    }

    return { ...buffer, pixelData: out32 };
}
