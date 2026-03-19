import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { StateValueData } from "../editor-types";
import type { Script as ScriptModel } from "~/atproto/generated/types/at/cozy-corner/script";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlacedTile {
  tile: number;
  x: number;
  y: number;
  /** Packed transform. Bits 0-1: rotation, bit 2: hflip, bit 3: vflip. */
  transform: number;
  renderLayer: number;
  layerName?: string;
  tint?: string;
}

export interface RoomExitData {
  label: string;
  target: { uri: string; cid: string } | null;
  targetExit?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: number;
}

/** Per-layer tint data. */
export interface LayerTintData {
  layerIndex: number;
  tint: string;
}

/** Serializable subset of a placed item (no HTMLImageElement). */
export interface RoomItemData {
  item: { uri: string; cid: string };
  x: number;
  y: number;
  variant: number;
  foreground: number;
  state: StateValueData[];
  tints: LayerTintData[];
}

/** Serializable subset of a placed critter (no HTMLImageElement). */
export interface RoomCritterData {
  critter: { uri: string; cid: string };
  area: number[];
  name: string;
  state: StateValueData[];
}

export interface TileAttributeData {
  attribute: string;
  values: number[];
}

export type BackgroundType = "none" | "color" | "gradient" | "image";

export interface BackgroundDataState {
  type: BackgroundType;
  color?: string;
  angle?: number;
  stops?: { color: string; position?: number }[];
  /** Existing blob ref from PDS (for image backgrounds being re-saved) */
  blobRef?: unknown;
}

export interface RoomEditorState {
  name: string;
  gridWidth: number;
  gridHeight: number;
  placedTiles: PlacedTile[];
  exits: RoomExitData[];
  spawnTiles: number[];
  blockingEdges: number[];
  background: BackgroundDataState;
  roomItems: RoomItemData[];
  roomCritters: RoomCritterData[];
  tileAttributes: TileAttributeData[];
  behaviors: ScriptModel[];
}

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

const GRID_DEFAULT = 16;

export function createRoomEditorInitialState(
  overrides?: Partial<RoomEditorState>,
): RoomEditorState {
  return {
    name: "",
    gridWidth: GRID_DEFAULT,
    gridHeight: GRID_DEFAULT,
    placedTiles: [],
    exits: [],
    spawnTiles: [],
    blockingEdges: [],
    background: { type: "none" },
    roomItems: [],
    roomCritters: [],
    tileAttributes: [],
    behaviors: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const roomEditorSlice = createSlice({
  name: "editor",
  initialState: createRoomEditorInitialState(),
  reducers: {
    // Metadata
    setRoomName(state, action: PayloadAction<string>) {
      state.name = action.payload;
    },
    setGridWidth(state, action: PayloadAction<number>) {
      state.gridWidth = action.payload;
    },
    setGridHeight(state, action: PayloadAction<number>) {
      state.gridHeight = action.payload;
    },

    // Tiles
    addPlacedTile(state, action: PayloadAction<PlacedTile>) {
      state.placedTiles.push(action.payload);
    },
    setPlacedTiles(state, action: PayloadAction<PlacedTile[]>) {
      state.placedTiles = action.payload;
    },

    // Exits
    addExit(state, action: PayloadAction<RoomExitData>) {
      state.exits.push(action.payload);
    },
    updateExit(
      state,
      action: PayloadAction<{ index: number; exit: RoomExitData }>,
    ) {
      const { index, exit } = action.payload;
      if (state.exits[index]) state.exits[index] = exit;
    },
    removeExit(state, action: PayloadAction<number>) {
      state.exits.splice(action.payload, 1);
    },

    // Spawn
    setSpawnTiles(state, action: PayloadAction<number[]>) {
      state.spawnTiles = action.payload;
    },

    // Blocking
    setBlockingEdges(state, action: PayloadAction<number[]>) {
      state.blockingEdges = action.payload;
    },

    // Background
    setBackground(state, action: PayloadAction<BackgroundDataState>) {
      state.background = action.payload;
    },

    // Items
    addRoomItem(state, action: PayloadAction<RoomItemData>) {
      state.roomItems.push(action.payload);
    },
    removeRoomItem(state, action: PayloadAction<number>) {
      state.roomItems.splice(action.payload, 1);
    },
    setRoomItems(state, action: PayloadAction<RoomItemData[]>) {
      state.roomItems = action.payload;
    },
    updateRoomItemState(
      state,
      action: PayloadAction<{ index: number; state: StateValueData[] }>,
    ) {
      const item = state.roomItems[action.payload.index];
      if (item) item.state = action.payload.state;
    },
    updateRoomItemTints(
      state,
      action: PayloadAction<{ index: number; tints: LayerTintData[] }>,
    ) {
      const item = state.roomItems[action.payload.index];
      if (item) item.tints = action.payload.tints;
    },

    // Critters
    addRoomCritter(state, action: PayloadAction<RoomCritterData>) {
      state.roomCritters.push(action.payload);
    },
    removeRoomCritter(state, action: PayloadAction<number>) {
      state.roomCritters.splice(action.payload, 1);
    },
    setRoomCritters(state, action: PayloadAction<RoomCritterData[]>) {
      state.roomCritters = action.payload;
    },
    updateCritterArea(
      state,
      action: PayloadAction<{ index: number; area: number[] }>,
    ) {
      const c = state.roomCritters[action.payload.index];
      if (c) c.area = action.payload.area;
    },
    updateCritterName(
      state,
      action: PayloadAction<{ index: number; name: string }>,
    ) {
      const c = state.roomCritters[action.payload.index];
      if (c) c.name = action.payload.name;
    },
    updateCritterState(
      state,
      action: PayloadAction<{ index: number; state: StateValueData[] }>,
    ) {
      const c = state.roomCritters[action.payload.index];
      if (c) c.state = action.payload.state;
    },

    // Tile attributes
    setTileAttributes(state, action: PayloadAction<TileAttributeData[]>) {
      state.tileAttributes = action.payload;
    },

    // Behaviors
    addRoomBehavior(state, action: PayloadAction<ScriptModel>) {
      state.behaviors.push(action.payload);
    },
    removeRoomBehavior(state, action: PayloadAction<number>) {
      state.behaviors.splice(action.payload, 1);
    },
    updateRoomBehavior(
      state,
      action: PayloadAction<{ idx: number; script: ScriptModel }>,
    ) {
      const { idx, script } = action.payload;
      if (state.behaviors[idx]) state.behaviors[idx] = script;
    },

    // Lifecycle
    restoreRoomState(_state, action: PayloadAction<RoomEditorState>) {
      return action.payload;
    },
  },
});

export const {
  setRoomName,
  setGridWidth,
  setGridHeight,
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
  setRoomItems,
  updateRoomItemState,
  updateRoomItemTints,
  addRoomCritter,
  removeRoomCritter,
  setRoomCritters,
  updateCritterArea,
  updateCritterName,
  updateCritterState,
  setTileAttributes,
  addRoomBehavior,
  removeRoomBehavior,
  updateRoomBehavior,
  restoreRoomState,
} = roomEditorSlice.actions;

export const roomEditorReducer = roomEditorSlice.reducer;
