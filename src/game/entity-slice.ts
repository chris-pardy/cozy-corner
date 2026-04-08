import {
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  Direction,
  directionFromDelta,
  directionName,
  type GameEntity,
  type Point,
} from "./types";

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const entityAdapter = createEntityAdapter<GameEntity>();

// ---------------------------------------------------------------------------
// Shared action types used by other slices / middleware
// ---------------------------------------------------------------------------

/** Standalone action — dispatched by the tick loop. */
export const TICK = "game/tick" as const;
export interface TickPayload {
  /** Monotonically increasing tick number. */
  tick: number;
}

export const INTERACT = "game/interact" as const;
export interface InteractPayload {
  sourceId: string;
  targetId: string;
}

export const MESSAGE = "game/message" as const;
export interface MessagePayload {
  fromId: string;
  toId: string;
  name: string;
  data: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const entitySlice = createSlice({
  name: "entities",
  initialState: entityAdapter.getInitialState(),
  reducers: {
    addEntity: {
      reducer: entityAdapter.addOne,
      prepare: (partial: Partial<GameEntity> & Pick<GameEntity, "id" | "type" | "x" | "y">) => ({
        payload: fillDefaults(partial),
      }),
    },
    removeEntity: entityAdapter.removeOne,
    addMany: {
      reducer: entityAdapter.addMany,
      prepare: (partials: Array<Partial<GameEntity> & Pick<GameEntity, "id" | "type" | "x" | "y">>) => ({
        payload: partials.map(fillDefaults),
      }),
    },

    setPosition(state, action: PayloadAction<{ id: string; x: number; y: number }>) {
      const e = state.entities[action.payload.id];
      if (e) {
        e.x = action.payload.x;
        e.y = action.payload.y;
      }
    },

    setDirection(state, action: PayloadAction<{ id: string; direction: Direction }>) {
      const e = state.entities[action.payload.id];
      if (e) e.direction = action.payload.direction;
    },

    setAnimTarget(state, action: PayloadAction<{ id: string; target: string }>) {
      const e = state.entities[action.payload.id];
      if (e) e.animTarget = action.payload.target;
    },

    setEntityState(
      state,
      action: PayloadAction<{ id: string; key: string; value: string }>,
    ) {
      const e = state.entities[action.payload.id];
      if (e) e.state[action.payload.key] = action.payload.value;
    },

    /** Begin walking along a pre-computed path. First step is taken on the next tick. */
    startMove(
      state,
      action: PayloadAction<{ id: string; path: Point[] }>,
    ) {
      const e = state.entities[action.payload.id];
      if (!e || action.payload.path.length === 0) return;
      e.movePath = action.payload.path;
      e.moveTimer = 0; // advance immediately on next tick
    },

    /** Cancel in-progress movement and idle in current direction. */
    stopMove(state, action: PayloadAction<string>) {
      const e = state.entities[action.payload];
      if (!e) return;
      e.movePath = null;
      e.moveTimer = 0;
      e.animTarget = `idle-${directionName(e.direction)}`;
    },

  },

  extraReducers(builder) {
    builder.addMatcher(
      (action) => action.type === TICK,
      (state) => {
        for (const id of state.ids) {
          const e = state.entities[id]!;
          if (!e.movePath || e.movePath.length === 0) continue;

          if (e.moveTimer > 0) {
            e.moveTimer--;
            continue;
          }

          // Take the next step.
          const prev: Point = { x: e.x, y: e.y };
          const next = e.movePath[0];
          e.movePath = e.movePath.slice(1);
          e.x = next.x;
          e.y = next.y;
          e.direction = directionFromDelta(next.x - prev.x, next.y - prev.y);
          e.moveTimer = e.moveSpeed;

          if (e.movePath.length === 0) {
            e.movePath = null;
            e.animTarget = `idle-${directionName(e.direction)}`;
          } else {
            e.animTarget = `walk-${directionName(e.direction)}`;
          }
        }
      },
    );
  },
});

export const {
  addEntity,
  removeEntity,
  addMany,
  setPosition,
  setDirection,
  setAnimTarget,
  setEntityState,
  startMove,
  stopMove,
} = entitySlice.actions;

export const entitySelectors = entityAdapter.getSelectors();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillDefaults(
  partial: Partial<GameEntity> & Pick<GameEntity, "id" | "type" | "x" | "y">,
): GameEntity {
  return {
    direction: Direction.South,
    animTarget: `idle-south`,
    state: {},
    width: 1,
    height: 1,
    blockedEdges: [0],
    movePath: null,
    moveTimer: 0,
    moveSpeed: 5,
    ...partial,
  };
}
