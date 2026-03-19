import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import type { Event } from "../event";
import { DataEvent } from "../event";
import type { EventOrigin } from "../event";
import {
  POSITION,
  DIRECTION,
  MOVE_TARGET,
  MOVE_START_TIME,
  MOVE_SPEED,
  PATH,
  ANIM_STATE,
  DEFAULT_MOVE_SPEED,
  MOVE_ORIGIN,
  directionName,
  type Position,
} from "../state/movement";
import { BLOCKING_GRID, type BlockingGrid } from "../state/blocking";
import { findPath, stepDirection } from "../pathfinding";

/**
 * A*-routed tile-based movement behavior.
 *
 * Responds to:
 * - "moveTo": computes A* path to target, starts walking the first step.
 *   A new moveTo overrides any in-progress path.
 * - "tick": checks if the current step's walk duration elapsed,
 *   advances to the next path step or goes idle.
 *
 * Reads BLOCKING_GRID from the entity's parent (the room).
 *
 * Sets ANIM_STATE ("walk"/"idle") and DIRECTION on the entity,
 * then emits semantic events:
 * - "walk" (direction) on each step
 * - "idle" (direction) when path is exhausted
 * - "turn-south" / "turn-north" / "turn-east" / "turn-west" when direction changes
 *
 * An AvatarAnimationBehavior (or custom replacement) converts these
 * into "target" DataEvents for the animation system.
 */
export class MovementBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["moveTo", "tick"]);

  handle(entity: Entity, event: Event): void {
    const de = event as DataEvent;
    if (event.type === "moveTo") {
      this.handleMoveTo(entity, de);
    } else {
      this.handleTick(entity, de);
    }
  }

  private handleMoveTo(entity: Entity, event: DataEvent): void {
    const pos = entity.get<Position>(POSITION);
    if (!pos) return;

    const x = event.data.get("x") as number;
    const y = event.data.get("y") as number;

    if (pos.x === x && pos.y === y) return;

    const grid = entity.find<BlockingGrid>(BLOCKING_GRID);
    if (!grid) return;

    const path = findPath(grid, pos, { x, y });
    if (!path || path.length === 0) return;

    // Store the origin so downstream walk/idle/turn events inherit it
    entity.set(MOVE_ORIGIN, event.origin);
    this.startStep(entity, pos, path, event.time);
  }

  private handleTick(entity: Entity, event: DataEvent): void {
    const moveTarget = entity.get<Position>(MOVE_TARGET);
    if (!moveTarget) return;

    const moveStart = entity.get<number>(MOVE_START_TIME);
    if (moveStart == null) return;

    const speed = entity.get<number>(MOVE_SPEED) ?? DEFAULT_MOVE_SPEED;
    if (event.time - moveStart < speed) return;

    // Arrive at current step
    const arrivedPos = { x: moveTarget.x, y: moveTarget.y };
    entity.set(POSITION, arrivedPos);
    entity.delete(MOVE_TARGET);
    entity.delete(MOVE_START_TIME);

    // Origin from the moveTo that initiated this path
    const origin = entity.get<EventOrigin>(MOVE_ORIGIN) ?? "local";

    // Continue along path or go idle
    const path = entity.get<Position[]>(PATH);
    if (path && path.length > 0) {
      this.startStep(entity, arrivedPos, path, event.time);
    } else {
      entity.delete(PATH);
      entity.delete(MOVE_ORIGIN);
      const direction = entity.get<number>(DIRECTION) ?? 0;
      entity.set(ANIM_STATE, "idle");
      entity.emit(
        new DataEvent("idle", { direction }, event.time, origin),
      );
    }
  }

  private startStep(
    entity: Entity,
    from: { x: number; y: number },
    path: { x: number; y: number }[],
    time: number,
  ): void {
    const next = path[0];
    const remaining = path.slice(1);
    entity.set(PATH, remaining.length > 0 ? remaining : undefined!);
    if (remaining.length === 0) entity.delete(PATH);

    const prevDirection = entity.get<number>(DIRECTION) ?? 0;
    const direction = stepDirection(from, next);
    entity.set(DIRECTION, direction);
    entity.set(MOVE_TARGET, next);
    entity.set(MOVE_START_TIME, time);
    entity.set(ANIM_STATE, "walk");

    const origin = entity.get<EventOrigin>(MOVE_ORIGIN) ?? "local";

    // Emit turn event if direction changed
    if (direction !== prevDirection) {
      entity.emit(
        new DataEvent(
          `turn-${directionName(direction)}`,
          { direction, previousDirection: prevDirection },
          time,
          origin,
        ),
      );
    }

    entity.emit(new DataEvent("walk", { direction }, time, origin));
  }
}
