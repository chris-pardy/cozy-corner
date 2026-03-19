import { useState, useEffect } from "react";
import {
  getSession,
  getPds,
  resolveHandle,
  fetchRecord,
} from "~/lib/at-protocol";
import type * as Room from "~/atproto/generated/types/at/cozy-corner/house/room";
import { LuaRuntime } from "~/engine/lua/lua-runtime";
import { resolveSpawnTiles } from "~/engine/resolve-spawn";
import { mulberry32, hashString } from "~/engine/prng";
import {
  type BuiltRoom,
  buildTileAtlas,
  buildPlacedTiles,
  computeRoomDimensions,
  buildBlockingGrid,
  buildAttributeMap,
  parseExits,
  buildEntityTree,
} from "~/atproto/room-building";
import {
  loadTileset,
  loadItems,
  loadCritters,
  loadAvatar,
} from "~/atproto/room-asset-loading";

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

export type LoadPhase =
  | "resolve"
  | "room"
  | "assets"
  | "build"
  | "done"
  | "error";

export const PHASE_LABELS: Record<LoadPhase, string> = {
  resolve: "Resolving handle...",
  room: "Fetching room...",
  assets: "Loading assets...",
  build: "Building room...",
  done: "",
  error: "",
};

export const PHASE_PROGRESS: Record<LoadPhase, number> = {
  resolve: 10,
  room: 25,
  assets: 60,
  build: 90,
  done: 100,
  error: 0,
};

// ---------------------------------------------------------------------------
// useRoomLoader hook
// ---------------------------------------------------------------------------

export function useRoomLoader(handle: string, tid: string) {
  const [phase, setPhase] = useState<LoadPhase>("resolve");
  const [error, setError] = useState<string | null>(null);
  const [builtRoom, setBuiltRoom] = useState<BuiltRoom | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const pds = getPds();
      const session = getSession();

      try {
        // Phase 1: Resolve handle -> DID
        setPhase("resolve");
        let did: string;
        if (handle.startsWith("did:")) {
          did = handle;
        } else {
          did = await resolveHandle(pds, handle);
        }
        if (cancelled) return;

        // Phase 2: Fetch room record + house record (for CID)
        setPhase("room");
        const [{ value: roomValue, cid: roomCid }, houseResult] = await Promise.all([
          fetchRecord(pds, did, "at.cozy-corner.house.room", tid),
          fetchRecord(pds, did, "at.cozy-corner.house", "self").catch(() => null),
        ]);
        const room = roomValue as unknown as Room.Main;
        const houseCid = houseResult?.cid ?? roomCid;
        if (cancelled) return;

        // Phase 3: Parallel asset loading
        setPhase("assets");

        // Initialize Lua runtime for script compilation
        const luaRuntime = new LuaRuntime();
        luaRuntime.init();
        if (cancelled) { luaRuntime.destroy(); return; }

        // Load all assets in parallel
        const [tilesetResult, itemsResult, crittersResult, avatarResult] = await Promise.all([
          loadTileset(pds, room),
          loadItems(pds, room),
          loadCritters(pds, room),
          loadAvatar(pds, session?.did, luaRuntime),
        ]);
        if (cancelled) return;

        // Phase 4: Build
        setPhase("build");

        const { tileset, image: tileSheet } = tilesetResult;
        const { itemDefs, itemImages } = itemsResult;
        const { critterDefs, critterImages } = crittersResult;
        const tileAtlas = buildTileAtlas(tileset, tileset.layers);
        const placedTiles = buildPlacedTiles(room);
        const { width: roomWidth, height: roomHeight } = computeRoomDimensions(room);
        const blockingGrid = buildBlockingGrid(room, roomWidth, roomHeight, itemDefs);
        const attributeMap = buildAttributeMap(room, roomWidth, roomHeight);
        const exits = parseExits(room);
        const spawnRng = mulberry32(hashString(roomCid));
        const spawnPos = resolveSpawnTiles(room.spawnTiles, roomWidth, spawnRng);

        const roomUri = `at://${did}/at.cozy-corner.house.room/${tid}`;

        const { roomEntity, playerEntity, store, entityRegistry } = buildEntityTree(
          tileSheet,
          tileAtlas,
          placedTiles,
          blockingGrid,
          attributeMap,
          room,
          roomWidth,
          roomHeight,
          itemDefs,
          itemImages,
          critterDefs,
          critterImages,
          avatarResult,
          spawnPos,
          luaRuntime,
        );

        if (cancelled) return;

        setBuiltRoom({
          roomEntity,
          playerEntity,
          store,
          entityRegistry,
          luaRuntime,
          roomWidth,
          roomHeight,
          exits,
          roomUri,
          roomCid,
          roomName: room.name || "Room",
          houseDid: did,
          houseCid,
        });
        setPhase("done");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load room");
          setPhase("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      // Destroy LuaRuntime when unmounting or re-loading
      setBuiltRoom((prev) => {
        if (prev?.luaRuntime) prev.luaRuntime.destroy();
        return null;
      });
    };
  }, [handle, tid]);

  return { phase, error, builtRoom };
}
