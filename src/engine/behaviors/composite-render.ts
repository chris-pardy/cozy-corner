import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import { type Event, RenderEvent } from "../event";
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
import type { LayerTint } from "~/atproto/generated/types/at/cozy-corner/defs";

function buildTintMap(tints: LayerTint[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const { layerIndexes, tint } of tints) {
    for (const i of layerIndexes) map.set(i, tint);
  }
  return map;
}

/**
 * Dispatches render events to children, y-sorted by POSITION.
 * Children at the same y are ordered by RENDER_ORDER (default 0).
 * Children are auto-translated to their POSITION * TILE_SIZE.
 *
 * Reads CHILD_RENDER_CONFIG for per-child tints and transforms.
 *
 * Does not stop the event — subsequent behaviors (e.g. overhead tiles,
 * light overlay) can run after children have been rendered.
 */
export class CompositeRenderBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["render"]);

  handle(entity: Entity, event: Event): void {
    const renderEvent = event as RenderEvent;
    const config = entity.get<Map<Entity, ChildRenderConfig>>(CHILD_RENDER_CONFIG);
    const tileSize = entity.get<number>(TILE_SIZE);
    const { ctx, time } = renderEvent;

    const children = entity.children;

    // Fast path: 0-1 children need no sorting
    if (children.length > 1) {
      sortByY(children, time);
    }

    for (const child of children) {
      const childConfig = config?.get(child);
      const tintMap = childConfig?.tints
        ? buildTintMap(childConfig.tints)
        : new Map<number, string>();

      ctx.save();

      const pos = child.get<Position>(POSITION);
      if (pos && tileSize) {
        // Interpolate between current position and move target for smooth movement
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
        const t = childConfig.transform;
        ctx.transform(
          t.a / 1000,
          t.b / 1000,
          t.c / 1000,
          t.d / 1000,
          t.e / 1000,
          t.f / 1000,
        );
      }

      child.emit(new RenderEvent(ctx, time, tintMap));

      ctx.restore();
    }
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

/** In-place stable sort of children by visual y, then RENDER_ORDER. */
function sortByY(children: Entity[], time: number): void {
  children.sort((a, b) => {
    const ay = visualY(a, time);
    const by = visualY(b, time);
    if (ay !== by) return ay - by;
    const ao = a.get<number>(RENDER_ORDER) ?? 0;
    const bo = b.get<number>(RENDER_ORDER) ?? 0;
    return ao - bo;
  });
}
