import { useEffect, useRef, useState } from 'react';
import { ANIMATION_ACTIONS, DIRECTIONS } from '../types';

interface AddTargetPopoverProps {
  existingTargets: string[];
  onAdd: (target: string) => void;
  onClose: () => void;
  /** Limit which action groups are shown. Defaults to all. */
  actions?: readonly string[];
  /** Whether to show the "dance" standalone target. Defaults to true. */
  showDance?: boolean;
}

export function AddTargetPopover({ existingTargets, onAdd, onClose, actions, showDance = true }: AddTargetPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const existing = new Set(existingTargets);

  function submitCustom() {
    const trimmed = custom.trim();
    if (trimmed && !existing.has(trimmed)) {
      onAdd(trimmed);
      setCustom('');
    }
  }

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-10 mt-1 w-52 max-h-72 overflow-y-auto rounded-sm border border-surface-border bg-surface p-1.5 shadow-lg"
    >
      {(actions ?? ANIMATION_ACTIONS).map((action) => (
        <div key={action}>
          <span className="block px-1 pt-1.5 pb-0.5 font-heading text-[9px] uppercase tracking-wider text-text-muted">
            {action}
          </span>
          {DIRECTIONS.map((dir) => {
            const target = `${action}-${dir}`;
            const disabled = existing.has(target);
            return (
              <button
                key={target}
                type="button"
                disabled={disabled}
                onClick={() => onAdd(target)}
                className="block w-full rounded-sm px-1 py-0.5 text-left font-heading text-[10px] transition-colors hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent"
              >
                {target}
              </button>
            );
          })}
        </div>
      ))}

      {showDance && (
        <div>
          <span className="block px-1 pt-1.5 pb-0.5 font-heading text-[9px] uppercase tracking-wider text-text-muted">
            Other
          </span>
          <button
            type="button"
            disabled={existing.has('dance')}
            onClick={() => onAdd('dance')}
            className="block w-full rounded-sm px-1 py-0.5 text-left font-heading text-[10px] transition-colors hover:bg-surface-muted disabled:opacity-30"
          >
            dance
          </button>
        </div>
      )}

      <div className="mt-1.5 border-t border-surface-border pt-1.5">
        <span className="block px-1 pb-0.5 font-heading text-[9px] uppercase tracking-wider text-text-muted">
          Custom
        </span>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitCustom();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="custom-target..."
          className="w-full rounded-sm border border-surface-border bg-surface-deep px-1 py-0.5 font-heading text-[10px] text-text outline-none focus:border-gold"
        />
      </div>
    </div>
  );
}
