import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tool = "pencil" | "brush" | "fill" | "eraser" | "move" | "scale" | "rotate";

export type LayerMeta = {
  id: number;
  name: string;
  visible: boolean;
  tint: string | null;
};

export interface SpriteEditorState {
  canvasW: number;
  canvasH: number;
  gridSize: number;
  zoom: number;

  tool: Tool;
  toolSize: number;
  color: string;

  layers: LayerMeta[];
  activeLayerId: number;
  nextLayerId: number;

  frameCount: number;
  currentFrame: number;
  previewFps: number;
  onionPrev: boolean;
  onionNext: boolean;
  showBg: boolean;

  transformAllFrames: boolean;
  rotAngle: number;
  tfX: number;
  tfY: number;
  tfW: number;
  tfH: number;

  version: number;
}

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export function createInitialState(opts?: {
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  fps?: number;
}): SpriteEditorState {
  const w = opts?.frameWidth ?? 32;
  const h = opts?.frameHeight ?? 32;
  return {
    canvasW: w,
    canvasH: h,
    gridSize: 1,
    zoom: 16,
    tool: "pencil",
    toolSize: 1,
    color: "#e2e8f0",
    layers: [{ id: 0, name: "Layer 0", visible: true, tint: null }],
    activeLayerId: 0,
    nextLayerId: 1,
    frameCount: opts?.frameCount ?? 1,
    currentFrame: 0,
    previewFps: opts?.fps ?? 8,
    onionPrev: false,
    onionNext: false,
    showBg: true,
    transformAllFrames: false,
    rotAngle: 45,
    tfX: 0,
    tfY: 0,
    tfW: w,
    tfH: h,
    version: 0,
  };
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const spriteEditorSlice = createSlice({
  name: "editor",
  initialState: createInitialState(),
  reducers: {
    // Canvas settings
    setCanvasW(state, action: PayloadAction<number>) {
      state.canvasW = action.payload;
      state.tfX = 0; state.tfY = 0;
      state.tfW = action.payload; state.tfH = state.canvasH;
    },
    setCanvasH(state, action: PayloadAction<number>) {
      state.canvasH = action.payload;
      state.tfX = 0; state.tfY = 0;
      state.tfW = state.canvasW; state.tfH = action.payload;
    },
    setGridSize(state, action: PayloadAction<number>) { state.gridSize = action.payload; },
    setZoom(state, action: PayloadAction<number>) { state.zoom = action.payload; },

    // Tool
    setTool(state, action: PayloadAction<Tool>) { state.tool = action.payload; },
    setToolSize(state, action: PayloadAction<number>) { state.toolSize = action.payload; },
    setColor(state, action: PayloadAction<string>) { state.color = action.payload; },

    // Layers
    addLayer(state) {
      const id = state.nextLayerId++;
      state.layers.push({ id, name: `Layer ${id}`, visible: true, tint: null });
      state.activeLayerId = id;
    },
    deleteLayer(state, action: PayloadAction<number>) {
      if (state.layers.length <= 1) return;
      const idx = action.payload;
      const removed = state.layers[idx];
      state.layers.splice(idx, 1);
      if (removed.id === state.activeLayerId) {
        state.activeLayerId = state.layers[Math.min(idx, state.layers.length - 1)].id;
      }
    },
    setActiveLayerId(state, action: PayloadAction<number>) { state.activeLayerId = action.payload; },
    renameLayer(state, action: PayloadAction<{ idx: number; name: string }>) {
      const { idx, name } = action.payload;
      if (state.layers[idx]) state.layers[idx].name = name;
    },
    toggleLayerVisibility(state, action: PayloadAction<number>) {
      const layer = state.layers[action.payload];
      if (layer) layer.visible = !layer.visible;
    },
    setLayerTint(state, action: PayloadAction<{ idx: number; tint: string | null }>) {
      const { idx, tint } = action.payload;
      if (state.layers[idx]) state.layers[idx].tint = tint;
    },
    reorderLayers(state, action: PayloadAction<{ fromIdx: number; toIdx: number }>) {
      const { fromIdx, toIdx } = action.payload;
      if (fromIdx === toIdx) return;
      const [moved] = state.layers.splice(fromIdx, 1);
      state.layers.splice(toIdx, 0, moved);
    },

    // Frames
    addFrame(state) { state.currentFrame = state.frameCount; state.frameCount += 1; },
    deleteFrame(state, action: PayloadAction<number>) {
      if (state.frameCount <= 1) return;
      const f = action.payload;
      state.frameCount -= 1;
      if (state.currentFrame >= state.frameCount) state.currentFrame = state.frameCount - 1;
      else if (state.currentFrame > f) state.currentFrame -= 1;
      state.version += 1;
    },
    setCurrentFrame(state, action: PayloadAction<number>) { state.currentFrame = action.payload; },
    setFrameCount(state, action: PayloadAction<number>) { state.frameCount = action.payload; },
    setPreviewFps(state, action: PayloadAction<number>) { state.previewFps = action.payload; },
    toggleOnionPrev(state) { state.onionPrev = !state.onionPrev; },
    toggleOnionNext(state) { state.onionNext = !state.onionNext; },
    toggleShowBg(state) { state.showBg = !state.showBg; },

    // Transform
    setTransformAllFrames(state) { state.transformAllFrames = !state.transformAllFrames; },
    setRotAngle(state, action: PayloadAction<number>) { state.rotAngle = action.payload; },
    setTransformRect(state, action: PayloadAction<{ x: number; y: number; w: number; h: number }>) {
      state.tfX = action.payload.x; state.tfY = action.payload.y;
      state.tfW = action.payload.w; state.tfH = action.payload.h;
    },
    resetTransformRect(state) {
      state.tfX = 0; state.tfY = 0; state.tfW = state.canvasW; state.tfH = state.canvasH;
    },

    // Lifecycle
    bumpVersion(state) { state.version += 1; },
    restoreState(_state, action: PayloadAction<SpriteEditorState>) { return action.payload; },
  },
});

export const {
  setCanvasW, setCanvasH, setGridSize, setZoom,
  setTool, setToolSize, setColor,
  addLayer, deleteLayer, setActiveLayerId, renameLayer,
  toggleLayerVisibility, setLayerTint, reorderLayers,
  addFrame, deleteFrame, setCurrentFrame, setFrameCount,
  setPreviewFps, toggleOnionPrev, toggleOnionNext, toggleShowBg,
  setTransformAllFrames, setRotAngle, setTransformRect, resetTransformRect,
  bumpVersion, restoreState,
} = spriteEditorSlice.actions;

export const spriteEditorReducer = spriteEditorSlice.reducer;
