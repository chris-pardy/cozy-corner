import type { Entity } from "../entity";
import type { RenderContext } from "../event";
import type { AnimationLayer, LayerTint } from "~/atproto/generated/types/at/cozy-corner/defs";
import { CHILD_RENDER_CONFIG, RENDER_ORDER, type ChildRenderConfig } from "../state/render";
import {
  POSITION,
  MOVE_TARGET,
  MOVE_START_TIME,
  MOVE_SPEED,
  DEFAULT_MOVE_SPEED,
  type Position,
} from "../state/movement";
import { TILE_SIZE } from "../state/tiles";
import {
  LAYERS,
  SPRITE_SHEET,
  TARGET,
  TARGET_START_TIME,
} from "../state/render";
import {
  SPEECH_TEXT,
  SPEECH_BUBBLE,
  SPEECH_START,
  SPEECH_DURATION,
  DEFAULT_SPEECH_DURATION,
} from "../state/speech";
import { TILE_POSITIONS, type PlacedTile, type TileFrame } from "../state/tiles";
import { TILE_ATLAS, TILE_SHEET } from "../state/tiles";
import { drawLayerStack } from "./layerStack";
import { drawSpeechBubbleFn } from "./speechBubble";
import { drawTileRow } from "./tileRow";

function buildTintMap(tints: LayerTint[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const { layerIndexes, tint } of tints) {
    for (const i of layerIndexes) map.set(i, tint);
  }
  return map;
}

/** Temp canvas manager for layer tinting. */
export class TintCanvasPool {
  private _tmp: OffscreenCanvas | null = null;
  private _tmpCtx: OffscreenCanvasRenderingContext2D | null = null;
  private _tmpW = 0;
  private _tmpH = 0;

  ensureTmp(w: number, h: number) {
    if (!this._tmp || w > this._tmpW || h > this._tmpH) {
      this._tmpW = Math.max(w, this._tmpW);
      this._tmpH = Math.max(h, this._tmpH);
      this._tmp = new OffscreenCanvas(this._tmpW, this._tmpH);
      this._tmpCtx = this._tmp.getContext("2d")!;
      this._tmpCtx.imageSmoothingEnabled = false;
    }
    return { tmp: this._tmp!, tmpCtx: this._tmpCtx! };
  }
}

/** Get the visual y (interpolated if moving). */
function visualY(entity: Entity, time: number): number {
  const pos = entity.get<Position>(POSITION);
  if (!pos) return 0;
  const moveTarget = entity.get<Position>(MOVE_TARGET);
  const moveStart = entity.get<number>(MOVE_START_TIME);
  if (moveTarget && moveStart != null) {
    const speed = entity.get<number>(MOVE_SPEED) ?? DEFAULT_MOVE_SPEED;
    const t = Math.min(1, (time - moveStart) / speed);
    return pos.y + (moveTarget.y - pos.y) * t;
  }
  return pos.y;
}

/**
 * Render a composite entity and all its children, y-sorted.
 * Handles:
 * - Composite entities (entities with children): y-sort, translate, recurse
 * - Leaf entities with LAYERS: draw sprite layers via drawLayerStack
 * - Foreground tile rows: draw tile row
 * - Speech bubbles: draw if SPEECH_TEXT present
 *
 * This replaces CompositeRenderBehavior + LayerStackRenderBehavior +
 * SpeechBubbleRenderBehavior + TileLayerRenderBehavior during rendering.
 */
export function renderEntity(
  ctx: RenderContext,
  entity: Entity,
  time: number,
  tintMap: ReadonlyMap<number, string>,
  tintPool: TintCanvasPool,
): void {
  const tileSize = entity.get<number>(TILE_SIZE) ?? entity.find<number>(TILE_SIZE);

  // If entity has children — it's a composite. Y-sort and recurse.
  if (entity.children.length > 0) {
    const children = [...entity.children];
    if (children.length > 1) {
      children.sort((a, b) => {
        const ay = visualY(a, time);
        const by = visualY(b, time);
        if (ay !== by) return ay - by;
        const ao = a.get<number>(RENDER_ORDER) ?? 0;
        const bo = b.get<number>(RENDER_ORDER) ?? 0;
        return ao - bo;
      });
    }

    const config = entity.get<Map<Entity, ChildRenderConfig>>(CHILD_RENDER_CONFIG);

    for (const child of children) {
      const childConfig = config?.get(child);
      const childTintMap = childConfig?.tints
        ? buildTintMap(childConfig.tints)
        : new Map<number, string>();

      ctx.save();

      const pos = child.get<Position>(POSITION);
      if (pos && tileSize) {
        const moveTarget = child.get<Position>(MOVE_TARGET);
        const moveStart = child.get<number>(MOVE_START_TIME);
        if (moveTarget && moveStart != null) {
          const speed = child.get<number>(MOVE_SPEED) ?? DEFAULT_MOVE_SPEED;
          const t = Math.min(1, (time - moveStart) / speed);
          const ix = pos.x + (moveTarget.x - pos.x) * t;
          const iy = pos.y + (moveTarget.y - pos.y) * t;
          ctx.translate(ix * tileSize, iy * tileSize);
        } else {
          ctx.translate(pos.x * tileSize, pos.y * tileSize);
        }
      }

      if (childConfig?.transform) {
        const tf = childConfig.transform;
        ctx.transform(
          tf.a / 1000,
          tf.b / 1000,
          tf.c / 1000,
          tf.d / 1000,
          tf.e / 1000,
          tf.f / 1000,
        );
      }

      renderEntity(ctx, child, time, childTintMap, tintPool);

      ctx.restore();
    }
  }

  // Draw tile row if this entity has TILE_POSITIONS (foreground row entity)
  const tilePosns = entity.get<PlacedTile[]>(TILE_POSITIONS);
  if (tilePosns) {
    const sheet = entity.find<CanvasImageSource>(TILE_SHEET);
    const atlas = entity.find<TileFrame[]>(TILE_ATLAS);
    const ts = entity.find<number>(TILE_SIZE);
    if (sheet && atlas && ts) {
      drawTileRow(ctx, tilePosns, 1, sheet, atlas, ts, time);
    }
  }

  // Draw sprite layers if entity has LAYERS
  const layers = entity.get<AnimationLayer[]>(LAYERS);
  const spriteSheet = entity.get<CanvasImageSource>(SPRITE_SHEET);
  const target = entity.get<string>(TARGET);
  const targetStartTime = entity.get<number>(TARGET_START_TIME);
  if (layers && spriteSheet && target && targetStartTime != null) {
    drawLayerStack(
      ctx,
      layers,
      spriteSheet,
      target,
      targetStartTime,
      time,
      tileSize,
      tintMap,
      (w, h) => tintPool.ensureTmp(w, h),
    );
  }

  // Draw speech bubble if present
  const speechText = entity.get<string>(SPEECH_TEXT);
  if (speechText) {
    const start = entity.get<number>(SPEECH_START) ?? 0;
    const duration = entity.get<number>(SPEECH_DURATION) ?? DEFAULT_SPEECH_DURATION;
    if (time - start <= duration) {
      const bubble = entity.get<string>(SPEECH_BUBBLE) ?? "speech";
      const ts = entity.get<number>(TILE_SIZE) ?? entity.find<number>(TILE_SIZE) ?? 32;
      drawSpeechBubbleFn(ctx as CanvasRenderingContext2D, speechText, bubble, ts);
    } else {
      // Auto-clear expired bubble
      entity.delete(SPEECH_TEXT);
      entity.delete(SPEECH_BUBBLE);
      entity.delete(SPEECH_START);
      entity.delete(SPEECH_DURATION);
    }
  }
}
