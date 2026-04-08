import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';
import type { AnimationLayer, AnimationFrame } from '@/atproto/generated/types/at/cozy-corner/defs';

export interface PackInput {
    target: string;
    frameRate: number;
    zIndex: number;
    colorChannel?: string;
    layerName?: string;
    frames: PixelBuffer[];
}

/**
 * Pack composited animation frames into a single spritesheet.
 *
 * Layout: one row per PackInput, frames laid out left-to-right.
 * All frames within a PackInput are assumed to be the same dimensions.
 *
 * Returns the packed PixelBuffer and AnimationLayer[] metadata with
 * frame rects pointing into the packed sheet.
 */
export function packSpritesheet(inputs: PackInput[]): {
    pixels: PixelBuffer;
    layers: AnimationLayer[];
} {
    if (inputs.length === 0) {
        return {
            pixels: { id: 0, width: 0, xOffset: 0, yOffset: 0, pixelData: new Uint32Array(0) },
            layers: [],
        };
    }

    // Compute row dimensions: each row is one PackInput
    const rows: Array<{ width: number; height: number; frameWidth: number; frameCount: number }> = [];
    for (const input of inputs) {
        if (input.frames.length === 0) {
            rows.push({ width: 0, height: 0, frameWidth: 0, frameCount: 0 });
            continue;
        }
        const fw = input.frames[0].width;
        const fh = fw > 0 ? (input.frames[0].pixelData.length / fw) | 0 : 0;
        rows.push({
            width: fw * input.frames.length,
            height: fh,
            frameWidth: fw,
            frameCount: input.frames.length,
        });
    }

    const sheetWidth = Math.max(...rows.map((r) => r.width), 1);
    const sheetHeight = rows.reduce((sum, r) => sum + r.height, 0);
    const outData = new Uint32Array(sheetWidth * sheetHeight);

    let yOffset = 0;
    const layers: AnimationLayer[] = [];

    for (let r = 0; r < inputs.length; r++) {
        const input = inputs[r];
        const row = rows[r];
        const fh = row.height;

        const frames: AnimationFrame[] = [];
        for (let f = 0; f < input.frames.length; f++) {
            const frame = input.frames[f];
            const fw = frame.width;
            const xOff = f * fw;

            // Copy frame pixels into sheet
            for (let y = 0; y < fh; y++) {
                for (let x = 0; x < fw; x++) {
                    outData[(yOffset + y) * sheetWidth + (xOff + x)] =
                        frame.pixelData[y * fw + x];
                }
            }

            frames.push({ x: xOff, y: yOffset, width: fw, height: fh });
        }

        layers.push({
            target: input.target,
            layerName: input.layerName,
            frames,
            frameRate: input.frameRate,
            zIndex: input.zIndex,
            colorChannel: input.colorChannel,
        });

        yOffset += fh;
    }

    return {
        pixels: { id: 0, width: sheetWidth, xOffset: 0, yOffset: 0, pixelData: outData },
        layers,
    };
}
