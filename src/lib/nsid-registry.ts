// ---------------------------------------------------------------------------
// Centralized NSID (Namespace ID) metadata registry
// ---------------------------------------------------------------------------

/**
 * Per-NSID display metadata: human label and theme-aware color.
 */
export interface NsidMeta {
  label: string;
  color: string;
}

/**
 * Canonical config for every known collection NSID.
 *
 * Colors use CSS custom-property references so they adapt to the active theme.
 * The one exception is `critter` which uses a fixed purple (#a78bfa) that
 * doesn't yet have a theme variable.
 */
export const NSID_CONFIG: Record<string, NsidMeta> = {
  "at.cozy-corner.item": {
    label: "Item",
    color: "var(--accent-primary)",
  },
  "at.cozy-corner.avatar.base": {
    label: "Base Avatar",
    color: "var(--accent-tertiary)",
  },
  "at.cozy-corner.avatar.wearable": {
    label: "Wearable",
    color: "var(--accent-secondary)",
  },
  "at.cozy-corner.critter": {
    label: "Critter",
    color: "#a78bfa",
  },
  "at.cozy-corner.tileset": {
    label: "Tileset",
    color: "var(--clr-success)",
  },
  "at.cozy-corner.starterPack": {
    label: "Starter Pack",
    color: "var(--accent-tertiary)",
  },
  "at.cozy-corner.house.room": {
    label: "Room",
    color: "var(--accent-primary)",
  },
};

/**
 * Set of all NSIDs that are browsable / loadable from a PDS.
 */
export const KNOWN_NSIDS = new Set(Object.keys(NSID_CONFIG));

/**
 * Get the human-readable label for an NSID, falling back to the raw string.
 */
export function getNsidLabel(nsid: string): string {
  return NSID_CONFIG[nsid]?.label ?? nsid;
}

/**
 * Get the theme-aware CSS color for an NSID, with a sensible fallback.
 */
export function getNsidColor(nsid: string): string {
  return NSID_CONFIG[nsid]?.color ?? "var(--accent-primary)";
}
