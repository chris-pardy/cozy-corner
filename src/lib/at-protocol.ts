/**
 * Shared AT Protocol utility functions.
 *
 * These are low-level helpers used across the codebase for interacting with
 * AT Protocol PDS servers. Higher-level concerns (token refresh, editor-specific
 * save logic) live in their respective modules.
 */

const DEFAULT_PDS = import.meta.env.VITE_PDS_URL || "https://bsky.social";

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// AT URI parsing
// ---------------------------------------------------------------------------

export function parseAtUri(
  uri: string,
): { did: string; collection: string; rkey: string } | null {
  const m = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { did: m[1], collection: m[2], rkey: m[3] };
}

// ---------------------------------------------------------------------------
// Blob helpers
// ---------------------------------------------------------------------------

export function extractBlobCid(blobRef: unknown): string {
  const ref = blobRef as { ref?: { $link?: string }; cid?: string };
  return ref.ref?.$link ?? ref.cid ?? "";
}

export function blobUrl(pds: string, did: string, cid: string): string {
  const qs = new URLSearchParams({ did, cid }).toString();
  return `${pds}/xrpc/com.atproto.sync.getBlob?${qs}`;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface Session {
  accessJwt: string;
  refreshJwt?: string;
  did: string;
  handle: string;
  pds: string;
}

/**
 * Read the session object from localStorage.
 * Returns `null` when no session is stored or the stored value is invalid.
 */
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem("session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Return the PDS URL from the current session, falling back to the
 * configured default (`VITE_PDS_URL` or `https://bsky.social`).
 */
export function getPds(): string {
  const session = getSession();
  return session?.pds ?? DEFAULT_PDS;
}

// ---------------------------------------------------------------------------
// Handle resolution
// ---------------------------------------------------------------------------

export async function resolveHandle(
  pds: string,
  handle: string,
): Promise<string> {
  const res = await fetch(
    `${pds}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
  );
  if (!res.ok) throw new Error(`Could not resolve handle: ${handle}`);
  const data = await res.json();
  return data.did;
}

// ---------------------------------------------------------------------------
// DID → PDS resolution
// ---------------------------------------------------------------------------

interface DidDocument {
  service?: { id: string; serviceEndpoint: string }[];
}

async function fetchDidDocument(did: string): Promise<DidDocument> {
  if (did.startsWith("did:plc:")) {
    const res = await fetch(`https://plc.directory/${did}`);
    if (!res.ok) throw new Error(`Could not resolve DID: ${did}`);
    return res.json();
  }
  if (did.startsWith("did:web:")) {
    const domain = did.slice("did:web:".length);
    const res = await fetch(`https://${domain}/.well-known/did.json`);
    if (!res.ok) throw new Error(`Could not resolve DID: ${did}`);
    return res.json();
  }
  throw new Error(`Unsupported DID method: ${did}`);
}

function extractPdsEndpoint(doc: DidDocument): string | null {
  const entry = doc.service?.find(
    (s) => s.id === "#atproto_pds" || s.id.endsWith("#atproto_pds"),
  );
  return entry?.serviceEndpoint ?? null;
}

/**
 * Resolve a DID to its PDS endpoint via the DID document.
 */
export async function resolveDidToPds(did: string): Promise<string> {
  const doc = await fetchDidDocument(did);
  const endpoint = extractPdsEndpoint(doc);
  if (!endpoint) throw new Error(`No PDS endpoint found for ${did}`);
  return endpoint;
}

// ---------------------------------------------------------------------------
// Record fetching
// ---------------------------------------------------------------------------

export async function fetchRecord(
  pds: string,
  did: string,
  collection: string,
  rkey: string,
): Promise<{ value: Record<string, unknown>; cid: string }> {
  const qs = new URLSearchParams({ repo: did, collection, rkey }).toString();
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?${qs}`);
  if (!res.ok)
    throw new Error(
      `Failed to fetch record: ${collection}/${rkey} (${res.status})`,
    );
  const data = await res.json();
  return { value: data.value, cid: data.cid };
}
