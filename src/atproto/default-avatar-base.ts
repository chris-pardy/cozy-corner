import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import type { Script } from "~/atproto/generated/types/at/cozy-corner/script";
import defaultAvatarUrl from "../../assets/character/default-avatar.png";

export { defaultAvatarUrl };

/** Default avatar base has no custom behaviors — standard movement targets apply. */
export const defaultAvatarBehaviors: Script[] = [];

function makeFrames(x: number, y: number, w: number, h: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    x: x + i * w,
    y,
    width: w,
    height: h,
  }));
}

export const defaultAvatarLayers: AnimationLayer[] = [
  {
    $type: "at.cozy-corner.defs#animationLayer",
    target: "idle-south",
    frames: makeFrames(0, 0, 32, 32, 1),
    frameRate: 125,
    zIndex: 0,
  },
  {
    $type: "at.cozy-corner.defs#animationLayer",
    target: "idle-north",
    frames: makeFrames(0, 32, 32, 32, 1),
    frameRate: 125,
    zIndex: 0,
  },
  {
    $type: "at.cozy-corner.defs#animationLayer",
    target: "idle-east",
    frames: makeFrames(0, 64, 32, 32, 1),
    frameRate: 125,
    zIndex: 0,
  },
  {
    $type: "at.cozy-corner.defs#animationLayer",
    target: "idle-west",
    frames: makeFrames(0, 96, 32, 32, 1),
    frameRate: 125,
    zIndex: 0,
  },
  {
    $type: "at.cozy-corner.defs#animationLayer",
    target: "walk-south",
    frames: makeFrames(0, 128, 32, 32, 8),
    frameRate: 125,
    zIndex: 0,
  },
  {
    $type: "at.cozy-corner.defs#animationLayer",
    target: "walk-north",
    frames: makeFrames(0, 160, 32, 32, 8),
    frameRate: 125,
    zIndex: 0,
  },
  {
    $type: "at.cozy-corner.defs#animationLayer",
    target: "walk-east",
    frames: makeFrames(0, 192, 32, 32, 8),
    frameRate: 125,
    zIndex: 0,
  },
  {
    $type: "at.cozy-corner.defs#animationLayer",
    target: "walk-west",
    frames: makeFrames(0, 224, 32, 32, 8),
    frameRate: 125,
    zIndex: 0,
  },
];
