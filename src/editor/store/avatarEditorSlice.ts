import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { LayerTint, Transform } from "~/atproto/generated/types/at/cozy-corner/defs";
import type { StateValueData } from "../editor-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Serializable subset of an equipped entry (no HTMLImageElement). */
export interface EquippedEntryData {
  ref: { uri: string; cid: string };
  name: string;
  tints: LayerTint[];
  transform?: Transform;
  state: StateValueData[];
}

export interface AvatarEditorState {
  baseAvatar: EquippedEntryData | null;
  wearables: EquippedEntryData[];
  selectedIndex: number;
}

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export function createAvatarEditorInitialState(
  overrides?: Partial<AvatarEditorState>,
): AvatarEditorState {
  return {
    baseAvatar: null,
    wearables: [],
    selectedIndex: -1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const avatarEditorSlice = createSlice({
  name: "editor",
  initialState: createAvatarEditorInitialState(),
  reducers: {
    setSelectedIndex(state, action: PayloadAction<number>) {
      state.selectedIndex = action.payload;
    },

    // Base avatar
    setBaseAvatar(state, action: PayloadAction<EquippedEntryData | null>) {
      state.baseAvatar = action.payload;
    },
    setBaseAvatarTints(state, action: PayloadAction<LayerTint[]>) {
      if (state.baseAvatar) state.baseAvatar.tints = action.payload;
    },
    setBaseAvatarTransform(state, action: PayloadAction<Transform>) {
      if (state.baseAvatar) state.baseAvatar.transform = action.payload;
    },

    // Wearables
    addWearable(state, action: PayloadAction<EquippedEntryData>) {
      if (!state.wearables.some((w) => w.ref.uri === action.payload.ref.uri)) {
        state.wearables.push(action.payload);
      }
    },
    removeWearable(state, action: PayloadAction<number>) {
      state.wearables.splice(action.payload, 1);
      state.selectedIndex = -1;
    },
    moveWearable(
      state,
      action: PayloadAction<{ index: number; direction: -1 | 1 }>,
    ) {
      const { index, direction } = action.payload;
      const target = index + direction;
      if (target < 0 || target >= state.wearables.length) return;
      const tmp = state.wearables[index];
      state.wearables[index] = state.wearables[target];
      state.wearables[target] = tmp;
    },
    setWearableTints(
      state,
      action: PayloadAction<{ index: number; tints: LayerTint[] }>,
    ) {
      const { index, tints } = action.payload;
      if (state.wearables[index]) state.wearables[index].tints = tints;
    },
    setWearableTransform(
      state,
      action: PayloadAction<{ index: number; transform: Transform }>,
    ) {
      const { index, transform } = action.payload;
      if (state.wearables[index]) state.wearables[index].transform = transform;
    },
    setWearableState(
      state,
      action: PayloadAction<{ index: number; state: StateValueData[] }>,
    ) {
      const w = state.wearables[action.payload.index];
      if (w) w.state = action.payload.state;
    },

    // Lifecycle
    restoreAvatarState(_state, action: PayloadAction<AvatarEditorState>) {
      return action.payload;
    },
  },
});

export const {
  setSelectedIndex,
  setBaseAvatar,
  setBaseAvatarTints,
  setBaseAvatarTransform,
  addWearable,
  removeWearable,
  moveWearable,
  setWearableTints,
  setWearableTransform,
  setWearableState,
  restoreAvatarState,
} = avatarEditorSlice.actions;

export const avatarEditorReducer = avatarEditorSlice.reducer;
