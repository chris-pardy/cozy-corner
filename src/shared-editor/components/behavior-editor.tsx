import { useState } from 'react';
import { Plus, Trash2, Code, X, Save } from 'lucide-react';
import type { Behavior } from '../types';
import { LuaEditor } from './lua-editor';

interface BehaviorEditorProps {
  behaviors: Behavior[];
  onAdd: () => void;
  onUpdate: (behavior: Behavior) => void;
  onRemove: (id: string) => void;
}

export function BehaviorEditor({ behaviors, onAdd, onUpdate, onRemove }: BehaviorEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingBehavior = editingId ? behaviors.find((b) => b.id === editingId) : null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-surface-border bg-surface-deep/50 p-2">
      <div className="flex items-center justify-between">
        <span className="font-heading text-[10px] uppercase tracking-wider text-text-muted">
          Behaviors
        </span>
        <button
          type="button"
          aria-label="Add behavior"
          onClick={onAdd}
          className="flex size-5 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {behaviors.length === 0 && (
        <span className="py-1 text-center font-heading text-[9px] text-text-muted">
          No behaviors
        </span>
      )}

      {behaviors.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-1 rounded-sm border border-surface-border bg-surface px-1.5 py-1"
        >
          <input
            value={b.name}
            onChange={(e) => onUpdate({ ...b, name: e.target.value })}
            className="h-5 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-0.5 font-heading text-[10px] text-text outline-none focus:border-surface-border focus:bg-surface-deep"
          />
          <button
            type="button"
            aria-label="Edit script"
            title="Edit script"
            onClick={() => setEditingId(b.id)}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          >
            <Code className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Remove behavior"
            onClick={() => onRemove(b.id)}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}

      {editingBehavior && (
        <ScriptEditorModal
          behavior={editingBehavior}
          onSave={(code) => {
            onUpdate({ ...editingBehavior, code });
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function ScriptEditorModal({
  behavior,
  onSave,
  onClose,
}: {
  behavior: Behavior;
  onSave: (code: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(behavior.code);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-deep">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border bg-surface px-4 py-1.5">
        <span className="font-heading text-xs tracking-wide text-gold">
          {behavior.name}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex items-center gap-1 rounded-sm border border-gold bg-gold/10 px-2 py-0.5 font-heading text-[10px] text-gold transition-colors hover:bg-gold/20"
          >
            <Save className="size-3" />
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-sm text-text-muted hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="min-h-0 flex-1">
        <LuaEditor
          value={draft}
          onChange={setDraft}
          placeholder="-- Write Lua behavior here..."
        />
      </div>
    </div>
  );
}
