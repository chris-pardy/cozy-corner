import type { Behavior } from "../behavior";
import type { Entity } from "../entity";
import type { Event } from "../event";
import { DataEvent } from "../event";
import {
  CAMERA_TARGET,
  CAMERA_FOCUS,
  CAMERA_FOCUS_ID,
  CAMERA_OFFSET,
  VIEW_DISTANCE,
  type CameraPosition,
} from "../state/camera";
import {
  POSITION,
  MOVE_TARGET,
  MOVE_START_TIME,
  MOVE_SPEED,
  DEFAULT_MOVE_SPEED,
  type Position,
} from "../state/movement";
import { TILE_SIZE } from "../state/tiles";

/**
 * Manages camera position on the room entity.
 *
 * On "tick": lerps CAMERA_TARGET toward the focus entity's interpolated
 * position plus any pan offset.
 *
 * On "camera-pan": sets CAMERA_OFFSET to { x, y } from event data (world pixels).
 * On "camera-reset": clears CAMERA_OFFSET to { 0, 0 }.
 * On "camera-set-view-distance": sets VIEW_DISTANCE from event data { distance }.
 */
export class CameraBehavior implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set([
    "tick",
    "camera-pan",
    "camera-reset",
    "camera-set-view-distance",
  ]);

  private readonly lerpSpeed: number;

  constructor(lerpSpeed = 0.15) {
    this.lerpSpeed = lerpSpeed;
  }

  handle(entity: Entity, event: Event): void {
    // Skip non-tick camera events from remote players
    if (event.type !== "tick" && (event as DataEvent).origin === "remote") return;

    switch (event.type) {
      case "tick":
        this.handleTick(entity, event as DataEvent);
        break;
      case "camera-pan":
        this.handlePan(entity, event as DataEvent);
        break;
      case "camera-reset":
        this.handleReset(entity);
        break;
      case "camera-set-view-distance":
        this.handleSetViewDistance(entity, event as DataEvent);
        break;
    }
  }

  private handleTick(entity: Entity, event: DataEvent): void {
    // Resolve focus entity: prefer ID-based lookup, fall back to direct reference
    let focus: Entity | undefined = undefined;
    const focusId = entity.get<string>(CAMERA_FOCUS_ID);
    if (focusId) {
      // Find the focus entity among children
      focus = entity.children.find((c) => c.id === focusId);
    }
    if (!focus) {
      focus = entity.get<Entity>(CAMERA_FOCUS);
    }
    if (!focus) return;

    const tileSize = entity.get<number>(TILE_SIZE);
    if (!tileSize) return;

    // Compute focus entity's interpolated world-pixel position
    const pos = focus.get<Position>(POSITION);
    if (!pos) return;

    let px = pos.x;
    let py = pos.y;
    const moveTarget = focus.get<Position>(MOVE_TARGET);
    if (moveTarget) {
      const moveStart = focus.get<number>(MOVE_START_TIME);
      const moveSpeed = focus.get<number>(MOVE_SPEED) ?? DEFAULT_MOVE_SPEED;
      if (moveStart != null) {
        const t = Math.min(1, (event.time - moveStart) / moveSpeed);
        px = pos.x + (moveTarget.x - pos.x) * t;
        py = pos.y + (moveTarget.y - pos.y) * t;
      }

      // Player is moving — decay pan offset back to zero
      const offset = entity.get<CameraPosition>(CAMERA_OFFSET);
      if (offset && (offset.x !== 0 || offset.y !== 0)) {
        const decay = 0.1;
        offset.x *= 1 - decay;
        offset.y *= 1 - decay;
        if (Math.abs(offset.x) < 0.5) offset.x = 0;
        if (Math.abs(offset.y) < 0.5) offset.y = 0;
      }
    }

    const offset = entity.get<CameraPosition>(CAMERA_OFFSET) ?? { x: 0, y: 0 };
    const targetX = (px + 0.5) * tileSize + offset.x;
    const targetY = (py + 0.5) * tileSize + offset.y;

    // Lerp camera toward target
    let cam = entity.get<CameraPosition>(CAMERA_TARGET);
    if (!cam) {
      cam = { x: targetX, y: targetY };
      entity.set(CAMERA_TARGET, cam);
    } else {
      cam.x += (targetX - cam.x) * this.lerpSpeed;
      cam.y += (targetY - cam.y) * this.lerpSpeed;
    }
  }

  private handlePan(entity: Entity, event: DataEvent): void {
    const x = (event.data.get("x") as number) ?? 0;
    const y = (event.data.get("y") as number) ?? 0;
    entity.set(CAMERA_OFFSET, { x, y });
  }

  private handleReset(entity: Entity): void {
    entity.set(CAMERA_OFFSET, { x: 0, y: 0 });
  }

  private handleSetViewDistance(entity: Entity, event: DataEvent): void {
    const distance = event.data.get("distance") as number;
    if (distance != null && distance >= 2 && distance <= 12) {
      entity.set(VIEW_DISTANCE, distance);
    }
  }
}
