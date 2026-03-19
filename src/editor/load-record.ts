import type { SpriteEditorResult } from "./SpritePixelEditor";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import {
  loadImage as _loadImage,
  extractBlobCid as _extractBlobCid,
  blobUrl as _blobUrl,
  parseAtUri as _parseAtUri,
  type Session,
} from "~/lib/at-protocol";

// ---------------------------------------------------------------------------
// Re-exports from shared module (backward compatibility)
// ---------------------------------------------------------------------------

export { _loadImage as loadImage };
export { _extractBlobCid as extractBlobCid };
export { _blobUrl as blobUrl };
export type { Session };

// ---------------------------------------------------------------------------
// URI parsing — the editor variant always returns a value (never null)
// ---------------------------------------------------------------------------

export interface ParsedUri {
  did: string;
  collection: string;
  rkey: string;
}

export function parseAtUri(uri: string): ParsedUri {
  const parsed = _parseAtUri(uri);
  if (parsed) return parsed;
  // Fallback: strip scheme and split (matches the original behavior)
  const parts = uri.replace("at://", "").split("/");
  return { did: parts[0], collection: parts[1], rkey: parts[2] };
}

// ---------------------------------------------------------------------------
// Record fetching — the editor variant returns { uri, cid, value }
// ---------------------------------------------------------------------------

export interface FetchedRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

export async function fetchRecord(
  pds: string,
  did: string,
  collection: string,
  rkey: string,
): Promise<FetchedRecord> {
  const qs = new URLSearchParams({ repo: did, collection, rkey }).toString();
  const res = await fetch(
    `${pds}/xrpc/com.atproto.repo.getRecord?${qs}`,
  );
  if (!res.ok) throw new Error(`Failed to fetch record (${res.status})`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Sprite reconstruction
// ---------------------------------------------------------------------------

/**
 * Given a spriteSheet image and its layers, reconstruct per-target
 * SpriteEditorResult objects (horizontal strip per target).
 */
export async function reconstructSprites(
  sheetImage: HTMLImageElement,
  layers: AnimationLayer[],
): Promise<{ targets: string[]; sprites: Map<string, SpriteEditorResult> }> {
  const seen = new Set<string>();
  const targets: string[] = [];
  const sprites = new Map<string, SpriteEditorResult>();

  for (const layer of layers) {
    if (seen.has(layer.target) || layer.frames.length === 0) continue;
    seen.add(layer.target);
    targets.push(layer.target);

    const f0 = layer.frames[0];
    const fw = f0.width;
    const fh = f0.height;
    const fc = layer.frames.length;
    const stripW = fw * fc;
    const stripH = fh;
    const canvas = document.createElement("canvas");
    canvas.width = stripW;
    canvas.height = stripH;
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < fc; i++) {
      const frame = layer.frames[i];
      ctx.drawImage(
        sheetImage,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        i * fw,
        0,
        fw,
        fh,
      );
    }
    const img = await _loadImage(canvas.toDataURL());
    sprites.set(layer.target, {
      image: img,
      frameWidth: fw,
      frameHeight: fh,
      frameCount: fc,
      fps: layer.frameRate > 0 ? Math.round(1000 / layer.frameRate) : 10,
    });
  }

  return { targets, sprites };
}

// ---------------------------------------------------------------------------
// Save helpers
// ---------------------------------------------------------------------------

/**
 * Get the session from localStorage.
 * Throws if no session is stored (editor context requires authentication).
 */
export function getSession(): Session {
  const raw = localStorage.getItem("session");
  if (!raw) throw new Error("Not logged in");
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

function decodeJwtPayload(jwt: string): { exp?: number } {
  try {
    const payload = jwt.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function isTokenExpired(jwt: string, bufferSeconds = 60): boolean {
  const { exp } = decodeJwtPayload(jwt);
  if (!exp) return true;
  return Date.now() / 1000 >= exp - bufferSeconds;
}

let refreshPromise: Promise<Session> | null = null;

async function doRefresh(stored: Session & { refreshJwt: string }): Promise<Session> {
  const res = await fetch(
    `${stored.pds}/xrpc/com.atproto.server.refreshSession`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${stored.refreshJwt}` },
    },
  );
  if (!res.ok) {
    localStorage.removeItem("session");
    throw new Error("Session expired — please log in again");
  }
  const data = await res.json();
  const updated: Session = {
    accessJwt: data.accessJwt,
    refreshJwt: data.refreshJwt,
    did: data.did ?? stored.did,
    handle: data.handle ?? stored.handle,
    pds: stored.pds,
  };
  localStorage.setItem("session", JSON.stringify(updated));
  return updated;
}

/**
 * Return a session with a valid access token, refreshing if needed.
 */
export async function ensureFreshSession(): Promise<Session> {
  const raw = localStorage.getItem("session");
  if (!raw) throw new Error("Not logged in");
  const stored: Session = JSON.parse(raw);

  if (!isTokenExpired(stored.accessJwt)) return stored;

  if (!stored.refreshJwt) {
    localStorage.removeItem("session");
    throw new Error("Session expired — please log in again");
  }

  if (!refreshPromise) {
    refreshPromise = doRefresh(stored as Session & { refreshJwt: string }).finally(
      () => { refreshPromise = null; },
    );
  }
  return refreshPromise;
}

/**
 * Save a record — uses putRecord if rkey is provided (overwrite),
 * createRecord otherwise (new). Auto-refreshes the token if expired.
 */
export async function saveRecord(
  _session: Session,
  collection: string,
  record: Record<string, unknown>,
  rkey?: string,
): Promise<string> {
  const session = await ensureFreshSession();
  if (rkey) {
    // Overwrite existing
    const res = await fetch(
      `${session.pds}/xrpc/com.atproto.repo.putRecord`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: session.did,
          collection,
          rkey,
          record,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || `Save failed (${res.status})`);
    }
    const { uri } = await res.json();
    return uri;
  } else {
    // Create new
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
          collection,
          record,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || `Save failed (${res.status})`);
    }
    const { uri } = await res.json();
    return uri;
  }
}

/**
 * Upload a blob and return the blob ref. Auto-refreshes the token if expired.
 */
export async function uploadBlob(
  _session: Session,
  data: Blob | ArrayBuffer,
  mimeType: string,
): Promise<unknown> {
  const session = await ensureFreshSession();
  const res = await fetch(
    `${session.pds}/xrpc/com.atproto.repo.uploadBlob`,
    {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: data,
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Upload failed (${res.status})`);
  }
  const { blob } = await res.json();
  return blob;
}
