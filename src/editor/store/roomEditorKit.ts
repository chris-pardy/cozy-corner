import { createEditorStoreKit } from "./createEditorStoreKit";
import {
  roomEditorReducer,
  createRoomEditorInitialState,
  type RoomEditorState,
} from "./roomEditorSlice";

const kit = createEditorStoreKit<RoomEditorState>({
  reducer: roomEditorReducer,
  createInitialState: createRoomEditorInitialState,
  disableSerializableCheck: true,
});

export const createRoomEditorStore = kit.createStore;
export const RoomEditorProvider = kit.Provider;
export const useRoomEditorDispatch = kit.useDispatch;
export const useRoomEditorSelector = kit.useSelector;
export const useRoomEditorStore = kit.useStore;

export type RoomEditorStore = ReturnType<typeof createRoomEditorStore>;
export type RoomEditorRootState = ReturnType<RoomEditorStore["getState"]>;
export type RoomEditorDispatch = RoomEditorStore["dispatch"];
