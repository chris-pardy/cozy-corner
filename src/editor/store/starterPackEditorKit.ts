import { createEditorStoreKit } from "./createEditorStoreKit";
import {
  starterPackEditorReducer,
  createStarterPackEditorInitialState,
  type StarterPackEditorState,
} from "./starterPackEditorSlice";

const kit = createEditorStoreKit<StarterPackEditorState>({
  reducer: starterPackEditorReducer,
  createInitialState: createStarterPackEditorInitialState,
});

export const createStarterPackEditorStore = kit.createStore;
export const StarterPackEditorProvider = kit.Provider;
export const usePackDispatch = kit.useDispatch;
export const usePackSelector = kit.useSelector;
export const usePackStore = kit.useStore;

export type StarterPackEditorStore = ReturnType<
  typeof createStarterPackEditorStore
>;
export type StarterPackEditorRootState = ReturnType<
  StarterPackEditorStore["getState"]
>;
export type StarterPackEditorDispatch = StarterPackEditorStore["dispatch"];
