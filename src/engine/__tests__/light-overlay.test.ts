import { describe, it, expect, vi, beforeEach } from "vitest";
import { Entity } from "../entity";
import { DataEvent, RenderEvent } from "../event";
import { LightOverlayBehavior } from "../behaviors/light-overlay";
import { AttributeMap, ATTRIBUTE_MAP } from "../state/attributes";
import {
  LIGHT_CANVAS,
  LIGHT_DIRTY,
  LIGHT_STEPS,
  LIGHT_RESOLUTION,
} from "../state/light";
import type { RenderContext } from "../event";

// Patch global OffscreenCanvas
vi.stubGlobal(
  "OffscreenCanvas",
  class {
    width: number;
    height: number;
    private _ctx = {
      clearRect: vi.fn(),
      putImageData: vi.fn(),
    };
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
    getContext() {
      return this._ctx;
    }
  },
);

// Patch global ImageData
vi.stubGlobal(
  "ImageData",
  class {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
      this.data = new Uint8ClampedArray(w * h * 4);
    }
  },
);

function mockCanvasContext(): RenderContext {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    imageSmoothingEnabled: true,
  } as unknown as RenderContext;
}

function getImageData(
  room: Entity,
): Uint8ClampedArray {
  const canvas = room.get(LIGHT_CANVAS)! as unknown as {
    getContext(): { putImageData: ReturnType<typeof vi.fn> };
  };
  return canvas.getContext().putImageData.mock.calls[0][0].data;
}

/** Get alpha at a sub-pixel position in the light canvas. */
function getAlphaAt(
  data: Uint8ClampedArray,
  canvasW: number,
  px: number,
  py: number,
): number {
  return data[(py * canvasW + px) * 4 + 3];
}

describe("LightOverlayBehavior", () => {
  let room: Entity;
  let map: AttributeMap;
  let ctx: RenderContext;
  const TILE_SIZE = 32;
  const TILES_W = 5;
  const TILES_H = 5;
  const CANVAS_W = TILES_W * LIGHT_RESOLUTION;
  const CANVAS_H = TILES_H * LIGHT_RESOLUTION;

  beforeEach(() => {
    room = new Entity([new LightOverlayBehavior(TILE_SIZE)]);
    map = new AttributeMap(TILES_W, TILES_H);
    room.set(ATTRIBUTE_MAP, map);
    ctx = mockCanvasContext();
  });

  it("marks dirty on emit-attributes", () => {
    room.emit(new DataEvent("emit-attributes", {}, 0));
    expect(room.get(LIGHT_DIRTY)).toBe(true);
  });

  it("does not rebuild on render when not dirty", () => {
    room.emit(new RenderEvent(ctx, 0));
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("rebuilds light canvas on render when dirty", () => {
    map.add("light", 0, 0, 0); // seed so map.has("light") is true
    room.emit(new DataEvent("emit-attributes", {}, 0));
    room.emit(new RenderEvent(ctx, 0));

    expect(room.get(LIGHT_DIRTY)).toBe(false);
    expect(room.get(LIGHT_CANVAS)).toBeDefined();
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("uses cached canvas on subsequent renders", () => {
    map.add("light", 0, 0, 0); // seed so map.has("light") is true
    room.emit(new DataEvent("emit-attributes", {}, 0));
    room.emit(new RenderEvent(ctx, 0));
    const firstCanvas = room.get(LIGHT_CANVAS);

    const ctx2 = mockCanvasContext();
    room.emit(new RenderEvent(ctx2, 100));
    expect(room.get(LIGHT_CANVAS)).toBe(firstCanvas);
    expect(ctx2.drawImage).toHaveBeenCalled();
  });

  it("creates offscreen canvas at sub-tile resolution", () => {
    map.add("light", 0, 0, 0); // seed so map.has("light") is true
    room.emit(new DataEvent("emit-attributes", {}, 0));
    room.emit(new RenderEvent(ctx, 0));

    const lightCanvas = room.get<OffscreenCanvas>(LIGHT_CANVAS)!;
    expect(lightCanvas.width).toBe(CANVAS_W);
    expect(lightCanvas.height).toBe(CANVAS_H);
  });

  it("draws with nearest-neighbor scaling", () => {
    map.add("light", 0, 0, 0); // seed so map.has("light") is true
    room.emit(new DataEvent("emit-attributes", {}, 0));
    room.emit(new RenderEvent(ctx, 0));
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it("draws scaled up to full tile pixel size", () => {
    map.add("light", 0, 0, 0); // seed so map.has("light") is true
    room.emit(new DataEvent("emit-attributes", {}, 0));
    room.emit(new RenderEvent(ctx, 0));

    const drawCall = (ctx.drawImage as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(drawCall[3]).toBe(CANVAS_W);
    expect(drawCall[4]).toBe(CANVAS_H);
    expect(drawCall[7]).toBe(TILES_W * TILE_SIZE);
    expect(drawCall[8]).toBe(TILES_H * TILE_SIZE);
  });

  it("sets full darkness for tiles with no light", () => {
    map.add("light", 0, 0, 0); // seed so map.has("light") is true
    room.emit(new DataEvent("emit-attributes", {}, 0));
    room.emit(new RenderEvent(ctx, 0));

    const data = getImageData(room);
    // Center of tile (0,0) — all sub-pixels should be max darkness
    const cx = Math.floor(LIGHT_RESOLUTION / 2);
    const cy = Math.floor(LIGHT_RESOLUTION / 2);
    expect(getAlphaAt(data, CANVAS_W, cx, cy)).toBe(LIGHT_STEPS[0]);
  });

  it("sets full transparency for fully lit tiles", () => {
    // Light all tiles so interpolation at (2,2) center is fully lit
    for (let x = 0; x < TILES_W; x++) {
      for (let y = 0; y < TILES_H; y++) {
        map.add("light", x, y, 1);
      }
    }

    room.emit(new DataEvent("emit-attributes", {}, 0));
    room.emit(new RenderEvent(ctx, 0));

    const data = getImageData(room);
    const cx = 2 * LIGHT_RESOLUTION + Math.floor(LIGHT_RESOLUTION / 2);
    const cy = 2 * LIGHT_RESOLUTION + Math.floor(LIGHT_RESOLUTION / 2);
    expect(getAlphaAt(data, CANVAS_W, cx, cy)).toBe(
      LIGHT_STEPS[LIGHT_STEPS.length - 1],
    );
  });

  it("interpolates between lit and dark tiles for smooth edges", () => {
    // Light tile (2,2) fully, leave neighbors dark
    map.add("light", 2, 2, 1);

    room.emit(new DataEvent("emit-attributes", {}, 0));
    room.emit(new RenderEvent(ctx, 0));

    const data = getImageData(room);

    // Near center of the lit tile — bilinear interpolation means a single
    // lit tile surrounded by dark neighbors won't be fully transparent,
    // but it should be more transparent than a tile further out.
    const litCx = 2 * LIGHT_RESOLUTION + Math.floor(LIGHT_RESOLUTION / 2);
    const litCy = 2 * LIGHT_RESOLUTION + Math.floor(LIGHT_RESOLUTION / 2);
    const centerAlpha = getAlphaAt(data, CANVAS_W, litCx, litCy);

    // Sub-pixels at the edge between lit tile (2,2) and dark tile (3,2)
    const edgePx = 3 * LIGHT_RESOLUTION; // first sub-pixel of tile 3
    const edgePy = 2 * LIGHT_RESOLUTION + Math.floor(LIGHT_RESOLUTION / 2);
    const edgeAlpha = getAlphaAt(data, CANVAS_W, edgePx, edgePy);

    // Center should be more transparent (lower alpha) than edge
    expect(centerAlpha).toBeLessThan(edgeAlpha);
    // Edge should be intermediate — not fully dark
    expect(edgeAlpha).toBeLessThan(LIGHT_STEPS[0]);
    // Center should be more transparent than full darkness
    expect(centerAlpha).toBeLessThan(LIGHT_STEPS[0]);
  });

  it("skips when no ATTRIBUTE_MAP", () => {
    const bare = new Entity([new LightOverlayBehavior(TILE_SIZE)]);
    bare.set(LIGHT_DIRTY, true);
    bare.emit(new RenderEvent(ctx, 0));
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
