import type { PixelBuffer } from './pixel-buffer';

/**
 * A stamp of pixel data that a tool (brush, pencil, eraser, …) applies to a
 * buffer. The `mask` selects which pixels are affected (1-bit per pixel); the
 * stamp's own alpha channel controls intensity.
 */
export interface ToolStamp {
    width: number;
    /** RGBA pixel data — the colour that will be set or added. */
    pixels: Uint32Array;
    /**
     * 1-bit mask (same length as `pixels`).
     *   0       = pixel is untouched
     *   non-zero = pixel is affected
     */
    mask: Uint8Array;
}

export type ApplyMode = 'set' | 'over';

/**
 * Apply a tool stamp to a pixel buffer at world-space position (x, y).
 *
 * **"set"** — directly overwrites each destination pixel with the stamp pixel
 * where the mask is non-zero. An eraser is a stamp whose pixels are all
 * 0x00000000.
 *
 * **"over"** — standard source-over alpha compositing. A partial-alpha stamp
 * blends toward the stamp colour: black darkens, white lightens, etc.
 * Repeated strokes build up opacity.
 */
export function applyTool(
    buffer: PixelBuffer,
    stamp: ToolStamp,
    x: number,
    y: number,
    mode: ApplyMode,
): PixelBuffer {
    const bufW = buffer.width;
    if (bufW === 0 || buffer.pixelData.length === 0) return { ...buffer };
    const bufH = buffer.pixelData.length / bufW;

    const stampW = stamp.width;
    if (stampW === 0 || stamp.pixels.length === 0) return { ...buffer };
    const stampH = stamp.pixels.length / stampW;

    // Clone so the original is not mutated
    const newData = new Uint32Array(buffer.pixelData);
    const destBytes = new Uint8Array(newData.buffer);
    const toolBytes = new Uint8Array(
        stamp.pixels.buffer,
        stamp.pixels.byteOffset,
        stamp.pixels.byteLength,
    );

    for (let sy = 0; sy < stampH; sy++) {
        const dy = y + sy - buffer.yOffset;
        if (dy < 0 || dy >= bufH) continue;

        for (let sx = 0; sx < stampW; sx++) {
            const dx = x + sx - buffer.xOffset;
            if (dx < 0 || dx >= bufW) continue;

            const sIdx = sy * stampW + sx;
            if (!stamp.mask[sIdx]) continue;

            const dIdx = dy * bufW + dx;

            if (mode === 'set') {
                newData[dIdx] = stamp.pixels[sIdx];
            } else {
                // Source-over alpha compositing:
                //   out_c = src_c * src_a + dst_c * dst_a * (1 - src_a)  /  out_a
                //   out_a = src_a + dst_a * (1 - src_a)
                const di = dIdx * 4;
                const si = sIdx * 4;
                const sa = toolBytes[si + 3];
                if (sa === 0) continue;

                const da = destBytes[di + 3];
                const srcA = sa / 255;
                const dstA = da / 255;
                const outA = srcA + dstA * (1 - srcA);

                if (outA > 0) {
                    for (let c = 0; c < 3; c++) {
                        const s = toolBytes[si + c];
                        const d = destBytes[di + c];
                        destBytes[di + c] = Math.round(
                            (s * srcA + d * dstA * (1 - srcA)) / outA,
                        );
                    }
                }
                destBytes[di + 3] = Math.min(255, Math.round(outA * 255));
            }
        }
    }

    return { ...buffer, pixelData: newData };
}
