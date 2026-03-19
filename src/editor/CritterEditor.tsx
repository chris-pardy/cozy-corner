import { useState, useCallback, useRef, useEffect } from "react";
import {
  SpritePixelEditor,
  type SpriteEditorResult,
} from "./SpritePixelEditor";
import { ScriptEditor, scriptSummary, newScript } from "./ScriptEditor";
import { StatePropertyEditor, type StatePropertyData } from "./StatePropertyEditor";
import { buildSpriteSheet } from "./build-spritesheet";
import {
  getSession,
  uploadBlob,
  saveRecord,
  parseAtUri,
} from "./load-record";
import { useEditorRecord, type EditorRecordData } from "./use-editor-record";
import { TargetPreview } from "./TargetPreview";
import type { StateProperty } from "~/atproto/generated/types/at/cozy-corner/defs";
import type { Script as ScriptModel } from "~/atproto/generated/types/at/cozy-corner/script";
import {
  RecordEditorProvider,
  createRecordEditorInitialState,
  useRecordDispatch,
  useRecordSelector,
  useRecordStore,
  setName,
  setDescription,
  addTag,
  removeTag,
  addTarget,
  removeTarget,
  addBehavior,
  removeBehavior,
  updateBehavior,
  setStateProperties,
} from "./store";
import "./editor.css";

type TargetSprite = SpriteEditorResult;

// ---------------------------------------------------------------------------
// CritterEditor
// ---------------------------------------------------------------------------

export function CritterEditor({ uri, editRkey }: { uri?: string; editRkey?: string }) {
  const { data, isLoading } = useEditorRecord(uri);
  if (isLoading) {
    return <div className="text-text-muted text-xs py-8 text-center">Loading...</div>;
  }
  return <CritterEditorForm key={uri} recordData={data} editRkey={editRkey} />;
}

function CritterEditorForm({ recordData, editRkey }: { recordData?: EditorRecordData; editRkey?: string }) {
  const v = recordData?.record.value;

  const initialState = createRecordEditorInitialState({
    name: (v?.name as string) ?? "",
    description: (v?.description as string) ?? "",
    tags: (v?.tags as string[]) ?? [],
    targets: recordData?.targets ?? [],
    behaviors: Array.isArray(v?.behaviors) ? v.behaviors as ScriptModel[] : [],
    stateProperties: Array.isArray(v?.stateProperties)
      ? (v.stateProperties as StateProperty[]).map((sp) => ({
          name: sp.name,
          type: sp.type,
          default: sp.default ?? "",
          allowOverride: sp.allowOverride ?? false,
        }))
      : [],
  });

  return (
    <RecordEditorProvider initialState={initialState}>
      <CritterEditorInner recordData={recordData} editRkey={editRkey} />
    </RecordEditorProvider>
  );
}

function CritterEditorInner({ recordData, editRkey }: { recordData?: EditorRecordData; editRkey?: string }) {
  const dispatch = useRecordDispatch();
  const store = useRecordStore();

  // Redux state
  const name = useRecordSelector((s) => s.editor.name);
  const description = useRecordSelector((s) => s.editor.description);
  const tags = useRecordSelector((s) => s.editor.tags);
  const targets = useRecordSelector((s) => s.editor.targets);
  const behaviors = useRecordSelector((s) => s.editor.behaviors);
  const stateProperties = useRecordSelector((s) => s.editor.stateProperties);

  // Local UI state
  const [tagInput, setTagInput] = useState("");
  const [targetSprites, setTargetSprites] = useState<
    Map<string, TargetSprite>
  >(() => recordData?.sprites ?? new Map());
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [addingTarget, setAddingTarget] = useState(false);
  const [newTargetInput, setNewTargetInput] = useState("");
  const newTargetRef = useRef<HTMLInputElement>(null);
  const [editingBehaviorIdx, setEditingBehaviorIdx] = useState<number | null>(null);

  // Save state
  const [currentRkey, setCurrentRkey] = useState(editRkey);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUri, setSavedUri] = useState<string | null>(null);

  const handleAddTarget = useCallback(
    (target: string) => {
      const trimmed = target.trim().toLowerCase().replace(/\s+/g, "-");
      if (!trimmed || targets.includes(trimmed)) return;
      dispatch(addTarget(trimmed));
      setAddingTarget(false);
      setNewTargetInput("");
      setEditingTarget(trimmed);
    },
    [targets, dispatch],
  );

  const handleRemoveTarget = useCallback(
    (target: string, e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(removeTarget(target));
      setTargetSprites((prev) => {
        const next = new Map(prev);
        next.delete(target);
        return next;
      });
      if (editingTarget === target) setEditingTarget(null);
    },
    [editingTarget, dispatch],
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

  const canSave =
    name.trim().length > 0 &&
    targets.length > 0 &&
    targets.some((t: string) => targetSprites.has(t));

  async function doSave(rkey?: string) {
    setSaving(true);
    setSaveError(null);

    try {
      const { editor } = store.getState();
      const session = getSession();
      const { blob, mimeType, layers } = await buildSpriteSheet(editor.targets, targetSprites);
      const blobRef = await uploadBlob(session, blob, mimeType);

      const statePropertyRecords = editor.stateProperties
        .filter((sp: StatePropertyData) => sp.name.trim())
        .map((sp: StatePropertyData) => ({
          $type: "at.cozy-corner.defs#stateProperty" as const,
          name: sp.name.trim(),
          type: sp.type,
          ...(sp.default ? { default: sp.default } : {}),
          ...(sp.allowOverride ? { allowOverride: true } : {}),
        }));

      const record = {
        $type: "at.cozy-corner.critter",
        name: editor.name.trim(),
        ...(editor.description.trim() ? { description: editor.description.trim() } : {}),
        ...(editor.tags.length > 0 ? { tags: editor.tags } : {}),
        spriteSheet: blobRef,
        layers,
        ...(editor.behaviors.length > 0 ? { behaviors: editor.behaviors } : {}),
        ...(statePropertyRecords.length > 0 ? { stateProperties: statePropertyRecords } : {}),
        createdAt: new Date().toISOString(),
      };

      const saved = await saveRecord(session, "at.cozy-corner.critter", record, rkey);
      setSavedUri(saved);
      if (!rkey) setCurrentRkey(parseAtUri(saved).rkey);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const handleSave = useCallback(() => doSave(currentRkey), [currentRkey, store, targetSprites]);
  const handleSaveNew = useCallback(() => doSave(undefined), [store, targetSprites]);

  // Focus the new-target input when it appears
  useEffect(() => {
    if (addingTarget && newTargetRef.current) {
      newTargetRef.current.focus();
    }
  }, [addingTarget]);

  return (
    <div className="bae-root">
      {/* Metadata pane */}
      <div className="bae-meta">
        <div className="ale-label">Name</div>
        <input
          className="bae-input"
          value={name}
          onChange={(e) => dispatch(setName(e.target.value))}
          placeholder="Critter name"
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
              <button
                className="bae-tag-remove"
                onClick={() => dispatch(removeTag(tag))}
              >
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

      {/* Targets pane */}
      <div className="bae-targets">
        <div className="ale-label">Animation Targets</div>
        <div className="bae-target-grid">
          {targets.map((target: string) => {
            const sprite = targetSprites.get(target);
            return (
              <button
                key={target}
                className="bae-target-card"
                onClick={() => setEditingTarget(target)}
              >
                <div className="bae-target-preview">
                  {sprite && <TargetPreview sprite={sprite} size={80} />}
                </div>
                <div className="bae-target-name">{target}</div>
                <button
                  className="ale-icon-btn ale-icon-btn--danger bae-target-delete"
                  onClick={(e) => handleRemoveTarget(target, e)}
                  title="Remove target"
                >
                  &times;
                </button>
              </button>
            );
          })}

          {/* Add target */}
          {addingTarget ? (
            <div className="bae-target-card bae-target-card--add-form">
              <input
                ref={newTargetRef}
                className="bae-input bae-add-target-input"
                value={newTargetInput}
                onChange={(e) => setNewTargetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTarget(newTargetInput);
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
                  onClick={() => handleAddTarget(newTargetInput)}
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
