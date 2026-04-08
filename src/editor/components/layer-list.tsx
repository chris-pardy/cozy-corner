import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, GripVertical, Plus, Trash2, Droplet, Layers } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { cn } from '@/lib/utils';
import type { AppDispatch } from '../redux/store';
import type { Layer } from '../redux/canvas/layer';
import { drawPixels } from '../redux/canvas/draw-pixels';
import {
  addLayer,
  removeLayer,
  renameLayer,
  setLayerColorChannel,
  setLayerZIndex,
  setActiveLayer,
  toggleLayerSelection,
  toggleLayerVisibility,
  reorderLayers,
  selectLayers,
  selectActiveLayerId,
  selectSelectedLayerIds,
  selectCurrentFrame,
  selectCanvasSize,
} from '../redux/canvas-slice';

export function LayerList() {
  const layers = useSelector(selectLayers);
  const activeId = useSelector(selectActiveLayerId);
  const selectedIds = useSelector(selectSelectedLayerIds);
  const canvasSize = useSelector(selectCanvasSize);
  const dispatch = useDispatch<AppDispatch>();

  const existingChannels = [...new Set(layers.map((l) => l.colorChannel).filter(Boolean))];

  function handleAddLayer() {
    const nextId =
      layers.length === 0 ? 1 : Math.max(...layers.map((l) => l.id)) + 1;
    dispatch(
      addLayer({
        id: nextId,
        name: `Layer ${nextId}`,
        colorChannel: '',
        hidden: false,
        zIndex: 0,
        frames: [
          {
            id: 0,
            width: canvasSize.width,
            xOffset: 0,
            yOffset: 0,
            pixelData: new Uint32Array(canvasSize.width * canvasSize.height),
          },
        ],
      }),
    );
    dispatch(setActiveLayer(nextId));
  }

  return (
    <div className="flex flex-col rounded-md border border-surface-border bg-surface">
      <div className="flex items-center justify-between border-b border-surface-border px-2 py-1">
        <span className="font-heading text-xs text-text-muted">
          Layers
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Delete active layer"
            disabled={layers.length <= 1}
            onClick={() => dispatch(removeLayer(activeId))}
            className="flex size-5 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text disabled:opacity-30"
          >
            <Trash2 className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Add layer"
            onClick={handleAddLayer}
            className="flex size-5 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
      <DragDropProvider
        onDragEnd={(event) => {
          const { source, target } = event.operation;
          if (!source || !target) return;
          // Indices are in reversed display order — convert back to array order.
          const fromIndex = layers.findIndex(
            (l) => String(l.id) === source.id,
          );
          const toIndex = layers.findIndex((l) => String(l.id) === target.id);
          if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
            dispatch(reorderLayers({ fromIndex, toIndex }));
          }
        }}
      >
        <div className="flex flex-col gap-px p-1">
          {[...layers].reverse().map((layer, displayIndex) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              index={displayIndex}
              active={layer.id === activeId}
              selected={selectedIds.includes(layer.id)}
              onSelect={(e) => {
                if (e.shiftKey) {
                  dispatch(toggleLayerSelection(layer.id));
                } else {
                  dispatch(setActiveLayer(layer.id));
                }
              }}
              onRename={(name) =>
                dispatch(renameLayer({ id: layer.id, name }))
              }
              existingChannels={existingChannels}
              onSetChannel={(ch) =>
                dispatch(setLayerColorChannel({ id: layer.id, colorChannel: ch }))
              }
              onSetZIndex={(z) =>
                dispatch(setLayerZIndex({ id: layer.id, zIndex: z }))
              }
              onToggleVisibility={() =>
                dispatch(toggleLayerVisibility(layer.id))
              }
            />
          ))}
        </div>
      </DragDropProvider>
    </div>
  );
}

function LayerRow({
  layer,
  index,
  active,
  selected,
  existingChannels,
  onSelect,
  onRename,
  onSetChannel,
  onSetZIndex,
  onToggleVisibility,
}: {
  layer: Layer;
  index: number;
  active: boolean;
  selected: boolean;
  existingChannels: string[];
  onSelect: (e: React.MouseEvent | React.KeyboardEvent) => void;
  onRename: (name: string) => void;
  onSetChannel: (channel: string) => void;
  onSetZIndex: (z: number) => void;
  onToggleVisibility: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: String(layer.id),
    index,
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [channelOpen, setChannelOpen] = useState(false);
  const [channelDraft, setChannelDraft] = useState(layer.colorChannel);
  const channelInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (channelOpen) {
      channelInputRef.current?.focus();
      channelInputRef.current?.select();
    }
  }, [channelOpen]);

  // Close popover on outside click
  useEffect(() => {
    if (!channelOpen) return;
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setChannelOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [channelOpen]);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== layer.name) {
      onRename(trimmed);
    } else {
      setDraft(layer.name);
    }
    setEditing(false);
  }

  function commitChannel(value: string) {
    const trimmed = value.trim();
    onSetChannel(trimmed);
    setChannelDraft(trimmed);
    setChannelOpen(false);
  }

  const hasChannel = !!layer.colorChannel;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(e);
        }
      }}
      className={cn(
        'relative flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-gold',
        active
          ? 'bg-gold/15 text-text ring-1 ring-gold/40'
          : selected
            ? 'bg-gold/10 text-text ring-1 ring-gold/25'
            : 'text-text-muted hover:bg-surface-muted hover:text-text',
        isDragging && 'opacity-50',
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab text-text-muted hover:text-text active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" />
      </button>

      <LayerPreview layer={layer} />

      <div className="flex min-w-0 flex-1 flex-col">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraft(layer.name);
                setEditing(false);
              }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 rounded-sm border border-surface-border bg-surface-deep px-0.5 font-heading text-xs text-text outline-none focus:border-gold"
          />
        ) : (
          <span
            className="truncate font-heading text-xs"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraft(layer.name);
              setEditing(true);
            }}
          >
            {layer.name}
          </span>
        )}
        {hasChannel && (
          <span className="truncate font-heading text-[9px] text-starlight">
            {layer.colorChannel}
          </span>
        )}
      </div>

      {/* Z-index toggle */}
      <button
        type="button"
        aria-label={layer.zIndex === 0 ? 'Layer: behind' : 'Layer: in front'}
        title={layer.zIndex === 0 ? 'Behind (click for front)' : 'In front (click for behind)'}
        onClick={(e) => {
          e.stopPropagation();
          onSetZIndex(layer.zIndex === 0 ? 1 : 0);
        }}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm font-heading text-[8px] font-bold transition-colors',
          'hover:bg-surface-muted hover:text-text',
          layer.zIndex === 1 ? 'text-gold' : 'text-text-muted/40',
        )}
      >
        {layer.zIndex === 0 ? 'B' : 'F'}
      </button>

      {/* Tint channel button */}
      <button
        type="button"
        aria-label="Set tint channel"
        title={hasChannel ? `Tint: ${layer.colorChannel}` : 'Set tint channel'}
        onClick={(e) => {
          e.stopPropagation();
          setChannelDraft(layer.colorChannel);
          setChannelOpen(!channelOpen);
        }}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm transition-colors',
          'hover:bg-surface-muted hover:text-text',
          hasChannel ? 'text-starlight' : 'text-text-muted/40',
        )}
      >
        <Droplet className="size-3" />
      </button>

      {/* Channel popover */}
      {channelOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-10 mt-0.5 w-36 rounded-sm border border-surface-border bg-surface p-1.5 shadow-lg"
        >
          <input
            ref={channelInputRef}
            value={channelDraft}
            placeholder="Channel name..."
            onChange={(e) => setChannelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitChannel(channelDraft);
              if (e.key === 'Escape') setChannelOpen(false);
              e.stopPropagation();
            }}
            className="mb-1 w-full rounded-sm border border-surface-border bg-surface-deep px-1 py-0.5 font-heading text-[10px] text-text outline-none focus:border-gold"
          />
          {existingChannels.length > 0 && (
            <div className="mb-1 flex flex-col gap-px">
              {existingChannels.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => commitChannel(ch)}
                  className={cn(
                    'rounded-sm px-1 py-0.5 text-left font-heading text-[10px] transition-colors hover:bg-surface-muted',
                    ch === layer.colorChannel ? 'text-starlight' : 'text-text-muted',
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}
          {hasChannel && (
            <button
              type="button"
              onClick={() => commitChannel('')}
              className="w-full rounded-sm px-1 py-0.5 text-left font-heading text-[10px] text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            >
              Remove tint
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        aria-label={layer.hidden ? 'Show layer' : 'Hide layer'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm transition-colors',
          'hover:bg-surface-muted hover:text-text',
          layer.hidden && 'text-text-muted/50',
        )}
      >
        {layer.hidden ? (
          <EyeOff className="size-3" />
        ) : (
          <Eye className="size-3" />
        )}
      </button>
    </div>
  );
}

const PREVIEW_SIZE = 24;

function LayerPreview({ layer }: { layer: Layer }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentFrame = useSelector(selectCurrentFrame);
  const frame = layer.frames[currentFrame];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    if (!frame || frame.width === 0 || frame.pixelData.length === 0) return;

    const height = (frame.pixelData.length / frame.width) | 0;
    const scale = Math.min(PREVIEW_SIZE / frame.width, PREVIEW_SIZE / height);

    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(
      (PREVIEW_SIZE - frame.width * scale) / 2,
      (PREVIEW_SIZE - height * scale) / 2,
    );
    ctx.scale(scale, scale);
    drawPixels(ctx, frame.pixelData, frame.width);
    ctx.restore();
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      width={PREVIEW_SIZE}
      height={PREVIEW_SIZE}
      className="shrink-0 rounded-sm border border-surface-border bg-surface-deep"
    />
  );
}
