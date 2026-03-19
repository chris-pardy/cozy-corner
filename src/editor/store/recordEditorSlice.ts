import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { StatePropertyData } from "../StatePropertyEditor";
import type { StateValueData } from "../editor-types";
import type { Script as ScriptModel } from "~/atproto/generated/types/at/cozy-corner/script";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VariantData {
  id: number;
  name: string;
  target: string;
  itemWidth: number;
  itemHeight: number;
  blockedEdges: number[];
  state: StateValueData[];
}

export interface TileData {
  id: number;
  name: string;
  wall: boolean;
}

export interface RecordEditorState {
  name: string;
  description: string;
  tags: string[];
  targets: string[];
  behaviors: ScriptModel[];
  stateProperties: StatePropertyData[];

  // Item-specific
  variants: VariantData[];
  nextVariantId: number;

  // Wearable-specific
  previewBaseRef: { uri: string; cid: string } | null;

  // Tileset-specific
  tiles: TileData[];
  nextTileId: number;
}

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export function createRecordEditorInitialState(
  overrides?: Partial<RecordEditorState>,
): RecordEditorState {
  return {
    name: "",
    description: "",
    tags: [],
    targets: [],
    behaviors: [],
    stateProperties: [],
    variants: [],
    nextVariantId: 1,
    previewBaseRef: null,
    tiles: [],
    nextTileId: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resize a flat grid array when dimensions change, preserving top-left data. */
function resizeGrid(
  old: number[],
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
): number[] {
  const out = new Array(newW * newH).fill(0);
  const copyW = Math.min(oldW, newW);
  const copyH = Math.min(oldH, newH);
  for (let r = 0; r < copyH; r++) {
    for (let c = 0; c < copyW; c++) {
      out[r * newW + c] = old[r * oldW + c] ?? 0;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const recordEditorSlice = createSlice({
  name: "editor",
  initialState: createRecordEditorInitialState(),
  reducers: {
    // Metadata
    setName(state, action: PayloadAction<string>) {
      state.name = action.payload;
    },
    setDescription(state, action: PayloadAction<string>) {
      state.description = action.payload;
    },

    // Tags
    addTag(state, action: PayloadAction<string>) {
      const tag = action.payload;
      if (!state.tags.includes(tag)) state.tags.push(tag);
    },
    removeTag(state, action: PayloadAction<string>) {
      state.tags = state.tags.filter((t) => t !== action.payload);
    },

    // Targets
    addTarget(state, action: PayloadAction<string>) {
      const trimmed = action.payload.trim().toLowerCase().replace(/\s+/g, "-");
      if (trimmed && !state.targets.includes(trimmed)) {
        state.targets.push(trimmed);
      }
    },
    removeTarget(state, action: PayloadAction<string>) {
      state.targets = state.targets.filter((t) => t !== action.payload);
    },

    // Behaviors
    addBehavior(state, action: PayloadAction<ScriptModel>) {
      state.behaviors.push(action.payload);
    },
    removeBehavior(state, action: PayloadAction<number>) {
      state.behaviors.splice(action.payload, 1);
    },
    updateBehavior(
      state,
      action: PayloadAction<{ idx: number; script: ScriptModel }>,
    ) {
      const { idx, script } = action.payload;
      if (state.behaviors[idx]) state.behaviors[idx] = script;
    },

    // State properties
    setStateProperties(state, action: PayloadAction<StatePropertyData[]>) {
      state.stateProperties = action.payload;
    },

    // Variants (Item editor)
    addVariant(state) {
      const id = state.nextVariantId++;
      state.variants.push({
        id,
        name: "",
        target: "",
        itemWidth: 1,
        itemHeight: 1,
        blockedEdges: [0],
        state: [],
      });
    },
    removeVariant(state, action: PayloadAction<number>) {
      state.variants = state.variants.filter((v) => v.id !== action.payload);
    },
    updateVariant(
      state,
      action: PayloadAction<{ id: number; patch: Partial<VariantData> }>,
    ) {
      const { id, patch } = action.payload;
      const v = state.variants.find((v) => v.id === id);
      if (v) Object.assign(v, patch);
    },
    updateVariantDimension(
      state,
      action: PayloadAction<{
        id: number;
        key: "itemWidth" | "itemHeight";
        value: number;
      }>,
    ) {
      const { id, key, value } = action.payload;
      const v = state.variants.find((v) => v.id === id);
      if (!v) return;
      const newW = key === "itemWidth" ? value : v.itemWidth;
      const newH = key === "itemHeight" ? value : v.itemHeight;
      v.blockedEdges = resizeGrid(
        v.blockedEdges,
        v.itemWidth,
        v.itemHeight,
        newW,
        newH,
      );
      v[key] = value;
    },

    // Wearable-specific
    setPreviewBaseRef(
      state,
      action: PayloadAction<{ uri: string; cid: string } | null>,
    ) {
      state.previewBaseRef = action.payload;
    },

    // Tiles (Tileset editor)
    addTile(state) {
      const id = state.nextTileId++;
      state.tiles.push({ id, name: "", wall: false });
    },
    removeTile(state, action: PayloadAction<number>) {
      state.tiles = state.tiles.filter((t) => t.id !== action.payload);
    },
    updateTile(
      state,
      action: PayloadAction<{ id: number; patch: Partial<TileData> }>,
    ) {
      const { id, patch } = action.payload;
      const t = state.tiles.find((t) => t.id === id);
      if (t) Object.assign(t, patch);
    },

    // Lifecycle
    restoreRecordState(_state, action: PayloadAction<RecordEditorState>) {
      return action.payload;
    },
  },
});

export const {
  setName,
  setDescription,
  addTag,
  removeTag,
  addTarget,
  removeTarget,
  addBehavior,
  removeBehavior,
  updateBehavior,
  setStateProperties,
  addVariant,
  removeVariant,
  updateVariant,
  updateVariantDimension,
  setPreviewBaseRef,
  addTile,
  removeTile,
  updateTile,
  restoreRecordState,
} = recordEditorSlice.actions;

export const recordEditorReducer = recordEditorSlice.reducer;
