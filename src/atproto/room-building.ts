import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import type * as Room from "~/atproto/generated/types/at/cozy-corner/house/room";
import type * as Item from "~/atproto/generated/types/at/cozy-corner/item";
import type * as Critter from "~/atproto/generated/types/at/cozy-corner/critter";
import type * as Tileset from "~/atproto/generated/types/at/cozy-corner/tileset";
import { parseAtUri } from "~/lib/at-protocol";
import { bakeLayer } from "~/engine/bake-avatar";
import { ReduxEntity } from "~/engine/entity";
import { createRoomStore, type RoomStore } from "~/engine/store/store";
import { createBehaviorMiddleware } from "~/engine/store/behaviorMiddleware";
import { setRoomConfig } from "~/engine/store/roomSlice";
import { addEntity } from "~/engine/store/actions";
import { MovementBehavior } from "~/engine/behaviors/movement";
import { AvatarAnimationBehavior } from "~/engine/behaviors/avatar-animation";
import { TargetBehavior } from "~/engine/behaviors/target";
import type { Behavior } from "~/engine/behavior";
import type { LuaRuntime } from "~/engine/lua/lua-runtime";
import { hashString } from "~/engine/prng";
import {
  TILE_SHEET,
  TILE_ATLAS,
  TILE_POSITIONS,
  TILE_SIZE,
  type TileFrame,
  type PlacedTile,
} from "~/engine/state/tiles";
import {
  BLOCKING_GRID,
  type BlockingGrid,
} from "~/engine/state/blocking";
import { AttributeMap, ATTRIBUTE_MAP } from "~/engine/state/attributes";
import {
  POSITION,
  DIRECTION,
  ANIM_STATE,
} from "~/engine/state/movement";
import {
  LAYERS,
  SPRITE_SHEET,
  TARGET,
  TARGET_START_TIME,
  RENDER_ORDER,
  RENDER_ORDER_BEHIND,
  RENDER_ORDER_FRONT,
  RENDER_ORDER_FOREGROUND_TILES,
} from "~/engine/state/render";
import { CameraBehavior } from "~/engine/behaviors/camera";
import {
  CAMERA_TARGET,
  CAMERA_FOCUS,
  CAMERA_FOCUS_ID,
  CAMERA_OFFSET,
  VIEW_DISTANCE,
  DEFAULT_VIEW_DISTANCE,
} from "~/engine/state/camera";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TILE_PX = 32;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single baked avatar component (base or wearable) ready for entity creation. */
export interface BakedAvatarLayer {
  spriteSheet: CanvasImageSource;
  layers: AnimationLayer[];
  behaviors: Behavior[];
}

export interface BuiltRoom {
  roomEntity: ReduxEntity;
  playerEntity: ReduxEntity;
  store: RoomStore;
  entityRegistry: Map<string, ReduxEntity>;
  luaRuntime: LuaRuntime;
  roomWidth: number;
  roomHeight: number;
  exits: ParsedExit[];
  roomUri: string;
  roomCid: string;
  roomName: string;
  houseDid: string;
  houseCid: string;
}

export interface ParsedExit {
  x: number;
  y: number;
  width: number;
  height: number;
  direction: number;
  targetUri: string | null;
  targetCid: string | null;
}

// ---------------------------------------------------------------------------
// Build functions
// ---------------------------------------------------------------------------

export function buildTileAtlas(
  tileset: Tileset.Main,
  tilesetLayers: AnimationLayer[],
): TileFrame[] {
  const atlas: TileFrame[] = [];

  for (const tile of tileset.tiles) {
    // Find matching layer by target
    const layer = tile.target
      ? tilesetLayers.find((l) => l.target === tile.target)
      : null;

    if (layer && layer.frames.length > 0) {
      const f0 = layer.frames[0];
      atlas.push({
        sx: f0.x,
        sy: f0.y,
        sw: f0.width,
        sh: f0.height,
        frameCount: layer.frames.length,
        frameRate: layer.frameRate,
        frameStride: f0.width,
      });
    } else {
      // Fallback: no layer found, push empty sentinel
      atlas.push({
        sx: 0,
        sy: 0,
        sw: 0,
        sh: 0,
        frameCount: 0,
        frameRate: 1,
        frameStride: 0,
      });
    }
  }

  return atlas;
}

export function buildBlockingGrid(
  room: Room.Main,
  width: number,
  height: number,
  itemDefs: Map<string, Item.Main>,
): BlockingGrid {
  const size = width * height;
  const edges = new Array<number>(size).fill(0);

  // Room-level blocking edges
  if (room.blockingEdges) {
    for (let i = 0; i < Math.min(room.blockingEdges.length, size); i++) {
      edges[i] |= room.blockingEdges[i];
    }
  }

  // Merge item variant blocked edges
  if (room.items) {
    for (const roomItem of room.items) {
      const parsed = parseAtUri(roomItem.item.uri);
      if (!parsed) continue;
      const itemDef = itemDefs.get(roomItem.item.uri);
      if (!itemDef) continue;

      const variantIdx = roomItem.variant ?? 0;
      const variant = itemDef.variants[variantIdx];
      if (!variant?.blockedEdges) continue;

      const iw = variant.itemWidth ?? 1;
      const ih = variant.itemHeight ?? 1;

      for (let iy = 0; iy < ih; iy++) {
        for (let ix = 0; ix < iw; ix++) {
          const rx = roomItem.x + ix;
          const ry = roomItem.y + iy;
          if (rx < 0 || rx >= width || ry < 0 || ry >= height) continue;
          const blocked = variant.blockedEdges[iy * iw + ix] ?? 0;
          edges[ry * width + rx] |= blocked;
        }
      }
    }
  }

  return { edges, width, height };
}

export function buildPlacedTiles(room: Room.Main): PlacedTile[] {
  return room.tiles.map((t) => ({
    tile: t.tile,
    x: t.x,
    y: t.y,
    renderLayer: t.renderLayer ?? 0,
    transform: t.transform ?? 0,
  }));
}

export function computeRoomDimensions(room: Room.Main): { width: number; height: number } {
  const gridLen =
    room.spawnTiles?.length ??
    room.blockingEdges?.length ??
    0;
  const height = gridLen > 0 ? Math.ceil(gridLen / room.width) : room.width;
  return { width: room.width, height };
}

export function parseExits(room: Room.Main): ParsedExit[] {
  if (!room.exits) return [];
  return room.exits.map((e) => ({
    x: e.x,
    y: e.y,
    width: e.width ?? 1,
    height: e.height ?? 1,
    direction: e.direction,
    targetUri: e.target?.uri ?? null,
    targetCid: e.target?.cid ?? null,
  }));
}

export function buildAttributeMap(
  room: Room.Main,
  width: number,
  height: number,
): AttributeMap {
  const map = new AttributeMap(width, height);

  if (room.tileAttributes) {
    for (const attr of room.tileAttributes) {
      for (let i = 0; i < Math.min(attr.values.length, width * height); i++) {
        const x = i % width;
        const y = (i / width) | 0;
        // Values are 0-200, 100=neutral. Convert to -1...+1 range.
        const raw = attr.values[i];
        if (raw !== 100) {
          map.setBase(attr.attribute, x, y, (raw - 100) / 100);
        }
      }
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Build entity tree
// ---------------------------------------------------------------------------

/** Events that signal animation state changes from MovementBehavior. */
const ANIMATION_EVENTS = new Set([
  "walk",
  "idle",
  "turn-south",
  "turn-west",
  "turn-north",
  "turn-east",
]);

/** Check if a behavior handles animation events (belongs on the player entity). */
function isAnimationBehavior(b: Behavior): boolean {
  for (const t of b.eventTypes) {
    if (ANIMATION_EVENTS.has(t)) return true;
  }
  return false;
}

/**
 * Register a ReduxEntity: dispatch addEntity to Redux, add to registry.
 * Must be called before any .set() calls on the entity.
 */
function registerEntity(
  store: RoomStore,
  entity: ReduxEntity,
  parentId: string | null,
  registry: Map<string, ReduxEntity>,
): void {
  store.dispatch(addEntity({
    id: entity.id,
    parentId,
    childIds: [],
    state: {},
  }));
  registry.set(entity.id, entity);
}

export function buildEntityTree(
  tileSheet: HTMLImageElement,
  tileAtlas: TileFrame[],
  placedTiles: PlacedTile[],
  blockingGrid: BlockingGrid,
  attributeMap: AttributeMap,
  room: Room.Main,
  roomWidth: number,
  roomHeight: number,
  itemDefs: Map<string, Item.Main>,
  itemImages: Map<string, HTMLImageElement>,
  critterDefs: Map<string, Critter.Main>,
  critterImages: Map<string, HTMLImageElement>,
  avatarLayers: BakedAvatarLayer[],
  spawnPos: { x: number; y: number },
  luaRuntime: LuaRuntime,
): { roomEntity: ReduxEntity; playerEntity: ReduxEntity; store: RoomStore; entityRegistry: Map<string, ReduxEntity> } {
  // Create entity registry and store with behavior middleware
  const entityRegistry = new Map<string, ReduxEntity>();
  const store = createRoomStore([
    createBehaviorMiddleware(entityRegistry),
  ]);

  // Set room config
  store.dispatch(setRoomConfig({ roomWidth, roomHeight, tileSize: TILE_PX }));
  // Compile Lua room scripts
  const roomBehaviors = (room.behaviors ?? []).map(
    (b, i) => luaRuntime.compileScript(b.code ?? "", hashString(`room:${i}`)),
  );

  // Room entity — room behaviors + camera (render behaviors removed — direct draw in rAF loop)
  const roomEntity = new ReduxEntity([
    ...roomBehaviors,
    new CameraBehavior(),
  ], "room", store);

  registerEntity(store, roomEntity, null, entityRegistry);

  roomEntity.set(TILE_SHEET, tileSheet);
  roomEntity.set(TILE_ATLAS, tileAtlas);
  roomEntity.set(TILE_POSITIONS, placedTiles);
  roomEntity.set(TILE_SIZE, TILE_PX);
  roomEntity.set(BLOCKING_GRID, blockingGrid);
  roomEntity.set(ATTRIBUTE_MAP, attributeMap);
  roomEntity.set(VIEW_DISTANCE, DEFAULT_VIEW_DISTANCE);
  roomEntity.set(CAMERA_OFFSET, { x: 0, y: 0 });

  // --- Foreground row entities (layer 1) ---
  const fgRows = new Set<number>();
  for (const t of placedTiles) {
    if (t.renderLayer === 1) fgRows.add(t.y);
  }
  for (const row of fgRows) {
    const rowTiles = placedTiles.filter(
      (t) => t.renderLayer === 1 && t.y === row,
    );
    const rowId = `fg-row:${row}`;
    const rowEntity = new ReduxEntity([], rowId, store);
    registerEntity(store, rowEntity, "room", entityRegistry);
    rowEntity.set(TILE_POSITIONS, rowTiles);
    rowEntity.set(POSITION, { x: 0, y: row });
    rowEntity.set(RENDER_ORDER, RENDER_ORDER_FOREGROUND_TILES);
    roomEntity.addChild(rowEntity);
  }

  // --- Item entities ---
  if (room.items) {
    for (const roomItem of room.items) {
      const itemDef = itemDefs.get(roomItem.item.uri);
      if (!itemDef) continue;
      const itemImg = itemImages.get(roomItem.item.uri);
      if (!itemImg) continue;

      const variantIdx = roomItem.variant ?? 0;
      const variant = itemDef.variants[variantIdx];
      if (!variant) continue;

      // Pre-bake tints/transform if the placement specifies them
      const bakedItem = bakeLayer({
        image: itemImg,
        layers: itemDef.layers,
        tints: roomItem.tints ?? [],
        transform: roomItem.transform,
      });

      // Compile Lua scripts from the item definition
      const itemId = `item:${roomItem.item.uri}`;
      const compiledBehaviors = (itemDef.behaviors ?? []).map(
        (b, i) => luaRuntime.compileScript(b.code ?? "", hashString(`${itemId}:${i}`)),
      );
      const itemEntity = new ReduxEntity([
        ...compiledBehaviors,
        new TargetBehavior(),
      ], itemId, store);

      registerEntity(store, itemEntity, "room", entityRegistry);

      itemEntity.set(POSITION, { x: roomItem.x, y: roomItem.y });
      itemEntity.set(LAYERS, bakedItem.layers);
      itemEntity.set(SPRITE_SHEET, bakedItem.spriteSheet);
      itemEntity.set(TARGET, variant.target);
      itemEntity.set(TARGET_START_TIME, 0);
      itemEntity.set(
        RENDER_ORDER,
        roomItem.foreground === 1 ? RENDER_ORDER_FRONT : RENDER_ORDER_BEHIND,
      );

      // Initialize behavior state from stateProperties + variant + placement overrides
      if (itemDef.stateProperties) {
        const stateValues = new Map<string, string | undefined>();
        const stateTypes = new Map<string, string>();
        for (const sp of itemDef.stateProperties) {
          stateValues.set(sp.name, sp.default);
          stateTypes.set(sp.name, sp.type);
        }
        if (variant.state) {
          for (const sv of variant.state) {
            if (sv.value !== undefined) stateValues.set(sv.name, sv.value);
          }
        }
        if (roomItem.state) {
          for (const sv of roomItem.state) {
            if (sv.value !== undefined) stateValues.set(sv.name, sv.value);
          }
        }
        for (const [name, val] of stateValues) {
          if (val === undefined) continue;
          const type = stateTypes.get(name);
          const key = name;
          if (type === "integer" || type === "direction" || type === "edges") {
            itemEntity.set(key, parseInt(val, 10));
          } else if (type !== "blob") {
            itemEntity.set(key, val);
          }
        }
      }

      roomEntity.addChild(itemEntity);
    }
  }

  // --- Critter entities ---
  if (room.critters) {
    for (const roomCritter of room.critters) {
      const critterDef = critterDefs.get(roomCritter.critter.uri);
      if (!critterDef) continue;
      const critterImg = critterImages.get(roomCritter.critter.uri);
      if (!critterImg) continue;

      // Find a valid spawn tile from the area mask
      const validTiles: { x: number; y: number }[] = [];
      for (let i = 0; i < roomCritter.area.length; i++) {
        if (roomCritter.area[i]) {
          validTiles.push({ x: i % roomWidth, y: (i / roomWidth) | 0 });
        }
      }
      if (validTiles.length === 0) continue;
      const spawnTile = validTiles[Math.floor(Math.random() * validTiles.length)];

      const critterIdx = room.critters.indexOf(roomCritter);
      const critterId = `critter:${critterIdx}`;

      // Compile Lua scripts from the critter definition
      const compiledBehaviors = (critterDef.behaviors ?? []).map(
        (b, i) => luaRuntime.compileScript(b.code ?? "", hashString(`${critterId}:${i}`)),
      );
      const critterEntity = new ReduxEntity([
        ...compiledBehaviors,
        new MovementBehavior(),
        new TargetBehavior(),
      ], critterId, store);

      registerEntity(store, critterEntity, "room", entityRegistry);

      // Pre-bake tints if the placement specifies them
      const bakedCritter = bakeLayer({
        image: critterImg,
        layers: critterDef.layers,
        tints: roomCritter.tints ?? [],
      });

      critterEntity.set(POSITION, spawnTile);
      critterEntity.set(DIRECTION, 0);
      critterEntity.set(LAYERS, bakedCritter.layers);
      critterEntity.set(SPRITE_SHEET, bakedCritter.spriteSheet);
      critterEntity.set(TARGET, "idle-south");
      critterEntity.set(TARGET_START_TIME, 0);

      roomEntity.addChild(critterEntity);
    }
  }

  // --- Player entity ---
  // Base avatar (first layer) may provide animation behaviors that override
  // the default state+direction -> target mapping. These go on the player
  // entity before AvatarAnimationBehavior so they get first crack.
  const baseAnimBehaviors = avatarLayers[0]
    ? avatarLayers[0].behaviors.filter(isAnimationBehavior)
    : [];

  const playerEntity = new ReduxEntity([
    new MovementBehavior(),
    ...baseAnimBehaviors,
    new AvatarAnimationBehavior(),
    new TargetBehavior(),
  ], "player", store);

  registerEntity(store, playerEntity, "room", entityRegistry);

  playerEntity.set(POSITION, spawnPos);
  playerEntity.set(DIRECTION, 0);
  playerEntity.set(ANIM_STATE, "idle");
  playerEntity.set(TILE_SIZE, TILE_PX);

  // Each avatar component (base + wearables) is a separate child entity.
  // The "target" event propagates from the player entity to children.
  // Insertion order = draw order: base first, then wearables in equip order.
  for (let i = 0; i < avatarLayers.length; i++) {
    const al = avatarLayers[i];
    // Base avatar animation behaviors already placed on player entity
    const layerBehaviors = i === 0
      ? al.behaviors.filter((b) => !isAnimationBehavior(b))
      : al.behaviors;
    const layerId = `player-layer:${i}`;
    const layerEntity = new ReduxEntity([
      ...layerBehaviors,
      new TargetBehavior(),
    ], layerId, store);

    registerEntity(store, layerEntity, "player", entityRegistry);

    layerEntity.set(LAYERS, al.layers);
    layerEntity.set(SPRITE_SHEET, al.spriteSheet);
    layerEntity.set(TARGET, "idle-south");
    layerEntity.set(TARGET_START_TIME, 0);
    layerEntity.set(POSITION, { x: 0, y: 0 });
    playerEntity.addChild(layerEntity);
  }

  roomEntity.addChild(playerEntity);

  // Camera follows the player
  roomEntity.set(CAMERA_FOCUS, playerEntity);
  roomEntity.set(CAMERA_FOCUS_ID, "player");
  // Initialize camera to player's spawn position
  roomEntity.set(CAMERA_TARGET, {
    x: (spawnPos.x + 0.5) * TILE_PX,
    y: (spawnPos.y + 0.5) * TILE_PX,
  });

  return { roomEntity, playerEntity, store, entityRegistry };
}
