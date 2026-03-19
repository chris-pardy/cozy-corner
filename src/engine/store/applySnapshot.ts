/**
 * Apply server tick snapshots to the client entity tree.
 *
 * Remote entities are behavior-less state bags — the snapshot overwrites
 * their state directly. The existing rendering code (position interpolation
 * via MOVE_TARGET/MOVE_START_TIME, sprite frame selection via TARGET/
 * TARGET_START_TIME) works without changes.
 */

import type { RoomStore } from "./store";
import { addEntity, removeEntity } from "./actions";
import { ReduxEntity } from "../entity";
import { POSITION, DIRECTION, ANIM_STATE, MOVE_TARGET, MOVE_START_TIME, MOVE_SPEED } from "../state/movement";
import { TILE_SIZE } from "../state/tiles";
import { TARGET, TARGET_START_TIME } from "../state/render";
import {
  SPEECH_TEXT,
  SPEECH_BUBBLE,
  SPEECH_START,
  SPEECH_DURATION,
} from "../state/speech";
import { TICK_MS } from "../tick";

// ---------------------------------------------------------------------------
// Types matching server protocol
// ---------------------------------------------------------------------------

export interface Identity {
  type: "did" | "anonymousId";
  did?: string;
  anonymousId?: string;
}

export interface SnapshotEntity {
  id: Identity;
  handle: string;
  x: number;
  y: number;
  direction: number;
  animState: string;
  moveTargetX?: number;
  moveTargetY?: number;
  moveStartTick?: number;
  moveSpeed?: number;
  target?: string;
  targetStartTick?: number;
  speechText?: string;
  speechBubble?: "thought" | "speech";
  speechStartTick?: number;
  speechDuration?: number;
}

export function identityKey(id: Identity): string {
  return id.type === "did" ? id.did! : id.anonymousId!;
}

// ---------------------------------------------------------------------------
// Time conversion
// ---------------------------------------------------------------------------

/** Convert a server tick to local client time using the computed offset. */
export function serverTickToLocal(tick: number, timeOffset: number): number {
  return tick * TICK_MS + timeOffset;
}

// ---------------------------------------------------------------------------
// Snapshot application
// ---------------------------------------------------------------------------

const TILE_PX = 32;

/**
 * Apply a tick snapshot to the client entity tree.
 *
 * For each entity in the snapshot:
 * - If it's the local player, reconcile position (snap if diverged)
 * - Otherwise, create/update a behavior-less remote entity
 *
 * Removes remote entities not present in the snapshot.
 */
export function applyTickSnapshot(
  entityRegistry: Map<string, ReduxEntity>,
  store: RoomStore,
  snapshot: SnapshotEntity[],
  localIdentityKey: string | null,
  timeOffset: number,
  remoteEntities: Map<string, ReduxEntity>,
): void {
  const activeKeys = new Set<string>();

  for (const snap of snapshot) {
    const key = identityKey(snap.id);

    // Skip local player in remote entity creation — reconcile separately
    if (key === localIdentityKey) {
      reconcileLocalPlayer(entityRegistry, snap);
      continue;
    }

    activeKeys.add(key);

    const entity = remoteEntities.get(key) ??
      createRemoteEntity(entityRegistry, store, key, remoteEntities);

    if (!entity) continue;

    // Update core state
    entity.set(POSITION, { x: snap.x, y: snap.y });
    entity.set(DIRECTION, snap.direction);
    entity.set(ANIM_STATE, snap.animState);
    entity.set(TILE_SIZE, TILE_PX);

    // Movement interpolation
    if (snap.moveTargetX !== undefined && snap.moveTargetY !== undefined) {
      entity.set(MOVE_TARGET, { x: snap.moveTargetX, y: snap.moveTargetY });
      if (snap.moveStartTick !== undefined) {
        entity.set(MOVE_START_TIME, serverTickToLocal(snap.moveStartTick, timeOffset));
      }
      if (snap.moveSpeed !== undefined) {
        entity.set(MOVE_SPEED, snap.moveSpeed);
      }
    } else {
      entity.delete(MOVE_TARGET);
    }

    // Animation target on layer child
    const layerId = `remote:${key}:layer`;
    const layerEntity = entityRegistry.get(layerId);
    if (layerEntity) {
      if (snap.target) {
        layerEntity.set(TARGET, snap.target);
      }
      if (snap.targetStartTick !== undefined) {
        layerEntity.set(TARGET_START_TIME, serverTickToLocal(snap.targetStartTick, timeOffset));
      }
    }

    // Speech
    if (snap.speechText) {
      entity.set(SPEECH_TEXT, snap.speechText);
      entity.set(SPEECH_BUBBLE, snap.speechBubble ?? "speech");
      if (snap.speechStartTick !== undefined) {
        entity.set(SPEECH_START, serverTickToLocal(snap.speechStartTick, timeOffset));
      }
      entity.set(SPEECH_DURATION, snap.speechDuration ?? 3000);
    } else {
      entity.delete(SPEECH_TEXT);
    }
  }

  // Remove remote entities not in snapshot
  for (const [key, entity] of remoteEntities) {
    if (!activeKeys.has(key)) {
      const roomEntity = entityRegistry.get("room");
      if (roomEntity) roomEntity.removeChild(entity);

      remoteEntities.delete(key);

      const entityId = `remote:${key}`;
      store.dispatch(removeEntity(entityId));
      entityRegistry.delete(entityId);
      entityRegistry.delete(`${entityId}:layer`);
    }
  }
}

/** Create a behavior-less remote entity (pure state bag). */
function createRemoteEntity(
  entityRegistry: Map<string, ReduxEntity>,
  store: RoomStore,
  key: string,
  remoteEntities: Map<string, ReduxEntity>,
): ReduxEntity | null {
  const entityId = `remote:${key}`;

  // Create entity with no behaviors
  const entity = new ReduxEntity([], entityId, store);
  store.dispatch(addEntity({
    id: entityId,
    parentId: "room",
    childIds: [],
    state: {},
  }));
  entityRegistry.set(entityId, entity);

  // Create layer child (for sprite rendering via TARGET)
  const layerId = `${entityId}:layer`;
  const layerEntity = new ReduxEntity([], layerId, store);
  store.dispatch(addEntity({
    id: layerId,
    parentId: entityId,
    childIds: [],
    state: {},
  }));
  entityRegistry.set(layerId, layerEntity);

  layerEntity.set(TARGET, "idle-south");
  layerEntity.set(TARGET_START_TIME, 0);
  layerEntity.set(POSITION, { x: 0, y: 0 });

  // Wire parent-child for scene graph traversal
  const roomEntity = entityRegistry.get("room");
  if (roomEntity) {
    roomEntity.addChild(entity);
    entity.addChild(layerEntity);
  }

  remoteEntities.set(key, entity);
  return entity;
}

/** Reconcile local player state with server snapshot. */
function reconcileLocalPlayer(
  entityRegistry: Map<string, ReduxEntity>,
  snap: SnapshotEntity,
): void {
  const player = entityRegistry.get("player");
  if (!player) return;

  const pos = player.get<{ x: number; y: number }>(POSITION);
  if (!pos) return;

  // If server position diverges from local prediction, snap to server state
  if (pos.x !== snap.x || pos.y !== snap.y) {
    // Only snap if the player is idle (not mid-step) to avoid visual jitter
    const animState = player.get<string>(ANIM_STATE);
    if (animState === "idle") {
      player.set(POSITION, { x: snap.x, y: snap.y });
      player.set(DIRECTION, snap.direction);
    }
  }
}

/** Remove all remote entities (on disconnect). */
export function removeAllRemotes(
  entityRegistry: Map<string, ReduxEntity>,
  store: RoomStore,
  remoteEntities: Map<string, ReduxEntity>,
): void {
  const roomEntity = entityRegistry.get("room");
  for (const [_key, entity] of remoteEntities) {
    if (roomEntity) roomEntity.removeChild(entity);
    store.dispatch(removeEntity(entity.id));
    entityRegistry.delete(entity.id);
    entityRegistry.delete(`${entity.id}:layer`);
  }
  remoteEntities.clear();
}
