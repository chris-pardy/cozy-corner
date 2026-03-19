import { useState } from "react";
import {
  InventoryPicker,
  type StrongRef,
} from "~/atproto/InventoryPicker";
import { PDSBrowser, type BrowsableType } from "~/atproto/PDSBrowser";
import type { InventoryCategory } from "~/atproto/inventory";
import { getSession } from "./load-record";

// ---------------------------------------------------------------------------
// Category ↔ BrowsableType mapping
// ---------------------------------------------------------------------------

const CATEGORY_TO_BROWSE: Record<InventoryCategory, BrowsableType> = {
  item: "item",
  wearable: "wearable",
  tileset: "tileset",
  baseAvatar: "base",
  critter: "critter",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RefPickerProps {
  /** Modal title. */
  title: string;
  /** Which inventory categories to show. */
  categories: InventoryCategory[];
  /** Called when the user selects a record. `value` is present when selected from
   *  the PDS browser (avoids a redundant fetch). */
  onSelect: (ref: StrongRef, value?: Record<string, unknown>) => void;
  /** Called when the modal is dismissed. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// RefPicker
// ---------------------------------------------------------------------------

export function RefPicker({ title, categories, onSelect, onClose }: RefPickerProps) {
  const [tab, setTab] = useState<"inventory" | "browse">("inventory");
  const session = getSession();
  const [browseHandle, setBrowseHandle] = useState(session.handle);
  const [handleInput, setHandleInput] = useState("");

  const browseTypes = categories.map((c) => CATEGORY_TO_BROWSE[c]);

  return (
    <div className="bae-overlay" onClick={onClose}>
      <div
        className="bae-modal"
        style={{ maxWidth: 680, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bae-modal-header">
          <span className="ale-label">{title}</span>
          <button className="ale-icon-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "8px 12px 0" }}>
          <button
            className={`spe-toggle-btn${tab === "inventory" ? " spe-toggle-btn--active" : ""}`}
            onClick={() => setTab("inventory")}
          >
            Inventory
          </button>
          <button
            className={`spe-toggle-btn${tab === "browse" ? " spe-toggle-btn--active" : ""}`}
            onClick={() => setTab("browse")}
          >
            Browse PDS
          </button>
        </div>

        <div className="bae-modal-body" style={{ padding: 12 }}>
          {tab === "inventory" ? (
            <InventoryPicker
              pds={session.pds}
              did={session.did}
              categories={categories}
              onSelect={(ref) => onSelect(ref)}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {/* Handle input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const h = handleInput.trim();
                  if (h) setBrowseHandle(h);
                }}
                className="flex items-center gap-2"
              >
                <input
                  className="bae-input"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder={browseHandle}
                  style={{ flex: 1, fontSize: 11 }}
                />
                <button
                  type="submit"
                  className="spe-toggle-btn"
                  style={{ whiteSpace: "nowrap" }}
                >
                  Lookup
                </button>
              </form>

              <PDSBrowser
                key={browseHandle}
                actor={browseHandle}
                pds={session.pds}
                allowedTypes={browseTypes}
                onSelectRecord={(uri, cid, value) =>
                  onSelect({ uri, cid }, value)
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export StrongRef for convenience
export type { StrongRef };
