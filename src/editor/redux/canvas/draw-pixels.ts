/**
 * Draw a Uint32Array of RGBA pixels onto a canvas 2D context.
 *
 * Uses drawImage internally so the current canvas transform is respected —
 * callers can scale, translate, or rotate before calling this and the pixels
 * will be drawn accordingly.  Set `ctx.imageSmoothingEnabled = false` for
 * crisp nearest-neighbour scaling (pixel art).
 */
export function drawPixels(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    pixels: Uint32Array,
    width: number,
): void {
    if (width === 0 || pixels.length === 0) return;
    const height = (pixels.length / width) | 0;

    const imageData = new ImageData(
        new Uint8ClampedArray(
            pixels.buffer,
            pixels.byteOffset,
            pixels.byteLength,
        ),
        width,
        height,
    );

    // putImageData ignores the canvas transform, so bounce through a
    // temporary OffscreenCanvas and use drawImage instead.
    const tmp = new OffscreenCanvas(width, height);
    const tmpCtx = tmp.getContext('2d')!;
    tmpCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tmp, 0, 0);
}
