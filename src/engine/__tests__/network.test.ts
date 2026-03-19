import { describe, it, expect } from "vitest";
import { createRoomStore } from "../store/store";
import { createBehaviorMiddleware } from "../store/behaviorMiddleware";
import { ReduxEntity } from "../entity";
import { addEntity } from "../store/actions";
import {
  POSITION,
  DIRECTION,
  ANIM_STATE,
  MOVE_TARGET,
  MOVE_START_TIME,
  MOVE_SPEED,
} from "../state/movement";
import { TILE_SIZE } from "../state/tiles";
import { TARGET, TARGET_START_TIME } from "../state/render";
import { BLOCKING_GRID, type BlockingGrid } from "../state/blocking";
import {
  SPEECH_TEXT,
  SPEECH_BUBBLE,
  SPEECH_START,
  SPEECH_DURATION,
} from "../state/speech";
import {
  applyTickSnapshot,
  removeAllRemotes,
  serverTickToLocal,
  type SnapshotEntity,
} from "../store/applySnapshot";

function openGrid(w = 10, h = 10): BlockingGrid {
  return { edges: new Array(w * h).fill(0), width: w, height: h };
}

function makeTestStore() {
  const entityRegistry = new Map<string, ReduxEntity>();
  const store = createRoomStore([
    createBehaviorMiddleware(entityRegistry),
  ]);

  // Create room entity
  const roomEntity = new ReduxEntity([], "room", store);
  store.dispatch(addEntity({ id: "room", parentId: null, childIds: [], state: {} }));
  entityRegistry.set("room", roomEntity);
  roomEntity.set(BLOCKING_GRID, openGrid());

  // Create local player entity
  const playerEntity = new ReduxEntity([], "player", store);
  store.dispatch(addEntity({ id: "player", parentId: "room", childIds: [], state: {} }));
  entityRegistry.set("player", playerEntity);
  playerEntity.set(POSITION, { x: 5, y: 5 });
  playerEntity.set(DIRECTION, 0);
  playerEntity.set(ANIM_STATE, "idle");
  roomEntity.addChild(playerEntity);

  return { store, entityRegistry, roomEntity, playerEntity };
}

describe("applyTickSnapshot", () => {
  it("creates remote entities from snapshot", () => {
    const { store, entityRegistry } = makeTestStore();
    const remoteEntities = new Map<string, ReduxEntity>();

    const snapshot: SnapshotEntity[] = [
      {
        id: { type: "did", did: "did:plc:alice" },
        handle: "alice.test",
        x: 3,
        y: 4,
        direction: 2,
        animState: "idle",
      },
    ];

    applyTickSnapshot(entityRegistry, store, snapshot, "did:plc:local", 0, remoteEntities);

    expect(remoteEntities.size).toBe(1);
    const entity = remoteEntities.get("did:plc:alice")!;
    expect(entity).toBeDefined();
    expect(entity.get(POSITION)).toEqual({ x: 3, y: 4 });
    expect(entity.get(DIRECTION)).toBe(2);
    expect(entity.get(ANIM_STATE)).toBe("idle");
    expect(entity.get(TILE_SIZE)).toBe(32);
  });

  it("updates existing remote entities", () => {
    const { store, entityRegistry } = makeTestStore();
    const remoteEntities = new Map<string, ReduxEntity>();

    const snap1: SnapshotEntity[] = [
      { id: { type: "did", did: "did:plc:alice" }, handle: "alice.test", x: 3, y: 4, direction: 0, animState: "idle" },
    ];
    applyTickSnapshot(entityRegistry, store, snap1, "did:plc:local", 0, remoteEntities);

    const snap2: SnapshotEntity[] = [
      { id: { type: "did", did: "did:plc:alice" }, handle: "alice.test", x: 4, y: 4, direction: 3, animState: "walk" },
    ];
    applyTickSnapshot(entityRegistry, store, snap2, "did:plc:local", 0, remoteEntities);

    expect(remoteEntities.size).toBe(1);
    const entity = remoteEntities.get("did:plc:alice")!;
    expect(entity.get(POSITION)).toEqual({ x: 4, y: 4 });
    expect(entity.get(DIRECTION)).toBe(3);
    expect(entity.get(ANIM_STATE)).toBe("walk");
  });

  it("removes departed entities", () => {
    const { store, entityRegistry } = makeTestStore();
    const remoteEntities = new Map<string, ReduxEntity>();

    const snap1: SnapshotEntity[] = [
      { id: { type: "did", did: "did:plc:alice" }, handle: "alice.test", x: 3, y: 4, direction: 0, animState: "idle" },
      { id: { type: "did", did: "did:plc:bob" }, handle: "bob.test", x: 1, y: 1, direction: 0, animState: "idle" },
    ];
    applyTickSnapshot(entityRegistry, store, snap1, "did:plc:local", 0, remoteEntities);
    expect(remoteEntities.size).toBe(2);

    // Bob leaves
    const snap2: SnapshotEntity[] = [
      { id: { type: "did", did: "did:plc:alice" }, handle: "alice.test", x: 3, y: 4, direction: 0, animState: "idle" },
    ];
    applyTickSnapshot(entityRegistry, store, snap2, "did:plc:local", 0, remoteEntities);

    expect(remoteEntities.size).toBe(1);
    expect(remoteEntities.has("did:plc:bob")).toBe(false);
    expect(entityRegistry.has("remote:did:plc:bob")).toBe(false);
  });

  it("skips local player in remote entity creation", () => {
    const { store, entityRegistry } = makeTestStore();
    const remoteEntities = new Map<string, ReduxEntity>();

    const snapshot: SnapshotEntity[] = [
      { id: { type: "did", did: "did:plc:local" }, handle: "me.test", x: 5, y: 5, direction: 0, animState: "idle" },
      { id: { type: "did", did: "did:plc:alice" }, handle: "alice.test", x: 3, y: 4, direction: 0, animState: "idle" },
    ];
    applyTickSnapshot(entityRegistry, store, snapshot, "did:plc:local", 0, remoteEntities);

    // Only alice should be a remote entity
    expect(remoteEntities.size).toBe(1);
    expect(remoteEntities.has("did:plc:local")).toBe(false);
    expect(remoteEntities.has("did:plc:alice")).toBe(true);
  });

  it("applies movement interpolation fields", () => {
    const { store, entityRegistry } = makeTestStore();
    const remoteEntities = new Map<string, ReduxEntity>();
    const timeOffset = 1000;

    const snapshot: SnapshotEntity[] = [
      {
        id: { type: "did", did: "did:plc:alice" },
        handle: "alice.test",
        x: 3,
        y: 4,
        direction: 0,
        animState: "walk",
        moveTargetX: 3,
        moveTargetY: 5,
        moveStartTick: 10,
        moveSpeed: 200,
      },
    ];
    applyTickSnapshot(entityRegistry, store, snapshot, "did:plc:local", timeOffset, remoteEntities);

    const entity = remoteEntities.get("did:plc:alice")!;
    expect(entity.get(MOVE_TARGET)).toEqual({ x: 3, y: 5 });
    expect(entity.get(MOVE_START_TIME)).toBe(serverTickToLocal(10, timeOffset));
    expect(entity.get(MOVE_SPEED)).toBe(200);
  });

  it("applies animation target to layer child", () => {
    const { store, entityRegistry } = makeTestStore();
    const remoteEntities = new Map<string, ReduxEntity>();

    const snapshot: SnapshotEntity[] = [
      {
        id: { type: "did", did: "did:plc:alice" },
        handle: "alice.test",
        x: 3,
        y: 4,
        direction: 0,
        animState: "walk",
        target: "walk-south",
        targetStartTick: 5,
      },
    ];
    applyTickSnapshot(entityRegistry, store, snapshot, "did:plc:local", 1000, remoteEntities);

    const layerEntity = entityRegistry.get("remote:did:plc:alice:layer")!;
    expect(layerEntity).toBeDefined();
    expect(layerEntity.get(TARGET)).toBe("walk-south");
    expect(layerEntity.get(TARGET_START_TIME)).toBe(serverTickToLocal(5, 1000));
  });

  it("applies speech state", () => {
    const { store, entityRegistry } = makeTestStore();
    const remoteEntities = new Map<string, ReduxEntity>();

    const snapshot: SnapshotEntity[] = [
      {
        id: { type: "did", did: "did:plc:alice" },
        handle: "alice.test",
        x: 3,
        y: 4,
        direction: 0,
        animState: "idle",
        speechText: "👋",
        speechBubble: "speech",
        speechStartTick: 10,
        speechDuration: 3000,
      },
    ];
    applyTickSnapshot(entityRegistry, store, snapshot, "did:plc:local", 500, remoteEntities);

    const entity = remoteEntities.get("did:plc:alice")!;
    expect(entity.get(SPEECH_TEXT)).toBe("👋");
    expect(entity.get(SPEECH_BUBBLE)).toBe("speech");
    expect(entity.get(SPEECH_START)).toBe(serverTickToLocal(10, 500));
    expect(entity.get(SPEECH_DURATION)).toBe(3000);
  });

  it("reconciles local player position when idle and diverged", () => {
    const { store, entityRegistry, playerEntity } = makeTestStore();
    const remoteEntities = new Map<string, ReduxEntity>();

    // Server says local player is at (7, 7) but client has (5, 5)
    const snapshot: SnapshotEntity[] = [
      { id: { type: "did", did: "did:plc:local" }, handle: "me.test", x: 7, y: 7, direction: 2, animState: "idle" },
    ];
    applyTickSnapshot(entityRegistry, store, snapshot, "did:plc:local", 0, remoteEntities);

    expect(playerEntity.get(POSITION)).toEqual({ x: 7, y: 7 });
    expect(playerEntity.get(DIRECTION)).toBe(2);
  });
});

describe("removeAllRemotes", () => {
  it("clears all remote entities", () => {
    const { store, entityRegistry } = makeTestStore();
    const remoteEntities = new Map<string, ReduxEntity>();

    const snapshot: SnapshotEntity[] = [
      { id: { type: "did", did: "did:plc:alice" }, handle: "alice.test", x: 3, y: 4, direction: 0, animState: "idle" },
      { id: { type: "did", did: "did:plc:bob" }, handle: "bob.test", x: 1, y: 1, direction: 0, animState: "idle" },
    ];
    applyTickSnapshot(entityRegistry, store, snapshot, "did:plc:local", 0, remoteEntities);
    expect(remoteEntities.size).toBe(2);

    removeAllRemotes(entityRegistry, store, remoteEntities);

    expect(remoteEntities.size).toBe(0);
    expect(entityRegistry.has("remote:did:plc:alice")).toBe(false);
    expect(entityRegistry.has("remote:did:plc:bob")).toBe(false);
  });
});

describe("serverTickToLocal", () => {
  it("converts server tick to local time", () => {
    expect(serverTickToLocal(10, 1000)).toBe(10 * 50 + 1000);
    expect(serverTickToLocal(0, 500)).toBe(500);
  });
});
