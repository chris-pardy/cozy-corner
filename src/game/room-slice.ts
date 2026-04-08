import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RoomConfig, TileState } from "./types";

export interface RoomSliceState {
  width: number;
  height: number;
  /** Sparse map keyed by "x,y". Only tiles that exist in the room are stored. */
  tiles: Record<string, TileState>;
}

const initialState: RoomSliceState = {
  width: 0,
  height: 0,
  tiles: {},
};

export const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    initRoom(
      _state,
      action: PayloadAction<{ config: RoomConfig; tiles: TileState[] }>,
    ) {
      const { config, tiles } = action.payload;
      const tileMap: Record<string, TileState> = {};
      for (const t of tiles) {
        tileMap[`${t.x},${t.y}`] = t;
      }
      return { width: config.width, height: config.height, tiles: tileMap };
    },

    setTile(state, action: PayloadAction<TileState>) {
      const t = action.payload;
      state.tiles[`${t.x},${t.y}`] = t;
    },

    removeTile(state, action: PayloadAction<{ x: number; y: number }>) {
      delete state.tiles[`${action.payload.x},${action.payload.y}`];
    },
  },
});

export const { initRoom, setTile, removeTile } = roomSlice.actions;
