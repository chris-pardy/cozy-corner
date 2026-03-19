import { describe, it, expect, vi, beforeEach } from "vitest";
import { Entity } from "../entity";
import { RenderEvent } from "../event";
import { TileLayerRenderBehavior } from "../behaviors/tile-layer-render";
import {
  TILE_SHEET,
  TILE_ATLAS,
  TILE_POSITIONS,
  TILE_SIZE,
  type TileFrame,
  type PlacedTile,
} from "../state/tiles";
import type { RenderContext } from "../event";

function mockCanvasContext(): RenderContext {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
  } as unknown as RenderContext;
}

function staticFrame(sx: number, sy: number, size: number): TileFrame {
  return {
    sx,
    sy,
    sw: size,
    sh: size,
    frameCount: 1,
    frameRate: 0,
    frameStride: 0,
  };
}

describe("TileLayerRenderBehavior", () => {
  const RENDER_SIZE = 32;
  let room: Entity;
  let ctx: RenderContext;
  let sheet: CanvasImageSource;

  beforeEach(() => {
    ctx = mockCanvasContext();
    sheet = {} as CanvasImageSource;
  });

  function setupRoom(
    renderLayer: number,
    atlas: TileFrame[],
    tiles: PlacedTile[],
  ): Entity {
    room = new Entity([new TileLayerRenderBehavior(renderLayer)]);
    room.set(TILE_SHEET, sheet);
    room.set(TILE_ATLAS, atlas);
    room.set(TILE_POSITIONS, tiles);
    room.set(TILE_SIZE, RENDER_SIZE);
    return room;
  }

  it("draws background tiles at correct pixel positions", () => {
    const atlas = [staticFrame(0, 0, 16), staticFrame(16, 0, 16)];
    const tiles: PlacedTile[] = [
      { tile: 0, x: 0, y: 0, renderLayer: 0, transform: 0 },
      { tile: 1, x: 2, y: 3, renderLayer: 0, transform: 0 },
    ];

    setupRoom(0, atlas, tiles);
    room.emit(new RenderEvent(ctx, 0));

    const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
    expect(drawImage).toHaveBeenCalledTimes(2);

    // First tile at (0,0)
    expect(drawImage.mock.calls[0]).toEqual([
      sheet,
      0, 0, 16, 16, // source
      0, 0, RENDER_SIZE, RENDER_SIZE, // dest
    ]);

    // Second tile at (2,3) → (64, 96)
    expect(drawImage.mock.calls[1]).toEqual([
      sheet,
      16, 0, 16, 16,
      64, 96, RENDER_SIZE, RENDER_SIZE,
    ]);
  });

  it("only renders tiles matching its renderLayer", () => {
    const atlas = [staticFrame(0, 0, 16)];
    const tiles: PlacedTile[] = [
      { tile: 0, x: 0, y: 0, renderLayer: 0, transform: 0 },
      { tile: 0, x: 1, y: 0, renderLayer: 1, transform: 0 },
      { tile: 0, x: 0, y: 1, renderLayer: 2, transform: 0 },
    ];

    // Background behavior — should only draw renderLayer 0
    setupRoom(0, atlas, tiles);
    room.emit(new RenderEvent(ctx, 0));
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("renders overhead tiles when configured for layer 2", () => {
    const atlas = [staticFrame(0, 0, 16)];
    const tiles: PlacedTile[] = [
      { tile: 0, x: 0, y: 0, renderLayer: 0, transform: 0 },
      { tile: 0, x: 1, y: 0, renderLayer: 2, transform: 0 },
    ];

    setupRoom(2, atlas, tiles);
    room.emit(new RenderEvent(ctx, 0));

    const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
    expect(drawImage).toHaveBeenCalledTimes(1);
    // Should draw at tile (1,0) → pixel (32, 0)
    expect(drawImage.mock.calls[0][5]).toBe(32);
    expect(drawImage.mock.calls[0][6]).toBe(0);
  });

  it("applies rotation via translate + rotate", () => {
    const atlas = [staticFrame(0, 0, 16)];
    const tiles: PlacedTile[] = [
      { tile: 0, x: 1, y: 2, renderLayer: 0, transform: 1 },
    ];

    setupRoom(0, atlas, tiles);
    room.emit(new RenderEvent(ctx, 0));

    expect(ctx.save).toHaveBeenCalledOnce();
    // Translate to tile center: (1*32 + 16, 2*32 + 16) = (48, 80)
    expect(ctx.translate).toHaveBeenCalledWith(48, 80);
    // Rotation 1 = 90deg = PI/2
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    // Draw centered at origin
    const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
    expect(drawImage.mock.calls[0][5]).toBe(-RENDER_SIZE / 2);
    expect(drawImage.mock.calls[0][6]).toBe(-RENDER_SIZE / 2);
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it("does not use save/restore for unrotated tiles", () => {
    const atlas = [staticFrame(0, 0, 16)];
    const tiles: PlacedTile[] = [
      { tile: 0, x: 0, y: 0, renderLayer: 0, transform: 0 },
    ];

    setupRoom(0, atlas, tiles);
    room.emit(new RenderEvent(ctx, 0));

    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.restore).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledOnce();
  });

  it("computes correct frame for animated tiles", () => {
    const atlas: TileFrame[] = [
      {
        sx: 0,
        sy: 0,
        sw: 16,
        sh: 16,
        frameCount: 4,
        frameRate: 200,
        frameStride: 16,
      },
    ];
    const tiles: PlacedTile[] = [
      { tile: 0, x: 0, y: 0, renderLayer: 0, transform: 0 },
    ];

    setupRoom(0, atlas, tiles);

    // At time=500, frame = floor(500/200) % 4 = 2, sx = 0 + 2*16 = 32
    room.emit(new RenderEvent(ctx, 500));

    const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
    expect(drawImage.mock.calls[0][1]).toBe(32); // sx
  });

  it("wraps animated frame index with modulo", () => {
    const atlas: TileFrame[] = [
      {
        sx: 0,
        sy: 0,
        sw: 16,
        sh: 16,
        frameCount: 3,
        frameRate: 100,
        frameStride: 16,
      },
    ];
    const tiles: PlacedTile[] = [
      { tile: 0, x: 0, y: 0, renderLayer: 0, transform: 0 },
    ];

    setupRoom(0, atlas, tiles);

    // At time=500, frame = floor(500/100) % 3 = 5 % 3 = 2
    room.emit(new RenderEvent(ctx, 500));

    const drawImage = ctx.drawImage as ReturnType<typeof vi.fn>;
    expect(drawImage.mock.calls[0][1]).toBe(32); // sx = 2 * 16
  });

  it("skips tiles with out-of-range atlas index", () => {
    const atlas = [staticFrame(0, 0, 16)];
    const tiles: PlacedTile[] = [
      { tile: 99, x: 0, y: 0, renderLayer: 0, transform: 0 },
    ];

    setupRoom(0, atlas, tiles);
    room.emit(new RenderEvent(ctx, 0));

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("does nothing when state is missing", () => {
    room = new Entity([new TileLayerRenderBehavior(0)]);
    room.emit(new RenderEvent(ctx, 0));
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("handles 180 and 270 degree rotations", () => {
    const atlas = [staticFrame(0, 0, 16)];
    const tiles: PlacedTile[] = [
      { tile: 0, x: 0, y: 0, renderLayer: 0, transform: 2 },
      { tile: 0, x: 1, y: 0, renderLayer: 0, transform: 3 },
    ];

    setupRoom(0, atlas, tiles);
    room.emit(new RenderEvent(ctx, 0));

    const rotate = ctx.rotate as ReturnType<typeof vi.fn>;
    expect(rotate.mock.calls[0][0]).toBeCloseTo(Math.PI); // 180deg
    expect(rotate.mock.calls[1][0]).toBeCloseTo((3 * Math.PI) / 2); // 270deg
  });
});
