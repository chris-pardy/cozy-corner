import { configureStore } from '@reduxjs/toolkit';
import { wearableSlice } from './wearable-slice';

export function createWearableEditorStore() {
    return configureStore({
        reducer: {
            wearable: wearableSlice.reducer,
        },
    });
}

export type WearableEditorStore = ReturnType<typeof createWearableEditorStore>;
export type WearableRootState = ReturnType<WearableEditorStore['getState']>;
export type WearableDispatch = WearableEditorStore['dispatch'];
