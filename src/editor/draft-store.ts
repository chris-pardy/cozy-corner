import type { SpriteEditorResult } from "./SpritePixelEditor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftSprite {
  target: string;
  blob: Blob;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
}

export interface DraftRecord {
  key: string;
  updatedAt: number;
  label: string;
  /** JSON-serializable editor state (metadata, variants, targets, etc.) */
  state: Record<string, unknown>;
  /** Sprite pixel data stored as PNG blobs per target */
  sprites: DraftSprite[];
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = "cozy-corner-drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getDraft(key: string): Promise<DraftRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as DraftRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function putDraft(draft: DraftRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(draft);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDraft(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listDrafts(): Promise<DraftRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as DraftRecord[]);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Sprite serialization (HTMLImageElement <-> Blob)
// ---------------------------------------------------------------------------

async function spriteToBlob(sprite: SpriteEditorResult): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = sprite.image.naturalWidth || sprite.image.width;
  canvas.height = sprite.image.naturalHeight || sprite.image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(sprite.image, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

export async function serializeSprites(
  sprites: Map<string, SpriteEditorResult>,
): Promise<DraftSprite[]> {
  const entries = Array.from(sprites.entries());
  return Promise.all(
    entries.map(async ([target, sprite]) => ({
      target,
      blob: await spriteToBlob(sprite),
      frameWidth: sprite.frameWidth,
      frameHeight: sprite.frameHeight,
      frameCount: sprite.frameCount,
      fps: sprite.fps,
    })),
  );
}

export async function deserializeSprites(
  draftSprites: DraftSprite[],
): Promise<Map<string, SpriteEditorResult>> {
  const map = new Map<string, SpriteEditorResult>();
  await Promise.all(
    draftSprites.map(async (ds) => {
      try {
        const image = await blobToImage(ds.blob);
        map.set(ds.target, {
          image,
          frameWidth: ds.frameWidth,
          frameHeight: ds.frameHeight,
          frameCount: ds.frameCount,
          fps: ds.fps,
        });
      } catch {
        // Skip corrupted sprites
      }
    }),
  );
  return map;
}
