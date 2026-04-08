import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createWearableEditorStore } from './redux/store';
import { AuthProvider } from '../atproto/AuthContext';
import { WearableEditorApp } from './components/wearable-editor-app';
import './index.css';

const store = createWearableEditorStore();

const root = createRoot(document.getElementById('root')!);
root.render(
  <AuthProvider>
    <Provider store={store}>
      <WearableEditorApp />
    </Provider>
  </AuthProvider>,
);
