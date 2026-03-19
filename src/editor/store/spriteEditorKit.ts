import { createEditorStoreKit } from "./createEditorStoreKit";
import {
  spriteEditorReducer,
  createInitialState,
  type SpriteEditorState,
} from "./spriteEditorSlice";

const kit = createEditorStoreKit<SpriteEditorState>({
  reducer: spriteEditorReducer,
  createInitialState,
});

export const createSpriteEditorStore = kit.createStore;
export const SpriteEditorProvider = kit.Provider;
export const useSpriteDispatch = kit.useDispatch;
export const useSpriteSelector = kit.useSelector;
export const useSpriteStore = kit.useStore;

export type SpriteEditorStore = ReturnType<typeof createSpriteEditorStore>;
export type SpriteEditorRootState = ReturnType<SpriteEditorStore["getState"]>;
export type SpriteEditorDispatch = SpriteEditorStore["dispatch"];
