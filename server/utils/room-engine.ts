/**
 * Server-side room engine.
 *
 * Runs the same Redux store + behaviors as the client. The server is
 * authoritative: a fixed-rate tick loop (20fps) advances the simulation
 * and broadcasts snapshots to connected clients.
 */

import { createRoomStore, type RoomStore } from "../../src/engine/store/store";
import { createBehaviorMiddleware } from "../../src/engine/store/behaviorMiddleware";
import { ReduxEntity, resetEventBudget } from "../../src/engine/entity";
import { dataEvent, addEntity, removeEntity } from "../../src/engine/store/actions";
import { setRoomConfig } from "../../src/engine/store/roomSlice";
import { MovementBehavior } from "../../src/engine/behaviors/movement";
import { AvatarAnimationBehavior } from "../../src/engine/behaviors/avatar-animation";
import { TargetBehavior } from "../../src/engine/behaviors/target";
import { POSITION, DIRECTION, ANIM_STATE, MOVE_TARGET, MOVE_START_TIME, MOVE_SPEED, type Position } from "../../src/engine/state/movement";
import { BLOCKING_GRID, type BlockingGrid } from "../../src/engine/state/blocking";
import { TARGET, TARGET_START_TIME } from "../../src/engine/state/render";
import {
  SPEECH_TEXT,
  SPEECH_BUBBLE,
  SPEECH_START,
  SPEECH_DURATION,
  DEFAULT_SPEECH_DURATION,
} from "../../src/engine/state/speech";
import { TICK_MS, tickToTime, timeToTick } from "../../src/engine/tick";
import { resolveSpawnTiles } from "../../src/engine/resolve-spawn";
import type { SnapshotEntity, Identity } from "./protocol";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_PX = 32;

/** Maximum ticks to catch up in one burst (prevents freeze after sleep). */
const MAX_CATCHUP_TICKS = 5;

// ---------------------------------------------------------------------------
// RoomEngine
// ---------------------------------------------------------------------------

export class RoomEngine {
  readonly store: RoomStore;
  readonly entityRegistry = new Map<string, ReduxEntity>();
  private currentTick = 0;
  private readonly rng: () => number;
  private readonly spawnTiles: number[] | null;
  private readonly roomWidth: number;
  private readonly roomHeight: number;

  /** Tick loop state. */
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;

  /** Callback invoked after each tick with the current tick and snapshot. */
  onTick: ((tick: number, snapshot: SnapshotEntity[]) => void) | null = null;

  /** Previous snapshot JSON for change detection. */
  private prevSnapshotJson = "";

  /** Map of entityId → { identity, handle } for snapshot building. */
  private readonly peerMeta = new Map<string, { identity: Identity; handle: string }>();

  constructor(
    blockingGrid: BlockingGrid,
    roomWidth: number,
    roomHeight: number,
    spawnTiles: number[] | null,
    rng: () => number,
  ) {
    this.roomWidth = roomWidth;
    this.roomHeight = roomHeight;
    this.spawnTiles = spawnTiles;
    this.rng = rng;

    // Create store with behavior middleware
    this.store = createRoomStore([
      createBehaviorMiddleware(this.entityRegistry),
    ]);

    // Set room config
    this.store.dispatch(setRoomConfig({ roomWidth, roomHeight, tileSize: TILE_PX }));

    // Create room entity (no behaviors — server skips camera/render)
    const roomEntity = new ReduxEntity([], "room", this.store);
    this.registerEntity(roomEntity, null);
    roomEntity.set(BLOCKING_GRID, blockingGrid);

    // Fire enter event at tick 0
    resetEventBudget();
    this.store.dispatch(dataEvent({
      entityId: "room",
      type: "enter",
      data: {},
      time: tickToTime(0),
    }));
  }

  private registerEntity(entity: ReduxEntity, parentId: string | null): void {
    this.store.dispatch(addEntity({
      id: entity.id,
      parentId,
      childIds: [],
      state: {},
    }));
    this.entityRegistry.set(entity.id, entity);
  }

  // -------------------------------------------------------------------------
  // Tick loop
  // -------------------------------------------------------------------------

  /** Start the fixed-rate tick loop. */
  startTickLoop(): void {
    if (this.tickInterval) return;
    this.startTime = Date.now() - this.currentTick * TICK_MS;

    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const expectedTick = Math.floor((now - this.startTime) / TICK_MS);
      const ticksToProcess = Math.min(expectedTick - this.currentTick, MAX_CATCHUP_TICKS);

      for (let i = 0; i < ticksToProcess; i++) {
        this.processTick();
      }
    }, TICK_MS);
  }

  /** Stop the tick loop. */
  stopTickLoop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /** Process a single tick and broadcast if state changed. */
  private processTick(): void {
    this.currentTick++;
    resetEventBudget();
    this.store.dispatch(dataEvent({
      entityId: "room",
      type: "tick",
      data: {},
      time: tickToTime(this.currentTick),
    }));

    if (this.onTick) {
      const snapshot = this.buildTickSnapshot();
      const json = JSON.stringify(snapshot);
      if (json !== this.prevSnapshotJson) {
        this.prevSnapshotJson = json;
        this.onTick(this.currentTick, snapshot);
      }
    }
  }

  /** Current tick number. */
  get tick(): number {
    return this.currentTick;
  }

  // -------------------------------------------------------------------------
  // Player lifecycle
  // -------------------------------------------------------------------------

  /** Add a player entity. Returns spawn position. */
  addPlayer(entityId: string, identity: Identity, handle: string): Position {
    const pos = resolveSpawnTiles(this.spawnTiles, this.roomWidth, this.rng);

    const entity = new ReduxEntity([
      new MovementBehavior(),
      new AvatarAnimationBehavior(),
      new TargetBehavior(),
    ], entityId, this.store);

    this.registerEntity(entity, "room");
    entity.set(POSITION, pos);
    entity.set(DIRECTION, 0);
    entity.set(ANIM_STATE, "idle");

    // Wire parent-child for blocking grid lookup
    const roomEntity = this.entityRegistry.get("room");
    if (roomEntity) roomEntity.addChild(entity);

    // Store peer metadata for snapshot building
    this.peerMeta.set(entityId, { identity, handle });

    return pos;
  }

  /** Remove a player entity. */
  removePlayer(entityId: string): void {
    const entity = this.entityRegistry.get(entityId);
    if (!entity) return;

    const roomEntity = this.entityRegistry.get("room");
    if (roomEntity) roomEntity.removeChild(entity);

    this.store.dispatch(removeEntity(entityId));
    this.entityRegistry.delete(entityId);
    this.peerMeta.delete(entityId);
  }

  // -------------------------------------------------------------------------
  // Intent dispatch
  // -------------------------------------------------------------------------

  /** Dispatch a moveTo intent for an entity at the current tick. */
  dispatchMoveTo(entityId: string, x: number, y: number): void {
    resetEventBudget();
    this.store.dispatch(dataEvent({
      entityId,
      type: "moveTo",
      data: { x, y },
      time: tickToTime(this.currentTick),
    }));
  }

  /** Set speech state on an entity. */
  dispatchSay(entityId: string, emoji: string, bubble: "thought" | "speech"): void {
    const entity = this.entityRegistry.get(entityId);
    if (!entity) return;

    entity.set(SPEECH_TEXT, emoji);
    entity.set(SPEECH_BUBBLE, bubble);
    entity.set(SPEECH_START, tickToTime(this.currentTick));
    entity.set(SPEECH_DURATION, DEFAULT_SPEECH_DURATION);
  }

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------

  /** Build a full snapshot of all player entities. */
  buildTickSnapshot(): SnapshotEntity[] {
    const entities: SnapshotEntity[] = [];

    for (const [entityId, meta] of this.peerMeta) {
      const entity = this.entityRegistry.get(entityId);
      if (!entity) continue;

      const pos = entity.get<Position>(POSITION);
      if (!pos) continue;

      const snap: SnapshotEntity = {
        id: meta.identity,
        handle: meta.handle,
        x: pos.x,
        y: pos.y,
        direction: entity.get<number>(DIRECTION) ?? 0,
        animState: entity.get<string>(ANIM_STATE) ?? "idle",
      };

      // Movement interpolation fields
      const moveTarget = entity.get<Position>(MOVE_TARGET);
      if (moveTarget) {
        snap.moveTargetX = moveTarget.x;
        snap.moveTargetY = moveTarget.y;
        const moveStart = entity.get<number>(MOVE_START_TIME);
        if (moveStart !== undefined) {
          snap.moveStartTick = timeToTick(moveStart);
        }
        const moveSpeed = entity.get<number>(MOVE_SPEED);
        if (moveSpeed !== undefined) {
          snap.moveSpeed = moveSpeed;
        }
      }

      // Animation target — read from layer child
      const layerEntity = this.entityRegistry.get(`${entityId}:layer`);
      if (layerEntity) {
        const target = layerEntity.get<string>(TARGET);
        if (target) snap.target = target;
        const targetStart = layerEntity.get<number>(TARGET_START_TIME);
        if (targetStart !== undefined) {
          snap.targetStartTick = timeToTick(targetStart);
        }
      }

      // Speech
      const speechText = entity.get<string>(SPEECH_TEXT);
      if (speechText) {
        snap.speechText = speechText;
        snap.speechBubble = entity.get<"thought" | "speech">(SPEECH_BUBBLE) ?? "speech";
        const speechStart = entity.get<number>(SPEECH_START);
        if (speechStart !== undefined) {
          snap.speechStartTick = timeToTick(speechStart);
        }
        snap.speechDuration = entity.get<number>(SPEECH_DURATION) ?? DEFAULT_SPEECH_DURATION;
      }

      entities.push(snap);
    }

    return entities;
  }

  // -------------------------------------------------------------------------
  // State queries
  // -------------------------------------------------------------------------

  /** Get current position of an entity. */
  getPosition(entityId: string): Position | undefined {
    const entity = this.entityRegistry.get(entityId);
    return entity?.get<Position>(POSITION);
  }

  /** Get direction of an entity. */
  getDirection(entityId: string): number {
    const entity = this.entityRegistry.get(entityId);
    return entity?.get<number>(DIRECTION) ?? 0;
  }

  /** True when only the room entity remains (no players). */
  get isEmpty(): boolean {
    return this.peerMeta.size === 0;
  }
}
