import { configureStore } from '@reduxjs/toolkit';
import { avatarSlice } from './avatar-slice';

export function createAvatarEditorStore() {
    return configureStore({
        reducer: {
            avatar: avatarSlice.reducer,
        },
    });
}

export type AvatarEditorStore = ReturnType<typeof createAvatarEditorStore>;
export type AvatarRootState = ReturnType<AvatarEditorStore['getState']>;
export type AvatarDispatch = AvatarEditorStore['dispatch'];
