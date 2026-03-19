import { useState, useEffect, useMemo } from "react";
import {
  type InventoryCategory,
  type EnrichedInventoryEntry,
  listInventory,
  enrichInventoryEntries,
  categoryFromUri,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  EntryPreview,
} from "~/atproto/inventory";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StrongRef {
  uri: string;
  cid: string;
}

export interface InventoryPickerProps {
  /** PDS URL for XRPC calls. */
  pds: string;
  /** DID of the user whose inventory to browse. */
  did: string;
  /** Which categories to show. If omitted, shows all. */
  categories?: InventoryCategory[];
  /** Called when the user clicks an entry. */
  onSelect: (ref: StrongRef) => void;
}

// ---------------------------------------------------------------------------
// InventoryPicker
// ---------------------------------------------------------------------------

export function InventoryPicker({
  pds,
  did,
  categories,
  onSelect,
}: InventoryPickerProps) {
  const allowedCategories = categories ?? CATEGORY_ORDER;
  const [entries, setEntries] = useState<EnrichedInventoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const records = await listInventory(pds, did);

        // Filter to allowed categories before doing network work
        const filtered = records.filter((rec) => {
          const cat = categoryFromUri(rec.subject.uri);
          return cat !== null && allowedCategories.includes(cat);
        });

        const enriched = await enrichInventoryEntries(pds, filtered);

        if (!cancelled) {
          setEntries(enriched);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load inventory",
          );
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pds, did, allowedCategories]);

  // Group by category
  const grouped = useMemo(() => {
    const acc: Partial<Record<InventoryCategory, EnrichedInventoryEntry[]>> = {};
    for (const entry of entries) {
      const list = acc[entry.category] ?? (acc[entry.category] = []);
      list.push(entry);
    }
    return acc;
  }, [entries]);

  if (loading) {
    return (
      <div className="text-text-muted text-xs py-4 text-center">
        Loading inventory...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm">
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-text-muted text-xs py-4 text-center">
        No matching items in inventory.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {allowedCategories.map((cat) => {
        const catEntries = grouped[cat];
        if (!catEntries || catEntries.length === 0) return null;
        return (
          <div key={cat}>
            <div
              className="font-heading text-[10px] uppercase tracking-wide mb-2"
              style={{ color: CATEGORY_COLORS[cat] }}
            >
              {CATEGORY_LABELS[cat]} ({catEntries.length})
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
              {catEntries.map((entry) => (
                <button
                  key={entry.uri}
                  onClick={() =>
                    onSelect({
                      uri: entry.subjectUri,
                      cid: entry.subjectCid,
                    })
                  }
                  className="flex items-center gap-3 p-2 bg-bg-panel border-2 border-border rounded-sm hover:border-accent-primary cursor-pointer transition-colors text-left"
                >
                  <div className="w-12 h-12 shrink-0 border-2 border-border rounded-sm bg-bg-deep flex items-center justify-center overflow-hidden">
                    <EntryPreview entry={entry} size={48} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-text-primary truncate">
                      {entry.name}
                    </div>
                    <div
                      className="text-[8px] mt-0.5"
                      style={{ color: CATEGORY_COLORS[entry.category] }}
                    >
                      {entry.category}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
