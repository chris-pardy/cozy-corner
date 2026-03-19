import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PDSBrowser, type BrowsableType } from "~/atproto/PDSBrowser";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";
import {
  parseAtUri,
  extractBlobCid,
  blobUrl,
  loadImage,
  fetchRecord,
  getSession,
  uploadBlob,
  saveRecord,
} from "./load-record";
import {
  StarterPackEditorProvider,
  createStarterPackEditorInitialState,
  usePackDispatch,
  usePackSelector,
  usePackStore,
  setPackName,
  setPackDescription,
  addEntry,
  removeEntry as removeEntryAction,
  moveEntry as moveEntryAction,
  type PackEntryData,
  type EntryCategory,
} from "./store";
import "./editor.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PackEntry {
  /** AT URI of the referenced record */
  uri: string;
  /** CID at time of addition */
  cid: string;
  category: EntryCategory;
  /** Display name from the record */
  name: string;
  /** Loaded preview image (first frame of spriteSheet) */
  previewImage: HTMLImageElement | null;
  /** First animation layer (for frame extraction) */
  layer: AnimationLayer | null;
}

interface PreviewData {
  previewImage: HTMLImageElement | null;
  layer: AnimationLayer | null;
}

const CATEGORY_LABELS: Record<EntryCategory, string> = {
  item: "Items",
  wearable: "Wearables",
  tileset: "Tilesets",
  baseAvatar: "Base Avatars",
  critter: "Critters",
};

const CATEGORY_COLORS: Record<EntryCategory, string> = {
  item: "var(--accent-primary)",
  wearable: "var(--accent-secondary)",
  tileset: "var(--clr-success)",
  baseAvatar: "var(--accent-tertiary)",
  critter: "#a78bfa",
};

const BROWSE_TYPES: BrowsableType[] = [
  "item",
  "wearable",
  "tileset",
  "base",
  "critter",
];

const COLLECTION_TO_CATEGORY: Record<string, EntryCategory> = {
  "at.cozy-corner.item": "item",
  "at.cozy-corner.avatar.wearable": "wearable",
  "at.cozy-corner.tileset": "tileset",
  "at.cozy-corner.avatar.base": "baseAvatar",
  "at.cozy-corner.critter": "critter",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDid(uri: string): string {
  return uri.split("/")[2];
}

function extractCollection(uri: string): string {
  const parts = uri.replace("at://", "").split("/");
  return parts[1];
}

// ---------------------------------------------------------------------------
// EntryPreview — renders first frame from spriteSheet
// ---------------------------------------------------------------------------

function EntryPreview({
  entry,
  size = 64,
}: {
  entry: PackEntry;
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

    // Extract first frame
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
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          color: "#475569",
        }}
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

// ---------------------------------------------------------------------------
// SplashPreview — composite of all entries
// ---------------------------------------------------------------------------

const SPLASH_W = 600;
const SPLASH_H = 315;

function generateSplash(entries: PackEntry[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SPLASH_W;
  canvas.height = SPLASH_H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // Dark background
  ctx.fillStyle = "#0a0e1a";
  ctx.fillRect(0, 0, SPLASH_W, SPLASH_H);

  // Subtle grid pattern
  ctx.strokeStyle = "rgba(34, 211, 238, 0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < SPLASH_W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SPLASH_H);
    ctx.stroke();
  }
  for (let y = 0; y < SPLASH_H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SPLASH_W, y);
    ctx.stroke();
  }

  const withImages = entries.filter((e) => e.previewImage);
  if (withImages.length === 0) return canvas;

  // Lay out items in a centered grid
  const count = withImages.length;
  const cols = Math.min(count, Math.ceil(Math.sqrt(count * (SPLASH_W / SPLASH_H))));
  const rows = Math.ceil(count / cols);

  const cellW = Math.floor(SPLASH_W / cols);
  const cellH = Math.floor(SPLASH_H / rows);
  const itemSize = Math.min(cellW, cellH) - 16;

  withImages.forEach((entry, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Center the last row if incomplete
    const rowItems = row === rows - 1 ? count - row * cols : cols;
    const rowOffset = (SPLASH_W - rowItems * cellW) / 2;

    const cx = rowOffset + col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2;

    const img = entry.previewImage!;
    const layer = entry.layer;
    const f0 = layer?.frames[0];
    const sx = f0?.x ?? 0;
    const sy = f0?.y ?? 0;
    const sw = f0?.width ?? img.width;
    const sh = f0?.height ?? img.height;

    const scale = Math.min(itemSize / sw, itemSize / sh);
    const dw = sw * scale;
    const dh = sh * scale;

    ctx.drawImage(
      img,
      sx,
      sy,
      sw,
      sh,
      cx - dw / 2,
      cy - dh / 2,
      dw,
      dh,
    );
  });

  return canvas;
}

function SplashPreview({ entries }: { entries: PackEntry[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = SPLASH_W;
    canvas.height = SPLASH_H;
    ctx.imageSmoothingEnabled = false;

    const splash = generateSplash(entries);
    ctx.drawImage(splash, 0, 0);
  }, [entries]);

  return (
    <canvas
      ref={ref}
      className="ale-preview-canvas"
      style={{
        width: "100%",
        height: "auto",
        aspectRatio: `${SPLASH_W}/${SPLASH_H}`,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// StarterPackEditor
// ---------------------------------------------------------------------------

export function StarterPackEditor({ uri, editRkey }: { uri?: string; editRkey?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["starter-pack-editor", uri],
    queryFn: async () => {
      const sess = getSession();
      const { did, collection, rkey } = parseAtUri(uri!);
      const rec = await fetchRecord(sess.pds, did, collection, rkey);
      const v = rec.value;

      const loadedEntries: PackEntry[] = [];
      if (Array.isArray(v.entries)) {
        for (const entry of v.entries as Record<string, unknown>[]) {
          const ref = entry.item as { uri: string; cid: string } | undefined;
          if (!ref?.uri) continue;
          const category = (entry.category as EntryCategory) ?? "item";
          const entryDid = extractDid(ref.uri);
          const entryColl = extractCollection(ref.uri);
          const entryRkey = ref.uri.split("/").pop()!;

          let recordName = entryRkey;
          let previewImage: HTMLImageElement | null = null;
          let firstLayer: AnimationLayer | null = null;
          try {
            const entryRec = await fetchRecord(sess.pds, entryDid, entryColl, entryRkey);
            recordName = (entryRec.value.name as string) ?? entryRkey;
            const layers = (entryRec.value.layers ?? []) as AnimationLayer[];
            firstLayer = layers[0] ?? null;
            const cid = extractBlobCid(entryRec.value.spriteSheet);
            if (cid) {
              previewImage = await loadImage(blobUrl(sess.pds, entryDid, cid));
            }
          } catch {
            // Best effort
          }

          loadedEntries.push({
            uri: ref.uri,
            cid: ref.cid ?? "",
            category,
            name: recordName,
            previewImage,
            layer: firstLayer,
          });
        }
      }

      return {
        name: (v.name as string) ?? "",
        description: (v.description as string) ?? "",
        entries: loadedEntries,
      };
    },
    enabled: !!uri,
  });

  if (isLoading) {
    return <div className="text-text-muted text-xs py-8 text-center">Loading...</div>;
  }

  return <StarterPackEditorForm key={uri} initialData={data} editRkey={editRkey} />;
}

function StarterPackEditorForm({ initialData, editRkey }: {
  initialData?: { name: string; description: string; entries: PackEntry[] };
  editRkey?: string;
}) {
  // Split loaded data into serializable Redux state and local preview map
  const { reduxInitialState, initialPreviewMap } = useMemo(() => {
    const entries = initialData?.entries ?? [];
    const entryData: PackEntryData[] = entries.map((e) => ({
      uri: e.uri,
      cid: e.cid,
      category: e.category,
      name: e.name,
    }));
    const previewMap = new Map<string, PreviewData>();
    for (const e of entries) {
      previewMap.set(e.uri, {
        previewImage: e.previewImage,
        layer: e.layer,
      });
    }
    return {
      reduxInitialState: createStarterPackEditorInitialState({
        name: initialData?.name ?? "",
        description: initialData?.description ?? "",
        entries: entryData,
      }),
      initialPreviewMap: previewMap,
    };
  }, [initialData]);

  return (
    <StarterPackEditorProvider initialState={reduxInitialState}>
      <StarterPackEditorInner
        editRkey={editRkey}
        initialPreviewMap={initialPreviewMap}
      />
    </StarterPackEditorProvider>
  );
}

function StarterPackEditorInner({ editRkey, initialPreviewMap }: {
  editRkey?: string;
  initialPreviewMap: Map<string, PreviewData>;
}) {
  const dispatch = usePackDispatch();
  const store = usePackStore();
  const name = usePackSelector((s) => s.editor.name);
  const description = usePackSelector((s) => s.editor.description);
  const entryData = usePackSelector((s) => s.editor.entries);

  // Local non-serializable preview data
  const previewMapRef = useRef<Map<string, PreviewData>>(initialPreviewMap);

  // Combine Redux entry data with local preview data for rendering
  const entries: PackEntry[] = useMemo(
    () =>
      entryData.map((ed: PackEntryData) => {
        const preview = previewMapRef.current.get(ed.uri);
        return {
          ...ed,
          previewImage: preview?.previewImage ?? null,
          layer: preview?.layer ?? null,
        };
      }),
    [entryData],
  );

  // Browser modal
  const [showBrowser, setShowBrowser] = useState(false);
  const [browseHandle, setBrowseHandle] = useState("");
  const [browseActor, setBrowseActor] = useState<string | null>(null);

  // Save state
  const [currentRkey, setCurrentRkey] = useState(editRkey);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUri, setSavedUri] = useState<string | null>(null);

  const session = JSON.parse(localStorage.getItem("session") ?? "{}");
  const sessionPds: string | undefined = session.pds;

  // Open browser
  const openBrowser = useCallback(() => {
    setBrowseHandle(session.handle ?? "");
    setBrowseActor(session.handle ?? null);
    setShowBrowser(true);
  }, [session.handle]);

  // Handle record selection from PDSBrowser
  const handleSelectRecord = useCallback(
    async (uri: string, _cid: string, value: Record<string, unknown>) => {
      // Check for duplicates
      const currentEntries = store.getState().editor.entries;
      if (currentEntries.some((e: PackEntryData) => e.uri === uri)) return;

      const collection = extractCollection(uri);
      const category = COLLECTION_TO_CATEGORY[collection];
      if (!category) return;

      const did = extractDid(uri);
      const recordName =
        (value.name as string) ?? uri.split("/").pop() ?? "Unknown";

      // Extract CID from the spriteSheet blob ref
      const spriteSheet = value.spriteSheet as unknown;
      const layers = (value.layers ?? []) as AnimationLayer[];
      const firstLayer = layers[0] ?? null;

      // We need the record CID — fetch it
      let recordCid = "";
      try {
        const rkey = uri.split("/").pop()!;
        const res = await fetch(
          `${sessionPds}/xrpc/com.atproto.repo.getRecord?` +
            new URLSearchParams({ repo: did, collection, rkey }).toString(),
        );
        if (res.ok) {
          const data = await res.json();
          recordCid = data.cid ?? "";
        }
      } catch {
        // Best effort
      }

      // Load preview image
      let previewImage: HTMLImageElement | null = null;
      if (spriteSheet && sessionPds) {
        const cid = extractBlobCid(spriteSheet);
        if (cid) {
          try {
            previewImage = await loadImage(blobUrl(sessionPds, did, cid));
          } catch {
            // Preview unavailable
          }
        }
      }

      // Dispatch serializable data to Redux
      dispatch(addEntry({ uri, cid: recordCid, category, name: recordName }));

      // Store non-serializable preview data locally
      previewMapRef.current.set(uri, { previewImage, layer: firstLayer });
    },
    [sessionPds, store, dispatch],
  );

  const handleRemoveEntry = useCallback((uri: string) => {
    dispatch(removeEntryAction(uri));
    previewMapRef.current.delete(uri);
  }, [dispatch]);

  const handleMoveEntry = useCallback((index: number, direction: -1 | 1) => {
    dispatch(moveEntryAction({ index, direction }));
  }, [dispatch]);

  // Group entries by category for display
  const groupedEntries = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.category]) acc[entry.category] = [];
      acc[entry.category].push(entry);
      return acc;
    },
    {} as Record<EntryCategory, PackEntry[]>,
  );

  const categoryOrder: EntryCategory[] = [
    "item",
    "wearable",
    "tileset",
    "baseAvatar",
    "critter",
  ];

  // Save
  const canSave = name.trim().length > 0 && entries.length > 0;

  async function doSave(rkey?: string) {
    setSaving(true);
    setSaveError(null);

    try {
      const sess = getSession();

      // Read current state from store for save
      const { name: currentName, description: currentDescription, entries: currentEntryData } = store.getState().editor;

      // Combine with preview data for splash generation
      const currentEntries: PackEntry[] = currentEntryData.map((ed: PackEntryData) => {
        const preview = previewMapRef.current.get(ed.uri);
        return {
          ...ed,
          previewImage: preview?.previewImage ?? null,
          layer: preview?.layer ?? null,
        };
      });

      // Generate and upload splash image
      const splashCanvas = generateSplash(currentEntries);
      const splashBlob = await new Promise<Blob>((resolve, reject) => {
        splashCanvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
          "image/png",
        );
      });
      const splashRef = await uploadBlob(sess, splashBlob, "image/png");

      // Build entries array
      const packedEntries = currentEntryData.map((e: PackEntryData) => ({
        $type: "at.cozy-corner.defs#categorizedEntry" as const,
        item: {
          uri: e.uri,
          cid: e.cid,
        },
        category: e.category,
      }));

      const record = {
        $type: "at.cozy-corner.starterPack",
        name: currentName.trim(),
        ...(currentDescription.trim() ? { description: currentDescription.trim() } : {}),
        splash: splashRef,
        entries: packedEntries,
        createdAt: new Date().toISOString(),
      };

      const saved = await saveRecord(
        sess,
        "at.cozy-corner.starterPack",
        record,
        rkey,
      );
      setSavedUri(saved);
      if (!rkey) setCurrentRkey(parseAtUri(saved).rkey);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const handleSave = useCallback(() => doSave(currentRkey), [name, description, entryData, currentRkey]);
  const handleSaveNew = useCallback(() => doSave(undefined), [name, description, entryData]);

  const handleLookup = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const v = browseHandle.trim();
      if (v) setBrowseActor(v);
    },
    [browseHandle],
  );

  return (
    <div className="bae-root">
      {/* ── Left pane: metadata ── */}
      <div className="bae-meta">
        <div className="ale-label">Name</div>
        <input
          className="bae-input"
          value={name}
          onChange={(e) => dispatch(setPackName(e.target.value))}
          placeholder="Starter pack name"
          maxLength={64}
        />

        <div className="ale-label" style={{ marginTop: 12 }}>
          Description
        </div>
        <textarea
          className="bae-textarea"
          value={description}
          onChange={(e) => dispatch(setPackDescription(e.target.value))}
          placeholder="What's in this pack?"
          maxLength={256}
          rows={3}
        />

        <div className="ale-label" style={{ marginTop: 12 }}>
          Splash Preview
        </div>
        <div className="ale-preview-frame">
          <SplashPreview entries={entries} />
        </div>
        <div
          style={{
            fontSize: 9,
            color: "#475569",
            marginTop: 4,
          }}
        >
          Auto-generated from entries ({entries.length}/256)
        </div>

        {/* Save */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {currentRkey && (
            <button
              className="spe-done-btn"
              disabled={!canSave || saving}
              onClick={handleSave}
              style={{ width: "100%" }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button
            className="spe-done-btn"
            disabled={!canSave || saving}
            onClick={currentRkey ? handleSaveNew : handleSave}
            style={{ width: "100%", ...(currentRkey ? { opacity: 0.75 } : {}) }}
          >
            {saving ? "Saving..." : currentRkey ? "Save as New" : "Save"}
          </button>
          {saveError && (
            <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm">
              {saveError}
            </div>
          )}
          {savedUri && (
            <div className="text-[11px] text-success px-2 py-1.5 bg-success/8 border border-success/20 rounded-sm">
              Saved
            </div>
          )}
        </div>
      </div>

      {/* ── Right pane: entries ── */}
      <div className="bae-targets">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className="ale-label">
            Entries ({entries.length})
          </div>
          <button className="ale-icon-btn" onClick={openBrowser} title="Add entries">
            +
          </button>
        </div>

        {entries.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              color: "#475569",
              fontSize: 11,
            }}
          >
            No entries yet. Click + to browse and add items.
          </div>
        )}

        {categoryOrder.map((cat) => {
          const catEntries = groupedEntries[cat];
          if (!catEntries || catEntries.length === 0) return null;
          return (
            <div key={cat} style={{ marginTop: 8 }}>
              <div
                style={{
                  fontFamily: "'Pixelify Sans', cursive",
                  fontSize: 7,
                  color: CATEGORY_COLORS[cat],
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                {CATEGORY_LABELS[cat]} ({catEntries.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {catEntries.map((entry) => {
                  const globalIdx = entries.indexOf(entry);
                  return (
                    <div
                      key={entry.uri}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        background: "var(--bg-panel)",
                        border: "2px solid var(--border-color)",
                        borderRadius: 2,
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          flexShrink: 0,
                          border: "2px solid var(--border-color)",
                          borderRadius: 2,
                          background: "var(--bg-deep)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <EntryPreview entry={entry} size={48} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.name}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: CATEGORY_COLORS[entry.category],
                            marginTop: 2,
                          }}
                        >
                          {entry.category}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <button
                          className="ale-icon-btn"
                          onClick={() => handleMoveEntry(globalIdx, -1)}
                          disabled={globalIdx === 0}
                          style={{
                            fontSize: 10,
                            padding: "1px 4px",
                            opacity: globalIdx === 0 ? 0.3 : 1,
                          }}
                          title="Move up"
                        >
                          &uarr;
                        </button>
                        <button
                          className="ale-icon-btn"
                          onClick={() => handleMoveEntry(globalIdx, 1)}
                          disabled={globalIdx === entries.length - 1}
                          style={{
                            fontSize: 10,
                            padding: "1px 4px",
                            opacity: globalIdx === entries.length - 1 ? 0.3 : 1,
                          }}
                          title="Move down"
                        >
                          &darr;
                        </button>
                        <button
                          className="ale-icon-btn ale-icon-btn--danger"
                          onClick={() => handleRemoveEntry(entry.uri)}
                          title="Remove"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Browser modal ── */}
      {showBrowser && (
        <div className="bae-overlay" onClick={() => setShowBrowser(false)}>
          <div
            className="bae-modal"
            style={{ width: 640, maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bae-modal-header">
              <span className="ale-label">Add Entries</span>
              <button
                className="ale-icon-btn"
                onClick={() => setShowBrowser(false)}
              >
                &times;
              </button>
            </div>
            <div className="bae-modal-body">
              <form
                onSubmit={handleLookup}
                style={{ display: "flex", gap: 8, marginBottom: 12 }}
              >
                <input
                  className="bae-input"
                  value={browseHandle}
                  onChange={(e) => setBrowseHandle(e.target.value)}
                  placeholder="handle or DID"
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="ale-icon-btn"
                  style={{ padding: "4px 12px", fontSize: 10 }}
                >
                  Lookup
                </button>
              </form>

              {browseActor && sessionPds && (
                <PDSBrowser
                  key={browseActor}
                  actor={browseActor}
                  pds={sessionPds}
                  allowedTypes={BROWSE_TYPES}
                  onSelectRecord={handleSelectRecord}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
