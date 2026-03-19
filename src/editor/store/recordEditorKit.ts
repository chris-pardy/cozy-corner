import { createEditorStoreKit } from "./createEditorStoreKit";
import {
  recordEditorReducer,
  createRecordEditorInitialState,
  type RecordEditorState,
} from "./recordEditorSlice";

const kit = createEditorStoreKit<RecordEditorState>({
  reducer: recordEditorReducer,
  createInitialState: createRecordEditorInitialState,
  disableSerializableCheck: true,
});

export const createRecordEditorStore = kit.createStore;
export const RecordEditorProvider = kit.Provider;
export const useRecordDispatch = kit.useDispatch;
export const useRecordSelector = kit.useSelector;
export const useRecordStore = kit.useStore;

export type RecordEditorStore = ReturnType<typeof createRecordEditorStore>;
export type RecordEditorRootState = ReturnType<RecordEditorStore["getState"]>;
export type RecordEditorDispatch = RecordEditorStore["dispatch"];
