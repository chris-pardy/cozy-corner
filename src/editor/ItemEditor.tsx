import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  SpritePixelEditor,
  type SpriteEditorResult,
} from "./SpritePixelEditor";
import { buildSpriteSheet } from "./build-spritesheet";
import type { Variant } from "~/atproto/generated/types/at/cozy-corner/item";
import type {
  StateProperty,
  StateValue,
} from "~/atproto/generated/types/at/cozy-corner/defs";
import {
  getSession,
  uploadBlob,
  saveRecord,
  parseAtUri,
} from "./load-record";
import { useEditorRecord, type EditorRecordData } from "./use-editor-record";
import {
  StatePropertyEditor,
  StateValueEditor,
  type StatePropertyData,
} from "./StatePropertyEditor";
import { TargetPreview } from "./TargetPreview";
import type { StateValueData } from "./editor-types";
import { ScriptEditor, scriptSummary, newScript } from "./ScriptEditor";
import type { Script as ScriptModel } from "~/atproto/generated/types/at/cozy-corner/script";
import { useDraft, DraftBanner, type DraftState, type UseDraftResult } from "./use-draft";
import {
  RecordEditorProvider,
  createRecordEditorInitialState,
  useRecordDispatch,
  useRecordSelector,
  useRecordStore,
  type VariantData,
  setName,
  setDescription,
  addTag,
  removeTag,
  addBehavior,
  removeBehavior,
  updateBehavior,
  setStateProperties,
  addVariant,
  removeVariant,
  updateVariant,
  updateVariantDimension,
} from "./store";
import "./editor.css";

type TargetSprite = SpriteEditorResult;

// Blocking bitmask constants
const BLOCK_PHYSICAL = 15; // N|E|S|W
const BLOCK_FULL = 255;    // physical + ephemeral

// ---------------------------------------------------------------------------
// BlockingGrid — visual grid for editing per-tile blockedEdges
// ---------------------------------------------------------------------------

function BlockingGrid({
  width,
  height,
  values,
  onChange,
}: {
  width: number;
  height: number;
  values: number[];
  onChange: (values: number[]) => void;
}) {
  const cycle = (idx: number) => {
    const next = [...values];
    const cur = next[idx] ?? 0;
    // Cycle: open → physical → full → open
    if (cur === 0) next[idx] = BLOCK_PHYSICAL;
    else if (cur === BLOCK_PHYSICAL) next[idx] = BLOCK_FULL;
    else next[idx] = 0;
    onChange(next);
  };

  return (
    <div
      className="ie-grid"
      style={{ gridTemplateColumns: `repeat(${width}, 24px)` }}
    >
      {Array.from({ length: width * height }, (_, i) => {
        const v = values[i] ?? 0;
        const cls =
          v >= BLOCK_FULL
            ? "ie-grid-cell ie-grid-cell--full"
            : v >= BLOCK_PHYSICAL
              ? "ie-grid-cell ie-grid-cell--physical"
              : "ie-grid-cell";
        return (
          <button
            key={i}
            className={cls}
            onClick={() => cycle(i)}
            title={
              v >= BLOCK_FULL
                ? "Fully blocked"
                : v >= BLOCK_PHYSICAL
                  ? "Movement blocked"
                  : "Open"
            }
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariantCard — editable variant in the sidebar
// ---------------------------------------------------------------------------

function VariantCard({
  variant,
  allTargets,
  stateProperties,
  onChange,
  onChangeDimension,
  onRemove,
}: {
  variant: VariantData;
  allTargets: string[];
  stateProperties: StatePropertyData[];
  onChange: (patch: Partial<VariantData>) => void;
  onChangeDimension: (key: "itemWidth" | "itemHeight", value: number) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  // Target input: dropdown when targets exist, free text otherwise
  const targetInput = (value: string, onChangeVal: (v: string) => void, placeholder: string) =>
    allTargets.length > 0 ? (
      <select
        className="ale-num-input"
        value={value}
        onChange={(e) => onChangeVal(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {allTargets.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    ) : (
      <input
        className="ale-num-input"
        value={value}
        onChange={(e) => onChangeVal(e.target.value.trim().toLowerCase().replace(/\s+/g, "-"))}
        placeholder={placeholder}
      />
    );

  const getStateValue = (propName: string) =>
    variant.state.find((s) => s.name === propName)?.value ?? "";

  const setStateValue = (propName: string, value: string) => {
    const existing = variant.state.filter((s) => s.name !== propName);
    onChange({ state: [...existing, { name: propName, value }] });
  };

  return (
    <div className="ie-variant-card">
      <div className="ie-variant-header">
        <button
          className="ie-expand-btn"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "\u25BC" : "\u25B6"}
        </button>
        <input
          className="bae-input ie-variant-name-input"
          value={variant.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Variant name"
          maxLength={64}
        />
        <button
          className="ale-icon-btn ale-icon-btn--danger"
          onClick={onRemove}
          title="Remove variant"
        >
          &times;
        </button>
      </div>

      {expanded && (
        <div className="ie-variant-fields">
          {/* Target */}
          <div className="ale-field">
            <span className="ale-field-label">Target</span>
            {targetInput(variant.target, (v) => onChange({ target: v }), "Select...")}
          </div>

          {/* Dimensions */}
          <div className="ie-variant-row">
            <div className="ale-field">
              <span className="ale-field-label">W</span>
              <input
                className="ale-num-input"
                type="number"
                value={variant.itemWidth}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1 && v <= 8) onChangeDimension("itemWidth", v);
                }}
                min={1}
                max={8}
              />
              <span className="ale-field-unit">tiles</span>
            </div>
            <div className="ale-field">
              <span className="ale-field-label">H</span>
              <input
                className="ale-num-input"
                type="number"
                value={variant.itemHeight}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1 && v <= 8) onChangeDimension("itemHeight", v);
                }}
                min={1}
                max={8}
              />
              <span className="ale-field-unit">tiles</span>
            </div>
          </div>

          {/* Blocking */}
          <div className="ie-grid-section">
            <span className="ale-field-label">Blocking</span>
            <BlockingGrid
              width={variant.itemWidth}
              height={variant.itemHeight}
              values={variant.blockedEdges}
              onChange={(v) => onChange({ blockedEdges: v })}
            />
            <div className="ie-grid-legend">
              <span className="ie-legend-item"><span className="ie-legend-swatch ie-legend--open" /> open</span>
              <span className="ie-legend-item"><span className="ie-legend-swatch ie-legend--physical" /> move</span>
              <span className="ie-legend-item"><span className="ie-legend-swatch ie-legend--full" /> full</span>
            </div>
          </div>

          {/* Variant state overrides */}
          {stateProperties.length > 0 && (
            <div className="ie-grid-section">
              <span className="ale-field-label">State</span>
              {stateProperties.map((prop) => (
                <StateValueEditor
                  key={prop.name}
                  property={prop}
                  value={getStateValue(prop.name)}
                  onChange={(v) => setStateValue(prop.name, v)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ItemEditor (wrapper — handles loading via React Query)
// ---------------------------------------------------------------------------

export function ItemEditor({ uri, editRkey, draftKey }: { uri?: string; editRkey?: string; draftKey?: string }) {
  const { data, isLoading } = useEditorRecord(uri);
  const draft = useDraft(draftKey);
  const [draftData, setDraftData] = useState<DraftState | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [resuming, setResuming] = useState(false);

  if (isLoading || draft.isLoading) {
    return <div className="text-text-muted text-xs py-8 text-center">Loading...</div>;
  }

  if (draft.pendingDraft && !draftData && !draftDismissed) {
    return (
      <DraftBanner
        updatedAt={draft.pendingDraft.updatedAt}
        label={draft.pendingDraft.label}
        resuming={resuming}
        onResume={async () => {
          setResuming(true);
          try {
            const d = await draft.acceptDraft();
            setDraftData(d);
          } finally {
            setResuming(false);
          }
        }}
        onDiscard={() => {
          draft.discardDraft();
          setDraftDismissed(true);
        }}
      />
    );
  }

  return (
    <ItemEditorForm
      key={draftData ? "draft" : uri}
      recordData={draftData ? undefined : data}
      draftData={draftData}
      editRkey={editRkey}
      draft={draft}
    />
  );
}

// ---------------------------------------------------------------------------
// ItemEditorForm (creates Provider with initial state)
// ---------------------------------------------------------------------------

function ItemEditorForm({ recordData, draftData, editRkey, draft }: {
  recordData?: EditorRecordData;
  draftData?: DraftState | null;
  editRkey?: string;
  draft?: UseDraftResult;
}) {
  const ds = draftData?.state;
  const v = recordData?.record.value;

  const [initialState] = useState(() => {
    // Build variant overrides from draft or record
    let variantOverrides: VariantData[] = [];
    let nextId = 1;

    if (Array.isArray(ds?.variants)) {
      const restored = ds.variants as VariantData[];
      const maxId = Math.max(0, ...restored.map((rv) => rv.id));
      nextId = maxId + 1;
      variantOverrides = restored;
    } else if (Array.isArray(v?.variants)) {
      let id = 1;
      variantOverrides = (v.variants as Variant[]).map((vr) => ({
        id: id++,
        name: vr.name ?? "",
        target: vr.target ?? "",
        itemWidth: vr.itemWidth ?? 1,
        itemHeight: vr.itemHeight ?? 1,
        blockedEdges: vr.blockedEdges ?? [0],
        state: (vr.state ?? []).map((sv: StateValue) => ({
          name: sv.name,
          value: sv.value ?? "",
        })),
      }));
      nextId = id;
    }

    // Build state properties from draft or record
    let statePropertiesInit: StatePropertyData[] = [];
    const spSrc = (ds?.stateProperties as StatePropertyData[]) ?? (Array.isArray(v?.stateProperties) ? v.stateProperties : null);
    if (Array.isArray(spSrc)) {
      statePropertiesInit = (spSrc as StateProperty[]).map((sp) => ({
        name: sp.name,
        type: sp.type,
        default: sp.default ?? "",
        allowOverride: sp.allowOverride ?? false,
      }));
    }

    // Build behaviors from draft or record
    const behaviorsSrc = (ds?.behaviors as ScriptModel[]) ?? (Array.isArray(v?.behaviors) ? v.behaviors : null);
    const behaviorsInit: ScriptModel[] = Array.isArray(behaviorsSrc) ? behaviorsSrc : [];

    return createRecordEditorInitialState({
      name: (ds?.name as string) ?? (v?.name as string) ?? "",
      description: (ds?.description as string) ?? (v?.description as string) ?? "",
      tags: (ds?.tags as string[]) ?? (v?.tags as string[]) ?? [],
      stateProperties: statePropertiesInit,
      behaviors: behaviorsInit,
      variants: variantOverrides,
      nextVariantId: nextId,
    });
  });

  return (
    <RecordEditorProvider initialState={initialState}>
      <ItemEditorInner
        recordData={recordData}
        draftData={draftData}
        editRkey={editRkey}
        draft={draft}
      />
    </RecordEditorProvider>
  );
}

// ---------------------------------------------------------------------------
// ItemEditorInner (uses Redux hooks)
// ---------------------------------------------------------------------------

function ItemEditorInner({ recordData, draftData, editRkey, draft }: {
  recordData?: EditorRecordData;
  draftData?: DraftState | null;
  editRkey?: string;
  draft?: UseDraftResult;
}) {
  const dispatch = useRecordDispatch();
  const store = useRecordStore();

  const name = useRecordSelector((s) => s.editor.name);
  const description = useRecordSelector((s) => s.editor.description);
  const tags = useRecordSelector((s) => s.editor.tags);
  const stateProperties = useRecordSelector((s) => s.editor.stateProperties);
  const behaviors = useRecordSelector((s) => s.editor.behaviors);
  const variants = useRecordSelector((s) => s.editor.variants);

  // Transient UI state (stays local)
  const [tagInput, setTagInput] = useState("");
  const [editingBehaviorIdx, setEditingBehaviorIdx] = useState<number | null>(null);

  // Per-target sprite data (non-serializable, stays local)
  const [targetSprites, setTargetSprites] = useState<Map<string, TargetSprite>>(
    () => draftData?.sprites ?? recordData?.sprites ?? new Map(),
  );

  // Which target the sprite editor is currently editing (null = closed)
  const [editingTarget, setEditingTarget] = useState<string | null>(null);

  // Adding a new target manually
  const [addingTarget, setAddingTarget] = useState(false);
  const [newTargetInput, setNewTargetInput] = useState("");

  // Collect all unique, non-empty target names from variants
  const allTargets = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of variants) {
      if (v.target && !seen.has(v.target)) {
        seen.add(v.target);
        out.push(v.target);
      }
    }
    // Also include any targets that have sprites but aren't currently referenced
    for (const t of targetSprites.keys()) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  }, [variants, targetSprites]);

  // ── Target operations ──

  const addTargetLocal = useCallback(
    (target: string) => {
      const trimmed = target.trim().toLowerCase().replace(/\s+/g, "-");
      if (!trimmed || allTargets.includes(trimmed)) return;
      // Create an empty sprite entry so it shows up in the grid
      setTargetSprites((prev) => new Map(prev));
      setAddingTarget(false);
      setNewTargetInput("");
      setEditingTarget(trimmed);
    },
    [allTargets],
  );

  const handleSpriteEditorDone = useCallback(
    (result: SpriteEditorResult) => {
      if (!editingTarget) return;
      setTargetSprites((prev) => {
        const next = new Map(prev);
        next.set(editingTarget, result);
        return next;
      });
      setEditingTarget(null);
    },
    [editingTarget],
  );

  // ── Tags ──

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && tagInput.trim()) {
        e.preventDefault();
        const tag = tagInput.trim();
        dispatch(addTag(tag));
        setTagInput("");
      }
    },
    [tagInput, dispatch],
  );

  // ── Save ──

  const [currentRkey, setCurrentRkey] = useState(editRkey);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUri, setSavedUri] = useState<string | null>(null);

  const canSave =
    name.trim().length > 0 &&
    variants.length > 0 &&
    variants.every((v: VariantData) => v.name.trim() && v.target) &&
    variants.some((v: VariantData) => targetSprites.has(v.target));

  // ── Auto-save draft ──

  useEffect(() => {
    const { name, description, tags, stateProperties, behaviors, variants } = store.getState().editor;
    draft?.saveDraft(
      { name, description, tags, stateProperties, behaviors, variants },
      targetSprites,
      name || "Untitled Item",
    );
  }, [name, description, tags, stateProperties, behaviors, variants, targetSprites, draft, store]);

  async function doSave(rkey?: string) {
    setSaving(true);
    setSaveError(null);

    // Flush any pending draft save before attempting PDS save
    await draft?.flushDraft();

    try {
      const session = getSession();
      const { name, description, tags, stateProperties, behaviors, variants } = store.getState().editor;

      // Only pack targets that have sprites
      const targetsWithSprites = allTargets.filter((t) => targetSprites.has(t));
      const { blob, mimeType, layers } = await buildSpriteSheet(
        targetsWithSprites,
        targetSprites,
      );
      const blobRef = await uploadBlob(session, blob, mimeType);

      // Build variant records
      const variantRecords: Variant[] = variants.map((v: VariantData) => {
        const hasBlocking = v.blockedEdges.some((b: number) => b !== 0);
        const stateValues = v.state.filter((s: StateValueData) => s.value !== "");
        return {
          $type: "at.cozy-corner.item#variant" as const,
          name: v.name.trim(),
          target: v.target,
          ...(v.itemWidth > 1 ? { itemWidth: v.itemWidth } : {}),
          ...(v.itemHeight > 1 ? { itemHeight: v.itemHeight } : {}),
          ...(hasBlocking ? { blockedEdges: v.blockedEdges } : {}),
          ...(stateValues.length > 0
            ? {
                state: stateValues.map((sv: StateValueData) => ({
                  $type: "at.cozy-corner.defs#stateValue" as const,
                  name: sv.name,
                  value: sv.value,
                })),
              }
            : {}),
        };
      });

      // Build state property records
      const statePropertyRecords = stateProperties
        .filter((sp: StatePropertyData) => sp.name.trim())
        .map((sp: StatePropertyData) => ({
          $type: "at.cozy-corner.defs#stateProperty" as const,
          name: sp.name.trim(),
          type: sp.type,
          ...(sp.default ? { default: sp.default } : {}),
          ...(sp.allowOverride ? { allowOverride: true } : {}),
        }));

      const record = {
        $type: "at.cozy-corner.item",
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(tags.length > 0 ? { tags } : {}),
        spriteSheet: blobRef,
        layers,
        variants: variantRecords,
        ...(statePropertyRecords.length > 0
          ? { stateProperties: statePropertyRecords }
          : {}),
        ...(behaviors.length > 0 ? { behaviors } : {}),
        createdAt: new Date().toISOString(),
      };

      const saved = await saveRecord(session, "at.cozy-corner.item", record, rkey);
      setSavedUri(saved);
      if (!rkey) setCurrentRkey(parseAtUri(saved).rkey);
      draft?.clearDraft();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = useCallback(() => doSave(currentRkey), [name, description, tags, variants, stateProperties, behaviors, allTargets, targetSprites, currentRkey]);
  const handleSaveNew = useCallback(() => doSave(undefined), [name, description, tags, variants, stateProperties, behaviors, allTargets, targetSprites]);

  // Focus new target input
  const newTargetRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (addingTarget && newTargetRef.current) {
      newTargetRef.current.focus();
    }
  }, [addingTarget]);

  return (
    <div className="ie-root">
      {/* ── Left: Metadata + State Properties + Variants ── */}
      <div className="ie-meta">
        <div className="ale-label">Name</div>
        <input
          className="bae-input"
          value={name}
          onChange={(e) => dispatch(setName(e.target.value))}
          placeholder="Item name"
          maxLength={64}
        />

        <div className="ale-label" style={{ marginTop: 12 }}>
          Description
        </div>
        <textarea
          className="bae-textarea"
          value={description}
          onChange={(e) => dispatch(setDescription(e.target.value))}
          placeholder="Optional description..."
          maxLength={256}
          rows={3}
        />

        <div className="ale-label" style={{ marginTop: 12 }}>
          Tags
        </div>
        <div className="bae-tags">
          {tags.map((tag: string) => (
            <span key={tag} className="bae-tag">
              {tag}
              <button className="bae-tag-remove" onClick={() => dispatch(removeTag(tag))}>
                &times;
              </button>
            </span>
          ))}
          <input
            className="bae-tag-input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={tags.length ? "" : "Add tags..."}
          />
        </div>

        {/* State Properties */}
        <StatePropertyEditor
          properties={stateProperties}
          onChange={(props) => dispatch(setStateProperties(props))}
        />

        {/* Behaviors */}
        <div className="ale-layer-header" style={{ marginTop: 16 }}>
          <span className="ale-label">Behaviors</span>
          <button className="ale-icon-btn" onClick={() => { dispatch(addBehavior(newScript())); setEditingBehaviorIdx(behaviors.length); }} title="Add behavior">+</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {behaviors.map((b: ScriptModel, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", background: "var(--bg-panel)", border: "2px solid var(--border-color)", borderRadius: 2 }}>
              <button onClick={() => setEditingBehaviorIdx(i)} style={{ flex: 1, textAlign: "left", fontSize: 9, color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <span style={{ color: "var(--accent-primary)" }}>{b.name || "Unnamed"}</span>{" "}
                <span style={{ color: "var(--text-muted)" }}>{scriptSummary(b)}</span>
              </button>
              <button onClick={() => dispatch(removeBehavior(i))} style={{ fontSize: 10, background: "none", border: "none", color: "var(--clr-error)", cursor: "pointer" }}>&times;</button>
            </div>
          ))}
          {behaviors.length === 0 && (
            <div className="ie-empty-hint">No behaviors</div>
          )}
        </div>

        {/* Variants */}
        <div className="ale-layer-header" style={{ marginTop: 16 }}>
          <span className="ale-label">Variants</span>
          <button className="ale-icon-btn" onClick={() => dispatch(addVariant())} title="Add variant">
            +
          </button>
        </div>

        <div className="ie-variant-list">
          {variants.map((v: VariantData) => (
            <VariantCard
              key={v.id}
              variant={v}
              allTargets={allTargets}
              stateProperties={stateProperties}
              onChange={(patch) => dispatch(updateVariant({ id: v.id, patch }))}
              onChangeDimension={(key, value) => dispatch(updateVariantDimension({ id: v.id, key, value }))}
              onRemove={() => dispatch(removeVariant(v.id))}
            />
          ))}
          {variants.length === 0 && (
            <div className="ie-empty-hint">
              Add a variant to get started
            </div>
          )}
        </div>

        {/* Save */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
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

      {/* ── Right: Animation Targets ── */}
      <div className="bae-targets">
        <div className="ale-label">Animation Targets</div>
        <div className="bae-target-grid">
          {allTargets.map((target) => {
            const sprite = targetSprites.get(target);
            const isVariantTarget = variants.some((v: VariantData) => v.target === target);
            return (
              <button
                key={target}
                className="bae-target-card"
                onClick={() => setEditingTarget(target)}
              >
                <div className="bae-target-preview">
                  {sprite && <TargetPreview sprite={sprite} size={80} checkerboardScale={Math.max(1, Math.floor(80 / 8))} />}
                </div>
                <div className="bae-target-name">{target}</div>
                <div className="ie-target-usage">
                  {isVariantTarget && <span className="ie-usage-tag">variant</span>}
                </div>
              </button>
            );
          })}

          {/* Add target (for targets not derived from variants) */}
          {addingTarget ? (
            <div className="bae-target-card bae-target-card--add-form">
              <input
                ref={newTargetRef}
                className="bae-input bae-add-target-input"
                value={newTargetInput}
                onChange={(e) => setNewTargetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTargetLocal(newTargetInput);
                  if (e.key === "Escape") {
                    setAddingTarget(false);
                    setNewTargetInput("");
                  }
                }}
                placeholder="target-name"
              />
              <div className="bae-add-actions">
                <button
                  className="ale-icon-btn"
                  onClick={() => addTargetLocal(newTargetInput)}
                >
                  Add
                </button>
                <button
                  className="ale-icon-btn"
                  onClick={() => {
                    setAddingTarget(false);
                    setNewTargetInput("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="bae-target-card bae-target-card--add"
              onClick={() => setAddingTarget(true)}
            >
              <span className="bae-add-icon">+</span>
              <span className="bae-target-name">Add Target</span>
            </button>
          )}
        </div>
      </div>

      {/* Sprite Pixel Editor modal */}
      {editingTarget && (
        <div className="bae-overlay bae-overlay--sprite-editor">
          <div
            className="bae-modal bae-modal--sprite-editor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bae-modal-header">
              <span className="ale-label">{editingTarget}</span>
            </div>
            <div className="bae-modal-body">
              <SpritePixelEditor
                key={editingTarget}
                initial={targetSprites.get(editingTarget)}
                onDone={handleSpriteEditorDone}
                onCancel={() => setEditingTarget(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Behavior Editor modal */}
      {editingBehaviorIdx != null && behaviors[editingBehaviorIdx] && (
        <div className="bae-overlay" onClick={() => setEditingBehaviorIdx(null)}>
          <div
            className="bae-modal"
            style={{ maxWidth: 800, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bae-modal-header">
              <span className="ale-label">{behaviors[editingBehaviorIdx].name || "Behavior"}</span>
              <button
                className="ale-icon-btn"
                onClick={() => setEditingBehaviorIdx(null)}
              >
                &times;
              </button>
            </div>
            <div className="bae-modal-body">
              <ScriptEditor
                script={behaviors[editingBehaviorIdx]}
                onChange={(updated) => dispatch(updateBehavior({ idx: editingBehaviorIdx, script: updated }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
