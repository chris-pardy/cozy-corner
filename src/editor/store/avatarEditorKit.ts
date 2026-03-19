import { createEditorStoreKit } from "./createEditorStoreKit";
import {
  avatarEditorReducer,
  createAvatarEditorInitialState,
  type AvatarEditorState,
} from "./avatarEditorSlice";

const kit = createEditorStoreKit<AvatarEditorState>({
  reducer: avatarEditorReducer,
  createInitialState: createAvatarEditorInitialState,
  disableSerializableCheck: true,
});

export const createAvatarEditorStore = kit.createStore;
export const AvatarEditorProvider = kit.Provider;
export const useAvatarDispatch = kit.useDispatch;
export const useAvatarSelector = kit.useSelector;
export const useAvatarStore = kit.useStore;

export type AvatarEditorStore = ReturnType<typeof createAvatarEditorStore>;
export type AvatarEditorRootState = ReturnType<AvatarEditorStore["getState"]>;
export type AvatarEditorDispatch = AvatarEditorStore["dispatch"];
