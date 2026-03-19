import {
  createEntityAdapter,
  createSlice,
} from "@reduxjs/toolkit";
import { setState, setStates, addEntity, removeEntity } from "./actions";

export interface EntityRecord {
  id: string;
  parentId: string | null;
  childIds: string[];
  state: Record<string, unknown>;
}

const entityAdapter = createEntityAdapter<EntityRecord>();

export const entitySlice = createSlice({
  name: "entities",
  initialState: entityAdapter.getInitialState(),
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(setState, (state, action) => {
        const { entityId, key, value } = action.payload;
        const entity = state.entities[entityId];
        if (entity) {
          entity.state[key] = value;
        }
      })
      .addCase(setStates, (state, action) => {
        const { entityId, entries } = action.payload;
        const entity = state.entities[entityId];
        if (entity) {
          for (const { key, value } of entries) {
            entity.state[key] = value;
          }
        }
      })
      .addCase(addEntity, (state, action) => {
        const record = action.payload;
        entityAdapter.addOne(state, record);
        // Update parent's childIds
        if (record.parentId) {
          const parent = state.entities[record.parentId];
          if (parent && !parent.childIds.includes(record.id)) {
            parent.childIds.push(record.id);
          }
        }
      })
      .addCase(removeEntity, (state, action) => {
        const id = action.payload;
        const entity = state.entities[id];
        if (!entity) return;

        // Remove from parent's childIds
        if (entity.parentId) {
          const parent = state.entities[entity.parentId];
          if (parent) {
            const idx = parent.childIds.indexOf(id);
            if (idx !== -1) parent.childIds.splice(idx, 1);
          }
        }

        // Recursively remove all descendants
        const toRemove = [id];
        for (let i = 0; i < toRemove.length; i++) {
          const current = state.entities[toRemove[i]];
          if (current) {
            for (const childId of current.childIds) {
              toRemove.push(childId);
            }
          }
        }

        entityAdapter.removeMany(state, toRemove);
      });
  },
});

export const entitiesReducer = entitySlice.reducer;

export const {
  selectById,
  selectIds,
  selectAll,
  selectEntities,
  selectTotal,
} = entityAdapter.getSelectors();
