import { useState, useEffect } from "react";
import {
  type EnrichedInventoryEntry,
  listInventory,
  enrichInventoryEntries,
} from "~/atproto/inventory";
import { getErrorMessage } from "~/routes/-ui";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseInventoryManagementResult {
  entries: EnrichedInventoryEntry[];
  loading: boolean;
  error: string | null;
  /** Replace the entries array (e.g. after adding/removing entries locally). */
  setEntries: React.Dispatch<React.SetStateAction<EnrichedInventoryEntry[]>>;
}

/**
 * Loads and enriches inventory entries for a given PDS + DID.
 *
 * Handles the full lifecycle: loading state, error handling, cancellation on
 * unmount, and exposes setEntries so the caller can optimistically update the
 * list after add/remove operations.
 */
export function useInventoryManagement(
  pds: string | null | undefined,
  did: string | null | undefined,
): UseInventoryManagementResult {
  const [entries, setEntries] = useState<EnrichedInventoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pds || !did) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const records = await listInventory(pds!, did!);
        const enriched = await enrichInventoryEntries(pds!, records);

        if (!cancelled) {
          setEntries(enriched);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Failed to load inventory"));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pds, did]);

  return { entries, loading, error, setEntries };
}
