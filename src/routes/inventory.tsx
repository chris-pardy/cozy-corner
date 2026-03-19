import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { type BrowsableType } from "~/atproto/PDSBrowser";
import { ErrorAlert, LoadingMessage, PDSBrowserModal, getErrorMessage } from "~/routes/-ui";
import {
  type EnrichedInventoryEntry,
  addToInventory,
  removeFromInventory,
  categoryFromUri,
} from "~/atproto/inventory";
import { InventoryCategoryGrid } from "~/atproto/InventoryCategoryGrid";
import { useInventoryManagement } from "~/atproto/useInventoryManagement";
import { extractBlobCid, blobUrl, loadImage, parseAtUri } from "~/lib/at-protocol";
import type { AnimationLayer } from "~/atproto/generated/types/at/cozy-corner/defs";


export const Route = createFileRoute("/inventory")({
  component: InventoryPage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BROWSE_TYPES: BrowsableType[] = [
  "item",
  "wearable",
  "tileset",
  "base",
  "critter",
];

// ---------------------------------------------------------------------------
// InventoryPage
// ---------------------------------------------------------------------------

function InventoryPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  // Session data (populated once ready)
  const [sessionPds, setSessionPds] = useState<string | undefined>();
  const [sessionDid, setSessionDid] = useState<string | undefined>();
  const [sessionHandle, setSessionHandle] = useState<string | undefined>();

  // Inventory state via shared hook
  const { entries, loading, error, setEntries } = useInventoryManagement(
    ready ? sessionPds : null,
    ready ? sessionDid : null,
  );

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Removing
  const [removingUri, setRemovingUri] = useState<string | null>(null);

  // Browser modal
  const [showBrowser, setShowBrowser] = useState(false);

  // Auth check
  useEffect(() => {
    const raw = localStorage.getItem("session");
    if (!raw) {
      navigate({ to: "/login" });
    } else {
      const session = JSON.parse(raw);
      setSessionPds(session.pds);
      setSessionDid(session.did);
      setSessionHandle(session.handle);
      setReady(true);
    }
  }, [navigate]);

  // Remove entry
  const removeEntry = useCallback(
    async (entry: EnrichedInventoryEntry) => {
      const sessionRaw = localStorage.getItem("session");
      if (!sessionRaw) return;

      setRemovingUri(entry.uri);
      setSaveError(null);

      try {
        await removeFromInventory(entry.rkey);
        setEntries((prev) => prev.filter((e) => e.uri !== entry.uri));
      } catch (err) {
        setSaveError(getErrorMessage(err, "Remove failed"));
      } finally {
        setRemovingUri(null);
      }
    },
    [],
  );

  // Add entry from PDS browser
  const handleSelectRecord = useCallback(
    async (uri: string, _cid: string, value: Record<string, unknown>) => {
      if (entries.some((e) => e.subjectUri === uri)) return;

      const sessionRaw = localStorage.getItem("session");
      if (!sessionRaw) return;
      const session: { accessJwt: string; did: string; pds: string } =
        JSON.parse(sessionRaw);

      const parsed = parseAtUri(uri);
      if (!parsed) return;
      const { collection, did: subjectDid, rkey: subjectRkey } = parsed;
      const category = categoryFromUri(uri);
      if (!category) return;

      setSaving(true);
      setSaveError(null);

      try {
        // Fetch record CID
        let recordCid = "";
        try {
          const res = await fetch(
            `${session.pds}/xrpc/com.atproto.repo.getRecord?` +
              new URLSearchParams({ repo: subjectDid, collection, rkey: subjectRkey }).toString(),
          );
          if (res.ok) {
            const data = await res.json();
            recordCid = data.cid ?? "";
          }
        } catch {
          // Best effort
        }

        const { uri: invUri, rkey } = await addToInventory(
          { uri, cid: recordCid },
        );

        // Build enriched entry for local state
        const recordName =
          (value.name as string) ?? uri.split("/").pop() ?? "Unknown";
        const layers = (value.layers ?? []) as AnimationLayer[];
        const firstLayer = layers[0] ?? null;

        let previewImage: HTMLImageElement | null = null;
        const spriteSheet = value.spriteSheet as unknown;
        if (spriteSheet) {
          const cid = extractBlobCid(spriteSheet);
          if (cid) {
            try {
              previewImage = await loadImage(blobUrl(session.pds, subjectDid, cid));
            } catch {
              // Preview unavailable
            }
          }
        }

        const entry: EnrichedInventoryEntry = {
          uri: invUri,
          rkey,
          subjectUri: uri,
          subjectCid: recordCid,
          category,
          name: recordName,
          previewImage,
          layer: firstLayer,
        };

        setEntries((prev) => [...prev, entry]);
      } catch (err) {
        setSaveError(getErrorMessage(err, "Add failed"));
      } finally {
        setSaving(false);
      }
    },
    [entries],
  );

  // Browser helpers
  const openBrowser = useCallback(() => {
    setShowBrowser(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="min-h-screen font-body">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-sm text-accent-primary">Inventory</h1>
          <button
            onClick={openBrowser}
            disabled={saving}
            className="bg-accent-primary/10 border-2 border-accent-primary rounded-sm text-accent-primary cursor-pointer font-heading text-xs py-1.5 px-3 hover:bg-accent-primary/20 active:bg-accent-primary/30 disabled:opacity-50 disabled:cursor-default"
          >
            + Add
          </button>
        </div>

        {saveError && (
          <div className="mb-4">
            <ErrorAlert message={saveError} />
          </div>
        )}

        {loading && (
          <LoadingMessage message="Loading inventory..." />
        )}

        <ErrorAlert message={error} />

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-xs mb-4">
              Your inventory is empty.
            </p>
            <button
              onClick={openBrowser}
              className="bg-accent-primary/10 border-2 border-accent-primary rounded-sm text-accent-primary cursor-pointer font-heading text-xs py-2 px-5 hover:bg-accent-primary/20 active:bg-accent-primary/30"
            >
              + Add your first item
            </button>
          </div>
        )}

        {!loading && !error && (
          <InventoryCategoryGrid
            entries={entries}
            cardClassName="group"
            renderAction={(entry) => (
              <button
                onClick={() => removeEntry(entry)}
                disabled={saving || removingUri === entry.uri}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-error/60 hover:text-error text-xs cursor-pointer bg-transparent border-0 transition-opacity disabled:opacity-30"
                title="Remove from inventory"
              >
                &times;
              </button>
            )}
          />
        )}
      </div>

      {/* PDS Browser modal */}
      {showBrowser && sessionPds && (
        <PDSBrowserModal
          title="Add to Inventory"
          pds={sessionPds}
          allowedTypes={BROWSE_TYPES}
          defaultHandle={sessionHandle}
          onSelectRecord={handleSelectRecord}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  );
}
