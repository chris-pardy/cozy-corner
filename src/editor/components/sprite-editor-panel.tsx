import { useState } from 'react';
import { AnimationPreview } from './animation-preview';
import { EditorCanvas } from './editor-canvas';
import { EditorToolbar } from './editor-toolbar';
import { FrameStrip } from './frame-strip';
import { ImportDialog } from './import-dialog';
import { LayerList } from './layer-list';
import { ToolPalette } from './tool-palette';

export function SpriteEditorPanel({ title = 'Sprite Editor' }: { title?: string }) {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-surface-deep text-text">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-surface-border bg-surface px-3 py-1.5">
        <span className="font-heading text-xs tracking-wide text-gold">
          {title}
        </span>
        <EditorToolbar onImport={() => setImportOpen(true)} />
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── Left rail: tools + layers ── */}
        <aside className="flex w-44 shrink-0 flex-col gap-1.5 border-r border-surface-border bg-surface p-1.5">
          <ToolPalette />
          <LayerList />
        </aside>

        {/* ── Canvas viewport + frame strip ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-auto bg-surface-deep p-4">
            <EditorCanvas />
          </div>
          <FrameStrip />
        </div>

        {/* ── Right rail: animation preview ── */}
        <aside className="flex w-44 shrink-0 flex-col gap-1.5 border-l border-surface-border bg-surface p-1.5">
          <AnimationPreview />
        </aside>
      </div>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}
