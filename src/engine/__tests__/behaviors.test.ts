import { describe, it, expect, vi, beforeEach } from "vitest";
import { Entity } from "../entity";
import { RenderEvent } from "../event";

// Stub OffscreenCanvas for happy-dom (used by LayerStackRenderBehavior tint path)
vi.stubGlobal(
  "OffscreenCanvas",
  class {
    width: number;
    height: number;
    private _ctx = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      globalCompositeOperation: "source-over",
      fillStyle: "",
      imageSmoothingEnabled: true,
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

import { LayerStackRenderBehavior } from "../behaviors/layer-stack-render";
import { CompositeRenderBehavior } from "../behaviors/composite-render";
import { LAYERS, SPRITE_SHEET, TARGET, TARGET_START_TIME, CHILD_RENDER_CONFIG, RENDER_ORDER } from "../state/render";
import { POSITION } from "../state/movement";
import { TILE_SIZE } from "../state/tiles";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import type { RenderContext } from "../event";

function mockCanvasContext(): RenderContext {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    transform: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalCompositeOperation: "source-over",
    fillStyle: "",
    canvas: { width: 64, height: 64 },
  } as unknown as RenderContext;
}

function makeFrames(x: number, y: number, w: number, h: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    x: x + i * w,
    y,
    width: w,
    height: h,
  }));
}

function makeLayer(overrides?: Partial<AnimationLayer>): AnimationLayer {
  return {
    target: "idle",
    frames: makeFrames(0, 0, 16, 16, 4),
    frameRate: 100,
    zIndex: 0,
    colorChannel: "primary",
    ...overrides,
  };
}

describe("LayerStackRenderBehavior", () => {
  let behavior: LayerStackRenderBehavior;
  let entity: Entity;
  let ctx: RenderContext;

  beforeEach(() => {
    behavior = new LayerStackRenderBehavior();
    entity = new Entity([behavior]);
    ctx = mockCanvasContext();
  });

  it("does nothing when state is missing", () => {
    const event = new RenderEvent(ctx, 1000);
    entity.emit(event);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("draws correct frame based on elapsed time", () => {
    const layer = makeLayer({ frameRate: 100, frames: makeFrames(0, 0, 16, 16, 4) });
    const spriteSheet = {} as CanvasImageSource;

    entity.set(LAYERS, [layer]);
    entity.set(SPRITE_SHEET, spriteSheet);
    entity.set(TARGET, "idle");
    entity.set(TARGET_START_TIME, 0);

    // At time=250, elapsed=250, frame = floor(250/100) % 4 = 2
    entity.emit(new RenderEvent(ctx, 250));

    expect(ctx.drawImage).toHaveBeenCalledWith(
      spriteSheet,
      2 * 16, // sx = frames[2].x
      0,      // sy
      16, 16, // source size
      0, 0,   // dest position
      16, 16, // dest size
    );
  });

  it("skips layers that don't match target", () => {
    entity.set(LAYERS, [makeLayer({ target: "walk", frames: makeFrames(0, 0, 16, 16, 4) })]);
    entity.set(SPRITE_SHEET, {} as CanvasImageSource);
    entity.set(TARGET, "idle");
    entity.set(TARGET_START_TIME, 0);

    entity.emit(new RenderEvent(ctx, 0));
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("applies tint from tintMap", () => {
    entity.set(LAYERS, [makeLayer({ colorChannel: "primary" })]);
    entity.set(SPRITE_SHEET, {} as CanvasImageSource);
    entity.set(TARGET, "idle");
    entity.set(TARGET_START_TIME, 0);

    const tintMap = new Map([["primary", "#ff0000"]]);
    entity.emit(new RenderEvent(ctx, 0, tintMap));

    // Tint compositing happens on the offscreen temp canvas, then the result
    // is stamped onto the main context via drawImage.
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("renders without tint when channel not in tintMap", () => {
    entity.set(LAYERS, [makeLayer({ colorChannel: "primary" })]);
    entity.set(SPRITE_SHEET, {} as CanvasImageSource);
    entity.set(TARGET, "idle");
    entity.set(TARGET_START_TIME, 0);

    const tintMap = new Map([["nonexistent", "#ff0000"]]); // channel doesn't match "primary"
    entity.emit(new RenderEvent(ctx, 0, tintMap));

    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("wraps frame index with modulo", () => {
    const layer = makeLayer({ frameRate: 100, frames: makeFrames(0, 0, 16, 16, 2) });
    entity.set(LAYERS, [layer]);
    entity.set(SPRITE_SHEET, {} as CanvasImageSource);
    entity.set(TARGET, "idle");
    entity.set(TARGET_START_TIME, 0);

    // At time=300, frame = floor(300/100) % 2 = 1
    entity.emit(new RenderEvent(ctx, 300));
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      1 * 16, 0, 16, 16, 0, 0, 16, 16,
    );
  });
});

describe("CompositeRenderBehavior", () => {
  let ctx: RenderContext;

  beforeEach(() => {
    ctx = mockCanvasContext();
  });

  it("does not stop the event so subsequent behaviors can run", () => {
    const composite = new CompositeRenderBehavior();
    const avatar = new Entity([composite]);
    const event = new RenderEvent(ctx, 1000);
    avatar.emit(event);
    expect(event.stopped).toBe(false);
  });

  it("dispatches render to children with tintMap from config", () => {
    const childHandler = vi.fn();
    const child = new Entity([{
      eventTypes: new Set(["render"]),
      handle: childHandler,
    }]);
    const composite = new CompositeRenderBehavior();
    const avatar = new Entity([composite]);
    avatar.addChild(child);

    avatar.set(CHILD_RENDER_CONFIG, new Map([
      [child, {
        tints: [{ channel: "skin", tint: "#cc4444" }],
      }],
    ]));

    avatar.emit(new RenderEvent(ctx, 500));

    expect(childHandler).toHaveBeenCalledOnce();
    const emittedEvent = childHandler.mock.calls[0][1] as RenderEvent;
    expect(emittedEvent.tintMap.get("skin")).toBe("#cc4444");
    expect(emittedEvent.time).toBe(500);
  });

  it("applies transform to canvas context", () => {
    const child = new Entity();
    const composite = new CompositeRenderBehavior();
    const avatar = new Entity([composite]);
    avatar.addChild(child);

    avatar.set(CHILD_RENDER_CONFIG, new Map([
      [child, {
        tints: [],
        transform: { a: 1000, b: 0, c: 0, d: -1000, e: 0, f: 16000 },
      }],
    ]));

    avatar.emit(new RenderEvent(ctx, 0));

    expect(ctx.transform).toHaveBeenCalledWith(1, 0, 0, -1, 0, 16);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("dispatches to children without config using empty tintMap", () => {
    const childHandler = vi.fn();
    const child = new Entity([{
      eventTypes: new Set(["render"]),
      handle: childHandler,
    }]);

    const composite = new CompositeRenderBehavior();
    const avatar = new Entity([composite]);
    avatar.addChild(child);
    // no CHILD_RENDER_CONFIG set

    avatar.emit(new RenderEvent(ctx, 100));

    expect(childHandler).toHaveBeenCalledOnce();
    const emittedEvent = childHandler.mock.calls[0][1] as RenderEvent;
    expect(emittedEvent.tintMap.size).toBe(0);
  });

  it("y-sorts children by POSITION", () => {
    const order: string[] = [];
    const makeChild = (name: string, y: number) => {
      const child = new Entity([{
        eventTypes: new Set(["render"]),
        handle: () => order.push(name),
      }]);
      child.set(POSITION, { x: 0, y });
      return child;
    };

    const composite = new CompositeRenderBehavior();
    const room = new Entity([composite]);
    // Add in reverse y order
    room.addChild(makeChild("far", 5));
    room.addChild(makeChild("near", 1));
    room.addChild(makeChild("mid", 3));

    room.emit(new RenderEvent(ctx, 0));

    expect(order).toEqual(["near", "mid", "far"]);
  });

  it("translates canvas to child POSITION when TILE_SIZE is set", () => {
    const child = new Entity([{
      eventTypes: new Set(["render"]),
      handle: vi.fn(),
    }]);
    child.set(POSITION, { x: 2, y: 3 });

    const composite = new CompositeRenderBehavior();
    const room = new Entity([composite]);
    room.set(TILE_SIZE, 32);
    room.addChild(child);

    room.emit(new RenderEvent(ctx, 0));

    expect(ctx.translate).toHaveBeenCalledWith(64, 96);
  });

  it("sorts by RENDER_ORDER at same y", () => {
    const order: string[] = [];
    const makeChild = (name: string, y: number, renderOrder?: number) => {
      const child = new Entity([{
        eventTypes: new Set(["render"]),
        handle: () => order.push(name),
      }]);
      child.set(POSITION, { x: 0, y });
      if (renderOrder !== undefined) child.set(RENDER_ORDER, renderOrder);
      return child;
    };

    const composite = new CompositeRenderBehavior();
    const room = new Entity([composite]);
    // Both at y=2, but row entity has higher render order
    room.addChild(makeChild("avatar", 2));
    room.addChild(makeChild("railing", 2, 1));

    room.emit(new RenderEvent(ctx, 0));

    expect(order).toEqual(["avatar", "railing"]);
  });

});
