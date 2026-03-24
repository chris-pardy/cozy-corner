import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefPicker, type StrongRef } from "./RefPicker";
import { DirectionPicker, ROOM_DIR_BITS } from "./DirectionPicker";
import { PDSBrowser } from "~/atproto/PDSBrowser";
import {
  fetchRecord,
  getSession,
  saveRecord,
  parseAtUri,
  extractBlobCid,
  blobUrl,
  loadImage,
  uploadBlob,
} from "./load-record";
import type { AnimationLayer, StateProperty, StateValue } from "~/atproto/generated/types/at/cozy-corner/defs";
import { StateValueEditor, type StatePropertyData } from "./StatePropertyEditor";
import type { StateValueData } from "./editor-types";
import { ColorPicker } from "./ColorPicker";
import { ScriptEditor, scriptSummary, newScript } from "./ScriptEditor";
import type { Script as ScriptModel } from "~/atproto/generated/types/at/cozy-corner/script";
import { computeSpawnTiles, generateBlockingFromWalls } from "./room-helpers";
import {
  RoomEditorProvider,
  createRoomEditorInitialState,
  useRoomEditorDispatch,
  useRoomEditorSelector,
  useRoomEditorStore,
  setRoomName,
  setGridWidth as setGridWidthAction,
  setGridHeight as setGridHeightAction,
  addPlacedTile,
  setPlacedTiles,
  addExit,
  updateExit,
  removeExit,
  setSpawnTiles,
  setBlockingEdges,
  setBackground,
  addRoomItem,
  removeRoomItem,
  updateRoomItemState,
  updateRoomItemTints,
  type ChannelTintData,
  addRoomCritter,
  removeRoomCritter,
  updateCritterArea,
  updateCritterName,
  updateCritterState,
  setTileAttributes,
  addRoomBehavior,
  removeRoomBehavior,
  updateRoomBehavior,
  type PlacedTile,
  type RoomExitData,
  type RoomItemData,
  type RoomCritterData,
  type TileAttributeData,
  type BackgroundDataState,
} from "./store";
import "./editor.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TilesetTile {
  index: number;
  name: string;
  image: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  wall: boolean;
}

interface LoadedTileset {
  ref: StrongRef;
  name: string;
  tiles: TilesetTile[];
}

/** Merged type for items: Redux data + preview fields for rendering */
interface RoomItemWithPreview extends RoomItemData {
  _name?: string;
  _image?: HTMLImageElement;
  _layer?: AnimationLayer;
  _layers: AnimationLayer[];
  _itemWidth: number;
  _itemHeight: number;
  _overridableProps?: StatePropertyData[];
}

/** Merged type for critters: Redux data + preview fields for rendering */
interface RoomCritterWithPreview extends RoomCritterData {
  _displayName?: string;
  _image?: HTMLImageElement;
  _layer?: AnimationLayer;
  _overridableProps?: StatePropertyData[];
}

/** Full background data including non-serializable file/previewUrl fields */
type BackgroundData =
  | { type: "none" }
  | { type: "color"; color: string }
  | {
      type: "gradient";
      angle: number;
      stops: { color: string; position?: number }[];
    }
  | { type: "image"; file: File | null; previewUrl: string | null; blobRef?: unknown };

type EditorMode =
  | "tiles"
  | "spawn"
  | "exits"
  | "blocking"
  | "items"
  | "critters"
  | "attributes"
  | "background"
  | "behaviors";

/** Variant info extracted from an item record for preview purposes. */
interface VariantPreview {
  name: string;
  target: string;
  layer: AnimationLayer | null;
  itemWidth: number;
  itemHeight: number;
}

/** Preview data for items and critters (non-serializable) */
interface RecordPreviewData {
  name: string;
  image: HTMLImageElement | null;
  layer: AnimationLayer | null;
  layers: AnimationLayer[];
  overridableProps: StatePropertyData[];
  variants?: VariantPreview[];
}

const TILE_SIZE = 32;
const GRID_DEFAULT = 16;

// Direction bitmask constants
const DIR_N = 1;
const DIR_E = 2;
const DIR_S = 4;
const DIR_W = 8;

// ---------------------------------------------------------------------------
// Edge-based blocking helpers
// ---------------------------------------------------------------------------

/** An edge between two adjacent tiles. */
interface EdgeCoord {
  /** "h" = horizontal edge (between rows), "v" = vertical edge (between columns) */
  orientation: "h" | "v";
  /** For "h": tile x; for "v": tile x to the left of the edge */
  x: number;
  /** For "h": tile y above the edge; for "v": tile y */
  y: number;
}

/** "physical" = movement only, "ephemeral" = light/sound only, "both" = movement + light/sound */
type BlockingLayer = "physical" | "ephemeral" | "both";

/**
 * Returns 2-bit edge state for physical blocking: bit0 = blocks forward (south/east), bit1 = blocks backward (north/west).
 * State 0=open, 1=one-way(backward allowed), 2=one-way(forward allowed), 3=wall.
 */
function getEdgePhysical(edges: number[], gridWidth: number, edge: EdgeCoord): number {
  if (edge.orientation === "h") {
    const aboveIdx = edge.y * gridWidth + edge.x;
    const belowIdx = (edge.y + 1) * gridWidth + edge.x;
    const blocksForward = (edges[belowIdx] ?? 0) & DIR_N ? 1 : 0;
    const blocksBackward = (edges[aboveIdx] ?? 0) & DIR_S ? 1 : 0;
    return (blocksBackward << 1) | blocksForward;
  } else {
    const leftIdx = edge.y * gridWidth + edge.x;
    const rightIdx = edge.y * gridWidth + edge.x + 1;
    const blocksForward = (edges[rightIdx] ?? 0) & DIR_W ? 1 : 0;
    const blocksBackward = (edges[leftIdx] ?? 0) & DIR_E ? 1 : 0;
    return (blocksBackward << 1) | blocksForward;
  }
}

/** Returns 2-bit edge state for ephemeral blocking (bits 4-7). */
function getEdgeEphemeral(edges: number[], gridWidth: number, edge: EdgeCoord): number {
  if (edge.orientation === "h") {
    const aboveIdx = edge.y * gridWidth + edge.x;
    const belowIdx = (edge.y + 1) * gridWidth + edge.x;
    const blocksForward = ((edges[belowIdx] ?? 0) >> 4) & DIR_N ? 1 : 0;
    const blocksBackward = ((edges[aboveIdx] ?? 0) >> 4) & DIR_S ? 1 : 0;
    return (blocksBackward << 1) | blocksForward;
  } else {
    const leftIdx = edge.y * gridWidth + edge.x;
    const rightIdx = edge.y * gridWidth + edge.x + 1;
    const blocksForward = ((edges[rightIdx] ?? 0) >> 4) & DIR_W ? 1 : 0;
    const blocksBackward = ((edges[leftIdx] ?? 0) >> 4) & DIR_E ? 1 : 0;
    return (blocksBackward << 1) | blocksForward;
  }
}

/**
 * Set the 2-bit edge state, returning a new array.
 * "physical" sets bits 0-3 only. "ephemeral" sets bits 4-7 only. "both" sets both.
 */
function setEdgeState(edges: number[], gridWidth: number, totalTiles: number, edge: EdgeCoord, layer: BlockingLayer, state: number): number[] {
  const next = [...edges];
  while (next.length < totalTiles) next.push(0);
  const setPhys = layer === "physical" || layer === "both";
  const setEph = layer === "ephemeral" || layer === "both";
  if (edge.orientation === "h") {
    const aboveIdx = edge.y * gridWidth + edge.x;
    const belowIdx = (edge.y + 1) * gridWidth + edge.x;
    if (setPhys) {
      if (state & 1) next[belowIdx] |= DIR_N; else next[belowIdx] &= ~DIR_N;
      if (state & 2) next[aboveIdx] |= DIR_S; else next[aboveIdx] &= ~DIR_S;
    }
    if (setEph) {
      if (state & 1) next[belowIdx] |= DIR_N << 4; else next[belowIdx] &= ~(DIR_N << 4);
      if (state & 2) next[aboveIdx] |= DIR_S << 4; else next[aboveIdx] &= ~(DIR_S << 4);
    }
  } else {
    const leftIdx = edge.y * gridWidth + edge.x;
    const rightIdx = edge.y * gridWidth + edge.x + 1;
    if (setPhys) {
      if (state & 1) next[rightIdx] |= DIR_W; else next[rightIdx] &= ~DIR_W;
      if (state & 2) next[leftIdx] |= DIR_E; else next[leftIdx] &= ~DIR_E;
    }
    if (setEph) {
      if (state & 1) next[rightIdx] |= DIR_W << 4; else next[rightIdx] &= ~(DIR_W << 4);
      if (state & 2) next[leftIdx] |= DIR_E << 4; else next[leftIdx] &= ~(DIR_E << 4);
    }
  }
  return next;
}

/** Cycle edge state: open → wall → one-way forward → one-way backward → open */
function cycleEdgeState(current: number): number {
  switch (current) {
    case 0: return 3;
    case 3: return 1;
    case 1: return 2;
    case 2: return 0;
    default: return 3;
  }
}

/** Draw an edge on the canvas with direction indicators. */
function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: EdgeCoord,
  state: number,
  color: string,
  dashed: boolean,
) {
  if (state === 0) return;
  const TS = TILE_SIZE;
  let x1: number, y1: number, x2: number, y2: number;
  if (edge.orientation === "h") {
    x1 = edge.x * TS + 3; y1 = (edge.y + 1) * TS;
    x2 = (edge.x + 1) * TS - 3; y2 = y1;
  } else {
    x1 = (edge.x + 1) * TS; y1 = edge.y * TS + 3;
    x2 = x1; y2 = (edge.y + 1) * TS - 3;
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  if (dashed) ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);

  // One-way arrows
  if (state === 1 || state === 2) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (edge.orientation === "h") {
      // state 1 = blocks forward (south), backward (north) allowed → arrow points up
      // state 2 = blocks backward (north), forward (south) allowed → arrow points down
      const dy = state === 2 ? 1 : -1;
      ctx.moveTo(mx - 4, my + dy * 1);
      ctx.lineTo(mx + 4, my + dy * 1);
      ctx.lineTo(mx, my + dy * 5);
    } else {
      const dx = state === 2 ? 1 : -1;
      ctx.moveTo(mx + dx * 1, my - 4);
      ctx.lineTo(mx + dx * 1, my + 4);
      ctx.lineTo(mx + dx * 5, my);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Tileset loading
// ---------------------------------------------------------------------------

async function loadTileset(
  pds: string,
  ref: StrongRef,
): Promise<LoadedTileset> {
  const { did, collection, rkey } = parseAtUri(ref.uri);
  const rec = await fetchRecord(pds, did, collection, rkey);
  const v = rec.value;

  const cid = extractBlobCid(v.spriteSheet);
  const sheetImage = await loadImage(blobUrl(pds, did, cid));

  const layers = (v.layers ?? []) as AnimationLayer[];
  const tileRecords = (v.tiles ?? []) as { name: string; target: string; wall?: boolean }[];

  const layerMap = new Map<string, AnimationLayer>();
  for (const layer of layers) {
    if (!layerMap.has(layer.target)) layerMap.set(layer.target, layer);
  }

  const tiles: TilesetTile[] = [];
  for (let i = 0; i < tileRecords.length; i++) {
    const tr = tileRecords[i];
    const layer = layerMap.get(tr.target);
    const f0 = layer?.frames[0];
    const fw = f0?.width ?? sheetImage.width;
    const fh = f0?.height ?? sheetImage.height;
    const fc = layer ? layer.frames.length : 1;
    const sx = f0?.x ?? 0;
    const sy = f0?.y ?? 0;

    const canvas = document.createElement("canvas");
    canvas.width = fw;
    canvas.height = fh;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(sheetImage, sx, sy, fw, fh, 0, 0, fw, fh);
    const img = await loadImage(canvas.toDataURL());

    tiles.push({ index: i, name: tr.name, image: img, frameWidth: fw, frameHeight: fh, frameCount: fc, wall: !!tr.wall });
  }

  return { ref, name: (v.name as string) ?? "Tileset", tiles };
}

/** Load an item or critter record to get its first-frame preview */
async function loadRecordPreview(
  pds: string,
  ref: StrongRef,
): Promise<RecordPreviewData> {
  const { did, collection, rkey } = parseAtUri(ref.uri);
  const rec = await fetchRecord(pds, did, collection, rkey);
  const v = rec.value;
  const name = (v.name as string) ?? rkey;
  const overridableProps = ((v.stateProperties ?? []) as StateProperty[])
    .filter((sp) => sp.allowOverride)
    .map((sp) => ({ name: sp.name, type: sp.type, default: sp.default ?? "", allowOverride: true }));
  const cid = extractBlobCid(v.spriteSheet);
  if (!cid) return { name, image: null, layer: null, layers: [], overridableProps };
  const img = await loadImage(blobUrl(pds, did, cid));
  const layers = (v.layers ?? []) as AnimationLayer[];
  // Extract variant info for items
  const rawVariants = (v.variants ?? []) as { name: string; target: string; itemWidth?: number; itemHeight?: number }[];
  const variants: VariantPreview[] = rawVariants.map((rv) => ({
    name: rv.name,
    target: rv.target,
    layer: layers.find((l) => l.target === rv.target) ?? null,
    itemWidth: rv.itemWidth ?? 1,
    itemHeight: rv.itemHeight ?? 1,
  }));
  return { name, image: img, layer: layers[0] ?? null, layers, overridableProps, variants: variants.length > 0 ? variants : undefined };
}

// ---------------------------------------------------------------------------
// TilePalette
// ---------------------------------------------------------------------------

function TilePalette({
  tileset,
  selectedTile,
  tint,
  onSelect,
}: {
  tileset: LoadedTileset;
  selectedTile: number | null;
  tint?: string;
  onSelect: (index: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="ale-label">{tileset.name}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 40px)", gap: 2 }}>
        {tileset.tiles.map((tile) => (
          <button
            key={tile.index}
            onClick={() => onSelect(tile.index)}
            title={tile.name}
            style={{
              width: 40, height: 40,
              border: selectedTile === tile.index ? "2px solid var(--accent-primary)" : "2px solid var(--border-color)",
              borderRadius: 2, background: "var(--bg-deep)", padding: 0,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}
          >
            <TileThumb tile={tile} size={36} tint={tint} />
          </button>
        ))}
      </div>
    </div>
  );
}

function TileThumb({ tile, size, tint }: { tile: TilesetTile; size: number; tint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;
    const scale = Math.min(size / tile.frameWidth, size / tile.frameHeight);
    const dw = tile.frameWidth * scale;
    const dh = tile.frameHeight * scale;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(tile.image, 0, 0, tile.frameWidth, tile.frameHeight, (size - dw) / 2, (size - dh) / 2, dw, dh);
    if (tint) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(tile.image, 0, 0, tile.frameWidth, tile.frameHeight, (size - dw) / 2, (size - dh) / 2, dw, dh);
    }
  }, [tile, size, tint]);
  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: "pixelated", display: "block" }} />;
}

/** Renders a single animation layer frame from a sprite sheet image. */
function ItemSpritePreview({ image, layer, size }: { image: HTMLImageElement; layer: AnimationLayer; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !layer.frames.length) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const f = layer.frames[0];
    const scale = Math.min(size / f.width, size / f.height);
    const dw = f.width * scale;
    const dh = f.height * scale;
    ctx.drawImage(image, f.x, f.y, f.width, f.height, (size - dw) / 2, (size - dh) / 2, dw, dh);
  }, [image, layer, size]);
  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: "pixelated", display: "block" }} />;
}

// ---------------------------------------------------------------------------
// Helper: draw a single tile onto a canvas context
// ---------------------------------------------------------------------------

function drawTileAt(
  ctx: CanvasRenderingContext2D,
  tileData: TilesetTile,
  px: number,
  py: number,
  transform: number,
) {
  ctx.save();
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;
  ctx.translate(cx, cy);
  const rotation = transform & 3;
  const hflip = (transform & 4) !== 0;
  const vflip = (transform & 8) !== 0;
  if (hflip || vflip) ctx.scale(hflip ? -1 : 1, vflip ? -1 : 1);
  if (rotation) ctx.rotate((rotation * Math.PI) / 2);
  const scale = Math.min(TILE_SIZE / tileData.frameWidth, TILE_SIZE / tileData.frameHeight);
  const dw = tileData.frameWidth * scale;
  const dh = tileData.frameHeight * scale;
  ctx.drawImage(tileData.image, 0, 0, tileData.frameWidth, tileData.frameHeight, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// GridCanvas
// ---------------------------------------------------------------------------

function GridCanvas({
  gridWidth, gridHeight, tiles, exits, spawnTiles, tileset, mode,
  selectedTile, activeLayer: _activeLayer, transform,
  blockingEdges, items, critters, tileAttributes, activeAttribute,
  itemGhost,
  onGridClick, onGridDrag, onGridRightClick,
  onEdgeClick, onEdgeDrag,
  hoverTile, onHoverChange,
  hoverEdge, onEdgeHoverChange,
}: {
  gridWidth: number;
  gridHeight: number;
  tiles: PlacedTile[];
  exits: RoomExitData[];
  spawnTiles: number[];
  tileset: LoadedTileset | null;
  mode: EditorMode;
  selectedTile: number | null;
  activeLayer: number;
  transform: number;
  blockingEdges: number[];
  items: RoomItemWithPreview[];
  critters: RoomCritterWithPreview[];
  tileAttributes: TileAttributeData[];
  activeAttribute: string;
  itemGhost?: { image: HTMLImageElement; layer: AnimationLayer; width: number; height: number } | null;
  onGridClick: (x: number, y: number, button: number) => void;
  onGridDrag: (x: number, y: number, button: number) => void;
  onGridRightClick: (x: number, y: number) => void;
  onEdgeClick?: (edge: EdgeCoord, button: number) => void;
  onEdgeDrag?: (edge: EdgeCoord, button: number) => void;
  hoverTile: { x: number; y: number } | null;
  onHoverChange: (coord: { x: number; y: number } | null) => void;
  hoverEdge?: EdgeCoord | null;
  onEdgeHoverChange?: (edge: EdgeCoord | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPaintingRef = useRef<false | number>(false);

  const canvasWidth = gridWidth * TILE_SIZE;
  const canvasHeight = gridHeight * TILE_SIZE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.imageSmoothingEnabled = false;

    // Background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Tiles sorted by renderLayer
    const sorted = [...tiles].sort((a, b) => a.renderLayer - b.renderLayer);
    for (const placed of sorted) {
      const tileData = tileset?.tiles[placed.tile];
      if (!tileData) continue;
      if (placed.tint) {
        // Draw to temp canvas, multiply tint, restore alpha, stamp
        const tmp = document.createElement("canvas");
        tmp.width = TILE_SIZE; tmp.height = TILE_SIZE;
        const tc = tmp.getContext("2d")!;
        tc.imageSmoothingEnabled = false;
        drawTileAt(tc, tileData, 0, 0, placed.transform);
        tc.globalCompositeOperation = "multiply";
        tc.fillStyle = placed.tint;
        tc.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        tc.globalCompositeOperation = "destination-in";
        drawTileAt(tc, tileData, 0, 0, placed.transform);
        ctx.drawImage(tmp, placed.x * TILE_SIZE, placed.y * TILE_SIZE);
      } else {
        drawTileAt(ctx, tileData, placed.x * TILE_SIZE, placed.y * TILE_SIZE, placed.transform);
      }
      if (placed.renderLayer === 2) {
        ctx.fillStyle = "rgba(34, 211, 238, 0.08)";
        ctx.fillRect(placed.x * TILE_SIZE, placed.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Items (only show overlay in items mode)
    if (mode === "items") for (const item of items) {
      const iw = item._itemWidth;
      const ih = item._itemHeight;
      const px = item.x * TILE_SIZE;
      const py = item.y * TILE_SIZE;
      const pw = iw * TILE_SIZE;
      const ph = ih * TILE_SIZE;
      if (item._image && item._layer) {
        ctx.save();
        ctx.globalAlpha = item.foreground ? 1 : 0.85;
        const f0 = item._layer.frames[0];
        const sw = f0?.width ?? item._image.width;
        const sh = f0?.height ?? item._image.height;
        const scale = Math.min(pw / sw, ph / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        ctx.drawImage(item._image, f0?.x ?? 0, f0?.y ?? 0, sw, sh, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(74, 222, 128, 0.2)";
        ctx.fillRect(px + 2, py + 2, pw - 4, ph - 4);
      }
      // Item border
      ctx.strokeStyle = "rgba(74, 222, 128, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    }

    // Critter areas (only show overlay in critters mode)
    if (mode === "critters") for (const critter of critters) {
      for (let i = 0; i < critter.area.length; i++) {
        if (!critter.area[i]) continue;
        const cx = i % gridWidth;
        const cy = Math.floor(i / gridWidth);
        ctx.fillStyle = "rgba(167, 139, 250, 0.15)";
        ctx.fillRect(cx * TILE_SIZE, cy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = "rgba(167, 139, 250, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx * TILE_SIZE + 1, cy * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    }

    // Spawn tiles (only show overlay in spawn mode)
    if (mode === "spawn") for (let i = 0; i < spawnTiles.length; i++) {
      if (!spawnTiles[i]) continue;
      const sx = (i % gridWidth) * TILE_SIZE;
      const sy = Math.floor(i / gridWidth) * TILE_SIZE;
      ctx.fillStyle = "rgba(74, 222, 128, 0.2)";
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 1, sy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }

    // Exits (only show overlay in exits mode)
    if (mode === "exits") for (const exit of exits) {
      const ex = exit.x * TILE_SIZE;
      const ey = exit.y * TILE_SIZE;
      const ew = (exit.width || 1) * TILE_SIZE;
      const eh = (exit.height || 1) * TILE_SIZE;
      ctx.fillStyle = "rgba(236, 72, 153, 0.2)";
      ctx.fillRect(ex, ey, ew, eh);
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 2;
      ctx.strokeRect(ex + 1, ey + 1, ew - 2, eh - 2);
      if (exit.label) {
        ctx.font = "8px 'Pixelify Sans'";
        ctx.fillStyle = "#ec4899";
        ctx.fillText(exit.label, ex + 4, ey + 12, ew - 8);
      }
    }

    // Blocking edge overlay — draw per shared edge
    if (mode === "blocking") {
      // Horizontal internal edges
      for (let ey = 0; ey < gridHeight - 1; ey++) {
        for (let ex = 0; ex < gridWidth; ex++) {
          const edge: EdgeCoord = { orientation: "h", x: ex, y: ey };
          const phys = getEdgePhysical(blockingEdges, gridWidth, edge);
          const eph = getEdgeEphemeral(blockingEdges, gridWidth, edge);
          if (phys && eph) {
            // Both: draw solid purple
            drawEdge(ctx, edge, phys, "#c084fc", false);
          } else {
            drawEdge(ctx, edge, phys, "#f87171", false);
            drawEdge(ctx, edge, eph, "#38bdf8", true);
          }
        }
      }
      // Vertical internal edges
      for (let ey = 0; ey < gridHeight; ey++) {
        for (let ex = 0; ex < gridWidth - 1; ex++) {
          const edge: EdgeCoord = { orientation: "v", x: ex, y: ey };
          const phys = getEdgePhysical(blockingEdges, gridWidth, edge);
          const eph = getEdgeEphemeral(blockingEdges, gridWidth, edge);
          if (phys && eph) {
            drawEdge(ctx, edge, phys, "#c084fc", false);
          } else {
            drawEdge(ctx, edge, phys, "#f87171", false);
            drawEdge(ctx, edge, eph, "#38bdf8", true);
          }
        }
      }
      // Edge hover highlight
      if (hoverEdge) {
        const TS = TILE_SIZE;
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 5;
        if (hoverEdge.orientation === "h") {
          const hx = hoverEdge.x * TS + 2;
          const hy = (hoverEdge.y + 1) * TS;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + TS - 4, hy); ctx.stroke();
        } else {
          const hx = (hoverEdge.x + 1) * TS;
          const hy = hoverEdge.y * TS + 2;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + TS - 4); ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Tile attribute overlay (lighting etc.)
    if (mode === "attributes" && activeAttribute) {
      const attr = tileAttributes.find((a) => a.attribute === activeAttribute);
      if (attr) {
        if (activeAttribute === "light") {
          // Preview matching the in-game LightOverlayBehavior
          const LIGHT_STEPS = [255, 204, 153, 102, 51, 0];
          for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
              const raw = attr.values[y * gridWidth + x] ?? 100;
              // PDS 0-200 → normalized 0…1 (only positive half is light)
              const light = Math.max(0, (raw - 100) / 100);
              let alpha: number;
              if (light <= 0) alpha = LIGHT_STEPS[0];
              else if (light >= 1) alpha = LIGHT_STEPS[LIGHT_STEPS.length - 1];
              else {
                const idx = Math.floor(light * (LIGHT_STEPS.length - 1));
                alpha = LIGHT_STEPS[idx];
              }
              if (alpha > 0) {
                ctx.fillStyle = `rgba(0, 0, 0, ${alpha / 255})`;
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
              }
            }
          }
        } else {
          for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
              const val = attr.values[y * gridWidth + x] ?? 100;
              if (val < 100) {
                ctx.fillStyle = `rgba(0, 0, 0, ${(100 - val) / 100 * 0.7})`;
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
              } else if (val > 100) {
                ctx.fillStyle = `rgba(255, 240, 180, ${(val - 100) / 100 * 0.4})`;
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
              }
            }
          }
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= gridWidth; x++) {
      ctx.beginPath(); ctx.moveTo(x * TILE_SIZE + 0.5, 0); ctx.lineTo(x * TILE_SIZE + 0.5, canvasHeight); ctx.stroke();
    }
    for (let y = 0; y <= gridHeight; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * TILE_SIZE + 0.5); ctx.lineTo(canvasWidth, y * TILE_SIZE + 0.5); ctx.stroke();
    }

    // Ghost preview (tiles mode)
    if (hoverTile && mode === "tiles" && selectedTile != null && tileset) {
      const tileData = tileset.tiles[selectedTile];
      if (tileData) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        drawTileAt(ctx, tileData, hoverTile.x * TILE_SIZE, hoverTile.y * TILE_SIZE, transform);
        ctx.restore();
      }
    }

    // Ghost preview (items mode)
    if (hoverTile && mode === "items") {
      const gw = itemGhost?.width ?? 1;
      const gh = itemGhost?.height ?? 1;
      const gpx = hoverTile.x * TILE_SIZE;
      const gpy = hoverTile.y * TILE_SIZE;
      const gpw = gw * TILE_SIZE;
      const gph = gh * TILE_SIZE;
      if (itemGhost) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        const f0 = itemGhost.layer.frames[0];
        if (f0) {
          const scale = Math.min(gpw / f0.width, gph / f0.height);
          const dw = f0.width * scale;
          const dh = f0.height * scale;
          ctx.drawImage(itemGhost.image, f0.x, f0.y, f0.width, f0.height, gpx + (gpw - dw) / 2, gpy + (gph - dh) / 2, dw, dh);
        }
        ctx.restore();
      }
      ctx.strokeStyle = "rgba(74, 222, 128, 0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(gpx + 1, gpy + 1, gpw - 2, gph - 2);
    }

    // Critter/attribute hover
    if (hoverTile && (mode === "critters" || mode === "attributes")) {
      ctx.strokeStyle = mode === "critters" ? "rgba(167, 139, 250, 0.6)" : "rgba(251, 191, 36, 0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(hoverTile.x * TILE_SIZE + 1, hoverTile.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }

    // Spawn mode hover
    if (hoverTile && mode === "spawn") {
      ctx.fillStyle = "rgba(74, 222, 128, 0.15)";
      ctx.fillRect(hoverTile.x * TILE_SIZE, hoverTile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Exit mode hover
    if (hoverTile && mode === "exits") {
      ctx.fillStyle = "rgba(236, 72, 153, 0.15)";
      ctx.fillRect(hoverTile.x * TILE_SIZE, hoverTile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  });

  const getTileCoord = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      const x = Math.floor(((e.clientX - rect.left) * scaleX) / TILE_SIZE);
      const y = Math.floor(((e.clientY - rect.top) * scaleY) / TILE_SIZE);
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return null;
      return { x, y };
    },
    [canvasWidth, canvasHeight, gridWidth, gridHeight],
  );

  const getEdgeCoord = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): EdgeCoord | null => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;

      const nearestHLine = Math.round(py / TILE_SIZE);
      const nearestVLine = Math.round(px / TILE_SIZE);
      const distH = Math.abs(py - nearestHLine * TILE_SIZE);
      const distV = Math.abs(px - nearestVLine * TILE_SIZE);
      const threshold = TILE_SIZE * 0.3;

      if (distH < threshold && distH <= distV) {
        if (nearestHLine <= 0 || nearestHLine >= gridHeight) return null;
        const tileX = Math.floor(px / TILE_SIZE);
        if (tileX < 0 || tileX >= gridWidth) return null;
        return { orientation: "h", x: tileX, y: nearestHLine - 1 };
      }
      if (distV < threshold) {
        if (nearestVLine <= 0 || nearestVLine >= gridWidth) return null;
        const tileY = Math.floor(py / TILE_SIZE);
        if (tileY < 0 || tileY >= gridHeight) return null;
        return { orientation: "v", x: nearestVLine - 1, y: tileY };
      }
      return null;
    },
    [canvasWidth, canvasHeight, gridWidth, gridHeight],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (mode === "blocking") {
        const edge = getEdgeCoord(e);
        onEdgeHoverChange?.(edge);
        onHoverChange(null);
        if (isPaintingRef.current !== false && edge) {
          onEdgeDrag?.(edge, isPaintingRef.current);
        }
      } else {
        const coord = getTileCoord(e);
        onHoverChange(coord);
        onEdgeHoverChange?.(null);
        if (isPaintingRef.current !== false && coord) {
          onGridDrag(coord.x, coord.y, isPaintingRef.current);
        }
      }
    },
    [mode, getTileCoord, getEdgeCoord, onHoverChange, onEdgeHoverChange, onGridDrag, onEdgeDrag],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (mode === "blocking") {
        const edge = getEdgeCoord(e);
        if (!edge) return;
        onEdgeClick?.(edge, e.button);
        isPaintingRef.current = e.button;
      } else {
        const coord = getTileCoord(e);
        if (!coord) return;
        if (e.button === 2) {
          onGridRightClick(coord.x, coord.y);
          isPaintingRef.current = 2;
        } else {
          onGridClick(coord.x, coord.y, e.button);
          isPaintingRef.current = e.button;
        }
      }
    },
    [mode, getTileCoord, getEdgeCoord, onGridClick, onGridRightClick, onEdgeClick],
  );

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={() => { isPaintingRef.current = false; }}
      onMouseLeave={() => { onHoverChange(null); onEdgeHoverChange?.(null); isPaintingRef.current = false; }}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: canvasWidth, height: canvasHeight, maxWidth: "100%",
        imageRendering: "pixelated", display: "block",
        cursor: mode === "tiles" ? "crosshair" : "pointer",
        border: "2px solid var(--border-color)", borderRadius: 2,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// ExitEditor
// ---------------------------------------------------------------------------

function ExitEditor({
  exit, index, pds, roomUri, allExits, onChange, onRemove,
}: {
  exit: RoomExitData; index: number; pds: string;
  roomUri: string | undefined;
  allExits: RoomExitData[];
  onChange: (index: number, exit: RoomExitData) => void;
  onRemove: (index: number) => void;
}) {
  const [showBrowser, setShowBrowser] = useState(false);
  const [browseHandle, setBrowseHandle] = useState("");
  const [browseActor, setBrowseActor] = useState<string | null>(null);

  const isSelfTarget = exit.target != null && roomUri != null && exit.target.uri === roomUri;

  const targetDisplay = exit.target
    ? isSelfTarget
      ? "This Room"
      : exit.target.uri.replace("at://", "").replace("at.cozy-corner.house.room/", "")
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 8, background: "var(--bg-panel)", border: "2px solid var(--border-color)", borderRadius: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ale-label" style={{ padding: 0 }}>
          Exit ({exit.x}, {exit.y})
        </span>
        <button onClick={() => onRemove(index)} title="Remove exit" style={{ fontSize: 14, background: "none", border: "none", color: "var(--clr-error)", cursor: "pointer" }}>&times;</button>
      </div>

      <input className="bae-input" value={exit.label} onChange={(e) => onChange(index, { ...exit, label: e.target.value })} placeholder="Label (e.g. Kitchen)" maxLength={64} />

      <div className="ale-label" style={{ fontSize: 7, marginTop: 2 }}>Target Room</div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {exit.target ? (
          <div style={{ flex: 1, fontSize: 10, color: isSelfTarget ? "var(--clr-success)" : "var(--accent-secondary)", background: isSelfTarget ? "color-mix(in srgb, var(--clr-success) 8%, transparent)" : "color-mix(in srgb, var(--accent-secondary) 8%, transparent)", border: `1px solid ${isSelfTarget ? "color-mix(in srgb, var(--clr-success) 20%, transparent)" : "color-mix(in srgb, var(--accent-secondary) 20%, transparent)"}`, borderRadius: 2, padding: "3px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={exit.target.uri}>{targetDisplay}</div>
        ) : (
          <div style={{ flex: 1, fontSize: 10, color: "var(--text-muted)" }}>No target set</div>
        )}
        {roomUri && (
          <button onClick={() => onChange(index, { ...exit, target: { uri: roomUri, cid: "" }, targetExit: undefined })} style={{ fontSize: 8, fontFamily: "'Pixelify Sans'", color: "var(--clr-success)", background: "color-mix(in srgb, var(--clr-success) 10%, transparent)", border: "2px solid var(--border-color)", borderRadius: 2, padding: "3px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>This Room</button>
        )}
        <button onClick={() => setShowBrowser(true)} style={{ fontSize: 8, fontFamily: "'Pixelify Sans'", color: "var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)", border: "2px solid var(--border-color)", borderRadius: 2, padding: "3px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>Browse</button>
        {exit.target && <button onClick={() => onChange(index, { ...exit, target: null, targetExit: undefined })} title="Clear target" style={{ fontSize: 10, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px 4px" }}>&times;</button>}
      </div>

      {/* Target exit picker for same-room exits */}
      {isSelfTarget && (
        <div>
          <div className="ale-label" style={{ fontSize: 7, marginTop: 2 }}>Destination Exit</div>
          <select
            className="bae-input"
            value={exit.targetExit ?? ""}
            onChange={(e) => onChange(index, { ...exit, targetExit: e.target.value === "" ? undefined : +e.target.value })}
            style={{ fontSize: 10 }}
          >
            <option value="">Auto (reciprocal)</option>
            {allExits.map((other, i) => i !== index && (
              <option key={i} value={i}>
                #{i} — {other.label || `(${other.x}, ${other.y})`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div className="ale-label" style={{ fontSize: 7 }}>W</div>
          <input className="bae-input" type="number" min={1} max={8} value={exit.width} onChange={(e) => onChange(index, { ...exit, width: Math.max(1, Math.min(8, +e.target.value || 1)) })} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="ale-label" style={{ fontSize: 7 }}>H</div>
          <input className="bae-input" type="number" min={1} max={8} value={exit.height} onChange={(e) => onChange(index, { ...exit, height: Math.max(1, Math.min(8, +e.target.value || 1)) })} />
        </div>
        <div>
          <div className="ale-label" style={{ fontSize: 7 }}>Dir</div>
          <DirectionPicker
            value={exit.direction}
            onChange={(v) => onChange(index, { ...exit, direction: v || 15 })}
            bits={ROOM_DIR_BITS}
          />
        </div>
      </div>

      {showBrowser && (
        <div className="bae-overlay" style={{ zIndex: 60 }} onClick={() => setShowBrowser(false)}>
          <div className="bae-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: "80vh", overflow: "auto" }}>
            <div className="bae-modal-header">
              <span className="ale-label">Select Target Room</span>
              <button onClick={() => setShowBrowser(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14 }}>&times;</button>
            </div>
            <div style={{ padding: 12 }}>
              <form onSubmit={(e) => { e.preventDefault(); const v = browseHandle.trim(); if (v) setBrowseActor(v); }} style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                <input className="bae-input" style={{ flex: 1 }} value={browseHandle} onChange={(e) => setBrowseHandle(e.target.value)} placeholder="Handle or DID" />
                <button type="submit" style={{ fontSize: 8, fontFamily: "'Pixelify Sans'", color: "var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)", border: "2px solid var(--accent-primary)", borderRadius: 2, padding: "4px 12px", cursor: "pointer" }}>Lookup</button>
              </form>
              {browseActor && <PDSBrowser key={browseActor} actor={browseActor} pds={pds} allowedTypes={["room"]} onSelectRecord={(uri, cid) => { onChange(index, { ...exit, target: { uri, cid }, targetExit: undefined }); setShowBrowser(false); }} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BackgroundEditor
// ---------------------------------------------------------------------------

function BackgroundEditor({
  bg, onChange,
}: {
  bg: BackgroundData;
  onChange: (bg: BackgroundData) => void;
}) {
  const types = ["none", "color", "gradient", "image"] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === "none") onChange({ type: "none" });
              else if (t === "color") onChange({ type: "color", color: "#1a1a2e" });
              else if (t === "gradient") onChange({ type: "gradient", angle: 0, stops: [{ color: "#1a1a2e" }, { color: "#87ceeb" }] });
              else onChange({ type: "image", file: null, previewUrl: null });
            }}
            style={{
              flex: 1, padding: "3px 0", fontSize: 7, fontFamily: "'Pixelify Sans'",
              background: bg.type === t ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "transparent",
              border: `2px solid ${bg.type === t ? "var(--accent-primary)" : "var(--border-color)"}`,
              borderRadius: 2, color: bg.type === t ? "var(--accent-primary)" : "var(--text-muted)", cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {bg.type === "color" && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="color" value={bg.color} onChange={(e) => onChange({ ...bg, color: e.target.value })} style={{ width: 32, height: 24, border: "none", padding: 0, cursor: "pointer" }} />
          <input className="bae-input" value={bg.color} onChange={(e) => onChange({ ...bg, color: e.target.value })} maxLength={7} style={{ width: 80 }} />
        </div>
      )}

      {bg.type === "gradient" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div className="ale-label" style={{ fontSize: 7 }}>Angle</div>
            <input className="bae-input" type="number" min={0} max={359} value={bg.angle} onChange={(e) => onChange({ ...bg, angle: Math.max(0, Math.min(359, +e.target.value || 0)) })} style={{ width: 60 }} />
          </div>
          {bg.stops.map((stop, i) => (
            <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input type="color" value={stop.color} onChange={(e) => { const stops = [...bg.stops]; stops[i] = { ...stop, color: e.target.value }; onChange({ ...bg, stops }); }} style={{ width: 24, height: 20, border: "none", padding: 0, cursor: "pointer" }} />
              <input className="bae-input" value={stop.color} onChange={(e) => { const stops = [...bg.stops]; stops[i] = { ...stop, color: e.target.value }; onChange({ ...bg, stops }); }} maxLength={7} style={{ flex: 1 }} />
              {bg.stops.length > 2 && (
                <button onClick={() => { const stops = bg.stops.filter((_, j) => j !== i); onChange({ ...bg, stops }); }} style={{ fontSize: 10, background: "none", border: "none", color: "var(--clr-error)", cursor: "pointer" }}>&times;</button>
              )}
            </div>
          ))}
          {bg.stops.length < 8 && (
            <button onClick={() => onChange({ ...bg, stops: [...bg.stops, { color: "#ffffff" }] })} style={{ fontSize: 8, fontFamily: "'Pixelify Sans'", color: "var(--text-muted)", background: "none", border: "2px solid var(--border-color)", borderRadius: 2, padding: "3px 8px", cursor: "pointer" }}>+ Stop</button>
          )}
        </div>
      )}

      {bg.type === "image" && (
        <div>
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onChange({ type: "image", file, previewUrl: file ? URL.createObjectURL(file) : null });
            }}
            style={{ fontSize: 10, color: "var(--text-primary)" }}
          />
          {bg.previewUrl && (
            <img src={bg.previewUrl} alt="" style={{ maxWidth: 200, maxHeight: 100, marginTop: 4, imageRendering: "pixelated", border: "2px solid var(--border-color)", borderRadius: 2 }} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModeButton helper
// ---------------------------------------------------------------------------

function ModeButton({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  const c = color ?? "var(--accent-primary)";
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "4px 0", fontSize: 8, fontFamily: "'Pixelify Sans'",
        background: active ? `color-mix(in srgb, ${c} 15%, transparent)` : "transparent",
        border: `2px solid ${active ? c : "var(--border-color)"}`,
        borderRadius: 2, color: active ? c : "var(--text-muted)", cursor: "pointer", textTransform: "uppercase",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// RoomRecordData – shape returned by the query function
// ---------------------------------------------------------------------------

interface RoomRecordData {
  name: string;
  tileset: LoadedTileset | null;
  placedTiles: PlacedTile[];
  gridWidth: number;
  gridHeight: number;
  exits: RoomExitData[];
  spawnTiles: number[];
  blockingEdges: number[];
  background: BackgroundData;
  items: RoomItemData[];
  critters: RoomCritterData[];
  tileAttributes: TileAttributeData[];
  behaviors: ScriptModel[];
  /** Preview data for items, keyed by item URI */
  itemPreviews: Map<string, RecordPreviewData>;
  /** Preview data for critters, keyed by critter URI */
  critterPreviews: Map<string, RecordPreviewData>;
}

// ---------------------------------------------------------------------------
// RoomEditor (outer wrapper – loads data via useQuery)
// ---------------------------------------------------------------------------

export function RoomEditor({ uri, editRkey }: { uri?: string; editRkey?: string }) {
  const session = useMemo(() => { try { return getSession(); } catch { return null; } }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["room-editor", uri],
    queryFn: async (): Promise<RoomRecordData> => {
      if (!session) throw new Error("Not logged in");
      const { did, collection, rkey } = parseAtUri(uri!);
      const rec = await fetchRecord(session.pds, did, collection, rkey);
      const v = rec.value;

      // Tileset
      let loadedTileset: LoadedTileset | null = null;
      const tilesetRef = v.tileset as { uri: string; cid: string } | undefined;
      if (tilesetRef?.uri) {
        try { loadedTileset = await loadTileset(session.pds, tilesetRef); } catch (err) { console.error("Failed to load tileset", err); }
      }

      // Parse tiles
      const rawTiles = (v.tiles ?? []) as Record<string, unknown>[];
      const parsedTiles: PlacedTile[] = rawTiles.map((t) => {
        const tints = t.tints as { tint?: string }[] | undefined;
        return { tile: (t.tile as number) ?? 0, x: (t.x as number) ?? 0, y: (t.y as number) ?? 0, transform: (t.transform as number) ?? 0, renderLayer: (t.renderLayer as number) ?? 0, layerName: t.layerName as string | undefined, ...(tints?.[0]?.tint ? { tint: tints[0].tint } : {}) };
      });

      // Grid size
      let gw = GRID_DEFAULT, gh = GRID_DEFAULT;
      if (parsedTiles.length > 0) {
        const maxX = Math.max(...parsedTiles.map((t) => t.x));
        const maxY = Math.max(...parsedTiles.map((t) => t.y));
        gw = Math.max(GRID_DEFAULT, maxX + 1);
        gh = Math.max(GRID_DEFAULT, maxY + 1);
      }

      // Exits
      const rawExits = (v.exits ?? []) as Array<Record<string, unknown>>;
      const parsedExits: RoomExitData[] = rawExits.map((e) => ({
        label: (e.label as string) ?? "",
        target: e.target && typeof e.target === "object" && "uri" in (e.target as object)
          ? e.target as unknown as StrongRef
          : typeof e.target === "string" && e.target
            ? { uri: e.target as string, cid: "" } as StrongRef
            : null,
        targetExit: typeof e.targetExit === "number" ? e.targetExit : undefined,
        x: (e.x as number) ?? 0,
        y: (e.y as number) ?? 0,
        width: (e.width as number) ?? 1,
        height: (e.height as number) ?? 1,
        direction: (e.direction as number) ?? 15,
      }));

      // Spawn tiles
      const parsedSpawnTiles: number[] = Array.isArray(v.spawnTiles) ? v.spawnTiles as number[] : [];

      // Blocking
      const parsedBlocking: number[] = Array.isArray(v.blockingEdges) ? v.blockingEdges as number[] : [];

      // Background
      let parsedBackground: BackgroundData = { type: "none" };
      const bg = v.background as Record<string, unknown> | undefined;
      if (bg) {
        if (bg.$type === "at.cozy-corner.house.room#backgroundColor" || bg.color) {
          parsedBackground = { type: "color", color: (bg.color as string) ?? "#1a1a2e" };
        } else if (bg.$type === "at.cozy-corner.house.room#backgroundGradient" || bg.stops) {
          parsedBackground = { type: "gradient", angle: (bg.angle as number) ?? 0, stops: (bg.stops as { color: string; position?: number }[]) ?? [] };
        } else if (bg.$type === "at.cozy-corner.house.room#backgroundImage" || bg.image) {
          parsedBackground = { type: "image", file: null, previewUrl: null, blobRef: bg.image };
        }
      }

      // Items + previews
      const rawItems = (v.items ?? []) as { item: { uri: string; cid: string }; x: number; y: number; variant?: number; foreground?: number; state?: StateValue[]; tints?: { channel: string; tint: string }[] }[];
      const loadedItems: RoomItemData[] = [];
      const itemPreviews = new Map<string, RecordPreviewData>();
      for (const ri of rawItems) {
        const state = (ri.state ?? []).map((sv: StateValue) => ({ name: sv.name, value: sv.value ?? "" }));
        const tints: ChannelTintData[] = (ri.tints ?? []).map((ct) => ({ channel: ct.channel, tint: ct.tint }));
        const item: RoomItemData = { item: ri.item, x: ri.x ?? 0, y: ri.y ?? 0, variant: ri.variant ?? 0, foreground: ri.foreground ?? 0, state, tints };
        try {
          const p = await loadRecordPreview(session.pds, ri.item);
          itemPreviews.set(ri.item.uri, p);
        } catch { /* best effort */ }
        loadedItems.push(item);
      }

      // Critters + previews
      const rawCritters = (v.critters ?? []) as { critter: { uri: string; cid: string }; area: number[]; name?: string; state?: StateValue[] }[];
      const loadedCritters: RoomCritterData[] = [];
      const critterPreviews = new Map<string, RecordPreviewData>();
      for (const rc of rawCritters) {
        const state = (rc.state ?? []).map((sv: StateValue) => ({ name: sv.name, value: sv.value ?? "" }));
        const critter: RoomCritterData = { critter: rc.critter, area: rc.area ?? [], name: rc.name ?? "", state };
        try {
          const p = await loadRecordPreview(session.pds, rc.critter);
          critterPreviews.set(rc.critter.uri, p);
        } catch { /* best effort */ }
        loadedCritters.push(critter);
      }

      // Tile attributes
      const parsedAttrs: TileAttributeData[] = Array.isArray(v.tileAttributes)
        ? (v.tileAttributes as TileAttributeData[]).map((a) => ({ attribute: a.attribute, values: [...(a.values ?? [])] }))
        : [];

      // Behaviors
      const parsedBehaviors: ScriptModel[] = Array.isArray(v.behaviors) ? v.behaviors as ScriptModel[] : [];

      return {
        name: (v.name as string) ?? "",
        tileset: loadedTileset,
        placedTiles: parsedTiles,
        gridWidth: gw,
        gridHeight: gh,
        exits: parsedExits,
        spawnTiles: parsedSpawnTiles,
        blockingEdges: parsedBlocking,
        background: parsedBackground,
        items: loadedItems,
        critters: loadedCritters,
        tileAttributes: parsedAttrs,
        behaviors: parsedBehaviors,
        itemPreviews,
        critterPreviews,
      };
    },
    enabled: !!uri && !!session,
  });

  if (isLoading) {
    return <div className="text-text-muted text-xs py-8 text-center">Loading...</div>;
  }

  return <RoomEditorForm key={uri} initialData={data} uri={uri} editRkey={editRkey} />;
}

// ---------------------------------------------------------------------------
// RoomEditorForm (creates initial Redux state + preview maps, wraps Provider)
// ---------------------------------------------------------------------------

function RoomEditorForm({ initialData, uri, editRkey }: {
  initialData?: RoomRecordData;
  uri?: string;
  editRkey?: string;
}) {
  // Split loaded data into serializable Redux state and local preview maps
  const { reduxInitialState, initialItemPreviews, initialCritterPreviews, initialBackground } = useMemo(() => {
    // Build serializable background state for Redux
    const bgData = initialData?.background;
    let bgState: BackgroundDataState = { type: "none" };
    if (bgData) {
      if (bgData.type === "color") {
        bgState = { type: "color", color: bgData.color };
      } else if (bgData.type === "gradient") {
        bgState = { type: "gradient", angle: bgData.angle, stops: bgData.stops };
      } else if (bgData.type === "image") {
        bgState = { type: "image", blobRef: bgData.blobRef };
      }
    }

    return {
      reduxInitialState: createRoomEditorInitialState({
        name: initialData?.name ?? "",
        gridWidth: initialData?.gridWidth ?? GRID_DEFAULT,
        gridHeight: initialData?.gridHeight ?? GRID_DEFAULT,
        placedTiles: initialData?.placedTiles ?? [],
        exits: initialData?.exits ?? [],
        spawnTiles: initialData?.spawnTiles ?? [],
        blockingEdges: initialData?.blockingEdges ?? [],
        background: bgState,
        roomItems: initialData?.items ?? [],
        roomCritters: initialData?.critters ?? [],
        tileAttributes: initialData?.tileAttributes ?? [],
        behaviors: initialData?.behaviors ?? [],
      }),
      initialItemPreviews: initialData?.itemPreviews ?? new Map<string, RecordPreviewData>(),
      initialCritterPreviews: initialData?.critterPreviews ?? new Map<string, RecordPreviewData>(),
      initialBackground: initialData?.background ?? { type: "none" } as BackgroundData,
    };
  }, [initialData]);

  return (
    <RoomEditorProvider initialState={reduxInitialState}>
      <RoomEditorInner
        uri={uri}
        editRkey={editRkey}
        initialTileset={initialData?.tileset ?? null}
        initialItemPreviews={initialItemPreviews}
        initialCritterPreviews={initialCritterPreviews}
        initialBackground={initialBackground}
      />
    </RoomEditorProvider>
  );
}

// ---------------------------------------------------------------------------
// RoomEditorInner (uses Redux hooks + local state for ephemeral UI)
// ---------------------------------------------------------------------------

function RoomEditorInner({ uri, editRkey, initialTileset, initialItemPreviews, initialCritterPreviews, initialBackground }: {
  uri?: string;
  editRkey?: string;
  initialTileset: LoadedTileset | null;
  initialItemPreviews: Map<string, RecordPreviewData>;
  initialCritterPreviews: Map<string, RecordPreviewData>;
  initialBackground: BackgroundData;
}) {
  const dispatch = useRoomEditorDispatch();
  const store = useRoomEditorStore();
  const session = useMemo(() => { try { return getSession(); } catch { return null; } }, []);

  // ---------------------------------------------------------------------------
  // Redux selectors
  // ---------------------------------------------------------------------------
  const name = useRoomEditorSelector((s) => s.editor.name);
  const gridWidth = useRoomEditorSelector((s) => s.editor.gridWidth);
  const gridHeight = useRoomEditorSelector((s) => s.editor.gridHeight);
  const placedTiles = useRoomEditorSelector((s) => s.editor.placedTiles);
  const exits = useRoomEditorSelector((s) => s.editor.exits);
  const spawnTiles = useRoomEditorSelector((s) => s.editor.spawnTiles);
  const blockingEdges = useRoomEditorSelector((s) => s.editor.blockingEdges);
  const _reduxBackground = useRoomEditorSelector((s) => s.editor.background);
  const roomItems = useRoomEditorSelector((s) => s.editor.roomItems);
  const roomCritters = useRoomEditorSelector((s) => s.editor.roomCritters);
  const tileAttributes = useRoomEditorSelector((s) => s.editor.tileAttributes);
  const behaviors = useRoomEditorSelector((s) => s.editor.behaviors);

  // ---------------------------------------------------------------------------
  // Local ephemeral state
  // ---------------------------------------------------------------------------

  // Tileset
  const [tileset, setTileset] = useState<LoadedTileset | null>(initialTileset);
  const [tilesetLoading, setTilesetLoading] = useState(false);
  const [showTilesetPicker, setShowTilesetPicker] = useState(false);

  // Tool state
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const [tileTint, setTileTint] = useState<string>("");
  const [transform, setTransform] = useState(0);

  // Editor mode
  const [mode, setMode] = useState<EditorMode>("tiles");

  // Hover
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<EdgeCoord | null>(null);

  // Blocking
  const [blockingType, setBlockingType] = useState<BlockingLayer>("physical");

  // Attribute tool
  const [activeAttribute, setActiveAttribute] = useState("light");
  const [attrBrushValue, setAttrBrushValue] = useState(150);

  // Item picker / selection
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [pendingItem, setPendingItem] = useState<StrongRef | null>(null);
  const [pendingVariant, setPendingVariant] = useState(0);
  const [pendingTints, setPendingTints] = useState<ChannelTintData[]>([]);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);

  // Critter picker / selection
  const [showCritterPicker, setShowCritterPicker] = useState(false);
  const [activeCritterIdx, setActiveCritterIdx] = useState<number | null>(null);

  // Behavior editing
  const [editingBehaviorIdx, setEditingBehaviorIdx] = useState<number | null>(null);

  // Save state
  const [currentRkey, setCurrentRkey] = useState(editRkey);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUri, setSavedUri] = useState<string | null>(null);

  // Background (local: includes non-serializable file/previewUrl)
  const [background, setBackgroundLocal] = useState<BackgroundData>(initialBackground);

  // Sync background: when local background changes, push serializable parts to Redux
  const handleBackgroundChange = useCallback((bg: BackgroundData) => {
    setBackgroundLocal(bg);
    // Push serializable parts to Redux
    if (bg.type === "none") {
      dispatch(setBackground({ type: "none" }));
    } else if (bg.type === "color") {
      dispatch(setBackground({ type: "color", color: bg.color }));
    } else if (bg.type === "gradient") {
      dispatch(setBackground({ type: "gradient", angle: bg.angle, stops: bg.stops }));
    } else if (bg.type === "image") {
      dispatch(setBackground({ type: "image", blobRef: bg.blobRef }));
    }
  }, [dispatch]);

  // ---------------------------------------------------------------------------
  // Non-serializable preview maps (items/critters)
  // ---------------------------------------------------------------------------
  const itemPreviewsRef = useRef<Map<string, RecordPreviewData>>(initialItemPreviews);
  const critterPreviewsRef = useRef<Map<string, RecordPreviewData>>(initialCritterPreviews);
  const [previewVersion, setPreviewVersion] = useState(0);

  // Pending item preview data (attached to pendingItem for display)
  const pendingItemPreviewRef = useRef<RecordPreviewData | null>(null);

  // Merge Redux item data with preview data for rendering
  const mergedItems: RoomItemWithPreview[] = useMemo(() => {
    void previewVersion; // depend on version counter
    return roomItems.map((it: RoomItemData) => {
      const preview = itemPreviewsRef.current.get(it.item.uri);
      const variant = preview?.variants?.[it.variant];
      return {
        ...it,
        _name: preview?.name,
        _image: preview?.image ?? undefined,
        _layer: variant?.layer ?? preview?.layer ?? undefined,
        _layers: preview?.layers ?? [],
        _itemWidth: variant?.itemWidth ?? 1,
        _itemHeight: variant?.itemHeight ?? 1,
        _overridableProps: preview?.overridableProps,
      };
    });
  }, [roomItems, previewVersion]);

  // Merge Redux critter data with preview data for rendering
  const mergedCritters: RoomCritterWithPreview[] = useMemo(() => {
    void previewVersion; // depend on version counter
    return roomCritters.map((c: RoomCritterData) => {
      const preview = critterPreviewsRef.current.get(c.critter.uri);
      return {
        ...c,
        _displayName: preview?.name,
        _image: preview?.image ?? undefined,
        _layer: preview?.layer ?? undefined,
        _overridableProps: preview?.overridableProps,
      };
    });
  }, [roomCritters, previewVersion]);

  // Ghost preview data for the pending item (passed to GridCanvas)
  const itemGhost = useMemo(() => {
    void previewVersion;
    if (!pendingItem) return null;
    const preview = pendingItemPreviewRef.current ?? itemPreviewsRef.current.get(pendingItem.uri);
    if (!preview?.image) return null;
    const variant = preview.variants?.[pendingVariant];
    const layer = variant?.layer ?? preview.layer;
    if (!layer) return null;
    return {
      image: preview.image,
      layer,
      width: variant?.itemWidth ?? 1,
      height: variant?.itemHeight ?? 1,
    };
  }, [pendingItem, pendingVariant, previewVersion]);

  // ---------------------------------------------------------------------------
  // Ensure blocking array is sized correctly
  // ---------------------------------------------------------------------------
  const totalTiles = gridWidth * gridHeight;
  useEffect(() => {
    const st = store.getState().editor;
    const prev = st.blockingEdges;
    if (prev.length === totalTiles) return;
    const next = new Array(totalTiles).fill(0);
    for (let i = 0; i < Math.min(prev.length, totalTiles); i++) next[i] = prev[i];
    dispatch(setBlockingEdges(next));
  }, [totalTiles, store, dispatch]);

  // ---------------------------------------------------------------------------
  // Tileset selection
  // ---------------------------------------------------------------------------
  const handleTilesetSelect = useCallback(async (ref: StrongRef) => {
    if (!session) return;
    setShowTilesetPicker(false);
    setTilesetLoading(true);
    try { const loaded = await loadTileset(session.pds, ref); setTileset(loaded); setSelectedTile(null); if (!uri) dispatch(setPlacedTiles([])); }
    catch (err) { console.error("Failed to load tileset", err); }
    finally { setTilesetLoading(false); }
  }, [session, uri, dispatch]);

  // ---------------------------------------------------------------------------
  // Item selection from inventory
  // ---------------------------------------------------------------------------
  const handleItemSelect = useCallback(async (ref: StrongRef) => {
    if (!session) return;
    setShowItemPicker(false);
    setPendingItem(ref);
    setPendingVariant(0);
    setPendingTints([]);
    pendingItemPreviewRef.current = null;
    // Pre-load the preview
    try {
      const p = await loadRecordPreview(session.pds, ref);
      // Store preview in the map
      itemPreviewsRef.current.set(ref.uri, p);
      pendingItemPreviewRef.current = p;
      setPreviewVersion((v) => v + 1);
    } catch { /* ok */ }
  }, [session]);

  // ---------------------------------------------------------------------------
  // Critter selection from inventory
  // ---------------------------------------------------------------------------
  const handleCritterSelect = useCallback(async (ref: StrongRef) => {
    if (!session) return;
    setShowCritterPicker(false);
    const critterData: RoomCritterData = { critter: ref, area: new Array(totalTiles).fill(0), name: "", state: [] };
    try {
      const p = await loadRecordPreview(session.pds, ref);
      critterPreviewsRef.current.set(ref.uri, p);
      setPreviewVersion((v) => v + 1);
    } catch { /* ok */ }
    dispatch(addRoomCritter(critterData));
    setActiveCritterIdx(store.getState().editor.roomCritters.length - 1);
  }, [session, totalTiles, dispatch, store]);

  // ---------------------------------------------------------------------------
  // Grid click handlers — read state from store.getState() for hot path
  // ---------------------------------------------------------------------------
  const handleGridClick = useCallback((x: number, y: number, _button: number) => {
    if (mode === "tiles") {
      if (selectedTile == null || !tileset) return;
      dispatch(addPlacedTile({ tile: selectedTile, x, y, transform, renderLayer: activeLayer, ...(tileTint ? { tint: tileTint } : {}) }));
    } else if (mode === "spawn") {
      const st = store.getState().editor;
      const prev = st.spawnTiles;
      const next = [...prev];
      while (next.length < totalTiles) next.push(0);
      const idx = y * gridWidth + x;
      next[idx] = next[idx] ? 0 : 1;
      dispatch(setSpawnTiles(next));
    } else if (mode === "exits") {
      dispatch(addExit({ label: "", target: null, x, y, width: 1, height: 1, direction: 15 }));
    } else if (mode === "items" && pendingItem) {
      const newItem: RoomItemData = { item: pendingItem, x, y, variant: pendingVariant, foreground: 0, state: [], tints: [...pendingTints] };
      // Ensure preview data is in the map
      if (pendingItemPreviewRef.current && !itemPreviewsRef.current.has(pendingItem.uri)) {
        itemPreviewsRef.current.set(pendingItem.uri, pendingItemPreviewRef.current);
        setPreviewVersion((v) => v + 1);
      }
      dispatch(addRoomItem(newItem));
    } else if (mode === "critters" && activeCritterIdx != null) {
      const st = store.getState().editor;
      const c = st.roomCritters[activeCritterIdx];
      if (!c) return;
      const area = [...c.area];
      const idx = y * gridWidth + x;
      area[idx] = area[idx] ? 0 : 1;
      dispatch(updateCritterArea({ index: activeCritterIdx, area }));
    } else if (mode === "attributes") {
      const st = store.getState().editor;
      const existing = st.tileAttributes.find((a: TileAttributeData) => a.attribute === activeAttribute);
      if (existing) {
        const updated = st.tileAttributes.map((a: TileAttributeData) => {
          if (a.attribute !== activeAttribute) return a;
          const values = [...a.values];
          while (values.length < totalTiles) values.push(100);
          values[y * gridWidth + x] = attrBrushValue;
          return { ...a, values };
        });
        dispatch(setTileAttributes(updated));
      } else {
        const values = new Array(totalTiles).fill(100);
        values[y * gridWidth + x] = attrBrushValue;
        dispatch(setTileAttributes([...st.tileAttributes, { attribute: activeAttribute, values }]));
      }
    }
  }, [mode, selectedTile, tileset, activeLayer, transform, tileTint, gridWidth, pendingItem, pendingVariant, activeCritterIdx, activeAttribute, attrBrushValue, totalTiles, dispatch, store]);

  const handleGridDrag = useCallback((x: number, y: number, button: number) => {
    if (mode === "tiles") {
      if (button === 2) {
        // Right-drag: remove topmost tile at this position on active layer
        const st = store.getState().editor;
        const prev = st.placedTiles;
        let idx = -1;
        for (let i = prev.length - 1; i >= 0; i--) { if (prev[i].x === x && prev[i].y === y && prev[i].renderLayer === activeLayer) { idx = i; break; } }
        if (idx >= 0) dispatch(setPlacedTiles(prev.filter((_: PlacedTile, i: number) => i !== idx)));
      } else if (selectedTile != null && tileset) {
        // Left-drag: add tile if not already the topmost at this position
        const st = store.getState().editor;
        const prev = st.placedTiles;
        let last: PlacedTile | undefined;
        for (let i = prev.length - 1; i >= 0; i--) { if (prev[i].x === x && prev[i].y === y && prev[i].renderLayer === activeLayer) { last = prev[i]; break; } }
        if (last && last.tile === selectedTile && last.transform === transform && (last.tint ?? "") === tileTint) return;
        dispatch(addPlacedTile({ tile: selectedTile, x, y, transform, renderLayer: activeLayer, ...(tileTint ? { tint: tileTint } : {}) }));
      }
    } else if (mode === "spawn") {
      const st = store.getState().editor;
      const prev = st.spawnTiles;
      const next = [...prev];
      while (next.length < totalTiles) next.push(0);
      const idx = y * gridWidth + x;
      next[idx] = button === 2 ? 0 : 1;
      dispatch(setSpawnTiles(next));
    } else if (mode === "critters" && activeCritterIdx != null) {
      const st = store.getState().editor;
      const c = st.roomCritters[activeCritterIdx];
      if (!c) return;
      const area = [...c.area];
      area[y * gridWidth + x] = button === 2 ? 0 : 1;
      dispatch(updateCritterArea({ index: activeCritterIdx, area }));
    } else if (mode === "attributes") {
      if (button === 2) {
        const st = store.getState().editor;
        const updated = st.tileAttributes.map((a: TileAttributeData) => {
          if (a.attribute !== activeAttribute) return a;
          const values = [...a.values]; values[y * gridWidth + x] = 100; return { ...a, values };
        });
        dispatch(setTileAttributes(updated));
      } else {
        const st = store.getState().editor;
        const existing = st.tileAttributes.find((a: TileAttributeData) => a.attribute === activeAttribute);
        if (existing) {
          const updated = st.tileAttributes.map((a: TileAttributeData) => {
            if (a.attribute !== activeAttribute) return a;
            const values = [...a.values]; while (values.length < totalTiles) values.push(100); values[y * gridWidth + x] = attrBrushValue; return { ...a, values };
          });
          dispatch(setTileAttributes(updated));
        } else {
          const values = new Array(totalTiles).fill(100);
          values[y * gridWidth + x] = attrBrushValue;
          dispatch(setTileAttributes([...st.tileAttributes, { attribute: activeAttribute, values }]));
        }
      }
    }
  }, [mode, selectedTile, tileset, activeLayer, transform, tileTint, gridWidth, activeCritterIdx, activeAttribute, attrBrushValue, totalTiles, dispatch, store]);

  const handleGridRightClick = useCallback((x: number, y: number) => {
    if (mode === "tiles") {
      // Remove topmost tile at this position on active layer
      const st = store.getState().editor;
      const prev = st.placedTiles;
      let idx = -1;
      for (let i = prev.length - 1; i >= 0; i--) { if (prev[i].x === x && prev[i].y === y && prev[i].renderLayer === activeLayer) { idx = i; break; } }
      if (idx >= 0) dispatch(setPlacedTiles(prev.filter((_: PlacedTile, i: number) => i !== idx)));
    } else if (mode === "items") {
      const st = store.getState().editor;
      const prev = st.roomItems;
      let idx = -1;
      for (let i = prev.length - 1; i >= 0; i--) { if (prev[i].x === x && prev[i].y === y) { idx = i; break; } }
      if (idx >= 0) dispatch(removeRoomItem(idx));
    } else if (mode === "critters" && activeCritterIdx != null) {
      const st = store.getState().editor;
      const c = st.roomCritters[activeCritterIdx];
      if (!c) return;
      const area = [...c.area]; area[y * gridWidth + x] = 0;
      dispatch(updateCritterArea({ index: activeCritterIdx, area }));
    } else if (mode === "attributes") {
      const st = store.getState().editor;
      const updated = st.tileAttributes.map((a: TileAttributeData) => { if (a.attribute !== activeAttribute) return a; const values = [...a.values]; values[y * gridWidth + x] = 100; return { ...a, values }; });
      dispatch(setTileAttributes(updated));
    }
  }, [mode, activeLayer, gridWidth, activeCritterIdx, activeAttribute, dispatch, store]);

  // Clear all blocking (physical + ephemeral) on an edge
  const clearEdge = useCallback((prev: number[], edge: EdgeCoord) => {
    const next = [...prev];
    while (next.length < totalTiles) next.push(0);
    if (edge.orientation === "h") {
      const aboveIdx = edge.y * gridWidth + edge.x;
      const belowIdx = (edge.y + 1) * gridWidth + edge.x;
      next[aboveIdx] &= ~(DIR_S | (DIR_S << 4));
      next[belowIdx] &= ~(DIR_N | (DIR_N << 4));
    } else {
      const leftIdx = edge.y * gridWidth + edge.x;
      const rightIdx = edge.y * gridWidth + edge.x + 1;
      next[leftIdx] &= ~(DIR_E | (DIR_E << 4));
      next[rightIdx] &= ~(DIR_W | (DIR_W << 4));
    }
    return next;
  }, [gridWidth, totalTiles]);

  // Edge-based blocking handlers
  const handleEdgeClick = useCallback((edge: EdgeCoord, button: number) => {
    const st = store.getState().editor;
    if (button === 2) {
      dispatch(setBlockingEdges(clearEdge(st.blockingEdges, edge)));
    } else {
      // Left-click: cycle the selected blocking type
      const current = blockingType === "ephemeral"
        ? getEdgeEphemeral(st.blockingEdges, gridWidth, edge)
        : getEdgePhysical(st.blockingEdges, gridWidth, edge);
      dispatch(setBlockingEdges(setEdgeState(st.blockingEdges, gridWidth, totalTiles, edge, blockingType, cycleEdgeState(current))));
    }
  }, [gridWidth, totalTiles, blockingType, clearEdge, dispatch, store]);

  const handleEdgeDrag = useCallback((edge: EdgeCoord, button: number) => {
    const st = store.getState().editor;
    if (button === 2) {
      dispatch(setBlockingEdges(clearEdge(st.blockingEdges, edge)));
    } else {
      // Left-drag: paint wall (blocks both directions) for selected type
      dispatch(setBlockingEdges(setEdgeState(st.blockingEdges, gridWidth, totalTiles, edge, blockingType, 3)));
    }
  }, [gridWidth, totalTiles, blockingType, clearEdge, dispatch, store]);

  // Transform helpers
  const rotation = transform & 3;
  const hflip = (transform & 4) !== 0;
  const vflip = (transform & 8) !== 0;
  const cycleRotation = useCallback(() => setTransform((t) => (t & ~3) | (((t & 3) + 1) % 4)), []);
  const toggleHFlip = useCallback(() => setTransform((t) => t ^ 4), []);
  const toggleVFlip = useCallback(() => setTransform((t) => t ^ 8), []);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "r") cycleRotation();
      if (e.key === "f") toggleHFlip();
      if (e.key === "v") toggleVFlip();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleRotation, toggleHFlip, toggleVFlip]);

  // Validation
  const canSave = name.trim().length > 0 && tileset != null && placedTiles.length > 0;

  // Save
  async function doSave(rkey?: string) {
    if (!session || !tileset) return;
    setSaving(true);
    setSaveError(null);

    try {
      // Read all state from Redux store
      const st = store.getState().editor;

      const tileRecords = st.placedTiles.map((t: PlacedTile) => ({
        $type: "at.cozy-corner.house.room#tilePosition" as const,
        tile: t.tile, x: t.x, y: t.y,
        ...(t.transform ? { transform: t.transform } : {}),
        ...(t.renderLayer ? { renderLayer: t.renderLayer } : {}),
        ...(t.layerName ? { layerName: t.layerName } : {}),
        ...(t.tint ? { tints: [{ $type: "at.cozy-corner.defs#channelTint" as const, channel: "primary", tint: t.tint }] } : {}),
      }));

      const exitRecords = st.exits.map((e: RoomExitData) => ({
        $type: "at.cozy-corner.house.room#exit" as const,
        x: e.x, y: e.y,
        ...(e.label ? { label: e.label } : {}),
        ...(e.target ? { target: e.target } : {}),
        ...(e.targetExit != null ? { targetExit: e.targetExit } : {}),
        ...(e.width !== 1 ? { width: e.width } : {}),
        ...(e.height !== 1 ? { height: e.height } : {}),
        ...(e.direction !== 15 ? { direction: e.direction } : {}),
      }));

      // Background — use local state (has file/previewUrl for upload)
      let bgRecord: Record<string, unknown> | undefined;
      if (background.type === "color") {
        bgRecord = { $type: "at.cozy-corner.house.room#backgroundColor", color: background.color };
      } else if (background.type === "gradient") {
        bgRecord = { $type: "at.cozy-corner.house.room#backgroundGradient", angle: background.angle, stops: background.stops.map((s) => ({ $type: "at.cozy-corner.house.room#gradientStop", color: s.color, ...(s.position != null ? { position: s.position } : {}) })) };
      } else if (background.type === "image") {
        let blobRef = background.blobRef;
        if (background.file && !blobRef) {
          const buf = await background.file.arrayBuffer();
          blobRef = await uploadBlob(session, buf, background.file.type);
        }
        if (blobRef) bgRecord = { $type: "at.cozy-corner.house.room#backgroundImage", image: blobRef };
      }

      // Items
      const itemRecords = st.roomItems.map((it: RoomItemData) => {
        const stateValues = it.state.filter((s: StateValueData) => s.value !== "");
        // Write ChannelTint records
        const tintRecords = it.tints.map((ct) => ({
          $type: "at.cozy-corner.defs#channelTint" as const,
          channel: ct.channel,
          tint: ct.tint,
        }));
        return {
          $type: "at.cozy-corner.house.room#roomItem" as const,
          item: it.item, x: it.x, y: it.y,
          ...(it.variant ? { variant: it.variant } : {}),
          ...(it.foreground ? { foreground: it.foreground } : {}),
          ...(stateValues.length > 0 ? { state: stateValues.map((sv: StateValueData) => ({ $type: "at.cozy-corner.defs#stateValue" as const, name: sv.name, value: sv.value })) } : {}),
          ...(tintRecords.length > 0 ? { tints: tintRecords } : {}),
        };
      });

      // Critters
      const critterRecords = st.roomCritters.map((c: RoomCritterData) => {
        const stateValues = c.state.filter((s: StateValueData) => s.value !== "");
        return {
          $type: "at.cozy-corner.house.room#roomCritter" as const,
          critter: c.critter, area: c.area,
          ...(c.name ? { name: c.name } : {}),
          ...(stateValues.length > 0 ? { state: stateValues.map((sv: StateValueData) => ({ $type: "at.cozy-corner.defs#stateValue" as const, name: sv.name, value: sv.value })) } : {}),
        };
      });

      // Tile attributes (filter out all-neutral)
      const attrRecords = st.tileAttributes
        .filter((a: TileAttributeData) => a.values.some((v: number) => v !== 100))
        .map((a: TileAttributeData) => ({ $type: "at.cozy-corner.house.room#tileAttribute" as const, attribute: a.attribute, values: a.values }));

      // Blocking (only if any non-zero)
      const hasBlocking = st.blockingEdges.some((v: number) => v !== 0);

      const record: Record<string, unknown> = {
        $type: "at.cozy-corner.house.room",
        name: st.name.trim(),
        width: st.gridWidth,
        tileset: tileset.ref,
        tiles: tileRecords,
        ...(exitRecords.length > 0 ? { exits: exitRecords } : {}),
        ...(st.spawnTiles.some((v: number) => v !== 0) ? { spawnTiles: st.spawnTiles } : {}),
        createdAt: new Date().toISOString(),
        ...(bgRecord ? { background: bgRecord } : {}),
        ...(hasBlocking ? { blockingEdges: st.blockingEdges } : {}),
        ...(itemRecords.length > 0 ? { items: itemRecords } : {}),
        ...(critterRecords.length > 0 ? { critters: critterRecords } : {}),
        ...(attrRecords.length > 0 ? { tileAttributes: attrRecords } : {}),
        ...(st.behaviors.length > 0 ? { behaviors: st.behaviors } : {}),
      };

      const saved = await saveRecord(session, "at.cozy-corner.house.room", record, rkey);
      setSavedUri(saved);
      if (!rkey) setCurrentRkey(parseAtUri(saved).rkey);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const handleSave = useCallback(() => doSave(currentRkey), [name, tileset, placedTiles, exits, spawnTiles, currentRkey, session, background, blockingEdges, roomItems, roomCritters, tileAttributes, behaviors]);
  const handleSaveNew = useCallback(() => doSave(undefined), [name, tileset, placedTiles, exits, spawnTiles, session, background, blockingEdges, roomItems, roomCritters, tileAttributes, behaviors]);

  const LAYER_LABELS = ["Background", "Foreground", "Overhead"];
  const ROTATION_LABELS = ["0°", "90°", "180°", "270°"];
  const ALL_MODES: { key: EditorMode; label: string; color?: string }[] = [
    { key: "tiles", label: "Tiles" },
    { key: "spawn", label: "Spawn", color: "var(--clr-success)" },
    { key: "exits", label: "Exits" },
    { key: "items", label: "Items", color: "var(--clr-success)" },
    { key: "critters", label: "Critters", color: "#a78bfa" },
    { key: "blocking", label: "Block", color: "var(--clr-error)" },
    { key: "attributes", label: "Attrs", color: "var(--accent-tertiary)" },
    { key: "background", label: "BG" },
    { key: "behaviors", label: "Bhvr", color: "#60a5fa" },
  ];

  return (
    <div className="bae-root">
      {/* Left sidebar */}
      <div className="bae-meta">
        <div className="ale-label">Room Name</div>
        <input className="bae-input" value={name} onChange={(e) => dispatch(setRoomName(e.target.value))} placeholder="e.g. Kitchen, Bedroom" maxLength={64} />

        {/* Grid size */}
        <div className="ale-label" style={{ marginTop: 12 }}>Grid Size</div>
        <div style={{ display: "flex", gap: 4 }}>
          <input className="bae-input" type="number" min={4} max={64} value={gridWidth} onChange={(e) => dispatch(setGridWidthAction(Math.max(4, Math.min(64, +e.target.value || GRID_DEFAULT))))} style={{ width: 60 }} />
          <span style={{ color: "var(--text-muted)", lineHeight: "28px" }}>&times;</span>
          <input className="bae-input" type="number" min={4} max={64} value={gridHeight} onChange={(e) => dispatch(setGridHeightAction(Math.max(4, Math.min(64, +e.target.value || GRID_DEFAULT))))} style={{ width: 60 }} />
        </div>

        {/* Tileset */}
        <div className="ale-label" style={{ marginTop: 12 }}>Tileset</div>
        {tileset ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", background: "var(--bg-panel)", border: "2px solid var(--border-color)", borderRadius: 2 }}>
              <span style={{ fontSize: 11, color: "var(--text-primary)" }}>{tileset.name}</span>
              <button onClick={() => setShowTilesetPicker(true)} style={{ fontSize: 9, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer" }}>Change</button>
            </div>
            {mode === "tiles" && <TilePalette tileset={tileset} selectedTile={selectedTile} tint={tileTint || undefined} onSelect={setSelectedTile} />}
          </div>
        ) : (
          <button className="spe-done-btn" onClick={() => setShowTilesetPicker(true)} disabled={tilesetLoading} style={{ width: "100%" }}>
            {tilesetLoading ? "Loading..." : "Select Tileset"}
          </button>
        )}

        {/* Mode selector */}
        {tileset && (
          <>
            <div className="ale-label" style={{ marginTop: 12 }}>Mode</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {ALL_MODES.map((m) => (
                <ModeButton key={m.key} label={m.label} active={mode === m.key} color={m.color} onClick={() => setMode(m.key)} />
              ))}
            </div>

            {/* Mode-specific controls */}
            {mode === "tiles" && (
              <>
                <div className="ale-label" style={{ marginTop: 8 }}>Layer</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {LAYER_LABELS.map((label, i) => (
                    <button key={i} onClick={() => setActiveLayer(i)} style={{
                      flex: 1, padding: "3px 0", fontSize: 7, fontFamily: "'Pixelify Sans'",
                      background: activeLayer === i ? "color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "transparent",
                      border: `2px solid ${activeLayer === i ? "var(--accent-primary)" : "var(--border-color)"}`, borderRadius: 2,
                      color: activeLayer === i ? "var(--accent-primary)" : "var(--text-muted)", cursor: "pointer",
                    }}>{label}</button>
                  ))}
                </div>
                <div className="ale-label" style={{ marginTop: 8 }}>Transform</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button onClick={cycleRotation} style={{ padding: "4px 8px", fontSize: 9, fontFamily: "'Pixelify Sans'", background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)", border: "2px solid var(--border-color)", borderRadius: 2, color: "var(--accent-primary)", cursor: "pointer" }}>
                    {ROTATION_LABELS[rotation]} (R)
                  </button>
                  <button onClick={toggleHFlip} style={{ padding: "4px 8px", fontSize: 9, fontFamily: "'Pixelify Sans'", background: hflip ? "color-mix(in srgb, var(--accent-primary) 25%, transparent)" : "color-mix(in srgb, var(--accent-primary) 10%, transparent)", border: `2px solid ${hflip ? "var(--accent-primary)" : "var(--border-color)"}`, borderRadius: 2, color: "var(--accent-primary)", cursor: "pointer" }}>
                    H-Flip (F)
                  </button>
                  <button onClick={toggleVFlip} style={{ padding: "4px 8px", fontSize: 9, fontFamily: "'Pixelify Sans'", background: vflip ? "color-mix(in srgb, var(--accent-primary) 25%, transparent)" : "color-mix(in srgb, var(--accent-primary) 10%, transparent)", border: `2px solid ${vflip ? "var(--accent-primary)" : "var(--border-color)"}`, borderRadius: 2, color: "var(--accent-primary)", cursor: "pointer" }}>
                    V-Flip (V)
                  </button>
                </div>
                <div className="ale-label" style={{ marginTop: 8 }}>Tint</div>
                {tileTint ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <ColorPicker value={tileTint} onChange={setTileTint} />
                    <button onClick={() => setTileTint("")} style={{ fontSize: 8, fontFamily: "'Pixelify Sans'", color: "var(--clr-error)", background: "color-mix(in srgb, var(--clr-error) 10%, transparent)", border: "2px solid var(--border-color)", borderRadius: 2, padding: "2px 6px", cursor: "pointer", width: "fit-content" }}>Reset</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <ColorPicker value="#ffffff" onChange={(c) => setTileTint(c === "#ffffff" ? "" : c)} />
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>None</span>
                  </div>
                )}
              </>
            )}

            {mode === "blocking" && (
              <>
                <div className="ale-label" style={{ marginTop: 8 }}>Blocking Type</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {([["Phys", "physical", "#f87171"], ["Eph", "ephemeral", "#38bdf8"], ["Both", "both", "#c084fc"]] as const).map(([label, type, color]) => (
                    <button key={type} onClick={() => setBlockingType(type)} style={{
                      flex: 1, padding: "3px 0", fontSize: 8, fontFamily: "'Pixelify Sans'",
                      background: blockingType === type ? `color-mix(in srgb, ${color} 15%, transparent)` : "transparent",
                      border: `2px solid ${blockingType === type ? color : "var(--border-color)"}`, borderRadius: 2,
                      color: blockingType === type ? color : "var(--text-muted)", cursor: "pointer",
                    }}>{label}</button>
                  ))}
                </div>
                <div style={{ marginTop: 6, fontSize: 9, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div>Click edge to cycle: open / wall / one-way</div>
                  <div>Drag to paint walls, right-click to erase</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                    <span><span style={{ color: "#f87171" }}>---</span> physical (blocks movement)</span>
                    <span><span style={{ color: "#c084fc" }}>---</span> both (movement + light/sound)</span>
                    <span><span style={{ color: "#38bdf8" }}>- -</span> ephemeral only (light/sound)</span>
                  </div>
                </div>
                {tileset && tileset.tiles.some((t) => t.wall) && (
                  <button onClick={() => {
                    const st = store.getState().editor;
                    const generated = generateBlockingFromWalls(gridWidth, gridHeight, st.placedTiles.map((t: PlacedTile) => ({ x: t.x, y: t.y, renderLayer: t.renderLayer, tileIndex: t.tile })), (idx) => tileset!.tiles[idx]?.wall ?? false);
                    dispatch(setBlockingEdges(generated));
                  }} style={{ marginTop: 6, fontSize: 8, fontFamily: "'Pixelify Sans'", color: "var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)", border: "2px solid var(--border-color)", borderRadius: 2, padding: "3px 8px", cursor: "pointer" }}>Generate from Walls</button>
                )}
                {blockingEdges.some((v: number) => v !== 0) && (
                  <button onClick={() => dispatch(setBlockingEdges([]))} style={{ marginTop: 6, fontSize: 8, fontFamily: "'Pixelify Sans'", color: "var(--clr-error)", background: "color-mix(in srgb, var(--clr-error) 10%, transparent)", border: "2px solid var(--border-color)", borderRadius: 2, padding: "3px 8px", cursor: "pointer" }}>Clear All</button>
                )}
              </>
            )}

            {mode === "items" && (() => {
              const preview = pendingItem
                ? (pendingItemPreviewRef.current ?? itemPreviewsRef.current.get(pendingItem.uri) ?? null)
                : null;
              const variants = preview?.variants;
              const activeVariantLayer = variants?.[pendingVariant]?.layer ?? preview?.layer ?? null;

              return (
                <>
                  <div className="ale-label" style={{ marginTop: 8 }}>Place Item</div>
                  <button className="spe-done-btn" onClick={() => setShowItemPicker(true)} style={{ width: "100%" }}>
                    {pendingItem ? "Change Item" : "Select Item"}
                  </button>

                  {/* Selected item preview */}
                  {pendingItem && preview && (
                    <div style={{ marginTop: 6, padding: 6, background: "var(--bg-panel)", border: "2px solid var(--border-color)", borderRadius: 2 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {preview.image && activeVariantLayer && (
                          <ItemSpritePreview image={preview.image} layer={activeVariantLayer} size={48} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: "var(--text-primary)", fontFamily: "'Pixelify Sans'" }}>{preview.name}</div>
                          {variants && variants.length > 1 && (
                            <div style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 2 }}>
                              Variant: {variants[pendingVariant]?.name ?? pendingVariant}
                            </div>
                          )}
                        </div>
                        <button onClick={() => { setPendingItem(null); setPendingVariant(0); }} style={{ fontSize: 10, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", alignSelf: "flex-start" }}>&times;</button>
                      </div>

                      {/* Variant picker */}
                      {variants && variants.length > 1 && (
                        <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fill, 44px)", gap: 2 }}>
                          {variants.map((v, vi) => (
                            <button
                              key={vi}
                              onClick={() => setPendingVariant(vi)}
                              title={v.name}
                              style={{
                                width: 44, padding: 2,
                                border: pendingVariant === vi ? "2px solid var(--accent-primary)" : "2px solid var(--border-color)",
                                borderRadius: 2,
                                background: pendingVariant === vi ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : "var(--bg-deep)",
                                cursor: "pointer",
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                              }}
                            >
                              {preview.image && v.layer && (
                                <ItemSpritePreview image={preview.image} layer={v.layer} size={32} />
                              )}
                              <span style={{ fontSize: 7, color: pendingVariant === vi ? "var(--accent-primary)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 40, display: "block" }}>{v.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Channel tints */}
                      {(() => {
                        const channels = Array.from(new Set(preview.layers.map((l) => l.colorChannel).filter((c): c is string => !!c)));
                        if (channels.length === 0) return null;
                        return (
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "'Pixelify Sans'" }}>Channel Tints</div>
                            {channels.map((channel) => {
                              const existing = pendingTints.find((t) => t.channel === channel);
                              return (
                                <div key={channel} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 8, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {channel}
                                    </span>
                                    {existing && (
                                      <button
                                        onClick={() => setPendingTints((prev) => prev.filter((t) => t.channel !== channel))}
                                        style={{ fontSize: 8, background: "none", border: "none", color: "var(--clr-error)", cursor: "pointer", padding: 0 }}
                                      >Reset</button>
                                    )}
                                  </div>
                                  <ColorPicker
                                    value={existing?.tint ?? "#ffffff"}
                                    onChange={(color) => {
                                      setPendingTints((prev) => {
                                        const filtered = prev.filter((t) => t.channel !== channel);
                                        if (color !== "#ffffff") filtered.push({ channel, tint: color });
                                        return filtered;
                                      });
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div style={{ marginTop: 4, fontSize: 9, color: "var(--text-muted)" }}>Click grid to place, right-click to remove</div>

                  {mergedItems.length > 0 && (
                    <>
                      <div className="ale-label" style={{ marginTop: 8 }}>Placed ({mergedItems.length})</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflowY: "auto" }}>
                        {mergedItems.map((it, i) => (
                          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 6px", background: selectedItemIdx === i ? "color-mix(in srgb, var(--accent-primary) 6%, transparent)" : "var(--bg-panel)", border: `2px solid ${selectedItemIdx === i ? "var(--accent-primary)" : "var(--border-color)"}`, borderRadius: 2, cursor: "pointer" }} onClick={() => setSelectedItemIdx(selectedItemIdx === i ? null : i)}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 9, color: "var(--text-primary)" }}>{it._name ?? "item"} ({it.x},{it.y})</span>
                              <button onClick={(e) => { e.stopPropagation(); dispatch(removeRoomItem(i)); if (selectedItemIdx === i) setSelectedItemIdx(null); }} style={{ fontSize: 10, background: "none", border: "none", color: "var(--clr-error)", cursor: "pointer" }}>&times;</button>
                            </div>
                            {selectedItemIdx === i && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 4, borderTop: "1px solid var(--border-color)" }}>
                                {it._overridableProps && it._overridableProps.map((prop) => {
                                  const sv = it.state.find((s) => s.name === prop.name);
                                  return (
                                    <StateValueEditor
                                      key={prop.name}
                                      property={prop}
                                      value={sv?.value ?? ""}
                                      onChange={(val) => {
                                        const st = store.getState().editor;
                                        const item = st.roomItems[i];
                                        if (!item) return;
                                        const state = item.state.filter((s: StateValueData) => s.name !== prop.name);
                                        dispatch(updateRoomItemState({ index: i, state: [...state, { name: prop.name, value: val }] }));
                                      }}
                                    />
                                  );
                                })}
                                {/* Per-channel tints */}
                                {(() => {
                                  const channels = Array.from(new Set(it._layers.map((l: AnimationLayer) => l.colorChannel).filter((c): c is string => !!c)));
                                  if (channels.length === 0) return null;
                                  return (
                                    <>
                                      <div style={{ fontSize: 8, color: "var(--text-muted)", fontFamily: "'Pixelify Sans'" }}>Channel Tints</div>
                                      {channels.map((channel) => {
                                        const existing = it.tints.find((t: ChannelTintData) => t.channel === channel);
                                        return (
                                          <div key={channel} onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                              <span style={{ fontSize: 8, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {channel}
                                              </span>
                                              {existing && (
                                                <button
                                                  onClick={() => {
                                                    const st = store.getState().editor;
                                                    const item = st.roomItems[i];
                                                    if (!item) return;
                                                    dispatch(updateRoomItemTints({ index: i, tints: item.tints.filter((t: ChannelTintData) => t.channel !== channel) }));
                                                  }}
                                                  style={{ fontSize: 8, background: "none", border: "none", color: "var(--clr-error)", cursor: "pointer", padding: 0 }}
                                                >Reset</button>
                                              )}
                                            </div>
                                            <ColorPicker
                                              value={existing?.tint ?? "#ffffff"}
                                              onChange={(color) => {
                                                const st = store.getState().editor;
                                                const item = st.roomItems[i];
                                                if (!item) return;
                                                const tints = item.tints.filter((t: ChannelTintData) => t.channel !== channel);
                                                if (color !== "#ffffff") tints.push({ channel, tint: color });
                                                dispatch(updateRoomItemTints({ index: i, tints }));
                                              }}
                                            />
                                          </div>
                                        );
                                      })}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            {mode === "critters" && (
              <>
                <div className="ale-label" style={{ marginTop: 8 }}>Critters</div>
                <button className="spe-done-btn" onClick={() => setShowCritterPicker(true)} style={{ width: "100%" }}>Add Critter</button>
                {mergedCritters.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                    {mergedCritters.map((c, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, padding: 6, background: activeCritterIdx === i ? "rgba(167,139,250,0.1)" : "var(--bg-panel)", border: `2px solid ${activeCritterIdx === i ? "#a78bfa" : "var(--border-color)"}`, borderRadius: 2, cursor: "pointer" }} onClick={() => setActiveCritterIdx(i)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 9, color: "#a78bfa" }}>{c._displayName ?? "Critter"}</span>
                          <button onClick={(e) => { e.stopPropagation(); dispatch(removeRoomCritter(i)); if (activeCritterIdx === i) setActiveCritterIdx(null); }} style={{ fontSize: 10, background: "none", border: "none", color: "var(--clr-error)", cursor: "pointer" }}>&times;</button>
                        </div>
                        <input className="bae-input" value={c.name} onClick={(e) => e.stopPropagation()} onChange={(e) => dispatch(updateCritterName({ index: i, name: e.target.value }))} placeholder="Nickname" maxLength={64} />
                        {activeCritterIdx === i && c._overridableProps && c._overridableProps.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 4, borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                            {c._overridableProps.map((prop) => {
                              const sv = c.state.find((s) => s.name === prop.name);
                              return (
                                <StateValueEditor
                                  key={prop.name}
                                  property={prop}
                                  value={sv?.value ?? ""}
                                  onChange={(val) => {
                                    const st = store.getState().editor;
                                    const cr = st.roomCritters[i];
                                    if (!cr) return;
                                    const state = cr.state.filter((s: StateValueData) => s.name !== prop.name);
                                    dispatch(updateCritterState({ index: i, state: [...state, { name: prop.name, value: val }] }));
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 4, fontSize: 9, color: "var(--text-muted)" }}>Select a critter, then paint its allowed area on the grid</div>
              </>
            )}

            {mode === "attributes" && (
              <>
                <div className="ale-label" style={{ marginTop: 8 }}>Attribute</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {Array.from(new Set(["light", ...tileAttributes.map((a: TileAttributeData) => a.attribute), ...(activeAttribute && activeAttribute !== "light" ? [activeAttribute] : [])])).map((a: string) => (
                    <button key={a} onClick={() => setActiveAttribute(a)} style={{
                      padding: "3px 8px", fontSize: 7, fontFamily: "'Pixelify Sans'",
                      background: activeAttribute === a ? "color-mix(in srgb, var(--accent-tertiary) 15%, transparent)" : "transparent",
                      border: `2px solid ${activeAttribute === a ? "var(--accent-tertiary)" : "var(--border-color)"}`, borderRadius: 2,
                      color: activeAttribute === a ? "var(--accent-tertiary)" : "var(--text-muted)", cursor: "pointer", textTransform: "capitalize",
                    }}>{a}</button>
                  ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); const input = (e.target as HTMLFormElement).elements.namedItem("newAttr") as HTMLInputElement; const name = input.value.trim().toLowerCase(); if (name) { setActiveAttribute(name); input.value = ""; } }} style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <input name="newAttr" placeholder="Add attribute..." style={{ flex: 1, fontSize: 8, fontFamily: "'Pixelify Sans'", padding: "2px 6px", background: "var(--bg-deep)", border: "2px solid var(--border-color)", borderRadius: 2, color: "var(--text-primary)" }} />
                  <button type="submit" style={{ fontSize: 7, fontFamily: "'Pixelify Sans'", padding: "2px 8px", background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)", border: "2px solid var(--border-color)", borderRadius: 2, color: "var(--accent-primary)", cursor: "pointer" }}>Add</button>
                </form>
                <div className="ale-label" style={{ marginTop: 8 }}>Brush Value ({attrBrushValue})</div>
                <input type="range" min={0} max={200} value={attrBrushValue} onChange={(e) => setAttrBrushValue(+e.target.value)} style={{ width: "100%" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "var(--text-muted)" }}>
                  {activeAttribute === "light" ? (
                    <><span>Dark (0)</span><span>Neutral (100)</span><span>Bright (200)</span></>
                  ) : (
                    <><span>Min (0)</span><span>Neutral (100)</span><span>Max (200)</span></>
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: 9, color: "var(--text-muted)" }}>
                  {activeAttribute === "light"
                    ? "Light attribute draws a darkness overlay in-game. Click to paint, right-click to reset."
                    : "Click to paint, right-click to reset to neutral"}
                </div>
              </>
            )}

            {mode === "background" && (
              <>
                <div className="ale-label" style={{ marginTop: 8 }}>Background</div>
                <BackgroundEditor bg={background} onChange={handleBackgroundChange} />
              </>
            )}

            {mode === "behaviors" && (
              <>
                <div className="ale-layer-header" style={{ marginTop: 8 }}>
                  <span className="ale-label">Behaviors</span>
                  <button className="ale-icon-btn" onClick={() => { dispatch(addRoomBehavior(newScript())); setEditingBehaviorIdx(behaviors.length); }} title="Add behavior">+</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {behaviors.map((b: ScriptModel, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", background: "var(--bg-panel)", border: "2px solid var(--border-color)", borderRadius: 2 }}>
                      <button onClick={() => setEditingBehaviorIdx(i)} style={{ flex: 1, textAlign: "left", fontSize: 9, color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <span style={{ color: "var(--accent-primary)" }}>{b.name || "Unnamed"}</span>{" "}
                        <span style={{ color: "var(--text-muted)" }}>{scriptSummary(b)}</span>
                      </button>
                      <button onClick={() => dispatch(removeRoomBehavior(i))} style={{ fontSize: 10, background: "none", border: "none", color: "var(--clr-error)", cursor: "pointer" }}>&times;</button>
                    </div>
                  ))}
                  {behaviors.length === 0 && (
                    <div className="ie-empty-hint">No behaviors. Room behaviors can respond to events like "enter" when a player joins.</div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Save */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {currentRkey && (
            <button className="spe-done-btn" disabled={!canSave || saving} onClick={handleSave} style={{ width: "100%" }}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button className="spe-done-btn" disabled={!canSave || saving} onClick={currentRkey ? handleSaveNew : handleSave} style={{ width: "100%", ...(currentRkey ? { opacity: 0.75 } : {}) }}>
            {saving ? "Saving..." : currentRkey ? "Save as New" : "Save"}
          </button>
          {saveError && <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm">{saveError}</div>}
          {savedUri && <div className="text-[11px] text-success px-2 py-1.5 bg-success/8 border border-success/20 rounded-sm">Saved</div>}
        </div>
      </div>

      {/* Main area */}
      <div className="bae-targets" style={{ gap: 12 }}>
        <div style={{ overflow: "auto" }}>
          <GridCanvas
            gridWidth={gridWidth} gridHeight={gridHeight} tiles={placedTiles} exits={exits} spawnTiles={spawnTiles}
            tileset={tileset} mode={mode} selectedTile={selectedTile} activeLayer={activeLayer}
            transform={transform} blockingEdges={blockingEdges} items={mergedItems} critters={mergedCritters}
            tileAttributes={tileAttributes} activeAttribute={activeAttribute}
            itemGhost={itemGhost}
            onGridClick={handleGridClick} onGridDrag={handleGridDrag} onGridRightClick={handleGridRightClick}
            onEdgeClick={handleEdgeClick} onEdgeDrag={handleEdgeDrag}
            hoverTile={hoverTile} onHoverChange={setHoverTile}
            hoverEdge={hoverEdge} onEdgeHoverChange={setHoverEdge}
          />
        </div>

        {/* Spawn area */}
        {mode === "spawn" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="ale-label">
              Spawn Tiles
              <span style={{ fontSize: 7, color: "var(--text-muted)", marginLeft: 8 }}>Click to toggle, drag to paint, right-click to erase</span>
            </div>
            {spawnTiles.some((v: number) => v !== 0) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 8, background: "var(--bg-panel)", border: "2px solid var(--border-color)", borderRadius: 2 }}>
                <span className="ale-label" style={{ padding: 0, color: "var(--clr-success)" }}>
                  {spawnTiles.filter((v: number) => v !== 0).length} tile(s) selected
                </span>
                <button onClick={() => dispatch(setSpawnTiles([]))} style={{ fontSize: 8, fontFamily: "'Pixelify Sans'", color: "var(--clr-error)", background: "color-mix(in srgb, var(--clr-error) 10%, transparent)", border: "2px solid var(--border-color)", borderRadius: 2, padding: "3px 8px", cursor: "pointer" }}>Clear All</button>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>No spawn tiles set. Click the grid to mark tiles where players can spawn when entering this room.</div>
            )}
            {exits.length > 0 && (
              <button onClick={() => {
                const st = store.getState().editor;
                const generated = computeSpawnTiles(gridWidth, gridHeight, st.placedTiles.map((t: PlacedTile) => ({ x: t.x, y: t.y, renderLayer: t.renderLayer })), st.exits, st.blockingEdges);
                dispatch(setSpawnTiles(generated));
              }} style={{ fontSize: 8, fontFamily: "'Pixelify Sans'", color: "var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)", border: "2px solid var(--border-color)", borderRadius: 2, padding: "3px 8px", cursor: "pointer" }}>Generate from Exits</button>
            )}
          </div>
        )}

        {/* Exits list */}
        {mode === "exits" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="ale-label">
              Exits ({exits.length})
              <span style={{ fontSize: 7, color: "var(--text-muted)", marginLeft: 8 }}>Click grid to place</span>
            </div>
            {exits.map((exit: RoomExitData, i: number) => (
              <ExitEditor key={i} exit={exit} index={i} pds={session!.pds} roomUri={uri} allExits={exits} onChange={(idx, e) => dispatch(updateExit({ index: idx, exit: e }))} onRemove={(idx) => dispatch(removeExit(idx))} />
            ))}
            {exits.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 11 }}>No exits yet. Click the grid to place one.</div>}
          </div>
        )}
      </div>

      {/* Tileset picker modal */}
      {showTilesetPicker && session && (
        <RefPicker
          title="Select Tileset"
          categories={["tileset"]}
          onSelect={handleTilesetSelect}
          onClose={() => setShowTilesetPicker(false)}
        />
      )}

      {/* Item picker modal */}
      {showItemPicker && session && (
        <RefPicker
          title="Select Item"
          categories={["item"]}
          onSelect={handleItemSelect}
          onClose={() => setShowItemPicker(false)}
        />
      )}

      {/* Critter picker modal */}
      {showCritterPicker && session && (
        <RefPicker
          title="Select Critter"
          categories={["critter"]}
          onSelect={handleCritterSelect}
          onClose={() => setShowCritterPicker(false)}
        />
      )}

      {/* Behavior editor modal */}
      {editingBehaviorIdx != null && behaviors[editingBehaviorIdx] && (
        <div className="bae-overlay" onClick={() => setEditingBehaviorIdx(null)}>
          <div
            className="bae-modal"
            style={{ maxWidth: 800, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bae-modal-header">
              <span className="ale-label">{behaviors[editingBehaviorIdx].name || "Behavior"}</span>
              <button
                className="ale-icon-btn"
                onClick={() => setEditingBehaviorIdx(null)}
              >
                &times;
              </button>
            </div>
            <div className="bae-modal-body">
              <ScriptEditor
                script={behaviors[editingBehaviorIdx]}
                onChange={(updated) => dispatch(updateRoomBehavior({ idx: editingBehaviorIdx, script: updated }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
