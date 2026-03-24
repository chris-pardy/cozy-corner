import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import {
  getSession,
  getPds,
  resolveHandle,
  extractBlobCid,
  blobUrl,
  loadImage,
  type Session,
} from "~/lib/at-protocol";
import { PixiSpritePreview } from "~/engine/pixi/PixiSpritePreview";
import { RoomGameView } from "~/atproto/RoomGameView";
import {
  type EnrichedInventoryEntry,
  type InventoryRecord,
  listInventory,
  enrichInventoryEntries,
  addToInventory,
  removeFromInventory,
} from "~/atproto/inventory";
import { InventoryCategoryGrid } from "~/atproto/InventoryCategoryGrid";
import { getNsidLabel, getNsidColor } from "~/lib/nsid-registry";
import { ErrorAlert, LoadingMessage, getErrorMessage } from "~/routes/-ui";

export const Route = createFileRoute("/$handle/$nsid/$tid")({
  component: RecordPreviewDispatch,
});

function RecordPreviewDispatch() {
  const { handle, nsid, tid } = Route.useParams();

  if (nsid === "at.cozy-corner.house.room") {
    return <RoomGameView handle={handle} tid={tid} />;
  }

  return <RecordPreview />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUniqueTargets(layers: AnimationLayer[]): string[] {
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const layer of layers) {
    if (!seen.has(layer.target)) {
      seen.add(layer.target);
      targets.push(layer.target);
    }
  }
  return targets;
}

// ---------------------------------------------------------------------------
// SpritePreview — animated sprite with pixi
// ---------------------------------------------------------------------------

function SpritePreview({
  image,
  layers,
  target,
  size = 192,
}: {
  image: HTMLImageElement;
  layers: AnimationLayer[];
  target: string;
  size?: number;
}) {
  const previewLayers = useMemo(
    () => [{ image, layers }],
    [image, layers],
  );
  return (
    <PixiSpritePreview
      previewLayers={previewLayers}
      target={target}
      size={size}
    />
  );
}

// ---------------------------------------------------------------------------
// StarterPackContents — entry list with optional inventory controls
// ---------------------------------------------------------------------------

function StarterPackContents({
  rawEntries,
  pds,
}: {
  rawEntries: { item: { uri: string; cid: string }; category: string }[];
  pds: string;
}) {
  const [entries, setEntries] = useState<EnrichedInventoryEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Inventory state (only if logged in)
  const [session] = useState<Session | null>(() => getSession());
  // Map from subject URI → inventory rkey (for removal)
  const [inventoryMap, setInventoryMap] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load pack entries + inventory in parallel
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingEntries(true);

      // Convert rawEntries to InventoryRecord-like for enrichment
      const fakeRecords: InventoryRecord[] = rawEntries.map((raw, i) => ({
        uri: `pack-entry-${i}`,
        rkey: `pack-entry-${i}`,
        subject: { uri: raw.item.uri, cid: raw.item.cid },
        createdAt: "",
      }));

      const enriched = await enrichInventoryEntries(pds, fakeRecords);

      if (!cancelled) {
        setEntries(enriched);
        setLoadingEntries(false);
      }

      // Load inventory if logged in
      if (session) {
        try {
          const invRecords = await listInventory(session.pds, session.did);
          if (!cancelled) {
            const map = new Map<string, string>();
            for (const rec of invRecords) {
              map.set(rec.subject.uri, rec.rkey);
            }
            setInventoryMap(map);
          }
        } catch {
          // Inventory unavailable
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [rawEntries, pds, session]);

  const handleAdd = useCallback(
    async (entry: EnrichedInventoryEntry) => {
      if (!session || inventoryMap.has(entry.subjectUri)) return;
      setSaving(true);
      setSaveError(null);
      try {
        const { rkey } = await addToInventory({
          uri: entry.subjectUri,
          cid: entry.subjectCid,
        });
        setInventoryMap((prev) => new Map(prev).set(entry.subjectUri, rkey));
      } catch (err) {
        setSaveError(getErrorMessage(err, "Add failed"));
      } finally {
        setSaving(false);
      }
    },
    [session, inventoryMap],
  );

  const handleRemove = useCallback(
    async (subjectUri: string) => {
      if (!session) return;
      const rkey = inventoryMap.get(subjectUri);
      if (!rkey) return;
      setSaving(true);
      setSaveError(null);
      try {
        await removeFromInventory(rkey);
        setInventoryMap((prev) => {
          const next = new Map(prev);
          next.delete(subjectUri);
          return next;
        });
      } catch (err) {
        setSaveError(getErrorMessage(err, "Remove failed"));
      } finally {
        setSaving(false);
      }
    },
    [session, inventoryMap],
  );

  const addAll = useCallback(async () => {
    if (!session) return;
    const toAdd = entries.filter((e) => !inventoryMap.has(e.subjectUri));
    if (toAdd.length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const results = await Promise.all(
        toAdd.map((e) =>
          addToInventory({
            uri: e.subjectUri,
            cid: e.subjectCid,
          }),
        ),
      );
      setInventoryMap((prev) => {
        const next = new Map(prev);
        for (let i = 0; i < toAdd.length; i++) {
          next.set(toAdd[i].subjectUri, results[i].rkey);
        }
        return next;
      });
    } catch (err) {
      setSaveError(getErrorMessage(err, "Add failed"));
    } finally {
      setSaving(false);
    }
  }, [entries, session, inventoryMap]);

  const allInInventory = entries.every((e) => inventoryMap.has(e.subjectUri));

  if (loadingEntries) {
    return (
      <div className="text-text-muted text-xs py-4 text-center">
        Loading contents...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-text-muted text-xs py-4 text-center">
        This starter pack is empty.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="font-heading text-[10px] text-text-muted uppercase tracking-wide">
          Contents ({entries.length})
        </div>
        {session && !allInInventory && (
          <button
            onClick={addAll}
            disabled={saving}
            className="bg-accent-primary/10 border-2 border-accent-primary rounded-sm text-accent-primary cursor-pointer font-heading text-[10px] py-1 px-3 hover:bg-accent-primary/20 active:bg-accent-primary/30 disabled:opacity-50 disabled:cursor-default"
          >
            + Add All
          </button>
        )}
      </div>

      {saveError && (
        <div className="mb-3">
          <ErrorAlert message={saveError} />
        </div>
      )}

      <InventoryCategoryGrid
        entries={entries}
        sectionClassName="mb-4"
        headingClassName="mb-2"
        renderAction={(entry) => {
          if (!session) return null;
          const inInventory = inventoryMap.has(entry.subjectUri);
          return (
            <button
              onClick={() =>
                inInventory
                  ? handleRemove(entry.subjectUri)
                  : handleAdd(entry)
              }
              disabled={saving}
              className={`shrink-0 font-heading text-[9px] py-1 px-2 rounded-sm border-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default ${
                inInventory
                  ? "border-error/50 text-error/80 hover:border-error hover:text-error bg-transparent"
                  : "border-accent-primary/50 text-accent-primary/80 hover:border-accent-primary hover:text-accent-primary bg-transparent"
              }`}
              title={
                inInventory
                  ? "Remove from inventory"
                  : "Add to inventory"
              }
            >
              {inInventory ? "Remove" : "+ Add"}
            </button>
          );
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecordPreview
// ---------------------------------------------------------------------------

interface RecordData {
  did: string;
  name: string;
  description?: string;
  tags?: string[];
  spriteSheet?: unknown;
  splash?: unknown;
  layers?: AnimationLayer[];
  raw: Record<string, unknown>;
}

function RecordPreview() {
  const { handle, nsid, tid } = Route.useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<RecordData | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [pds] = useState(() => getPds());
  const [session] = useState(() => getSession());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Resolve handle to DID
        let did: string;
        if (handle.startsWith("did:")) {
          did = handle;
        } else {
          did = await resolveHandle(pds, handle);
        }

        // Fetch record
        const qs = new URLSearchParams({
          repo: did,
          collection: nsid,
          rkey: tid,
        }).toString();
        const res = await fetch(
          `${pds}/xrpc/com.atproto.repo.getRecord?${qs}`,
        );
        if (!res.ok) throw new Error(`Record not found (${res.status})`);

        const data = await res.json();
        const value = data.value as Record<string, unknown>;

        const rec: RecordData = {
          did,
          name: (value.name as string) ?? tid,
          description: value.description as string | undefined,
          tags: value.tags as string[] | undefined,
          spriteSheet: value.spriteSheet,
          splash: value.splash,
          layers: value.layers as AnimationLayer[] | undefined,
          raw: value,
        };

        if (cancelled) return;
        setRecord(rec);

        // Set default target
        if (rec.layers && rec.layers.length > 0) {
          const targets = getUniqueTargets(rec.layers);
          setActiveTarget(targets[0]);
        }

        // Load sprite image
        const blobRef = rec.spriteSheet ?? rec.splash;
        if (blobRef) {
          const cid = extractBlobCid(blobRef);
          if (cid) {
            try {
              const img = await loadImage(blobUrl(pds, did, cid));
              if (!cancelled) setImage(img);
            } catch {
              // Image unavailable
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Failed to load"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [handle, nsid, tid, pds]);

  const typeLabel = getNsidLabel(nsid);
  const typeColor = getNsidColor(nsid);
  const targets = record?.layers ? getUniqueTargets(record.layers) : [];
  const isStarterPack = nsid === "at.cozy-corner.starterPack";

  // Extract starter pack entries from raw record
  const packEntries = isStarterPack
    ? ((record?.raw?.entries ?? []) as {
        item: { uri: string; cid: string };
        category: string;
      }[])
    : [];

  return (
    <div className="min-h-screen font-body">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {loading && <LoadingMessage />}

        <ErrorAlert message={error} />

        {!loading && !error && record && (
          <div className="flex flex-col gap-6">
            {/* Type badge + name */}
            <div>
              <span
                className="font-heading text-[10px] uppercase tracking-wide"
                style={{ color: typeColor }}
              >
                {typeLabel}
              </span>
              <div className="flex items-center justify-between mt-1">
                <h1 className="font-heading text-sm text-text-primary">
                  {record.name}
                </h1>
                {session && (
                  <Link
                    to="/create/$actor/$nsid/$tid"
                    params={{ actor: record.did, nsid, tid }}
                    className="font-heading text-[10px] px-3 py-1.5 rounded-sm border-2 border-accent-secondary/50 text-accent-secondary/80 hover:border-accent-secondary hover:text-accent-secondary transition-colors"
                  >
                    Edit
                  </Link>
                )}
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                by {handle}
              </div>
            </div>

            {/* Sprite preview */}
            {image && !isStarterPack && record.layers && activeTarget && (
              <div>
                <div className="border-2 border-border rounded-sm bg-bg-panel p-4 flex items-center justify-center">
                  <SpritePreview
                    image={image}
                    layers={record.layers}
                    target={activeTarget}
                    size={192}
                  />
                </div>

                {targets.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {targets.map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTarget(t)}
                        className={`font-heading text-[10px] px-2.5 py-1.5 rounded-sm border-2 cursor-pointer ${
                          activeTarget === t
                            ? "bg-accent-primary/15 border-accent-primary text-accent-primary"
                            : "bg-bg-surface border-border text-text-muted hover:border-border-hover hover:text-text-primary"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Splash image for starter packs */}
            {image && isStarterPack && (
              <div className="border-2 border-border rounded-sm bg-bg-panel p-4 flex items-center justify-center">
                <img
                  src={image.src}
                  alt={record.name}
                  style={{ imageRendering: "pixelated", maxWidth: "100%" }}
                />
              </div>
            )}

            {/* Static preview fallback (no layers but has image) */}
            {image && !isStarterPack && (!record.layers || record.layers.length === 0) && (
              <div className="border-2 border-border rounded-sm bg-bg-panel p-4 flex items-center justify-center">
                <img
                  src={image.src}
                  alt={record.name}
                  style={{ imageRendering: "pixelated", maxWidth: "100%", maxHeight: 256 }}
                />
              </div>
            )}

            {/* Description */}
            {record.description && (
              <div>
                <div className="font-heading text-[10px] text-text-muted uppercase tracking-wide mb-2">
                  Description
                </div>
                <p className="text-[13px] text-text-primary leading-relaxed m-0">
                  {record.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {record.tags && record.tags.length > 0 && (
              <div>
                <div className="font-heading text-[10px] text-text-muted uppercase tracking-wide mb-2">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {record.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] text-accent-tertiary bg-accent-tertiary/10 px-2 py-1 rounded-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Starter pack contents */}
            {isStarterPack && packEntries.length > 0 && (
              <StarterPackContents rawEntries={packEntries} pds={pds} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
