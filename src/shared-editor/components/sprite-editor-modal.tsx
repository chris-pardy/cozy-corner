import { lazy, Suspense, useMemo } from 'react';
import { Provider } from 'react-redux';
import { X, Save } from 'lucide-react';
import { createEditorStore } from '../../editor/redux/store';
import { addLayer, setCanvasSize, setFrameRate } from '../../editor/redux/canvas-slice';
import { setZoom } from '../../editor/redux/tools-slice';
import type { AvatarTarget } from '../types';
import { deserializeLayers, serializeLayers } from '../serialization';

const SpriteEditorPanel = lazy(() =>
  import('../../editor/components/sprite-editor-panel').then((m) => ({
    default: m.SpriteEditorPanel,
  })),
);

interface SpriteEditorModalProps {
  target: AvatarTarget;
  onSave: (data: {
    layerData: AvatarTarget['layerData'];
    canvasWidth: number;
    canvasHeight: number;
    frameRate: number;
  }) => void;
  onCancel: () => void;
}

export function SpriteEditorModal({ target, onSave, onCancel }: SpriteEditorModalProps) {
  const store = useMemo(() => {
    const s = createEditorStore();

    // Seed canvas size
    s.dispatch(setCanvasSize({ width: target.canvasWidth, height: target.canvasHeight }));
    s.dispatch(setFrameRate(target.frameRate));
    s.dispatch(setZoom(16));

    // Seed existing layers
    if (target.layerData.length > 0) {
      const layers = deserializeLayers(target.layerData);
      for (const layer of layers) {
        s.dispatch(addLayer(layer));
      }
    }

    return s;
  }, [target.id]);

  function handleSave() {
    const state = store.getState();
    const { layers, width, height, frameRate } = state.canvas;
    onSave({
      layerData: serializeLayers(layers),
      canvasWidth: width,
      canvasHeight: height,
      frameRate,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-deep">
      {/* Modal header */}
      <div className="flex items-center justify-between border-b border-surface-border bg-surface px-4 py-1.5">
        <span className="font-heading text-xs tracking-wide text-gold">
          Editing: {target.target}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1 rounded-sm border border-gold bg-gold/10 px-2 py-0.5 font-heading text-[10px] text-gold transition-colors hover:bg-gold/20"
          >
            <Save className="size-3" />
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex size-6 items-center justify-center rounded-sm text-text-muted hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Sprite editor body */}
      <div className="min-h-0 flex-1">
        <Provider store={store}>
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <span className="font-heading text-sm text-text-muted">Loading editor...</span>
              </div>
            }
          >
            <SpriteEditorPanel title={target.target} />
          </Suspense>
        </Provider>
      </div>
    </div>
  );
}
