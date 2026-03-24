import type { SpriteEditorStore } from "./spriteEditorKit";
import {
  bumpVersion,
  setFrameCount,
  resetTransformRect,
} from "./spriteEditorSlice";
import {
  flipH,
  flipV,
  rotateCW,
  rotateCCW,
  rotspriteRotate,
  transformLayer,
} from "../sprite-drawing";


/**
 * Canvas operations that pair backing-canvas mutations with Redux dispatches.
 * Created once per editor instance; holds a ref to the backing OffscreenCanvas.
 */
export function createCanvasOps(
  store: SpriteEditorStore,
  backingRef: { current: OffscreenCanvas },
) {
  const s = () => store.getState().editor;
  const d = store.dispatch;

  function applyPerFrame(
    fn: (
      backing: OffscreenCanvas,
      frame: number,
      layerId: number,
      w: number,
      h: number,
    ) => void,
  ) {
    const state = s();
    const backing = backingRef.current;
    if (state.transformAllFrames) {
      for (let f = 0; f < state.frameCount; f++)
        fn(backing, f, state.activeLayerId, state.canvasW, state.canvasH);
    } else {
      fn(
        backing,
        state.currentFrame,
        state.activeLayerId,
        state.canvasW,
        state.canvasH,
      );
    }
    d(bumpVersion());
  }

  return {
    flipH() {
      applyPerFrame(flipH);
    },
    flipV() {
      applyPerFrame(flipV);
    },
    rotateCW() {
      applyPerFrame(rotateCW);
    },
    rotateCCW() {
      applyPerFrame(rotateCCW);
    },
    rotspriteRotate() {
      const state = s();
      const backing = backingRef.current;
      if (state.transformAllFrames) {
        for (let f = 0; f < state.frameCount; f++)
          rotspriteRotate(
            backing,
            f,
            state.activeLayerId,
            state.canvasW,
            state.canvasH,
            state.rotAngle,
          );
      } else {
        rotspriteRotate(
          backing,
          state.currentFrame,
          state.activeLayerId,
          state.canvasW,
          state.canvasH,
          state.rotAngle,
        );
      }
      d(bumpVersion());
    },
    applyTransform() {
      const state = s();
      const backing = backingRef.current;
      if (state.transformAllFrames) {
        for (let f = 0; f < state.frameCount; f++)
          transformLayer(
            backing,
            f,
            state.activeLayerId,
            state.canvasW,
            state.canvasH,
            state.tfX,
            state.tfY,
            state.tfW,
            state.tfH,
          );
      } else {
        transformLayer(
          backing,
          state.currentFrame,
          state.activeLayerId,
          state.canvasW,
          state.canvasH,
          state.tfX,
          state.tfY,
          state.tfW,
          state.tfH,
        );
      }
      d(resetTransformRect());
      d(bumpVersion());
    },
    deleteFrame(f: number) {
      const state = s();
      if (state.frameCount <= 1) return;
      const backing = backingRef.current;
      const ctx = backing.getContext("2d")!;
      // Shift all frames after f left by one slot
      for (let i = f; i < state.frameCount - 1; i++) {
        for (const layer of state.layers) {
          const y = layer.id * state.canvasH;
          ctx.clearRect(i * state.canvasW, y, state.canvasW, state.canvasH);
          ctx.drawImage(
            backing,
            (i + 1) * state.canvasW,
            y,
            state.canvasW,
            state.canvasH,
            i * state.canvasW,
            y,
            state.canvasW,
            state.canvasH,
          );
        }
      }
      // Clear the now-vacant last slot
      for (const layer of state.layers) {
        ctx.clearRect(
          (state.frameCount - 1) * state.canvasW,
          layer.id * state.canvasH,
          state.canvasW,
          state.canvasH,
        );
      }
      // Dispatch state-only half (adjusts frameCount + currentFrame)
      d({ type: "editor/deleteFrame", payload: f });
    },
    copyPrevFrame() {
      const state = s();
      if (state.currentFrame <= 0) return;
      const backing = backingRef.current;
      const ctx = backing.getContext("2d")!;
      const srcX = (state.currentFrame - 1) * state.canvasW;
      const dstX = state.currentFrame * state.canvasW;
      const y = state.activeLayerId * state.canvasH;
      ctx.clearRect(dstX, y, state.canvasW, state.canvasH);
      ctx.drawImage(
        backing,
        srcX,
        y,
        state.canvasW,
        state.canvasH,
        dstX,
        y,
        state.canvasW,
        state.canvasH,
      );
      d(bumpVersion());
    },
    copyPrevFrameAll() {
      const state = s();
      if (state.currentFrame <= 0) return;
      const backing = backingRef.current;
      const ctx = backing.getContext("2d")!;
      const srcX = (state.currentFrame - 1) * state.canvasW;
      const dstX = state.currentFrame * state.canvasW;
      for (const layer of state.layers) {
        const y = layer.id * state.canvasH;
        ctx.clearRect(dstX, y, state.canvasW, state.canvasH);
        ctx.drawImage(
          backing,
          srcX,
          y,
          state.canvasW,
          state.canvasH,
          dstX,
          y,
          state.canvasW,
          state.canvasH,
        );
      }
      d(bumpVersion());
    },
    performImport(
      result: {
        image: HTMLImageElement;
        frames: Array<{ sx: number; sy: number; sw: number; sh: number }>;
        newFrameCount: number;
        sizeMode: "scale" | "center";
      },
      ensureSize: (
        canvas: OffscreenCanvas,
        w: number,
        h: number,
      ) => OffscreenCanvas,
    ) {
      const state = s();
      const { image: img, frames, newFrameCount, sizeMode } = result;
      if (newFrameCount > state.frameCount) d(setFrameCount(newFrameCount));
      // Grow backing
      backingRef.current = ensureSize(
        backingRef.current,
        newFrameCount * state.canvasW,
        state.nextLayerId * state.canvasH,
      );
      const ctx = backingRef.current.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      for (let f = 0; f < frames.length; f++) {
        const { sx, sy, sw, sh } = frames[f];
        const dx = f * state.canvasW;
        const dy = state.activeLayerId * state.canvasH;
        ctx.clearRect(dx, dy, state.canvasW, state.canvasH);
        if (sizeMode === "center") {
          const cx = dx + Math.floor((state.canvasW - sw) / 2);
          const cy = dy + Math.floor((state.canvasH - sh) / 2);
          ctx.drawImage(img, sx, sy, sw, sh, cx, cy, sw, sh);
        } else {
          ctx.drawImage(
            img,
            sx,
            sy,
            sw,
            sh,
            dx,
            dy,
            state.canvasW,
            state.canvasH,
          );
        }
      }
      d(bumpVersion());
    },
  };
}

export type CanvasOps = ReturnType<typeof createCanvasOps>;
