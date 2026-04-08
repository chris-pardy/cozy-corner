import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { removeEntity, TICK } from "./entity-slice";

/** Default field-of-view radius in tiles. */
const DEFAULT_RADIUS = 8;

export interface CameraPan {
  fromX: number;
  fromY: number;
  fromRadius: number;
  toX: number;
  toY: number;
  toRadius: number;
  /** Ticks elapsed so far. */
  elapsed: number;
  /** Total duration in ticks. */
  duration: number;
}

/**
 * Per-PC camera state. Each camera either follows an entity or sits at
 * a static position, with an optional animated pan transition.
 * Keyed by the owning PC's entity ID.
 */
export interface CameraState {
  /** Entity ID this camera tracks. Null means static positioning. */
  followId: string | null;
  /** Current position (interpolated during pan, otherwise static). */
  x: number;
  y: number;
  /** Field-of-view radius in tiles. */
  radius: number;
  /** Active pan transition, or null when idle. */
  pan: CameraPan | null;
}

export interface CameraSliceState {
  cameras: Record<string, CameraState>;
}

const initialState: CameraSliceState = {
  cameras: {},
};

export const cameraSlice = createSlice({
  name: "cameras",
  initialState,
  reducers: {
    /** Create a camera for a PC, defaulting to follow itself. */
    addCamera(
      state,
      action: PayloadAction<{ owner: string; followId?: string; radius?: number }>,
    ) {
      const { owner, followId, radius } = action.payload;
      state.cameras[owner] = {
        followId: followId ?? owner,
        x: 0,
        y: 0,
        radius: radius ?? DEFAULT_RADIUS,
        pan: null,
      };
    },

    /** Attach the camera to follow an entity. Cancels any active pan. */
    attachCamera(
      state,
      action: PayloadAction<{ owner: string; followId: string; radius?: number }>,
    ) {
      const cam = state.cameras[action.payload.owner];
      if (cam) {
        cam.followId = action.payload.followId;
        cam.pan = null;
        if (action.payload.radius != null) cam.radius = action.payload.radius;
      }
    },

    /**
     * Detach the camera and move it to a static position.
     * If `duration` > 0, animates from the current position over that many ticks.
     * Otherwise snaps instantly.
     */
    setCameraPosition(
      state,
      action: PayloadAction<{
        owner: string;
        x: number;
        y: number;
        radius?: number;
        duration?: number;
      }>,
    ) {
      const { owner, x, y, radius, duration } = action.payload;
      const cam = state.cameras[owner];
      if (!cam) return;

      const targetRadius = radius ?? cam.radius;
      cam.followId = null;

      if (duration && duration > 0) {
        cam.pan = {
          fromX: cam.x,
          fromY: cam.y,
          fromRadius: cam.radius,
          toX: x,
          toY: y,
          toRadius: targetRadius,
          elapsed: 0,
          duration,
        };
      } else {
        cam.x = x;
        cam.y = y;
        cam.radius = targetRadius;
        cam.pan = null;
      }
    },

    /** Remove a camera. */
    removeCamera(state, action: PayloadAction<string>) {
      delete state.cameras[action.payload];
    },
  },

  extraReducers(builder) {
    // When an entity is removed, clean up its camera (if it's a PC)
    // and detach any cameras that were following it.
    builder.addCase(removeEntity, (state, action) => {
      const removedId = action.payload as string;
      delete state.cameras[removedId];
      for (const cam of Object.values(state.cameras)) {
        if (cam.followId === removedId) {
          cam.followId = null;
        }
      }
    });

    // Advance pan transitions each tick.
    builder.addMatcher(
      (action) => action.type === TICK,
      (state) => {
        for (const cam of Object.values(state.cameras)) {
          if (!cam.pan) continue;
          cam.pan.elapsed++;
          const t = Math.min(cam.pan.elapsed / cam.pan.duration, 1);
          cam.x = cam.pan.fromX + (cam.pan.toX - cam.pan.fromX) * t;
          cam.y = cam.pan.fromY + (cam.pan.toY - cam.pan.fromY) * t;
          cam.radius = cam.pan.fromRadius + (cam.pan.toRadius - cam.pan.fromRadius) * t;
          if (cam.pan.elapsed >= cam.pan.duration) {
            cam.x = cam.pan.toX;
            cam.y = cam.pan.toY;
            cam.radius = cam.pan.toRadius;
            cam.pan = null;
          }
        }
      },
    );
  },
});

export const { addCamera, attachCamera, setCameraPosition, removeCamera } =
  cameraSlice.actions;
