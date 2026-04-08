export interface PixelBuffer {
    id: number;
    width: number;
    xOffset: number;
    yOffset: number;
    pixelData: Uint32Array;
}

/**
 * Translate the buffer by (dx, dy).
 */
export function move(buffer: PixelBuffer, dx: number, dy: number): PixelBuffer {
    return {
        ...buffer,
        xOffset: buffer.xOffset + dx,
        yOffset: buffer.yOffset + dy,
    };
}

/**
 * Scale the buffer using nearest-neighbor sampling.
 * Accepts a uniform factor or separate X/Y factors.
 * xOffset and yOffset remain the same; width and height scale to the nearest whole number.
 */
export function scale(buffer: PixelBuffer, factorX: number, factorY?: number): PixelBuffer {
    const fy = factorY ?? factorX;
    if (factorX <= 0 || fy <= 0) return { ...buffer, width: 0, pixelData: new Uint32Array(0) };

    const oldWidth = buffer.width;
    if (oldWidth === 0 || buffer.pixelData.length === 0)
        return { ...buffer, pixelData: new Uint32Array(0) };
    const oldHeight = buffer.pixelData.length / oldWidth;
    const newWidth = Math.max(1, Math.round(oldWidth * factorX));
    const newHeight = Math.max(1, Math.round(oldHeight * fy));
    const newData = new Uint32Array(newWidth * newHeight);

    for (let y = 0; y < newHeight; y++) {
        const srcY = Math.min(Math.floor(y / fy), oldHeight - 1);
        for (let x = 0; x < newWidth; x++) {
            const srcX = Math.min(Math.floor(x / factorX), oldWidth - 1);
            newData[y * newWidth + x] = buffer.pixelData[srcY * oldWidth + srcX];
        }
    }

    return { ...buffer, width: newWidth, pixelData: newData };
}

/**
 * Flip the buffer horizontally or vertically around its center.
 */
export function flip(
    buffer: PixelBuffer,
    direction: 'horizontal' | 'vertical',
): PixelBuffer {
    const width = buffer.width;
    if (width === 0 || buffer.pixelData.length === 0) return { ...buffer };
    const height = buffer.pixelData.length / width;
    const newData = new Uint32Array(buffer.pixelData.length);

    if (direction === 'horizontal') {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                newData[y * width + x] =
                    buffer.pixelData[y * width + (width - 1 - x)];
            }
        }
    } else {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                newData[y * width + x] =
                    buffer.pixelData[(height - 1 - y) * width + x];
            }
        }
    }

    return { ...buffer, pixelData: newData };
}

// ---------------------------------------------------------------------------
// RotSprite rotation
// ---------------------------------------------------------------------------

/**
 * Scale2x (EPX) – pixel-art-friendly 2× upscale.
 *
 * For each pixel P with cardinal neighbours A (up), B (right), C (left), D (down)
 * the 2×2 output block is:
 *   1 = (C==A && C!=D && A!=B) ? A : P
 *   2 = (A==B && A!=C && B!=D) ? B : P
 *   3 = (D==C && D!=B && C!=A) ? C : P
 *   4 = (B==D && B!=A && D!=C) ? D : P
 */
function scale2x(
    data: Uint32Array,
    width: number,
): { data: Uint32Array; width: number } {
    const height = data.length / width;
    const w2 = width * 2;
    const result = new Uint32Array(w2 * height * 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const P = data[y * width + x];
            const A = y > 0 ? data[(y - 1) * width + x] : 0;
            const B = x < width - 1 ? data[y * width + (x + 1)] : 0;
            const C = x > 0 ? data[y * width + (x - 1)] : 0;
            const D = y < height - 1 ? data[(y + 1) * width + x] : 0;

            result[y * 2 * w2 + x * 2] =
                C === A && C !== D && A !== B ? A : P;
            result[y * 2 * w2 + x * 2 + 1] =
                A === B && A !== C && B !== D ? B : P;
            result[(y * 2 + 1) * w2 + x * 2] =
                D === C && D !== B && C !== A ? C : P;
            result[(y * 2 + 1) * w2 + x * 2 + 1] =
                B === D && B !== A && D !== C ? D : P;
        }
    }

    return { data: result, width: w2 };
}

/** Snap trig values very close to 0, 1 or −1 to exact integers. */
function snapTrig(v: number): number {
    if (Math.abs(v) < 1e-10) return 0;
    if (Math.abs(v - 1) < 1e-10) return 1;
    if (Math.abs(v + 1) < 1e-10) return -1;
    return v;
}

/**
 * Rotate the buffer by the given angle (radians, clockwise) around its centre
 * using the RotSprite algorithm (3× Scale2x then rotated down-sample) to
 * preserve pixel-art aesthetics.
 *
 * The returned buffer's xOffset/yOffset are adjusted so that the world-space
 * centre of the original buffer is preserved.
 */
export function rotate(buffer: PixelBuffer, angle: number): PixelBuffer {
    const width = buffer.width;
    if (width === 0 || buffer.pixelData.length === 0) return { ...buffer };
    const height = buffer.pixelData.length / width;

    // Normalise to [0, 2π)
    const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (a < 1e-10) return { ...buffer };

    // Step 1 — Scale2x three times (8× upscale)
    let scaled: { data: Uint32Array; width: number } = {
        data: buffer.pixelData,
        width,
    };
    scaled = scale2x(scaled.data, scaled.width);
    scaled = scale2x(scaled.data, scaled.width);
    scaled = scale2x(scaled.data, scaled.width);
    const sW = scaled.width;
    const sH = scaled.data.length / sW;

    // Step 2+3 — Rotate & down-sample in a single pass
    // Snap trig values near 0/±1 to exact values to avoid floating-point
    // noise inflating the bounding box at axis-aligned angles.
    const cosA = snapTrig(Math.cos(a));
    const sinA = snapTrig(Math.sin(a));

    const outWidth = Math.ceil(Math.abs(width * cosA) + Math.abs(height * sinA));
    const outHeight = Math.ceil(Math.abs(width * sinA) + Math.abs(height * cosA));
    const outData = new Uint32Array(outWidth * outHeight);

    const outCx = outWidth / 2;
    const outCy = outHeight / 2;
    const srcCx = width / 2;
    const srcCy = height / 2;

    for (let oy = 0; oy < outHeight; oy++) {
        for (let ox = 0; ox < outWidth; ox++) {
            // Output pixel centre relative to output centre
            const dx = ox + 0.5 - outCx;
            const dy = oy + 0.5 - outCy;
            // Inverse-rotate into 1× source space
            const sx = cosA * dx + sinA * dy + srcCx;
            const sy = -sinA * dx + cosA * dy + srcCy;
            // Map to 8× space (nearest-neighbour)
            const sx8 = Math.floor(sx * 8);
            const sy8 = Math.floor(sy * 8);
            if (sx8 >= 0 && sx8 < sW && sy8 >= 0 && sy8 < sH) {
                outData[oy * outWidth + ox] = scaled.data[sy8 * sW + sx8];
            }
        }
    }

    // Preserve world-space centre
    const oldCx = buffer.xOffset + width / 2;
    const oldCy = buffer.yOffset + height / 2;

    return {
        ...buffer,
        width: outWidth,
        xOffset: Math.round(oldCx - outWidth / 2),
        yOffset: Math.round(oldCy - outHeight / 2),
        pixelData: outData,
    };
}

/**
 * Flatten pixel buffers into one, compositing from first (bottom) to last
 * (top) using additive blending (RGB scaled by source alpha, alpha added
 * directly, all channels clamped to [0, 255]).
 *
 * The output covers the union bounding box of all inputs, with
 * xOffset/yOffset set to the top-left corner of that box.
 * The returned buffer inherits the first buffer's id.
 */
export function flatten(layers: PixelBuffer[]): PixelBuffer {
    // Filter to non-empty layers
    const nonEmpty = layers.filter(
        (l) => l.width > 0 && l.pixelData.length > 0,
    );
    if (nonEmpty.length === 0)
        return { id: layers[0]?.id ?? 0, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
    if (nonEmpty.length === 1)
        return { ...nonEmpty[0] };

    // Union bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const l of nonEmpty) {
        const h = l.pixelData.length / l.width;
        minX = Math.min(minX, l.xOffset);
        minY = Math.min(minY, l.yOffset);
        maxX = Math.max(maxX, l.xOffset + l.width);
        maxY = Math.max(maxY, l.yOffset + h);
    }
    const outW = maxX - minX;
    const outH = maxY - minY;
    const outData = new Uint32Array(outW * outH);
    const destBytes = new Uint8Array(outData.buffer);

    // Copy first layer directly
    const first = nonEmpty[0];
    const fW = first.width;
    const fH = first.pixelData.length / fW;
    for (let y = 0; y < fH; y++) {
        const dy = first.yOffset + y - minY;
        for (let x = 0; x < fW; x++) {
            outData[dy * outW + (first.xOffset + x - minX)] =
                first.pixelData[y * fW + x];
        }
    }

    // Composite remaining layers (additive blend)
    for (let i = 1; i < nonEmpty.length; i++) {
        const layer = nonEmpty[i];
        const lW = layer.width;
        const lH = layer.pixelData.length / lW;
        const srcBytes = new Uint8Array(
            layer.pixelData.buffer,
            layer.pixelData.byteOffset,
            layer.pixelData.byteLength,
        );

        for (let y = 0; y < lH; y++) {
            const dy = layer.yOffset + y - minY;
            for (let x = 0; x < lW; x++) {
                const sIdx = y * lW + x;
                const si = sIdx * 4;
                const sa = srcBytes[si + 3];
                if (sa === 0) continue;

                const dIdx = dy * outW + (layer.xOffset + x - minX);
                const di = dIdx * 4;

                for (let c = 0; c < 3; c++) {
                    const d = destBytes[di + c];
                    const s = srcBytes[si + c];
                    const add = sa === 255 ? s : Math.round(s * sa / 255);
                    destBytes[di + c] = Math.min(255, d + add);
                }
                destBytes[di + 3] = Math.min(255, destBytes[di + 3] + sa);
            }
        }
    }

    return {
        id: layers[0].id,
        width: outW,
        xOffset: minX,
        yOffset: minY,
        pixelData: outData,
    };
}

/**
 * Flatten pixel buffers using standard Porter-Duff source-over compositing.
 *
 * For each pixel:
 *   outA  = srcA + dstA × (1 − srcA)
 *   outRGB = (srcRGB × srcA + dstRGB × dstA × (1 − srcA)) / outA
 *
 * This is the standard blend mode for layering opaque/semi-transparent
 * sprites (e.g. avatar body + wearable layers).
 *
 * Layout and bounding-box behaviour is identical to {@link flatten}.
 */
export function flattenAlphaOver(layers: PixelBuffer[]): PixelBuffer {
    const nonEmpty = layers.filter(
        (l) => l.width > 0 && l.pixelData.length > 0,
    );
    if (nonEmpty.length === 0)
        return { id: layers[0]?.id ?? 0, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) };
    if (nonEmpty.length === 1)
        return { ...nonEmpty[0] };

    // Union bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const l of nonEmpty) {
        const h = l.pixelData.length / l.width;
        minX = Math.min(minX, l.xOffset);
        minY = Math.min(minY, l.yOffset);
        maxX = Math.max(maxX, l.xOffset + l.width);
        maxY = Math.max(maxY, l.yOffset + h);
    }
    const outW = maxX - minX;
    const outH = maxY - minY;
    const outData = new Uint32Array(outW * outH);
    const destBytes = new Uint8Array(outData.buffer);

    // Copy first layer directly
    const first = nonEmpty[0];
    const fW = first.width;
    const fH = first.pixelData.length / fW;
    for (let y = 0; y < fH; y++) {
        const dy = first.yOffset + y - minY;
        for (let x = 0; x < fW; x++) {
            outData[dy * outW + (first.xOffset + x - minX)] =
                first.pixelData[y * fW + x];
        }
    }

    // Composite remaining layers (source-over)
    for (let i = 1; i < nonEmpty.length; i++) {
        const layer = nonEmpty[i];
        const lW = layer.width;
        const lH = layer.pixelData.length / lW;
        const srcBytes = new Uint8Array(
            layer.pixelData.buffer,
            layer.pixelData.byteOffset,
            layer.pixelData.byteLength,
        );

        for (let y = 0; y < lH; y++) {
            const dy = layer.yOffset + y - minY;
            for (let x = 0; x < lW; x++) {
                const sIdx = y * lW + x;
                const si = sIdx * 4;
                const sa = srcBytes[si + 3];
                if (sa === 0) continue;

                const dIdx = dy * outW + (layer.xOffset + x - minX);
                const di = dIdx * 4;
                const da = destBytes[di + 3];

                if (sa === 255) {
                    // Fully opaque source replaces destination
                    outData[dIdx] = layer.pixelData[sIdx];
                } else {
                    // srcA / 255 as a fraction
                    const saf = sa / 255;
                    const outA = sa + da * (1 - saf);
                    if (outA === 0) continue;
                    const invSaf = 1 - saf;
                    for (let c = 0; c < 3; c++) {
                        destBytes[di + c] = Math.round(
                            (srcBytes[si + c] * sa + destBytes[di + c] * da * invSaf) / outA,
                        );
                    }
                    destBytes[di + 3] = Math.round(outA);
                }
            }
        }
    }

    return {
        id: layers[0].id,
        width: outW,
        xOffset: minX,
        yOffset: minY,
        pixelData: outData,
    };
}

