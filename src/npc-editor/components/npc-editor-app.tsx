import { LogOut } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { NpcDispatch } from '../redux/store';
import {
  selectName,
  selectDescription,
  selectTags,
  selectTargets,
  selectSelectedTargetId,
  selectSelectedTarget,
  selectEditingTarget,
  selectStateProperties,
  selectBehaviors,
  setName,
  setDescription,
  setTags,
  addTarget,
  removeTarget,
  selectTarget,
  openEditor,
  commitSpriteEditorResult,
  closeEditor,
  addStateProperty,
  updateStateProperty,
  removeStateProperty,
  addBehavior,
  updateBehavior,
  removeBehavior,
} from '../redux/npc-slice';
import { useAuth } from '../../atproto/AuthContext';
import { LoginForm } from '../../atproto/LoginForm';
import { TargetList } from '../../shared-editor/components/target-list';
import { EditorPreview } from '../../shared-editor/components/editor-preview';
import { MetadataPanel } from '../../shared-editor/components/metadata-panel';
import { StatePropertyEditor } from '../../shared-editor/components/state-property-editor';
import { BehaviorEditor } from '../../shared-editor/components/behavior-editor';
import { SpriteEditorModal } from '../../shared-editor/components/sprite-editor-modal';

/** NPCs only show idle and walk as built-in actions; custom targets still allowed. */
const NPC_ACTIONS = ['idle', 'walk'] as const;

export function NpcEditorApp() {
  const { session, did, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-deep text-text">
        <span className="font-heading text-sm text-text-muted">Loading...</span>
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  return <NpcEditorInner did={did!} onSignOut={signOut} />;
}

function NpcEditorInner({ did, onSignOut }: { did: string; onSignOut: () => void }) {
  const dispatch = useDispatch<NpcDispatch>();
  const name = useSelector(selectName);
  const description = useSelector(selectDescription);
  const tags = useSelector(selectTags);
  const targets = useSelector(selectTargets);
  const selectedTargetId = useSelector(selectSelectedTargetId);
  const selectedTarget = useSelector(selectSelectedTarget);
  const editingTarget = useSelector(selectEditingTarget);
  const stateProperties = useSelector(selectStateProperties);
  const behaviors = useSelector(selectBehaviors);

  return (
    <div className="flex h-screen flex-col bg-surface-deep text-text">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-surface-border bg-surface px-4 py-1.5">
        <span className="font-heading text-xs tracking-wide text-gold">
          NPC Editor
        </span>
        <input
          value={name}
          onChange={(e) => dispatch(setName(e.target.value))}
          placeholder="NPC name..."
          className="h-5 w-48 rounded-sm border border-surface-border bg-surface-deep px-1.5 font-heading text-xs text-text outline-none focus:border-gold"
        />

        <div className="flex-1" />

        <span className="font-heading text-[10px] text-text-muted">
          {did}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1 rounded-sm border border-surface-border px-1.5 py-0.5 font-heading text-[10px] text-text-muted transition-colors hover:border-text-muted hover:text-text"
        >
          <LogOut className="size-3" />
          Sign out
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── Left rail: target list ── */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-surface-border bg-surface p-1.5">
          <TargetList
            targets={targets}
            selectedId={selectedTargetId}
            onAdd={(target) => dispatch(addTarget({ id: crypto.randomUUID(), target }))}
            onSelect={(id) => dispatch(selectTarget(id))}
            onEdit={(id) => dispatch(openEditor(id))}
            onRemove={(id) => dispatch(removeTarget(id))}
            actions={NPC_ACTIONS}
            showDance={false}
          />
        </aside>

        {/* ── Center: preview ── */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-surface-deep p-4">
          <EditorPreview
            layerData={selectedTarget?.layerData ?? []}
            canvasWidth={selectedTarget?.canvasWidth ?? 32}
            canvasHeight={selectedTarget?.canvasHeight ?? 32}
            frameRate={selectedTarget?.frameRate ?? 8}
          />
        </div>

        {/* ── Right rail: metadata + state + behaviors ── */}
        <aside className="flex w-72 shrink-0 flex-col gap-1.5 overflow-y-auto border-l border-surface-border bg-surface p-1.5">
          <MetadataPanel
            description={description}
            tags={tags}
            onDescriptionChange={(v) => dispatch(setDescription(v))}
            onTagsChange={(v) => dispatch(setTags(v))}
            descriptionPlaceholder="A friendly NPC..."
            tagsPlaceholder="cat, shopkeeper, ..."
          />
          <StatePropertyEditor
            properties={stateProperties}
            onAdd={() =>
              dispatch(addStateProperty({
                id: crypto.randomUUID(),
                name: '',
                type: 'string',
                default: '',
                allowOverride: false,
              }))
            }
            onUpdate={(p) => dispatch(updateStateProperty(p))}
            onRemove={(id) => dispatch(removeStateProperty(id))}
          />
          <BehaviorEditor
            behaviors={behaviors}
            onAdd={() => {
              dispatch(addBehavior({
                id: crypto.randomUUID(),
                name: `script_${behaviors.length + 1}`,
                code: '-- New behavior\nwhile true do\n  local event = when("interact")\n  say("Hello!")\nend\n',
              }));
            }}
            onUpdate={(b) => dispatch(updateBehavior(b))}
            onRemove={(id) => dispatch(removeBehavior(id))}
          />
        </aside>
      </div>

      {/* ── Sprite editor modal ── */}
      {editingTarget && (
        <SpriteEditorModal
          target={editingTarget}
          onSave={(data) =>
            dispatch(commitSpriteEditorResult({ targetId: editingTarget.id, ...data }))
          }
          onCancel={() => dispatch(closeEditor())}
        />
      )}
    </div>
  );
}
