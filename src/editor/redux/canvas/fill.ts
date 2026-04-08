import type { PixelBuffer } from './pixel-buffer';

/**
 * Flood-fill from a world-space point, replacing all 4-connected pixels that
 * match the colour at (x, y) with `fillColor`.
 *
 * Returns the same buffer reference if nothing changes (point is out of bounds
 * or the target colour already equals `fillColor`).
 */
export function floodFill(
    buffer: PixelBuffer,
    x: number,
    y: number,
    fillColor: number,
): PixelBuffer {
    const width = buffer.width;
    if (width === 0 || buffer.pixelData.length === 0) return { ...buffer };
    const height = buffer.pixelData.length / width;

    const lx = x - buffer.xOffset;
    const ly = y - buffer.yOffset;
    if (lx < 0 || lx >= width || ly < 0 || ly >= height) return { ...buffer };

    const targetColor = buffer.pixelData[ly * width + lx];
    if (targetColor === fillColor) return { ...buffer };

    const newData = new Uint32Array(buffer.pixelData);
    const stack: number[] = [lx, ly];

    while (stack.length > 0) {
        const cy = stack.pop()!;
        const cx = stack.pop()!;
        const idx = cy * width + cx;
        if (newData[idx] !== targetColor) continue;

        newData[idx] = fillColor;

        if (cx > 0 && newData[idx - 1] === targetColor) stack.push(cx - 1, cy);
        if (cx < width - 1 && newData[idx + 1] === targetColor) stack.push(cx + 1, cy);
        if (cy > 0 && newData[idx - width] === targetColor) stack.push(cx, cy - 1);
        if (cy < height - 1 && newData[idx + width] === targetColor) stack.push(cx, cy + 1);
    }

    return { ...buffer, pixelData: newData };
}
