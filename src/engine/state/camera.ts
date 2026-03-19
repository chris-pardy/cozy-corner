export interface CameraPosition {
  x: number;
  y: number;
}

/** Current camera center in world pixels (lerped). */
export const CAMERA_TARGET = "engine:cameraTarget";

/** Entity the camera follows (usually the player). */
export const CAMERA_FOCUS = "engine:cameraFocus";

/** Pan offset in world pixels, added to focus position. */
export const CAMERA_OFFSET = "engine:cameraOffset";

/** Tiles of context visible in each direction from center. Viewport = 2*distance+1. */
export const VIEW_DISTANCE = "engine:viewDistance";

export const DEFAULT_VIEW_DISTANCE = 5;


/** Entity ID the camera follows (replaces Entity reference in CAMERA_FOCUS). */
export const CAMERA_FOCUS_ID = "engine:cameraFocusId";

/** Mixin interface for entities with camera state. */
export interface CameraMixin {
  [CAMERA_TARGET]: CameraPosition;
  [CAMERA_FOCUS]: import("../entity").Entity;
  [CAMERA_OFFSET]: CameraPosition;
  [VIEW_DISTANCE]: number;
}
