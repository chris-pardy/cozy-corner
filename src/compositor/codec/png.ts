import { inflateSync, deflateSync } from 'node:zlib';
import type { PixelBuffer } from '@/editor/redux/canvas/pixel-buffer';
import type { ImageCodec } from './types';

// PNG signature: 8 bytes
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function readU32(data: Uint8Array, offset: number): number {
    return (
        ((data[offset] << 24) |
            (data[offset + 1] << 16) |
            (data[offset + 2] << 8) |
            data[offset + 3]) >>> 0
    );
}

function writeU32(data: Uint8Array, offset: number, value: number): void {
    data[offset] = (value >>> 24) & 0xff;
    data[offset + 1] = (value >>> 16) & 0xff;
    data[offset + 2] = (value >>> 8) & 0xff;
    data[offset + 3] = value & 0xff;
}

// CRC32 table (precomputed)
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
}

function crc32(data: Uint8Array, start: number, length: number): number {
    let crc = 0xffffffff;
    for (let i = start; i < start + length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/** PNG filter: None=0, Sub=1, Up=2, Average=3, Paeth=4 */
function paethPredictor(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

function decodePng(png: Uint8Array): PixelBuffer {
    // Verify signature
    for (let i = 0; i < 8; i++) {
        if (png[i] !== PNG_SIGNATURE[i]) {
            throw new Error('Invalid PNG signature');
        }
    }

    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatChunks: Uint8Array[] = [];

    let offset = 8;
    while (offset < png.length) {
        const length = readU32(png, offset);
        const type =
            String.fromCharCode(png[offset + 4]) +
            String.fromCharCode(png[offset + 5]) +
            String.fromCharCode(png[offset + 6]) +
            String.fromCharCode(png[offset + 7]);

        if (type === 'IHDR') {
            width = readU32(png, offset + 8);
            height = readU32(png, offset + 12);
            bitDepth = png[offset + 16];
            colorType = png[offset + 17];
        } else if (type === 'IDAT') {
            idatChunks.push(png.slice(offset + 8, offset + 8 + length));
        } else if (type === 'IEND') {
            break;
        }

        offset += 12 + length; // 4 (length) + 4 (type) + data + 4 (crc)
    }

    if (bitDepth !== 8) {
        throw new Error(`Unsupported bit depth: ${bitDepth} (only 8 supported)`);
    }

    // Determine bytes per pixel based on color type
    let bpp: number;
    switch (colorType) {
        case 0: bpp = 1; break; // Grayscale
        case 2: bpp = 3; break; // RGB
        case 4: bpp = 2; break; // Grayscale + Alpha
        case 6: bpp = 4; break; // RGBA
        default: throw new Error(`Unsupported color type: ${colorType}`);
    }

    // Concatenate IDAT chunks and decompress
    const totalLen = idatChunks.reduce((s, c) => s + c.length, 0);
    const combined = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of idatChunks) {
        combined.set(chunk, pos);
        pos += chunk.length;
    }

    const raw = inflateSync(combined);
    const stride = width * bpp;

    // Un-filter scanlines
    const pixels = new Uint8Array(height * stride);
    let rawIdx = 0;

    for (let y = 0; y < height; y++) {
        const filterType = raw[rawIdx++];
        const rowStart = y * stride;
        const prevRow = (y - 1) * stride;

        for (let x = 0; x < stride; x++) {
            const rawByte = raw[rawIdx++];
            const a = x >= bpp ? pixels[rowStart + x - bpp] : 0;
            const b = y > 0 ? pixels[prevRow + x] : 0;
            const c = x >= bpp && y > 0 ? pixels[prevRow + x - bpp] : 0;

            let unfiltered: number;
            switch (filterType) {
                case 0: unfiltered = rawByte; break;
                case 1: unfiltered = (rawByte + a) & 0xff; break;
                case 2: unfiltered = (rawByte + b) & 0xff; break;
                case 3: unfiltered = (rawByte + ((a + b) >> 1)) & 0xff; break;
                case 4: unfiltered = (rawByte + paethPredictor(a, b, c)) & 0xff; break;
                default: throw new Error(`Unknown filter type: ${filterType}`);
            }
            pixels[rowStart + x] = unfiltered;
        }
    }

    // Convert to RGBA Uint32Array
    const pixelData = new Uint32Array(width * height);
    const rgba = new Uint8Array(pixelData.buffer);

    for (let i = 0; i < width * height; i++) {
        switch (colorType) {
            case 0: { // Grayscale
                const g = pixels[i];
                rgba[i * 4] = g;
                rgba[i * 4 + 1] = g;
                rgba[i * 4 + 2] = g;
                rgba[i * 4 + 3] = 255;
                break;
            }
            case 2: { // RGB
                rgba[i * 4] = pixels[i * 3];
                rgba[i * 4 + 1] = pixels[i * 3 + 1];
                rgba[i * 4 + 2] = pixels[i * 3 + 2];
                rgba[i * 4 + 3] = 255;
                break;
            }
            case 4: { // Grayscale + Alpha
                const g = pixels[i * 2];
                rgba[i * 4] = g;
                rgba[i * 4 + 1] = g;
                rgba[i * 4 + 2] = g;
                rgba[i * 4 + 3] = pixels[i * 2 + 1];
                break;
            }
            case 6: { // RGBA
                rgba[i * 4] = pixels[i * 4];
                rgba[i * 4 + 1] = pixels[i * 4 + 1];
                rgba[i * 4 + 2] = pixels[i * 4 + 2];
                rgba[i * 4 + 3] = pixels[i * 4 + 3];
                break;
            }
        }
    }

    return {
        id: 0,
        width,
        xOffset: 0,
        yOffset: 0,
        pixelData,
    };
}

function encodePng(buffer: PixelBuffer): Uint8Array {
    const width = buffer.width;
    const height = width > 0 ? (buffer.pixelData.length / width) | 0 : 0;
    if (width === 0 || height === 0) {
        throw new Error('Cannot encode empty PixelBuffer');
    }

    const rgba = new Uint8Array(
        buffer.pixelData.buffer,
        buffer.pixelData.byteOffset,
        buffer.pixelData.byteLength,
    );

    // Build raw scanlines with filter byte (using filter None=0 for simplicity)
    const stride = width * 4;
    const rawData = new Uint8Array(height * (1 + stride));
    for (let y = 0; y < height; y++) {
        rawData[y * (1 + stride)] = 0; // filter: None
        rawData.set(
            rgba.subarray(y * stride, (y + 1) * stride),
            y * (1 + stride) + 1,
        );
    }

    const compressed = deflateSync(rawData);

    // Build PNG file
    // Signature (8) + IHDR chunk (25) + IDAT chunk (12 + compressed) + IEND (12)
    const ihdrData = 13;
    const fileSize = 8 + (12 + ihdrData) + (12 + compressed.length) + 12;
    const out = new Uint8Array(fileSize);
    let o = 0;

    // Signature
    out.set(PNG_SIGNATURE, o);
    o += 8;

    // IHDR
    writeU32(out, o, ihdrData); o += 4;
    out[o] = 73; out[o + 1] = 72; out[o + 2] = 68; out[o + 3] = 82; // "IHDR"
    o += 4;
    writeU32(out, o, width); o += 4;
    writeU32(out, o, height); o += 4;
    out[o++] = 8;  // bitDepth
    out[o++] = 6;  // colorType: RGBA
    out[o++] = 0;  // compression
    out[o++] = 0;  // filter
    out[o++] = 0;  // interlace
    writeU32(out, o, crc32(out, o - ihdrData - 4, ihdrData + 4));
    o += 4;

    // IDAT
    writeU32(out, o, compressed.length); o += 4;
    out[o] = 73; out[o + 1] = 68; out[o + 2] = 65; out[o + 3] = 84; // "IDAT"
    o += 4;
    out.set(compressed, o); o += compressed.length;
    writeU32(out, o, crc32(out, o - compressed.length - 4, compressed.length + 4));
    o += 4;

    // IEND
    writeU32(out, o, 0); o += 4;
    out[o] = 73; out[o + 1] = 69; out[o + 2] = 78; out[o + 3] = 68; // "IEND"
    o += 4;
    writeU32(out, o, crc32(out, o - 4, 4));

    return out;
}

/** PNG codec using node:zlib (works in Bun and Node.js). */
export const pngCodec: ImageCodec = {
    async decode(png: Uint8Array): Promise<PixelBuffer> {
        return decodePng(png);
    },
    async encode(buffer: PixelBuffer): Promise<Uint8Array> {
        return encodePng(buffer);
    },
};
