import { configureStore } from '@reduxjs/toolkit';
import { npcSlice } from './npc-slice';

export function createNpcEditorStore() {
    return configureStore({
        reducer: {
            npc: npcSlice.reducer,
        },
    });
}

export type NpcEditorStore = ReturnType<typeof createNpcEditorStore>;
export type NpcRootState = ReturnType<NpcEditorStore['getState']>;
export type NpcDispatch = NpcEditorStore['dispatch'];
