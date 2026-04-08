import { Plus, Trash2 } from 'lucide-react';
import { STATE_PROPERTY_TYPES, type StateProperty, type StatePropertyType } from '../types';

interface StatePropertyEditorProps {
  properties: StateProperty[];
  onAdd: () => void;
  onUpdate: (property: StateProperty) => void;
  onRemove: (id: string) => void;
}

export function StatePropertyEditor({ properties, onAdd, onUpdate, onRemove }: StatePropertyEditorProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-surface-border bg-surface-deep/50 p-2">
      <div className="flex items-center justify-between">
        <span className="font-heading text-[10px] uppercase tracking-wider text-text-muted">
          State Properties
        </span>
        <button
          type="button"
          aria-label="Add property"
          onClick={onAdd}
          className="flex size-5 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {properties.length === 0 && (
        <span className="py-1 text-center font-heading text-[9px] text-text-muted">
          No state properties
        </span>
      )}

      {properties.map((prop) => (
        <PropertyRow
          key={prop.id}
          property={prop}
          onUpdate={onUpdate}
          onRemove={() => onRemove(prop.id)}
        />
      ))}
    </div>
  );
}

function PropertyRow({
  property,
  onUpdate,
  onRemove,
}: {
  property: StateProperty;
  onUpdate: (p: StateProperty) => void;
  onRemove: () => void;
}) {
  function update(partial: Partial<StateProperty>) {
    onUpdate({ ...property, ...partial });
  }

  return (
    <div className="flex flex-col gap-1 rounded-sm border border-surface-border bg-surface p-1.5">
      <div className="flex items-center gap-1">
        <input
          value={property.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="name"
          className="h-5 min-w-0 flex-1 rounded-sm border border-surface-border bg-surface-deep px-1 font-heading text-[10px] text-text outline-none focus:border-gold"
        />
        <button
          type="button"
          aria-label="Remove property"
          onClick={onRemove}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <select
          value={property.type}
          onChange={(e) => update({ type: e.target.value as StatePropertyType })}
          className="h-5 flex-1 rounded-sm border border-surface-border bg-surface-deep px-0.5 font-heading text-[10px] text-text outline-none focus:border-gold"
        >
          {STATE_PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {property.type !== 'blob' && (
        <input
          value={property.default}
          onChange={(e) => update({ default: e.target.value })}
          placeholder="default value"
          className="h-5 rounded-sm border border-surface-border bg-surface-deep px-1 font-heading text-[10px] text-text outline-none focus:border-gold"
        />
      )}

      <label className="flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={property.allowOverride}
          onChange={(e) => update({ allowOverride: e.target.checked })}
          className="size-3 cursor-pointer accent-gold"
        />
        <span className="font-heading text-[9px] text-text-muted">
          Allow override
        </span>
      </label>
    </div>
  );
}
