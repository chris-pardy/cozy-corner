import type * as Item from "~/atproto/generated/types/at/cozy-corner/item";
import type * as Critter from "~/atproto/generated/types/at/cozy-corner/critter";
import type * as Tileset from "~/atproto/generated/types/at/cozy-corner/tileset";
import type * as Avatar from "~/atproto/generated/types/at/cozy-corner/avatar";
import type * as AvatarBase from "~/atproto/generated/types/at/cozy-corner/avatar/base";
import type * as AvatarWearable from "~/atproto/generated/types/at/cozy-corner/avatar/wearable";
import type * as Room from "~/atproto/generated/types/at/cozy-corner/house/room";
import {
  extractBlobCid,
  blobUrl,
  loadImage,
  fetchRecord,
  parseAtUri,
} from "~/lib/at-protocol";
import {
  defaultAvatarUrl,
  defaultAvatarLayers,
  defaultAvatarBehaviors,
} from "~/atproto/default-avatar-base";
import { bakeLayer } from "~/engine/bake-avatar";
import type { LuaRuntime } from "~/engine/lua/lua-runtime";
import { hashString } from "~/engine/prng";
import type { BakedAvatarLayer } from "~/atproto/room-building";

// ---------------------------------------------------------------------------
// Tileset loading
// ---------------------------------------------------------------------------

export interface LoadedTileset {
  tileset: Tileset.Main;
  image: HTMLImageElement;
}

export async function loadTileset(
  pds: string,
  room: Room.Main,
): Promise<LoadedTileset> {
  const tilesetRef = room.tileset;
  const tilesetParsed = parseAtUri(tilesetRef.uri);
  if (!tilesetParsed) throw new Error("Invalid tileset URI");

  const { value } = await fetchRecord(
    pds,
    tilesetParsed.did,
    tilesetParsed.collection,
    tilesetParsed.rkey,
  );
  const tileset = value as unknown as Tileset.Main;
  const cid = extractBlobCid(tileset.spriteSheet);
  const img = await loadImage(blobUrl(pds, tilesetParsed.did, cid));
  return { tileset, image: img };
}

// ---------------------------------------------------------------------------
// Item loading
// ---------------------------------------------------------------------------

export interface LoadedItems {
  itemDefs: Map<string, Item.Main>;
  itemImages: Map<string, HTMLImageElement>;
}

export async function loadItems(
  pds: string,
  room: Room.Main,
): Promise<LoadedItems> {
  const uniqueItemUris = new Set<string>();
  if (room.items) {
    for (const ri of room.items) uniqueItemUris.add(ri.item.uri);
  }

  const itemDefs = new Map<string, Item.Main>();
  const itemImages = new Map<string, HTMLImageElement>();

  const itemPromises = [...uniqueItemUris].map(async (uri) => {
    const parsed = parseAtUri(uri);
    if (!parsed) return;
    try {
      const { value } = await fetchRecord(
        pds,
        parsed.did,
        parsed.collection,
        parsed.rkey,
      );
      const item = value as unknown as Item.Main;
      const cid = extractBlobCid(item.spriteSheet);
      const img = await loadImage(blobUrl(pds, parsed.did, cid));
      itemDefs.set(uri, item);
      itemImages.set(uri, img);
    } catch {
      // Skip items that fail to load
    }
  });

  await Promise.all(itemPromises);
  return { itemDefs, itemImages };
}

// ---------------------------------------------------------------------------
// Critter loading
// ---------------------------------------------------------------------------

export interface LoadedCritters {
  critterDefs: Map<string, Critter.Main>;
  critterImages: Map<string, HTMLImageElement>;
}

export async function loadCritters(
  pds: string,
  room: Room.Main,
): Promise<LoadedCritters> {
  const uniqueCritterUris = new Set<string>();
  if (room.critters) {
    for (const rc of room.critters) uniqueCritterUris.add(rc.critter.uri);
  }

  const critterDefs = new Map<string, Critter.Main>();
  const critterImages = new Map<string, HTMLImageElement>();

  const critterPromises = [...uniqueCritterUris].map(async (uri) => {
    const parsed = parseAtUri(uri);
    if (!parsed) return;
    try {
      const { value } = await fetchRecord(
        pds,
        parsed.did,
        parsed.collection,
        parsed.rkey,
      );
      const critter = value as unknown as Critter.Main;
      const cid = extractBlobCid(critter.spriteSheet);
      const img = await loadImage(blobUrl(pds, parsed.did, cid));
      critterDefs.set(uri, critter);
      critterImages.set(uri, img);
    } catch {
      // Skip critters that fail to load
    }
  });

  await Promise.all(critterPromises);
  return { critterDefs, critterImages };
}

// ---------------------------------------------------------------------------
// Avatar loading
// ---------------------------------------------------------------------------

export async function loadAvatar(
  pds: string,
  sessionDid: string | undefined,
  luaRuntime: LuaRuntime,
): Promise<BakedAvatarLayer[]> {
  if (!sessionDid) {
    const img = await loadImage(defaultAvatarUrl);
    return [{
      spriteSheet: img,
      layers: defaultAvatarLayers,
      behaviors: defaultAvatarBehaviors.map((b, i) => luaRuntime.compileScript(b.code ?? "", hashString(`avatar:default:${i}`))),
    }];
  }

  try {
    const { value: avatarValue } = await fetchRecord(
      pds,
      sessionDid,
      "at.cozy-corner.avatar",
      "self",
    );
    const avatar = avatarValue as unknown as Avatar.Main;
    const result: BakedAvatarLayer[] = [];

    // Load and bake the base avatar
    if (avatar.baseAvatar) {
      const baseParsed = parseAtUri(avatar.baseAvatar.uri);
      if (baseParsed) {
        const { value: baseValue } = await fetchRecord(
          pds,
          baseParsed.did,
          baseParsed.collection,
          baseParsed.rkey,
        );
        const baseRec = baseValue as unknown as AvatarBase.Main;
        const baseCid = extractBlobCid(baseRec.spriteSheet);
        const baseImg = await loadImage(blobUrl(pds, baseParsed.did, baseCid));
        const baked = bakeLayer({
          image: baseImg,
          layers: baseRec.layers,
          tints: avatar.baseAvatarTints ?? [],
          transform: avatar.baseAvatarTransform,
        });
        result.push({
          ...baked,
          behaviors: (baseRec.behaviors ?? []).map((b, i) => luaRuntime.compileScript(b.code ?? "", hashString(`avatar:base:${i}`))),
        });
      }
    } else {
      const img = await loadImage(defaultAvatarUrl);
      result.push({
        spriteSheet: img,
        layers: defaultAvatarLayers,
        behaviors: defaultAvatarBehaviors.map((b, i) => luaRuntime.compileScript(b.code ?? "", hashString(`avatar:default:${i}`))),
      });
    }

    // Load and bake each equipped wearable
    if (avatar.wearables) {
      const wearablePromises = avatar.wearables.map(async (eq, eqIdx) => {
        const wParsed = parseAtUri(eq.wearable.uri);
        if (!wParsed) return null;
        try {
          const { value: wValue } = await fetchRecord(
            pds,
            wParsed.did,
            wParsed.collection,
            wParsed.rkey,
          );
          const wRec = wValue as unknown as AvatarWearable.Main;
          const wCid = extractBlobCid(wRec.spriteSheet);
          const wImg = await loadImage(blobUrl(pds, wParsed.did, wCid));
          const baked = bakeLayer({
            image: wImg,
            layers: wRec.layers,
            tints: eq.tints ?? [],
            transform: eq.transform,
          });
          return {
            ...baked,
            behaviors: (wRec.behaviors ?? []).map((b, i) => luaRuntime.compileScript(b.code ?? "", hashString(`avatar:wearable:${eqIdx}:${i}`))),
          } satisfies BakedAvatarLayer;
        } catch {
          return null;
        }
      });
      const wearableResults = await Promise.all(wearablePromises);
      for (const w of wearableResults) {
        if (w) result.push(w);
      }
    }

    return result;
  } catch {
    const img = await loadImage(defaultAvatarUrl);
    return [{
      spriteSheet: img,
      layers: defaultAvatarLayers,
      behaviors: defaultAvatarBehaviors.map((b, i) => luaRuntime.compileScript(b.code ?? "", hashString(`avatar:default:${i}`))),
    }];
  }
}
