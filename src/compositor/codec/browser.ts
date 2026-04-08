import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';
import type { ImageCodec } from './types';

/** Browser-based image codec using OffscreenCanvas + createImageBitmap. */
export const browserCodec: ImageCodec = {
    async decode(png: Uint8Array): Promise<PixelBuffer> {
        const blob = new Blob([png], { type: 'image/png' });
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return {
            id: 0,
            width: canvas.width,
            xOffset: 0,
            yOffset: 0,
            pixelData: new Uint32Array(
                imageData.data.buffer,
                imageData.data.byteOffset,
                imageData.data.byteLength / 4,
            ),
        };
    },

    async encode(buffer: PixelBuffer): Promise<Uint8Array> {
        const height = buffer.width > 0
            ? (buffer.pixelData.length / buffer.width) | 0
            : 0;
        const canvas = new OffscreenCanvas(buffer.width, height);
        const ctx = canvas.getContext('2d')!;
        const imageData = new ImageData(
            new Uint8ClampedArray(
                buffer.pixelData.buffer,
                buffer.pixelData.byteOffset,
                buffer.pixelData.byteLength,
            ),
            buffer.width,
            height,
        );
        ctx.putImageData(imageData, 0, 0);
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        return new Uint8Array(await blob.arrayBuffer());
    },
};
