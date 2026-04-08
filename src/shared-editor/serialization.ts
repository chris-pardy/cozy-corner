import type { Layer } from '../editor/redux/canvas/layer';
import type { PixelBuffer } from '../editor/redux/canvas/pixel-buffer';
import type { SerializedLayer, SerializedPixelBuffer } from './types';

export function serializePixelBuffer(buf: PixelBuffer): SerializedPixelBuffer {
    return {
        id: buf.id,
        width: buf.width,
        xOffset: buf.xOffset,
        yOffset: buf.yOffset,
        pixelData: Array.from(buf.pixelData),
    };
}

export function deserializePixelBuffer(data: SerializedPixelBuffer): PixelBuffer {
    return {
        id: data.id,
        width: data.width,
        xOffset: data.xOffset,
        yOffset: data.yOffset,
        pixelData: new Uint32Array(data.pixelData),
    };
}

export function serializeLayers(layers: Layer[]): SerializedLayer[] {
    return layers.map((l) => ({
        id: l.id,
        name: l.name,
        colorChannel: l.colorChannel,
        hidden: l.hidden,
        zIndex: l.zIndex,
        frames: l.frames.map(serializePixelBuffer),
    }));
}

export function deserializeLayers(data: SerializedLayer[]): Layer[] {
    return data.map((l) => ({
        id: l.id,
        name: l.name,
        colorChannel: l.colorChannel,
        hidden: l.hidden,
        zIndex: l.zIndex ?? 0,
        frames: l.frames.map(deserializePixelBuffer),
    }));
}
