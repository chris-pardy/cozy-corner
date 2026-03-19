import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { entitiesReducer } from "./entitySlice";
import { roomReducer } from "./roomSlice";

export function createRoomStore(middleware: Middleware[] = []) {
  return configureStore({
    reducer: {
      entities: entitiesReducer,
      room: roomReducer,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(...middleware),
  });
}

export type RoomStore = ReturnType<typeof createRoomStore>;
export type RootState = ReturnType<RoomStore["getState"]>;
export type AppDispatch = RoomStore["dispatch"];
