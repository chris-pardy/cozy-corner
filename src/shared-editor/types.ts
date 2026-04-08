export interface SerializedPixelBuffer {
    id: number;
    width: number;
    xOffset: number;
    yOffset: number;
    /** Pixel data as plain number array (from Uint32Array) for JSON serialization. */
    pixelData: number[];
}

export interface SerializedLayer {
    id: number;
    name: string;
    colorChannel: string;
    hidden: boolean;
    zIndex: number;
    frames: SerializedPixelBuffer[];
}

export interface AvatarTarget {
    id: string;
    /** Animation target identifier, e.g. "idle-south", "walk-north", "dance". */
    target: string;
    /** Serialized sprite editor layers for this target. */
    layerData: SerializedLayer[];
    canvasWidth: number;
    canvasHeight: number;
    /** Animation frame rate in FPS. */
    frameRate: number;
}

export type StatePropertyType = 'string' | 'integer' | 'blob' | 'direction' | 'edges' | 'attribute';

export const STATE_PROPERTY_TYPES: StatePropertyType[] = [
    'string', 'integer', 'blob', 'direction', 'edges', 'attribute',
];

export interface StateProperty {
    id: string;
    name: string;
    type: StatePropertyType;
    default: string;
    allowOverride: boolean;
}

export interface Behavior {
    id: string;
    name: string;
    code: string;
}

/** Well-known animation targets grouped by action. */
export const ANIMATION_ACTIONS = [
    'idle', 'walk', 'sit', 'hold', 'push', 'pickup',
] as const;

export const DIRECTIONS = ['south', 'north', 'east', 'west'] as const;

export const WELL_KNOWN_TARGETS: string[] = [
    ...ANIMATION_ACTIONS.flatMap((a) => DIRECTIONS.map((d) => `${a}-${d}`)),
    'dance',
];
