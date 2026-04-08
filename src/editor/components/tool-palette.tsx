import {
  Pencil,
  Paintbrush,
  Eraser,
  PaintBucket,
  Move,
  Maximize,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  type LucideIcon,
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { cn } from '@/lib/utils';
import type { AppDispatch } from '../redux/store';
import {
  type ToolType,
  selectTool,
  setRadius,
  setAllFrames,
  selectCurrentTool,
  selectCurrentToolOptions,
  selectAllFrames,
  selectPending,
  updateDrag,
  commitDrag,
} from '../redux/tools-slice';
import {
  setColor,
  selectActiveColor,
  selectColors,
} from '../redux/palette-slice';
import {
  flipSelectedLayers,
  moveSelectedLayers,
  scaleXYSelectedLayers,
  rotateSelectedLayers,
  selectCurrentFrame,
} from '../redux/canvas-slice';

interface ToolDef {
  type: ToolType;
  label: string;
  icon: LucideIcon;
  shortcut: string;
  hasRadius: boolean;
  hasColor: boolean;
  hasFlip: boolean;
  hasAllFrames: boolean;
}

const tools: ToolDef[] = [
  { type: 'pencil', label: 'Pencil', icon: Pencil, shortcut: 'P', hasRadius: true, hasColor: true, hasFlip: false, hasAllFrames: false },
  { type: 'brush', label: 'Brush', icon: Paintbrush, shortcut: 'B', hasRadius: true, hasColor: true, hasFlip: false, hasAllFrames: false },
  { type: 'eraser', label: 'Eraser', icon: Eraser, shortcut: 'E', hasRadius: true, hasColor: false, hasFlip: false, hasAllFrames: false },
  { type: 'fill', label: 'Fill', icon: PaintBucket, shortcut: 'G', hasRadius: false, hasColor: true, hasFlip: false, hasAllFrames: false },
  { type: 'move', label: 'Move', icon: Move, shortcut: 'V', hasRadius: false, hasColor: false, hasFlip: true, hasAllFrames: true },
  { type: 'scale', label: 'Scale', icon: Maximize, shortcut: 'S', hasRadius: false, hasColor: false, hasFlip: false, hasAllFrames: true },
  { type: 'rotate', label: 'Rotate', icon: RotateCw, shortcut: 'R', hasRadius: false, hasColor: false, hasFlip: false, hasAllFrames: true },
];

/** Unpack a little-endian RGBA Uint32 to a CSS color string. */
function uint32ToCss(c: number): string {
  const r = c & 0xff;
  const g = (c >> 8) & 0xff;
  const b = (c >> 16) & 0xff;
  const a = (c >>> 24) & 0xff;
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  if (a === 255) return hex;
  return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
}

/** Always returns #rrggbb for use with <input type="color">. */
function uint32ToHex(c: number): string {
  const r = c & 0xff;
  const g = (c >> 8) & 0xff;
  const b = (c >> 16) & 0xff;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Convert a CSS hex color (#rrggbb) to a little-endian RGBA Uint32. */
function cssToUint32(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function ToolPalette() {
  const selected = useSelector(selectCurrentTool);
  const dispatch = useDispatch<AppDispatch>();

  const activeDef = tools.find((t) => t.type === selected)!;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-surface-border bg-surface-deep/50 p-1.5">
      <div className="grid grid-cols-4 gap-0.5">
        {tools.map((tool) => (
          <ToolButton
            key={tool.type}
            tool={tool}
            active={selected === tool.type}
            onSelect={() => dispatch(selectTool(tool.type))}
          />
        ))}
      </div>

      {(activeDef.hasRadius || activeDef.hasColor || activeDef.hasFlip || activeDef.hasAllFrames) && (
        <>
          <div className="h-px bg-surface-border" />
          {activeDef.hasRadius && <RadiusControl tool={selected} />}
          {activeDef.hasColor && <ColorControl />}
          {selected === 'move' && <MoveControls />}
          {selected === 'scale' && <ScaleControls />}
          {selected === 'rotate' && <RotateControls />}
          {activeDef.hasFlip && <FlipControls />}
          {activeDef.hasAllFrames && <AllFramesToggle />}
        </>
      )}
    </div>
  );
}

function ToolButton({
  tool,
  active,
  onSelect,
}: {
  tool: ToolDef;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      title={`${tool.label} (${tool.shortcut})`}
      aria-label={tool.label}
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        'flex size-8 items-center justify-center rounded-sm transition-colors',
        'text-text-muted hover:bg-surface-muted hover:text-text',
        'focus-visible:ring-2 focus-visible:ring-gold outline-none',
        active && 'bg-gold/15 text-gold ring-1 ring-gold/40',
      )}
    >
      <tool.icon className="size-4" strokeWidth={active ? 2.5 : 2} />
    </button>
  );
}

function RadiusControl({ tool }: { tool: ToolType }) {
  const { radius } = useSelector(selectCurrentToolOptions);
  const dispatch = useDispatch<AppDispatch>();

  return (
    <div className="flex flex-col items-center gap-0.5 px-0.5">
      <label
        htmlFor="radius-slider"
        className="font-heading text-[10px] text-text-muted"
      >
        {radius}px
      </label>
      <input
        id="radius-slider"
        type="range"
        min={1}
        max={32}
        value={radius}
        onChange={(e) =>
          dispatch(setRadius({ tool, radius: Number(e.target.value) }))
        }
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-border accent-gold"
      />
    </div>
  );
}

function ColorControl() {
  const activeColor = useSelector(selectActiveColor);
  const colors = useSelector(selectColors);
  const dispatch = useDispatch<AppDispatch>();

  return (
    <div className="flex flex-col items-center gap-1 px-0.5">
      <label
        htmlFor="color-input"
        className="relative block size-6 cursor-pointer overflow-hidden rounded-sm border border-surface-border"
      >
        <span
          className="absolute inset-0"
          style={{ backgroundColor: uint32ToCss(activeColor) }}
        />
        <input
          id="color-input"
          type="color"
          value={uint32ToHex(activeColor)}
          onChange={(e) => dispatch(setColor(cssToUint32(e.target.value)))}
          className="sr-only"
        />
      </label>
      <div className="grid grid-cols-4 gap-0.5">
        {colors.map((c, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Color ${i + 1}`}
            onClick={() => dispatch(setColor(c))}
            className={cn(
              'size-3 rounded-sm border',
              c === activeColor ? 'border-gold' : 'border-surface-border',
            )}
            style={{ backgroundColor: uint32ToCss(c) }}
          />
        ))}
      </div>
    </div>
  );
}

const inputCls = 'h-5 w-full rounded-sm border border-surface-border bg-surface-deep px-1 text-center font-heading text-[10px] text-text outline-none focus:border-gold';
const labelCls = 'w-5 shrink-0 text-right font-heading text-[10px] uppercase text-text-muted';

function MoveControls() {
  const dispatch = useDispatch<AppDispatch>();
  const frame = useSelector(selectCurrentFrame);
  const allFrames = useSelector(selectAllFrames);
  const pending = useSelector(selectPending);

  function applyField(field: 'dx' | 'dy', value: string) {
    const target = parseInt(value, 10) || 0;
    const current = pending[field];
    const delta = target - current;
    if (delta === 0) return;
    const payload = field === 'dx'
      ? { dx: delta, dy: 0, frame, allFrames }
      : { dx: 0, dy: delta, frame, allFrames };
    dispatch(moveSelectedLayers(payload));
    dispatch(updateDrag({ [field]: target }));
  }

  return (
    <div className="flex flex-col gap-1 px-0.5">
      <div className="flex items-center gap-1">
        <span className={labelCls}>dx</span>
        <input type="number" value={pending.dx}
          onChange={(e) => applyField('dx', e.target.value)}
          className={inputCls} />
      </div>
      <div className="flex items-center gap-1">
        <span className={labelCls}>dy</span>
        <input type="number" value={pending.dy}
          onChange={(e) => applyField('dy', e.target.value)}
          className={inputCls} />
      </div>
    </div>
  );
}

function ScaleControls() {
  const dispatch = useDispatch<AppDispatch>();
  const frame = useSelector(selectCurrentFrame);
  const allFrames = useSelector(selectAllFrames);
  const pending = useSelector(selectPending);

  // Combined running total including current drag
  const displayScale = Math.round(pending.totalScale * pending.dragScale * 100) / 100;

  function applySx(value: string) {
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n <= 0) return;
    dispatch(scaleXYSelectedLayers({ sx: n, sy: 1, frame, allFrames }));
    dispatch(commitDrag()); // flush any drag, then total tracks it
  }
  function applySy(value: string) {
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n <= 0) return;
    dispatch(scaleXYSelectedLayers({ sx: 1, sy: n, frame, allFrames }));
    dispatch(commitDrag());
  }

  return (
    <div className="flex flex-col gap-1 px-0.5">
      <div className="flex items-center gap-1">
        <span className={labelCls}>sx</span>
        <input type="number" step="0.1" min="0.1" value={displayScale}
          onChange={(e) => applySx(e.target.value)}
          className={inputCls} />
      </div>
      <div className="flex items-center gap-1">
        <span className={labelCls}>sy</span>
        <input type="number" step="0.1" min="0.1" value={displayScale}
          onChange={(e) => applySy(e.target.value)}
          className={inputCls} />
      </div>
    </div>
  );
}

function RotateControls() {
  const dispatch = useDispatch<AppDispatch>();
  const frame = useSelector(selectCurrentFrame);
  const allFrames = useSelector(selectAllFrames);
  const pending = useSelector(selectPending);

  // Combined running total including current drag, in degrees
  const totalRad = pending.totalRotation + pending.dragRotation;
  const displayDeg = Math.round((totalRad * 180) / Math.PI * 10) / 10;

  function applyDeg(value: string) {
    const target = parseFloat(value);
    if (!Number.isFinite(target)) return;
    // Apply the delta between current total and desired
    const deltaRad = (target * Math.PI) / 180 - totalRad;
    if (Math.abs(deltaRad) < 0.001) return;
    dispatch(rotateSelectedLayers({ angle: deltaRad, frame, allFrames }));
    dispatch(commitDrag());
  }

  return (
    <div className="flex flex-col gap-1 px-0.5">
      <div className="flex items-center gap-1">
        <span className={labelCls}>deg</span>
        <input type="number" step="1" value={displayDeg}
          onChange={(e) => applyDeg(e.target.value)}
          className={inputCls} />
      </div>
    </div>
  );
}

function FlipControls() {
  const dispatch = useDispatch<AppDispatch>();
  const frame = useSelector(selectCurrentFrame);
  const allFrames = useSelector(selectAllFrames);

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        title="Flip Horizontal"
        aria-label="Flip Horizontal"
        onClick={() => dispatch(flipSelectedLayers({ direction: 'horizontal', frame, allFrames }))}
        className="flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
      >
        <FlipHorizontal2 className="size-3.5" />
      </button>
      <button
        type="button"
        title="Flip Vertical"
        aria-label="Flip Vertical"
        onClick={() => dispatch(flipSelectedLayers({ direction: 'vertical', frame, allFrames }))}
        className="flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
      >
        <FlipVertical2 className="size-3.5" />
      </button>
    </div>
  );
}

function AllFramesToggle() {
  const dispatch = useDispatch<AppDispatch>();
  const allFrames = useSelector(selectAllFrames);

  return (
    <label className="flex cursor-pointer items-center gap-1.5 px-0.5">
      <input
        type="checkbox"
        checked={allFrames}
        onChange={(e) => dispatch(setAllFrames(e.target.checked))}
        className="size-3 cursor-pointer accent-gold"
      />
      <span className="font-heading text-[10px] text-text-muted">
        All frames
      </span>
    </label>
  );
}
