import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createEditorStore } from './redux/store';
import { addLayer } from './redux/canvas-slice';
import { setZoom } from './redux/tools-slice';
import { SpriteEditorPanel } from './components/sprite-editor-panel';
import type { Layer } from './redux/canvas/layer';
import './index.css';

const store = createEditorStore();

// Seed a test layer so there's something visible.
function makeTestLayer(): Layer {
  const size = 16;
  const pixels = new Uint32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.round((x / size) * 255);
      const g = Math.round((y / size) * 255);
      const b = 128;
      const a = 255;
      pixels[y * size + x] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
  return {
    id: 1,
    name: 'Layer 1',
    colorChannel: '#f6ad55',
    hidden: false,
    zIndex: 0,
    frames: [{ id: 0, width: size, xOffset: 0, yOffset: 0, pixelData: pixels }],
  };
}

store.dispatch(addLayer(makeTestLayer()));
store.dispatch(setZoom(16));

const root = createRoot(document.getElementById('root')!);
root.render(
  <Provider store={store}>
    <div className="h-screen">
      <SpriteEditorPanel />
    </div>
  </Provider>,
);
