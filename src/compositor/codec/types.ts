import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';

/** Platform-agnostic image codec for PNG encode/decode. */
export interface ImageCodec {
    /** Decode PNG bytes to RGBA PixelBuffer. */
    decode(png: Uint8Array): Promise<PixelBuffer>;
    /** Encode RGBA PixelBuffer to PNG bytes. */
    encode(buffer: PixelBuffer): Promise<Uint8Array>;
}
