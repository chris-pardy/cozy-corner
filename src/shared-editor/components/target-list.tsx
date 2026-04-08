import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AvatarTarget } from '../types';
import { AddTargetPopover } from './add-target-popover';

interface TargetListProps {
  targets: AvatarTarget[];
  selectedId: string | null;
  onAdd: (target: string) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  /** Limit which action groups appear in the add popover. */
  actions?: readonly string[];
  /** Whether to show the "dance" target in the add popover. Defaults to true. */
  showDance?: boolean;
}

export function TargetList({ targets, selectedId, onAdd, onSelect, onEdit, onRemove, actions, showDance }: TargetListProps) {
  const [addOpen, setAddOpen] = useState(false);

  function handleAdd(target: string) {
    onAdd(target);
    setAddOpen(false);
  }

  return (
    <div className="flex h-full flex-col rounded-md border border-surface-border bg-surface">
      <div className="flex items-center justify-between border-b border-surface-border px-2 py-1">
        <span className="font-heading text-xs text-text-muted">Targets</span>
        <div className="relative">
          <button
            type="button"
            aria-label="Add target"
            onClick={() => setAddOpen(!addOpen)}
            className="flex size-5 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          >
            <Plus className="size-3.5" />
          </button>
          {addOpen && (
            <AddTargetPopover
              existingTargets={targets.map((t) => t.target)}
              onAdd={handleAdd}
              onClose={() => setAddOpen(false)}
              actions={actions}
              showDance={showDance}
            />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-px overflow-y-auto p-1">
        {targets.length === 0 && (
          <span className="px-1 py-2 text-center font-heading text-[10px] text-text-muted">
            No targets yet
          </span>
        )}
        {targets.map((t) => {
          const isSelected = t.id === selectedId;
          const hasData = t.layerData.length > 0;
          const frameCount = hasData
            ? Math.max(...t.layerData.map((l) => l.frames.length))
            : 0;

          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(t.id)}
              onDoubleClick={() => onEdit(t.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEdit(t.id);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-sm px-1.5 py-1 transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-gold',
                isSelected
                  ? 'bg-gold/15 text-text ring-1 ring-gold/40'
                  : 'text-text-muted hover:bg-surface-muted hover:text-text',
              )}
            >
              {/* Status dot */}
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full border',
                  hasData
                    ? 'border-gold bg-gold'
                    : 'border-text-muted/40 bg-transparent',
                )}
              />

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-heading text-xs">{t.target}</span>
                {hasData && (
                  <span className="font-heading text-[9px] text-text-muted">
                    {t.layerData.length} layer{t.layerData.length !== 1 ? 's' : ''}, {frameCount} frame{frameCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <button
                type="button"
                aria-label="Edit layers"
                title="Edit layers"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(t.id);
                }}
                className="flex size-5 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                aria-label="Remove target"
                title="Remove target"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(t.id);
                }}
                className="flex size-5 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
