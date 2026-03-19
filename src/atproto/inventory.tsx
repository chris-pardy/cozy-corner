import { useEffect, useRef } from "react";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import {
  extractBlobCid,
  blobUrl,
  loadImage,
  parseAtUri,
} from "~/lib/at-protocol";
import { ensureFreshSession } from "~/editor/load-record";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InventoryCategory =
  | "item"
  | "wearable"
  | "tileset"
  | "baseAvatar"
  | "critter";

export interface InventoryRecord {
  uri: string;
  rkey: string;
  subject: { uri: string; cid: string };
  createdAt: string;
}

export interface EnrichedInventoryEntry {
  uri: string;
  rkey: string;
  subjectUri: string;
  subjectCid: string;
  category: InventoryCategory;
  name: string;
  previewImage: HTMLImageElement | null;
  layer: AnimationLayer | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  item: "Items",
  wearable: "Wearables",
  tileset: "Tilesets",
  baseAvatar: "Base Avatars",
  critter: "Critters",
};

// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORY_COLORS: Record<InventoryCategory, string> = {
  item: "var(--accent-primary)",
  wearable: "var(--accent-secondary)",
  tileset: "var(--clr-success)",
  baseAvatar: "var(--accent-tertiary)",
  critter: "#a78bfa",
};

// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORY_ORDER: InventoryCategory[] = [
  "item",
  "wearable",
  "tileset",
  "baseAvatar",
  "critter",
];

const COLLECTION_TO_CATEGORY: Record<string, InventoryCategory> = {
  "at.cozy-corner.item": "item",
  "at.cozy-corner.avatar.wearable": "wearable",
  "at.cozy-corner.tileset": "tileset",
  "at.cozy-corner.avatar.base": "baseAvatar",
  "at.cozy-corner.critter": "critter",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export function categoryFromUri(uri: string): InventoryCategory | null {
  const parsed = parseAtUri(uri);
  if (!parsed) return null;
  return COLLECTION_TO_CATEGORY[parsed.collection] ?? null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * List all inventory records for a user via paginated listRecords.
 */
// eslint-disable-next-line react-refresh/only-export-components
export async function listInventory(
  pds: string,
  did: string,
): Promise<InventoryRecord[]> {
  const all: InventoryRecord[] = [];
  let cursor: string | undefined;

  for (;;) {
    const params = new URLSearchParams({
      repo: did,
      collection: "at.cozy-corner.inventory",
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(
      `${pds}/xrpc/com.atproto.repo.listRecords?${params}`,
    );
    if (!res.ok) {
      if (res.status === 400 || res.status === 404) break;
      throw new Error(`Failed to list inventory (${res.status})`);
    }

    const data = await res.json();
    const records = data.records as {
      uri: string;
      value: { subject?: { uri: string; cid: string }; createdAt?: string };
    }[];

    for (const rec of records) {
      if (!rec.value.subject) continue;
      const rkey = rec.uri.split("/").pop()!;
      all.push({
        uri: rec.uri,
        rkey,
        subject: rec.value.subject,
        createdAt: rec.value.createdAt ?? "",
      });
    }

    cursor = data.cursor;
    if (!cursor || records.length === 0) break;
  }

  return all;
}

/**
 * Add a subject to the inventory via createRecord.
 * Auto-refreshes the session token if expired.
 */
// eslint-disable-next-line react-refresh/only-export-components
export async function addToInventory(
  subject: { uri: string; cid: string },
): Promise<{ uri: string; rkey: string }> {
  const session = await ensureFreshSession();
  const res = await fetch(
    `${session.pds}/xrpc/com.atproto.repo.createRecord`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "at.cozy-corner.inventory",
        record: {
          $type: "at.cozy-corner.inventory",
          subject,
          createdAt: new Date().toISOString(),
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Add failed (${res.status})`);
  }

  const data = await res.json();
  const rkey = (data.uri as string).split("/").pop()!;
  return { uri: data.uri as string, rkey };
}

/**
 * Remove an inventory record by rkey via deleteRecord.
 * Auto-refreshes the session token if expired.
 */
// eslint-disable-next-line react-refresh/only-export-components
export async function removeFromInventory(
  rkey: string,
): Promise<void> {
  const session = await ensureFreshSession();
  const res = await fetch(
    `${session.pds}/xrpc/com.atproto.repo.deleteRecord`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "at.cozy-corner.inventory",
        rkey,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Remove failed (${res.status})`);
  }
}

// ---------------------------------------------------------------------------
// Enrichment — fetch subject records for name + preview
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export async function enrichInventoryEntries(
  pds: string,
  records: InventoryRecord[],
): Promise<EnrichedInventoryEntry[]> {
  return Promise.all(
    records.map(async (rec) => {
      const parsed = parseAtUri(rec.subject.uri);
      const did = parsed?.did ?? "";
      const collection = parsed?.collection ?? "";
      const subjectRkey = parsed?.rkey ?? "";
      const category = COLLECTION_TO_CATEGORY[collection] ?? "item";

      let name = subjectRkey;
      let previewImage: HTMLImageElement | null = null;
      let firstLayer: AnimationLayer | null = null;

      try {
        const qs = new URLSearchParams({
          repo: did,
          collection,
          rkey: subjectRkey,
        }).toString();
        const res = await fetch(
          `${pds}/xrpc/com.atproto.repo.getRecord?${qs}`,
        );
        if (res.ok) {
          const data = await res.json();
          name = (data.value?.name as string) ?? subjectRkey;

          const spriteSheet = data.value?.spriteSheet;
          const layers = (data.value?.layers ?? []) as AnimationLayer[];
          firstLayer = layers[0] ?? null;

          if (spriteSheet) {
            const blobCid = extractBlobCid(spriteSheet);
            if (blobCid) {
              try {
                previewImage = await loadImage(blobUrl(pds, did, blobCid));
              } catch {
                // Preview unavailable
              }
            }
          }
        }
      } catch {
        // Best effort
      }

      return {
        uri: rec.uri,
        rkey: rec.rkey,
        subjectUri: rec.subject.uri,
        subjectCid: rec.subject.cid,
        category,
        name,
        previewImage,
        layer: firstLayer,
      } satisfies EnrichedInventoryEntry;
    }),
  );
}

// ---------------------------------------------------------------------------
// Grouping helper
// ---------------------------------------------------------------------------

/**
 * Group enriched inventory entries by category, preserving insertion order
 * within each group.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function groupByCategory(
  entries: EnrichedInventoryEntry[],
): Partial<Record<InventoryCategory, EnrichedInventoryEntry[]>> {
  return entries.reduce(
    (acc, entry) => {
      const list = acc[entry.category] ?? (acc[entry.category] = []);
      list.push(entry);
      return acc;
    },
    {} as Partial<Record<InventoryCategory, EnrichedInventoryEntry[]>>,
  );
}

// ---------------------------------------------------------------------------
// EntryPreview component
// ---------------------------------------------------------------------------

export function EntryPreview({
  entry,
  size = 48,
}: {
  entry: { previewImage: HTMLImageElement | null; layer: AnimationLayer | null };
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !entry.previewImage) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;

    const img = entry.previewImage;
    const layer = entry.layer;

    const f0 = layer?.frames[0];
    const sx = f0?.x ?? 0;
    const sy = f0?.y ?? 0;
    const sw = f0?.width ?? img.width;
    const sh = f0?.height ?? img.height;

    const scale = Math.min(size / sw, size / sh);
    const dw = sw * scale;
    const dh = sh * scale;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(
      img,
      sx,
      sy,
      sw,
      sh,
      (size - dw) / 2,
      (size - dh) / 2,
      dw,
      dh,
    );
  }, [entry, size]);

  if (!entry.previewImage) {
    return (
      <div
        className="flex items-center justify-center text-text-dim"
        style={{ width: size, height: size, fontSize: 9 }}
      >
        ...
      </div>
    );
  }

  return (
    <canvas
      ref={ref}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        display: "block",
      }}
    />
  );
}
