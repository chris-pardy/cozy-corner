import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createAvatarEditorStore } from './redux/store';
import { AuthProvider } from '../atproto/AuthContext';
import { AvatarEditorApp } from './components/avatar-editor-app';
import './index.css';

const store = createAvatarEditorStore();

const root = createRoot(document.getElementById('root')!);
root.render(
  <AuthProvider>
    <Provider store={store}>
      <AvatarEditorApp />
    </Provider>
  </AuthProvider>,
);
