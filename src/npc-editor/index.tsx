import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createNpcEditorStore } from './redux/store';
import { AuthProvider } from '../atproto/AuthContext';
import { NpcEditorApp } from './components/npc-editor-app';
import './index.css';

const store = createNpcEditorStore();

const root = createRoot(document.getElementById('root')!);
root.render(
  <AuthProvider>
    <Provider store={store}>
      <NpcEditorApp />
    </Provider>
  </AuthProvider>,
);
