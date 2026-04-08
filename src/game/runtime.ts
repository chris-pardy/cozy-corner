import {
  addEntity,
  addMany,
  removeEntity,
  startMove,
  stopMove,
  setEntityState,
  setDirection,
  setAnimTarget,
  INTERACT,
  MESSAGE,
  type InteractPayload,
  type MessagePayload,
} from "./entity-slice";
import {
  addCamera,
  attachCamera,
  setCameraPosition,
} from "./camera-slice";
import { initRoom } from "./room-slice";
import { findPath } from "./pathfinding";
import {
  selectAllEntities,
  selectEntityById,
  selectBlockingGrid,
  selectAttributeMaps,
  selectSpawnTiles,
  selectCamera,
  selectCameraPosition,
  type RootState,
} from "./selectors";
import { createGameStore, type CreateStoreOptions, type GameStore } from "./store";
import { TickLoop } from "./tick";
import type { ScriptEntry } from "./scripting/middleware";
import type { ScriptRuntime } from "./scripting/types";
import type { Direction, GameEntity, Point, RoomConfig, TileState } from "./types";

// ---------------------------------------------------------------------------
// RoomRuntime — public API for a running room
// ---------------------------------------------------------------------------

export interface RoomRuntimeOptions {
  config: RoomConfig;
  tiles: TileState[];
  entities?: Array<Partial<GameEntity> & Pick<GameEntity, "id" | "type" | "x" | "y">>;
  scripts?: ScriptEntry[];
  scriptRuntime?: ScriptRuntime;
}

export class RoomRuntime {
  readonly store: GameStore;
  private tickLoop: TickLoop;
  private runtime: ScriptRuntime;

  constructor(options: RoomRuntimeOptions) {
    const { store, runtime } = createGameStore({
      scripts: options.scripts,
      scriptRuntime: options.scriptRuntime,
    });
    this.store = store;
    this.runtime = runtime;
    this.tickLoop = new TickLoop(store.dispatch);

    // Initialize room
    store.dispatch(initRoom({ config: options.config, tiles: options.tiles }));

    // Add initial entities
    if (options.entities && options.entities.length > 0) {
      store.dispatch(addMany(options.entities));
    }
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Start the 24fps tick loop. */
  start() {
    this.tickLoop.start();
  }

  /** Pause the tick loop (state is preserved). */
  stop() {
    this.tickLoop.stop();
  }

  /** Tear down the runtime, stop ticking, dispose scripts. */
  dispose() {
    this.tickLoop.stop();
    this.runtime.dispose();
  }

  get running() {
    return this.tickLoop.running;
  }

  // -----------------------------------------------------------------------
  // Entity management
  // -----------------------------------------------------------------------

  addEntity(entity: Partial<GameEntity> & Pick<GameEntity, "id" | "type" | "x" | "y">) {
    this.store.dispatch(addEntity(entity));
  }

  removeEntity(id: string) {
    this.store.dispatch(removeEntity(id));
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /** Move entity along an A*-computed path to (x, y). Returns false if no path. */
  moveTo(entityId: string, x: number, y: number): boolean {
    const state = this.getState();
    const entity = selectEntityById(state, entityId);
    if (!entity) return false;

    const grid = selectBlockingGrid(state);
    const path = findPath(
      grid,
      state.room.width,
      state.room.height,
      { x: entity.x, y: entity.y },
      { x, y },
    );
    if (!path || path.length === 0) return false;
    this.store.dispatch(startMove({ id: entityId, path }));
    return true;
  }

  stopMoving(entityId: string) {
    this.store.dispatch(stopMove(entityId));
  }

  interact(sourceId: string, targetId: string) {
    this.store.dispatch({
      type: INTERACT,
      payload: { sourceId, targetId } satisfies InteractPayload,
    });
  }

  sendMessage(fromId: string, toId: string, name: string, data: Record<string, string> = {}) {
    this.store.dispatch({
      type: MESSAGE,
      payload: { fromId, toId, name, data } satisfies MessagePayload,
    });
  }

  setEntityState(entityId: string, key: string, value: string) {
    this.store.dispatch(setEntityState({ id: entityId, key, value }));
  }

  setDirection(entityId: string, direction: Direction) {
    this.store.dispatch(setDirection({ id: entityId, direction }));
  }

  setAnimTarget(entityId: string, target: string) {
    this.store.dispatch(setAnimTarget({ id: entityId, target }));
  }

  // -----------------------------------------------------------------------
  // Camera
  // -----------------------------------------------------------------------

  /** Register a camera for a PC. Defaults to following itself. */
  addCamera(owner: string, followId?: string, radius?: number) {
    this.store.dispatch(addCamera({ owner, followId, radius }));
  }

  /** Attach a PC's camera to follow any entity. */
  attachCamera(owner: string, followId: string, radius?: number) {
    this.store.dispatch(attachCamera({ owner, followId, radius }));
  }

  /**
   * Detach a PC's camera and move it to a static position.
   * If `duration` > 0, animates over that many ticks (24 ticks ≈ 1 second).
   */
  setCameraPosition(owner: string, x: number, y: number, radius?: number, duration?: number) {
    this.store.dispatch(setCameraPosition({ owner, x, y, radius, duration }));
  }

  /** Get the resolved camera view for a PC ({x, y, radius} or null). */
  getCameraPosition(owner: string) {
    return selectCameraPosition(this.getState(), owner);
  }

  /** Get the raw camera state for a PC. */
  getCamera(owner: string) {
    return selectCamera(this.getState(), owner);
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  getState(): RootState {
    return this.store.getState();
  }

  getEntity(id: string) {
    return selectEntityById(this.getState(), id);
  }

  getAllEntities() {
    return selectAllEntities(this.getState());
  }

  getBlockingGrid() {
    return selectBlockingGrid(this.getState());
  }

  getAttributeMaps() {
    return selectAttributeMaps(this.getState());
  }

  getSpawnTiles() {
    return selectSpawnTiles(this.getState());
  }

  /** Subscribe to store changes. Returns unsubscribe function. */
  subscribe(listener: () => void) {
    return this.store.subscribe(listener);
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /** Snapshot the full room state (serializable JSON). Does not include Lua script state. */
  serialize(): RootState {
    return this.getState();
  }
}
