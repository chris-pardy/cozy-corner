import { describe, it, expect } from "vitest";
import { createRoomStore } from "../store/store";
import { setRoomConfig } from "../store/roomSlice";
import {
  setState,
  setStates,
  addEntity,
  removeEntity,
} from "../store/actions";
import {
  selectEntityById,
  selectAllEntities,
  selectAs,
  selectFind,
  selectChildIds,
  selectRoomConfig,
} from "../store/selectors";

describe("entitySlice", () => {
  it("adds an entity", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({
        id: "room",
        parentId: null,
        childIds: [],
        state: { foo: 42 },
      }),
    );
    const entity = selectEntityById(store.getState(), "room");
    expect(entity).toBeDefined();
    expect(entity!.id).toBe("room");
    expect(entity!.state.foo).toBe(42);
  });

  it("updates parent childIds on addEntity", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({ id: "room", parentId: null, childIds: [], state: {} }),
    );
    store.dispatch(
      addEntity({ id: "player", parentId: "room", childIds: [], state: {} }),
    );
    const room = selectEntityById(store.getState(), "room");
    expect(room!.childIds).toContain("player");
  });

  it("setState updates entity state", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({ id: "e1", parentId: null, childIds: [], state: {} }),
    );
    store.dispatch(setState({ entityId: "e1", key: "x", value: 10 }));
    const entity = selectEntityById(store.getState(), "e1");
    expect(entity!.state.x).toBe(10);
  });

  it("setStates batch updates", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({ id: "e1", parentId: null, childIds: [], state: {} }),
    );
    store.dispatch(
      setStates({
        entityId: "e1",
        entries: [
          { key: "a", value: 1 },
          { key: "b", value: 2 },
        ],
      }),
    );
    const entity = selectEntityById(store.getState(), "e1");
    expect(entity!.state.a).toBe(1);
    expect(entity!.state.b).toBe(2);
  });

  it("removeEntity removes entity and updates parent", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({ id: "room", parentId: null, childIds: [], state: {} }),
    );
    store.dispatch(
      addEntity({ id: "child", parentId: "room", childIds: [], state: {} }),
    );
    store.dispatch(removeEntity("child"));
    expect(selectEntityById(store.getState(), "child")).toBeUndefined();
    expect(selectChildIds(store.getState(), "room")).not.toContain("child");
  });

  it("removeEntity recursively removes descendants", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({ id: "root", parentId: null, childIds: [], state: {} }),
    );
    store.dispatch(
      addEntity({ id: "child", parentId: "root", childIds: [], state: {} }),
    );
    store.dispatch(
      addEntity({
        id: "grandchild",
        parentId: "child",
        childIds: [],
        state: {},
      }),
    );
    store.dispatch(removeEntity("child"));
    expect(selectEntityById(store.getState(), "child")).toBeUndefined();
    expect(selectEntityById(store.getState(), "grandchild")).toBeUndefined();
  });
});

describe("selectors", () => {
  it("selectAs casts entity state to typed mixin", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({
        id: "e1",
        parentId: null,
        childIds: [],
        state: { "engine:position": { x: 3, y: 5 } },
      }),
    );
    interface TestMixin {
      "engine:position": { x: number; y: number };
    }
    const mixin = selectAs<TestMixin>(store.getState(), "e1");
    expect(mixin!["engine:position"]).toEqual({ x: 3, y: 5 });
  });

  it("selectFind walks parent chain", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({
        id: "room",
        parentId: null,
        childIds: [],
        state: { shared: "hello" },
      }),
    );
    store.dispatch(
      addEntity({
        id: "player",
        parentId: "room",
        childIds: [],
        state: {},
      }),
    );
    const val = selectFind<string>(store.getState(), "player", "shared");
    expect(val).toBe("hello");
  });

  it("selectFind returns own value if present", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({
        id: "room",
        parentId: null,
        childIds: [],
        state: { key: "parent" },
      }),
    );
    store.dispatch(
      addEntity({
        id: "child",
        parentId: "room",
        childIds: [],
        state: { key: "child" },
      }),
    );
    expect(selectFind(store.getState(), "child", "key")).toBe("child");
  });

  it("selectAllEntities returns all", () => {
    const store = createRoomStore();
    store.dispatch(
      addEntity({ id: "a", parentId: null, childIds: [], state: {} }),
    );
    store.dispatch(
      addEntity({ id: "b", parentId: null, childIds: [], state: {} }),
    );
    expect(selectAllEntities(store.getState())).toHaveLength(2);
  });
});

describe("roomSlice", () => {
  it("sets room config", () => {
    const store = createRoomStore();
    store.dispatch(
      setRoomConfig({ roomWidth: 11, roomHeight: 11, tileSize: 32 }),
    );
    const cfg = selectRoomConfig(store.getState());
    expect(cfg.roomWidth).toBe(11);
    expect(cfg.roomHeight).toBe(11);
    expect(cfg.tileSize).toBe(32);
  });
});
