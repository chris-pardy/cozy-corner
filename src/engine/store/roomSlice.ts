import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface RoomConfig {
  roomWidth: number;
  roomHeight: number;
  tileSize: number;
}

const initialState: RoomConfig = {
  roomWidth: 0,
  roomHeight: 0,
  tileSize: 0,
};

export const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    setRoomConfig(_state, action: PayloadAction<RoomConfig>) {
      return action.payload;
    },
  },
});

export const { setRoomConfig } = roomSlice.actions;
export const roomReducer = roomSlice.reducer;
