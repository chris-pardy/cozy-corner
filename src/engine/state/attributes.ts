/**
 * A spatial attribute grid for a room. Stores per-tile values for
 * arbitrary named attributes (light, heat, food, etc.).
 * Values are additive — multiple emitters contribute to the same tile.
 * Call reset() at the start of each tick before emitters write.
 */
export class AttributeMap {
  readonly width: number;
  readonly height: number;
  private readonly maps = new Map<string, Float64Array>();
  private readonly bases = new Map<string, Float64Array>();
  private readonly size: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.size = width * height;
  }

  /** Reset all attribute arrays to their base values. Call at the start of each tick. */
  reset(): void {
    for (const [attr, arr] of this.maps) {
      const base = this.bases.get(attr);
      if (base) {
        arr.set(base);
      } else {
        arr.fill(0);
      }
    }
  }

  /** Set the base (static) value for a tile's attribute. Survives reset(). */
  setBase(attribute: string, x: number, y: number, value: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    let base = this.bases.get(attribute);
    if (!base) {
      base = new Float64Array(this.size);
      this.bases.set(attribute, base);
    }
    base[y * this.width + x] = value;
    // Also write into the live map so it's visible before the first reset
    this.add(attribute, x, y, 0); // ensure the live array exists
    this.maps.get(attribute)![y * this.width + x] = value;
  }

  /** Add a value to a tile's attribute. */
  add(attribute: string, x: number, y: number, value: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    let arr = this.maps.get(attribute);
    if (!arr) {
      arr = new Float64Array(this.size);
      this.maps.set(attribute, arr);
    }
    arr[y * this.width + x] += value;
  }

  /** Check whether any data has been written for the given attribute. */
  has(attribute: string): boolean {
    return this.maps.has(attribute);
  }

  /** Read a tile's attribute value. */
  get(attribute: string, x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.maps.get(attribute)?.[y * this.width + x] ?? 0;
  }
}

/** The room's attribute map. */
export const ATTRIBUTE_MAP = "engine:attributeMap";

/**
 * Direction bitmask for attribute emission falloff.
 * Matches the item/room convention: S=1, W=2, N=4, E=8.
 * Omit or use DIR_ALL for omnidirectional emission.
 */
export const DIR_S = 1;
export const DIR_W = 2;
export const DIR_N = 4;
export const DIR_E = 8;
export const DIR_ALL = DIR_S | DIR_W | DIR_N | DIR_E;

export interface AttributeEmission {
  /** Attribute name (e.g. "light", "heat", "food"). */
  attribute: string;
  /** Peak value at the source. */
  value: number;
  /** Width of the emitter footprint in tiles (default 1). */
  width?: number;
  /** Height of the emitter footprint in tiles (default 1). */
  height?: number;
  /** Falloff radius beyond the footprint edge, in tiles (default 0 = no falloff). */
  radius?: number;
  /** Direction bitmask (S=1,W=2,N=4,E=8). Falloff only extends in these directions. Default: all. */
  direction?: number;
}

/** Attribute emissions for this entity. */
export const ATTRIBUTE_EMISSIONS = "engine:attributeEmissions";

/** Mixin interface for entities with attribute map state. */
export interface AttributesMixin {
  [ATTRIBUTE_MAP]: AttributeMap;
}

/** Mixin interface for entities that emit attributes. */
export interface AttributeEmitterMixin {
  [ATTRIBUTE_EMISSIONS]: AttributeEmission[];
}
