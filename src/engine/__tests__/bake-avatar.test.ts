import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { bakeLayer, type AvatarLayerInput } from "../bake-avatar";
import type { AnimationLayer, AnimationFrame } from "~/atproto/generated/types/at/cozy-corner/defs";

// ---------------------------------------------------------------------------
// OffscreenCanvas mock
// ---------------------------------------------------------------------------

function mockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    transform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    globalCompositeOperation: "source-over",
    fillStyle: "",
    imageSmoothingEnabled: true,
  };
}

class MockOffscreenCanvas {
  width: number;
  height: number;
  _ctx = mockCtx();

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  getContext() {
    return this._ctx;
  }
}

let origOffscreenCanvas: unknown;

beforeAll(() => {
  origOffscreenCanvas = globalThis.OffscreenCanvas;
  (globalThis as Record<string, unknown>).OffscreenCanvas =
    MockOffscreenCanvas;
});

afterAll(() => {
  (globalThis as Record<string, unknown>).OffscreenCanvas =
    origOffscreenCanvas;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFrames(x: number, y: number, w: number, h: number, count: number): AnimationFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    x: x + i * w,
    y,
    width: w,
    height: h,
  }));
}

function layer(overrides?: Partial<AnimationLayer>): AnimationLayer {
  return {
    target: "idle-south",
    frames: makeFrames(0, 0, 32, 32, 1),
    frameRate: 125,
    ...overrides,
  };
}

function input(overrides?: Partial<AvatarLayerInput>): AvatarLayerInput {
  return {
    image: {} as CanvasImageSource,
    layers: [layer()],
    tints: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("bakeLayer", () => {
  it("returns original image when no tints or transform", () => {
    const img = { _tag: "original" } as unknown as CanvasImageSource;
    const result = bakeLayer(input({ image: img }));

    // Should return the original image, not a new canvas
    expect(result.spriteSheet).toBe(img);
    expect(result.layers).toHaveLength(1);
  });

  it("returns original layers unchanged when no baking needed", () => {
    const layers = [
      layer({ target: "idle-south" }),
      layer({ target: "walk-south", frames: makeFrames(0, 32, 32, 32, 4) }),
    ];
    const result = bakeLayer(input({ layers }));

    expect(result.layers).toBe(layers);
  });

  it("creates new canvas when tints are present", () => {
    const img = { _tag: "sprite" } as unknown as CanvasImageSource;
    const result = bakeLayer(
      input({
        image: img,
        tints: [{ layerIndexes: [0], tint: "#ff0000" }],
      }),
    );

    expect(result.spriteSheet).toBeInstanceOf(MockOffscreenCanvas);
    expect(result.spriteSheet).not.toBe(img);
  });

  it("creates new canvas when transform is present", () => {
    const img = { _tag: "sprite" } as unknown as CanvasImageSource;
    const result = bakeLayer(
      input({
        image: img,
        transform: { a: 1000, b: 0, c: 0, d: 1000, e: 0, f: 0 },
      }),
    );

    expect(result.spriteSheet).toBeInstanceOf(MockOffscreenCanvas);
    expect(result.spriteSheet).not.toBe(img);
  });

  it("sizes canvas to bounding box of all layer frames", () => {
    const layers = [
      layer({ target: "idle-south", frames: makeFrames(0, 0, 32, 32, 1) }),
      layer({ target: "walk-south", frames: makeFrames(0, 32, 32, 32, 8) }),
    ];
    const result = bakeLayer(
      input({
        layers,
        tints: [{ layerIndexes: [0], tint: "#ff0000" }],
      }),
    );

    const sheet = result.spriteSheet as unknown as MockOffscreenCanvas;
    expect(sheet.width).toBe(8 * 32); // walk row: 8 frames * 32px
    expect(sheet.height).toBe(64); // 32 + 32
  });

  it("applies transform via ctx.transform for each frame", () => {
    const result = bakeLayer(
      input({
        transform: { a: 1000, b: 0, c: 0, d: -1000, e: 0, f: 32000 },
      }),
    );

    const sheet = result.spriteSheet as unknown as MockOffscreenCanvas;
    const ctx = sheet._ctx;

    expect(ctx.transform).toHaveBeenCalledWith(1, 0, 0, -1, 0, 32);
  });

  it("uses drawImage for untinted layers", () => {
    const img = { _tag: "sprite" } as unknown as CanvasImageSource;
    const result = bakeLayer(
      input({
        image: img,
        transform: { a: 1000, b: 0, c: 0, d: 1000, e: 0, f: 0 },
      }),
    );

    const sheet = result.spriteSheet as unknown as MockOffscreenCanvas;
    const ctx = sheet._ctx;

    expect(ctx.drawImage).toHaveBeenCalledWith(
      img,
      0, 0, 32, 32,
      0, 0, 32, 32,
    );
  });

  it("applies tint via temp canvas for tinted layers", () => {
    const img = { _tag: "sprite" } as unknown as CanvasImageSource;
    const result = bakeLayer(
      input({
        image: img,
        tints: [{ layerIndexes: [0], tint: "#ff0000" }],
      }),
    );

    const sheet = result.spriteSheet as unknown as MockOffscreenCanvas;
    const ctx = sheet._ctx;
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("preserves layer coordinates in output", () => {
    const layers = [
      layer({ target: "idle-south", frames: makeFrames(0, 0, 32, 32, 1) }),
      layer({ target: "walk-south", frames: makeFrames(0, 32, 32, 32, 4) }),
    ];
    const result = bakeLayer(
      input({
        layers,
        tints: [{ layerIndexes: [0], tint: "#ff0000" }],
      }),
    );

    // Layers should reference the same coordinates
    expect(result.layers).toBe(layers);
    expect(result.layers[0].frames[0].y).toBe(0);
    expect(result.layers[1].frames[0].y).toBe(32);
  });

  it("handles walk animation with multiple frames", () => {
    const result = bakeLayer(
      input({
        layers: [
          layer({
            target: "walk-south",
            frames: makeFrames(0, 0, 32, 32, 8),
            frameRate: 125,
          }),
        ],
        transform: { a: 1000, b: 0, c: 0, d: 1000, e: 0, f: 0 },
      }),
    );

    const sheet = result.spriteSheet as unknown as MockOffscreenCanvas;
    expect(sheet.width).toBe(8 * 32);
    expect(sheet.height).toBe(32);

    // Should have drawn 8 frames
    const ctx = sheet._ctx;
    expect(ctx.drawImage).toHaveBeenCalledTimes(8);
  });

  it("returns empty for layers with zero dimensions", () => {
    const result = bakeLayer(
      input({
        layers: [],
        tints: [{ layerIndexes: [0], tint: "#ff0000" }],
      }),
    );

    expect(result.layers).toEqual([]);
    expect(result.spriteSheet).toBeInstanceOf(MockOffscreenCanvas);
  });
});
