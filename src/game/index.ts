// Types
export { Direction, Edge, directionName, directionDelta, directionFromDelta, entryEdge } from "./types";
export type { EntityType, Point, GameEntity, TileAttribute, TileExit, TileState, RoomConfig } from "./types";

// Store
export { createGameStore } from "./store";
export type { GameStore, GameState, GameDispatch } from "./store";

// Slices & actions
export {
  addEntity,
  removeEntity,
  addMany,
  setPosition,
  setDirection,
  setAnimTarget,
  setEntityState,
  startMove,
  stopMove,
  TICK,
  INTERACT,
  MESSAGE,
} from "./entity-slice";
export { initRoom, setTile, removeTile } from "./room-slice";
export { addCamera, attachCamera, setCameraPosition, removeCamera } from "./camera-slice";
export type { CameraState, CameraPan } from "./camera-slice";

// Selectors
export {
  selectAllEntities,
  selectEntityById,
  selectEntitiesByType,
  selectBlockingGrid,
  selectAttributeMaps,
  selectSpawnTiles,
  selectTileAt,
  selectCamera,
  selectCameraPosition,
} from "./selectors";
export type { RootState, CameraPosition } from "./selectors";

// Pathfinding
export { findPath } from "./pathfinding";

// Tick
export { TickLoop } from "./tick";

// Scripting
export { FengariRuntime } from "./scripting/fengari-runtime";
export { createScriptMiddleware } from "./scripting/middleware";
export { lintLuaScript, lintPassed } from "./scripting/lint";
export type { LintDiagnostic } from "./scripting/lint";
export type { ScriptRuntime, ScriptHandle, ScriptAPI } from "./scripting/types";
export type { ScriptEntry } from "./scripting/middleware";

// Runtime (main entry point)
export { RoomRuntime } from "./runtime";
export type { RoomRuntimeOptions } from "./runtime";
