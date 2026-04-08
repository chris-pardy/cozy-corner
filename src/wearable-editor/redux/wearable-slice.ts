import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AvatarTarget, SerializedLayer, StateProperty, Behavior } from '../../shared-editor/types';

export interface BaseAvatarRef {
    /** AT URI of the base avatar record. */
    uri: string;
    /** CID of the base avatar record. */
    cid: string;
    /** Display name (for the picker UI). */
    name: string;
    /** Serialized layers from the base avatar (for composite preview). */
    layers: SerializedLayer[];
    canvasWidth: number;
    canvasHeight: number;
}

export interface WearableEditorState {
    name: string;
    description: string;
    tags: string[];
    targets: AvatarTarget[];
    selectedTargetId: string | null;
    editingTargetId: string | null;
    stateProperties: StateProperty[];
    behaviors: Behavior[];
    baseAvatar: BaseAvatarRef | null;
}

const initialState: WearableEditorState = {
    name: '',
    description: '',
    tags: [],
    targets: [],
    selectedTargetId: null,
    editingTargetId: null,
    stateProperties: [],
    behaviors: [],
    baseAvatar: null,
};

export const wearableSlice = createSlice({
    name: 'wearable',
    initialState,
    reducers: {
        setName(state, action: PayloadAction<string>) {
            state.name = action.payload;
        },
        setDescription(state, action: PayloadAction<string>) {
            state.description = action.payload;
        },
        setTags(state, action: PayloadAction<string[]>) {
            state.tags = action.payload;
        },
        addTarget(state, action: PayloadAction<{ id: string; target: string }>) {
            const { id, target } = action.payload;
            if (state.targets.some((t) => t.target === target)) return;
            state.targets.push({
                id,
                target,
                layerData: [],
                canvasWidth: 32,
                canvasHeight: 32,
                frameRate: 8,
            });
            state.selectedTargetId = id;
        },
        removeTarget(state, action: PayloadAction<string>) {
            state.targets = state.targets.filter((t) => t.id !== action.payload);
            if (state.selectedTargetId === action.payload) {
                state.selectedTargetId = state.targets[0]?.id ?? null;
            }
            if (state.editingTargetId === action.payload) {
                state.editingTargetId = null;
            }
        },
        selectTarget(state, action: PayloadAction<string>) {
            state.selectedTargetId = action.payload;
        },
        openEditor(state, action: PayloadAction<string>) {
            state.editingTargetId = action.payload;
        },
        closeEditor(state) {
            state.editingTargetId = null;
        },
        commitSpriteEditorResult(
            state,
            action: PayloadAction<{
                targetId: string;
                layerData: SerializedLayer[];
                canvasWidth: number;
                canvasHeight: number;
                frameRate: number;
            }>,
        ) {
            const { targetId, layerData, canvasWidth, canvasHeight, frameRate } = action.payload;
            const target = state.targets.find((t) => t.id === targetId);
            if (!target) return;
            target.layerData = layerData;
            target.canvasWidth = canvasWidth;
            target.canvasHeight = canvasHeight;
            target.frameRate = frameRate;
            state.editingTargetId = null;
        },
        // ── State properties ──
        addStateProperty(state, action: PayloadAction<StateProperty>) {
            state.stateProperties.push(action.payload);
        },
        updateStateProperty(state, action: PayloadAction<StateProperty>) {
            const idx = state.stateProperties.findIndex((p) => p.id === action.payload.id);
            if (idx >= 0) state.stateProperties[idx] = action.payload;
        },
        removeStateProperty(state, action: PayloadAction<string>) {
            state.stateProperties = state.stateProperties.filter((p) => p.id !== action.payload);
        },

        // ── Behaviors ──
        addBehavior(state, action: PayloadAction<Behavior>) {
            state.behaviors.push(action.payload);
        },
        updateBehavior(state, action: PayloadAction<Behavior>) {
            const idx = state.behaviors.findIndex((b) => b.id === action.payload.id);
            if (idx >= 0) state.behaviors[idx] = action.payload;
        },
        removeBehavior(state, action: PayloadAction<string>) {
            state.behaviors = state.behaviors.filter((b) => b.id !== action.payload);
        },

        // ── Base avatar ──
        setBaseAvatar(state, action: PayloadAction<BaseAvatarRef>) {
            state.baseAvatar = action.payload;
        },
        clearBaseAvatar(state) {
            state.baseAvatar = null;
        },
    },
    selectors: {
        selectName: (state) => state.name,
        selectDescription: (state) => state.description,
        selectTags: (state) => state.tags,
        selectTargets: (state) => state.targets,
        selectSelectedTargetId: (state) => state.selectedTargetId,
        selectEditingTargetId: (state) => state.editingTargetId,
        selectSelectedTarget: (state) =>
            state.targets.find((t) => t.id === state.selectedTargetId) ?? null,
        selectEditingTarget: (state) =>
            state.targets.find((t) => t.id === state.editingTargetId) ?? null,
        selectStateProperties: (state) => state.stateProperties,
        selectBehaviors: (state) => state.behaviors,
        selectBaseAvatar: (state) => state.baseAvatar,
    },
});

export const {
    setName, setDescription, setTags,
    addTarget, removeTarget, selectTarget,
    openEditor, closeEditor, commitSpriteEditorResult,
    addStateProperty, updateStateProperty, removeStateProperty,
    addBehavior, updateBehavior, removeBehavior,
    setBaseAvatar, clearBaseAvatar,
} = wearableSlice.actions;

export const {
    selectName, selectDescription, selectTags,
    selectTargets, selectSelectedTargetId, selectEditingTargetId,
    selectSelectedTarget, selectEditingTarget,
    selectStateProperties, selectBehaviors,
    selectBaseAvatar,
} = wearableSlice.selectors;
