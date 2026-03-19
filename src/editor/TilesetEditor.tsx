import { useState, useCallback } from "react";
import {
  SpritePixelEditor,
  type SpriteEditorResult,
} from "./SpritePixelEditor";
import { buildSpriteSheet } from "./build-spritesheet";
import {
  getSession,
  uploadBlob,
  saveRecord,
  parseAtUri,
} from "./load-record";
import { useEditorRecord, type EditorRecordData } from "./use-editor-record";
import { TargetPreview } from "./TargetPreview";
import {
  RecordEditorProvider,
  createRecordEditorInitialState,
  useRecordDispatch,
  useRecordSelector,
  useRecordStore,
  type TileData,
  setName,
  setDescription,
  addTag,
  removeTag,
  addTile,
  removeTile,
  updateTile,
} from "./store";
import "./editor.css";

type TargetSprite = SpriteEditorResult;

function deriveTarget(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

// ---------------------------------------------------------------------------
// TilesetEditor
// ---------------------------------------------------------------------------

export function TilesetEditor({ uri, editRkey }: { uri?: string; editRkey?: string }) {
  const { data, isLoading } = useEditorRecord(uri);
  if (isLoading) {
    return <div className="text-text-muted text-xs py-8 text-center">Loading...</div>;
  }
  return <TilesetEditorForm key={uri} recordData={data} editRkey={editRkey} />;
}

function TilesetEditorForm({ recordData, editRkey }: { recordData?: EditorRecordData; editRkey?: string }) {
  const v = recordData?.record.value;

  const [{ initialState, initialSprites }] = useState(() => {
    if (!v?.tiles || !recordData) {
      return {
        initialState: createRecordEditorInitialState(),
        initialSprites: new Map<string, SpriteEditorResult>(),
      };
    }
    const tileRecords = (v.tiles as { name: string; target: string; wall?: boolean }[]);
    const loadedTiles: TileData[] = [];
    const loadedSprites = new Map<string, SpriteEditorResult>();
    let maxId = 0;
    for (let i = 0; i < tileRecords.length; i++) {
      const tr = tileRecords[i];
      const id = i + 1;
      if (id > maxId) maxId = id;
      loadedTiles.push({ id, name: tr.name, wall: !!tr.wall });
      const sprite = recordData.sprites.get(tr.target);
      if (sprite) loadedSprites.set(String(id), sprite);
    }
    return {
      initialState: createRecordEditorInitialState({
        name: (v.name as string) ?? "",
        description: (v.description as string) ?? "",
        tags: (v.tags as string[]) ?? [],
        tiles: loadedTiles,
        nextTileId: maxId + 1,
      }),
      initialSprites: loadedSprites,
    };
  });

  return (
    <RecordEditorProvider initialState={initialState}>
      <TilesetEditorInner
        editRkey={editRkey}
        initialSprites={initialSprites}
      />
    </RecordEditorProvider>
  );
}

function TilesetEditorInner({ editRkey, initialSprites }: { editRkey?: string; initialSprites: Map<string, SpriteEditorResult> }) {
  const dispatch = useRecordDispatch();
  const store = useRecordStore();

  const name = useRecordSelector((s) => s.editor.name);
  const description = useRecordSelector((s) => s.editor.description);
  const tags = useRecordSelector((s) => s.editor.tags);
  const tiles = useRecordSelector((s) => s.editor.tiles);

  const [tagInput, setTagInput] = useState("");
  const [targetSprites, setTargetSprites] = useState<
    Map<string, TargetSprite>
  >(initialSprites);

  // Track editing by tile id — sprites are keyed by tile id so they work
  // even before the tile has a name (and thus a target).
  const [editingTileId, setEditingTileId] = useState<number | null>(null);

  const [currentRkey, setCurrentRkey] = useState(editRkey);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUri, setSavedUri] = useState<string | null>(null);

  const handleAddTile = useCallback(() => {
    dispatch(addTile());
    const newTiles = store.getState().editor.tiles;
    setEditingTileId(newTiles[newTiles.length - 1].id);
  }, [dispatch, store]);

  const handleRemoveTile = useCallback(
    (tileId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(removeTile(tileId));
      setTargetSprites((prev) => {
        const next = new Map(prev);
        next.delete(String(tileId));
        return next;
      });
      if (editingTileId === tileId) setEditingTileId(null);
    },
    [dispatch, editingTileId],
  );

  const handleUpdateTileName = useCallback((tileId: number, newName: string) => {
    dispatch(updateTile({ id: tileId, patch: { name: newName } }));
  }, [dispatch]);

  const handleTileClick = useCallback((tile: TileData) => {
    setEditingTileId(tile.id);
  }, []);

  const handleSpriteEditorDone = useCallback(
    (result: SpriteEditorResult) => {
      if (editingTileId == null) return;
      setTargetSprites((prev) => {
        const next = new Map(prev);
        next.set(String(editingTileId), result);
        return next;
      });
      setEditingTileId(null);
    },
    [editingTileId],
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

  const handleRemoveTag = useCallback((tag: string) => {
    dispatch(removeTag(tag));
  }, [dispatch]);

  // Validation
  const canSave =
    name.trim().length > 0 &&
    tiles.length > 0 &&
    tiles.every((t: TileData) => t.name.trim().length > 0) &&
    tiles.some((t: TileData) => targetSprites.has(String(t.id)));

  async function doSave(rkey?: string) {
    setSaving(true);
    setSaveError(null);

    try {
      const session = getSession();
      const state = store.getState().editor;

      // Remap sprites from tile-id keys to derived-target keys for buildSpriteSheet
      const targetList: string[] = [];
      const targetSpritesByTarget = new Map<string, TargetSprite>();
      for (const tile of state.tiles) {
        const target = deriveTarget(tile.name);
        if (!target) continue;
        const sprite = targetSprites.get(String(tile.id));
        if (sprite && !targetSpritesByTarget.has(target)) {
          targetSpritesByTarget.set(target, sprite);
          targetList.push(target);
        }
      }

      const { blob, mimeType, layers } = await buildSpriteSheet(
        targetList,
        targetSpritesByTarget,
      );
      const blobRef = await uploadBlob(session, blob, mimeType);

      const tileRecords = state.tiles.map((tile: TileData) => ({
        $type: "at.cozy-corner.tileset#tile" as const,
        name: tile.name.trim(),
        target: deriveTarget(tile.name),
        ...(tile.wall ? { wall: true } : {}),
      }));

      const record = {
        $type: "at.cozy-corner.tileset",
        name: state.name.trim(),
        ...(state.description.trim() ? { description: state.description.trim() } : {}),
        ...(state.tags.length > 0 ? { tags: state.tags } : {}),
        spriteSheet: blobRef,
        layers,
        tiles: tileRecords,
        createdAt: new Date().toISOString(),
      };

      const saved = await saveRecord(session, "at.cozy-corner.tileset", record, rkey);
      setSavedUri(saved);
      if (!rkey) setCurrentRkey(parseAtUri(saved).rkey);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const handleSave = useCallback(() => doSave(currentRkey), [name, description, tags, tiles, targetSprites, currentRkey]);
  const handleSaveNew = useCallback(() => doSave(undefined), [name, description, tags, tiles, targetSprites]);

  return (
    <div className="bae-root">
      {/* Metadata sidebar */}
      <div className="bae-meta">
        <div className="ale-label">Name</div>
        <input
          className="bae-input"
          value={name}
          onChange={(e) => dispatch(setName(e.target.value))}
          placeholder="Tileset name"
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
                onClick={() => handleRemoveTag(tag)}
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

      {/* Tile grid */}
      <div className="bae-targets">
        <div className="ale-label">Tiles</div>
        <div className="bae-target-grid">
          {tiles.map((tile: TileData) => {
            const sprite = targetSprites.get(String(tile.id));
            return (
              <div
                key={tile.id}
                className="bae-target-card"
                onClick={() => handleTileClick(tile)}
              >
                <div className="bae-target-preview">
                  {sprite ? (
                    <TargetPreview sprite={sprite} size={80} checkerboardScale={1} />
                  ) : (
                    <span
                      style={{
                        color: "var(--text-dim)",
                        fontSize: 20,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      +
                    </span>
                  )}
                </div>
                <input
                  className="bae-input te-tile-name-input"
                  value={tile.name}
                  onChange={(e) => handleUpdateTileName(tile.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="tile name"
                  maxLength={64}
                />
                <label
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, fontFamily: "'Pixelify Sans'", color: tile.wall ? "var(--accent-primary)" : "var(--text-muted)", cursor: "pointer", padding: "2px 0" }}
                >
                  <input
                    type="checkbox"
                    checked={tile.wall}
                    onChange={(e) => dispatch(updateTile({ id: tile.id, patch: { wall: e.target.checked } }))}
                    style={{ margin: 0 }}
                  />
                  Wall
                </label>
                <button
                  className="ale-icon-btn ale-icon-btn--danger bae-target-delete"
                  onClick={(e) => handleRemoveTile(tile.id, e)}
                  title="Remove tile"
                >
                  &times;
                </button>
              </div>
            );
          })}

          {/* Add tile card */}
          <button
            className="bae-target-card bae-target-card--add"
            onClick={handleAddTile}
          >
            <span className="bae-add-icon">+</span>
            <span className="bae-target-name">Add Tile</span>
          </button>
        </div>
      </div>

      {/* Sprite Pixel Editor modal */}
      {editingTileId != null && (
        <div className="bae-overlay bae-overlay--sprite-editor">
          <div
            className="bae-modal bae-modal--sprite-editor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bae-modal-header">
              <span className="ale-label">
                {tiles.find((t: TileData) => t.id === editingTileId)?.name || "New Tile"}
              </span>
            </div>
            <div className="bae-modal-body">
              <SpritePixelEditor
                key={editingTileId}
                initial={targetSprites.get(String(editingTileId))}
                onDone={handleSpriteEditorDone}
                onCancel={() => setEditingTileId(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
