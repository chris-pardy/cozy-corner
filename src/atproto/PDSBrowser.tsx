import { useState, useEffect, useCallback } from "react";
import { resolveHandle, blobUrl as sharedBlobUrl } from "~/lib/at-protocol";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrowsableType =
  | "item"
  | "base"
  | "wearable"
  | "critter"
  | "tileset"
  | "starterPack"
  | "room"
  | "blob";

const TYPE_CONFIG: Record<
  BrowsableType,
  { label: string; collection?: string }
> = {
  item: { label: "Items", collection: "at.cozy-corner.item" },
  base: { label: "Base Avatars", collection: "at.cozy-corner.avatar.base" },
  wearable: {
    label: "Wearables",
    collection: "at.cozy-corner.avatar.wearable",
  },
  critter: { label: "Critters", collection: "at.cozy-corner.critter" },
  tileset: { label: "Tilesets", collection: "at.cozy-corner.tileset" },
  starterPack: {
    label: "Starter Packs",
    collection: "at.cozy-corner.starterPack",
  },
  room: { label: "Rooms", collection: "at.cozy-corner.house.room" },
  blob: { label: "Blobs" },
};

const ALL_TYPES = Object.keys(TYPE_CONFIG) as BrowsableType[];

export interface PDSBrowserProps {
  /** DID or handle of the repo to browse */
  actor: string;
  /** PDS URL to use for handle resolution and all XRPC calls. */
  pds: string;
  /** Which content types to show tabs for. Defaults to all. */
  allowedTypes?: BrowsableType[];
  /** For the blob tab: only show blobs whose Content-Type matches one of
   *  these patterns. Supports wildcards like "image/*". */
  allowedMimeTypes?: string[];
  /** Fired when the user selects a record. */
  onSelectRecord?: (uri: string, cid: string, value: Record<string, unknown>) => void;
  /** Fired when the user selects a blob. */
  onSelectBlob?: (cid: string, mimeType: string) => void;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RecordEntry {
  uri: string;
  cid: string;
  value: {
    name?: string;
    description?: string;
    tags?: string[];
    [k: string]: unknown;
  };
}

interface BlobEntry {
  cid: string;
  mimeType: string | null;
}

// ---------------------------------------------------------------------------
// Resolution — uses the caller's PDS for everything
// ---------------------------------------------------------------------------

async function resolveActor(
  pds: string,
  actor: string
): Promise<string> {
  if (actor.startsWith("did:")) return actor;
  return resolveHandle(pds, actor);
}

// ---------------------------------------------------------------------------
// Data fetching — calls the resolved PDS directly
// ---------------------------------------------------------------------------

function xrpc(pds: string, method: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return `${pds}/xrpc/${method}${qs ? `?${qs}` : ""}`;
}

async function fetchRecords(
  pds: string,
  did: string,
  collection: string,
  cursor?: string
): Promise<{ records: RecordEntry[]; cursor?: string }> {
  const params: Record<string, string> = {
    repo: did,
    collection,
    limit: "50",
  };
  if (cursor) params.cursor = cursor;
  const res = await fetch(xrpc(pds, "com.atproto.repo.listRecords", params));
  if (!res.ok) throw new Error(`Failed to list ${collection}`);
  return res.json();
}

async function fetchBlobs(
  pds: string,
  did: string,
  cursor?: string
): Promise<{ cids: string[]; cursor?: string }> {
  const params: Record<string, string> = { did, limit: "50" };
  if (cursor) params.cursor = cursor;
  const res = await fetch(xrpc(pds, "com.atproto.sync.listBlobs", params));
  if (!res.ok) throw new Error("Failed to list blobs");
  return res.json();
}

async function resolveBlobMimeType(
  pds: string,
  did: string,
  cid: string
): Promise<string> {
  const controller = new AbortController();
  try {
    const res = await fetch(
      xrpc(pds, "com.atproto.sync.getBlob", { did, cid }),
      { signal: controller.signal }
    );
    const ct =
      res.headers.get("content-type") || "application/octet-stream";
    controller.abort();
    return ct;
  } catch {
    return "application/octet-stream";
  }
}

function blobUrl(pds: string, did: string, cid: string): string {
  return sharedBlobUrl(pds, did, cid);
}

function extractRkey(uri: string): string {
  return uri.split("/").pop() ?? uri;
}

function matchMimeType(actual: string, pattern: string): boolean {
  if (pattern === actual) return true;
  if (pattern.endsWith("/*")) {
    return actual.startsWith(pattern.slice(0, -1));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PDSBrowser({
  actor,
  pds,
  allowedTypes,
  allowedMimeTypes,
  onSelectRecord,
  onSelectBlob,
}: PDSBrowserProps) {
  const types = allowedTypes ?? ALL_TYPES;
  const [did, setDid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BrowsableType>(types[0]);

  useEffect(() => {
    queueMicrotask(() => {
      setDid(null);
      setError(null);
    });
    resolveActor(pds, actor)
      .then(setDid)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [actor, pds]);

  useEffect(() => {
    if (!types.includes(activeTab)) queueMicrotask(() => setActiveTab(types[0]));
  }, [types, activeTab]);

  if (error) {
    return (
      <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm">
        {error}
      </div>
    );
  }

  if (!did) {
    return (
      <div className="text-text-muted text-xs py-4 text-center">
        Resolving...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {types.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`font-heading text-[10px] px-2.5 py-1.5 rounded-sm border-2 cursor-pointer ${
                activeTab === type
                  ? "bg-accent-primary/15 border-accent-primary text-accent-primary"
                  : "bg-bg-surface border-border text-text-muted hover:border-border-hover hover:text-text-primary"
              }`}
            >
              {TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "blob" ? (
        <BlobList
          pds={pds}
          did={did}
          allowedMimeTypes={allowedMimeTypes}
          onSelect={onSelectBlob}
        />
      ) : (
        <RecordList
          pds={pds}
          did={did}
          collection={TYPE_CONFIG[activeTab].collection!}
          onSelect={onSelectRecord}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecordList
// ---------------------------------------------------------------------------

function RecordList({
  pds,
  did,
  collection,
  onSelect,
}: {
  pds: string;
  did: string;
  collection: string;
  onSelect?: (uri: string, cid: string, value: Record<string, unknown>) => void;
}) {
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(
    async (c?: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRecords(pds, did, collection, c);
        setRecords((prev) => (c ? [...prev, ...data.records] : data.records));
        setCursor(data.cursor);
        setHasMore(!!data.cursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [pds, did, collection]
  );

  useEffect(() => {
    setRecords([]);
    setCursor(undefined);
    setHasMore(true);
    load();
  }, [load]);

  if (error) {
    return (
      <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm">
        {error}
      </div>
    );
  }

  if (!loading && records.length === 0) {
    return (
      <div className="text-text-muted text-xs py-4 text-center">
        No records found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {records.map((rec) => (
        <button
          key={rec.uri}
          onClick={() => onSelect?.(rec.uri, rec.cid, rec.value)}
          className="flex flex-col gap-0.5 px-3 py-2 bg-bg-surface border-2 border-border rounded-sm text-left cursor-pointer hover:border-border-hover hover:bg-bg-panel"
        >
          <span className="font-heading text-[9px] text-text-primary">
            {rec.value.name ?? extractRkey(rec.uri)}
          </span>
          {rec.value.description && (
            <span className="text-[11px] text-text-muted line-clamp-1">
              {rec.value.description}
            </span>
          )}
          {rec.value.tags && rec.value.tags.length > 0 && (
            <span className="flex gap-1 flex-wrap mt-0.5">
              {rec.value.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[8px] text-accent-tertiary bg-accent-tertiary/10 px-1.5 py-0.5 rounded-sm"
                >
                  {tag}
                </span>
              ))}
            </span>
          )}
        </button>
      ))}
      {loading && (
        <div className="text-text-muted text-xs py-2 text-center">
          Loading...
        </div>
      )}
      {!loading && hasMore && (
        <button
          onClick={() => load(cursor)}
          className="text-link text-xs py-1.5 cursor-pointer hover:underline bg-transparent border-0"
        >
          Load more
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlobList
// ---------------------------------------------------------------------------

function BlobList({
  pds,
  did,
  allowedMimeTypes,
  onSelect,
}: {
  pds: string;
  did: string;
  allowedMimeTypes?: string[];
  onSelect?: (cid: string, mimeType: string) => void;
}) {
  const [blobs, setBlobs] = useState<BlobEntry[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(
    async (c?: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchBlobs(pds, did, c);
        const newBlobs: BlobEntry[] = data.cids.map((cid) => ({
          cid,
          mimeType: null,
        }));
        setBlobs((prev) => (c ? [...prev, ...newBlobs] : newBlobs));
        setCursor(data.cursor);
        setHasMore(!!data.cursor);

        if (newBlobs.length > 0) {
          setResolving(true);
          await Promise.all(
            newBlobs.map(async (blob) => {
              const mime = await resolveBlobMimeType(pds, did, blob.cid);
              setBlobs((prev) =>
                prev.map((b) =>
                  b.cid === blob.cid ? { ...b, mimeType: mime } : b
                )
              );
            })
          );
          setResolving(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [pds, did]
  );

  useEffect(() => {
    setBlobs([]);
    setCursor(undefined);
    setHasMore(true);
    load();
  }, [load]);

  const filtered = allowedMimeTypes
    ? blobs.filter(
        (b) =>
          b.mimeType !== null &&
          allowedMimeTypes.some((pattern) =>
            matchMimeType(b.mimeType!, pattern)
          )
      )
    : blobs;

  if (error) {
    return (
      <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm">
        {error}
      </div>
    );
  }

  if (!loading && !resolving && blobs.length === 0) {
    return (
      <div className="text-text-muted text-xs py-4 text-center">
        No blobs found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1">
        {filtered.map((blob) => (
          <button
            key={blob.cid}
            onClick={() =>
              blob.mimeType && onSelect?.(blob.cid, blob.mimeType)
            }
            disabled={blob.mimeType === null}
            className="flex flex-col items-center gap-1 p-2 bg-bg-surface border-2 border-border rounded-sm cursor-pointer hover:border-border-hover hover:bg-bg-panel disabled:opacity-40 disabled:cursor-default"
          >
            {blob.mimeType?.startsWith("image/") ? (
              <img
                src={blobUrl(pds, did, blob.cid)}
                alt=""
                className="w-16 h-16 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center text-text-dim text-[10px] text-center leading-tight">
                {blob.mimeType ?? "..."}
              </div>
            )}
            <span className="text-[8px] text-text-muted truncate w-full text-center">
              {blob.cid.slice(0, 12)}...
            </span>
          </button>
        ))}
      </div>
      {resolving && (
        <div className="text-text-muted text-xs py-1 text-center">
          Resolving types...
        </div>
      )}
      {loading && (
        <div className="text-text-muted text-xs py-2 text-center">
          Loading...
        </div>
      )}
      {!loading && hasMore && (
        <button
          onClick={() => load(cursor)}
          className="text-link text-xs py-1.5 cursor-pointer hover:underline bg-transparent border-0"
        >
          Load more
        </button>
      )}
    </div>
  );
}
