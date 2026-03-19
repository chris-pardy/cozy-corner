import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntryCategory =
  | "item"
  | "wearable"
  | "tileset"
  | "baseAvatar"
  | "critter";

/** Serializable subset of a starter pack entry (no HTMLImageElement). */
export interface PackEntryData {
  uri: string;
  cid: string;
  category: EntryCategory;
  name: string;
}

export interface StarterPackEditorState {
  name: string;
  description: string;
  entries: PackEntryData[];
}

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export function createStarterPackEditorInitialState(
  overrides?: Partial<StarterPackEditorState>,
): StarterPackEditorState {
  return {
    name: "",
    description: "",
    entries: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const starterPackEditorSlice = createSlice({
  name: "editor",
  initialState: createStarterPackEditorInitialState(),
  reducers: {
    setName(state, action: PayloadAction<string>) {
      state.name = action.payload;
    },
    setDescription(state, action: PayloadAction<string>) {
      state.description = action.payload;
    },
    addEntry(state, action: PayloadAction<PackEntryData>) {
      if (!state.entries.some((e) => e.uri === action.payload.uri)) {
        state.entries.push(action.payload);
      }
    },
    removeEntry(state, action: PayloadAction<string>) {
      state.entries = state.entries.filter((e) => e.uri !== action.payload);
    },
    moveEntry(
      state,
      action: PayloadAction<{ index: number; direction: -1 | 1 }>,
    ) {
      const { index, direction } = action.payload;
      const target = index + direction;
      if (target < 0 || target >= state.entries.length) return;
      const tmp = state.entries[index];
      state.entries[index] = state.entries[target];
      state.entries[target] = tmp;
    },
    restoreStarterPackState(
      _state,
      action: PayloadAction<StarterPackEditorState>,
    ) {
      return action.payload;
    },
  },
});

export const {
  setName: setPackName,
  setDescription: setPackDescription,
  addEntry,
  removeEntry,
  moveEntry,
  restoreStarterPackState,
} = starterPackEditorSlice.actions;

export const starterPackEditorReducer = starterPackEditorSlice.reducer;
