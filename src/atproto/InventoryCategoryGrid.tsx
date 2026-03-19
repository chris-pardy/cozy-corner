import { type ReactNode } from "react";
import {
  type EnrichedInventoryEntry,
  groupByCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  EntryPreview,
} from "~/atproto/inventory";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InventoryCategoryGridProps {
  entries: EnrichedInventoryEntry[];

  /**
   * Optional render function for the name/label area of each entry card.
   * When provided, replaces the default name + category badge.
   * Receives the entry so the consumer can wrap the name in a Link, etc.
   */
  renderLabel?: (entry: EnrichedInventoryEntry) => ReactNode;

  /**
   * Optional render function for the trailing action area of each entry card.
   * Use this for remove buttons, add/remove toggles, etc.
   */
  renderAction?: (entry: EnrichedInventoryEntry) => ReactNode;

  /**
   * Extra className applied to the outer card div (per entry).
   * Useful for adding `group` for hover-based action reveals.
   */
  cardClassName?: string;

  /**
   * Margin-bottom class for each category section. Defaults to "mb-6".
   */
  sectionClassName?: string;

  /**
   * Margin-bottom class for the category heading. Defaults to "mb-3".
   */
  headingClassName?: string;
}

// ---------------------------------------------------------------------------
// Default label renderer
// ---------------------------------------------------------------------------

function DefaultLabel({ entry }: { entry: EnrichedInventoryEntry }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] text-text-primary truncate">{entry.name}</div>
      <div
        className="text-[8px] mt-0.5"
        style={{ color: CATEGORY_COLORS[entry.category] }}
      >
        {entry.category}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InventoryCategoryGrid
// ---------------------------------------------------------------------------

export function InventoryCategoryGrid({
  entries,
  renderLabel,
  renderAction,
  cardClassName = "",
  sectionClassName = "mb-6",
  headingClassName = "mb-3",
}: InventoryCategoryGridProps) {
  const grouped = groupByCategory(entries);

  return (
    <>
      {CATEGORY_ORDER.map((cat) => {
        const catEntries = grouped[cat];
        if (!catEntries || catEntries.length === 0) return null;
        return (
          <div key={cat} className={sectionClassName}>
            <div
              className={`font-heading text-[10px] uppercase tracking-wide ${headingClassName}`}
              style={{ color: CATEGORY_COLORS[cat] }}
            >
              {CATEGORY_LABELS[cat]} ({catEntries.length})
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
              {catEntries.map((entry) => (
                <div
                  key={entry.uri ?? entry.subjectUri}
                  className={`flex items-center gap-3 p-2 bg-bg-panel border-2 border-border rounded-sm hover:border-border-hover transition-colors ${cardClassName}`}
                >
                  <div className="w-12 h-12 shrink-0 border-2 border-border rounded-sm bg-bg-deep flex items-center justify-center overflow-hidden">
                    <EntryPreview entry={entry} size={48} />
                  </div>

                  {renderLabel ? (
                    renderLabel(entry)
                  ) : (
                    <DefaultLabel entry={entry} />
                  )}

                  {renderAction?.(entry)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
