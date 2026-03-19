import { useRef, type ReactNode } from "react";
import { configureStore, type Reducer } from "@reduxjs/toolkit";
import { Provider, useDispatch, useSelector, useStore } from "react-redux";

interface EditorStoreKitOptions<TState> {
  reducer: Reducer<TState>;
  createInitialState: () => TState;
  disableSerializableCheck?: boolean;
}

export function createEditorStoreKit<TState>(
  opts: EditorStoreKitOptions<TState>,
) {
  const { reducer, createInitialState, disableSerializableCheck } = opts;

  function createStore(preloadedState?: TState) {
    return configureStore({
      reducer: { editor: reducer },
      preloadedState: preloadedState
        ? { editor: preloadedState }
        : { editor: createInitialState() },
      ...(disableSerializableCheck && {
        middleware: (getDefault) =>
          getDefault({ serializableCheck: false }),
      }),
    });
  }

  type Store = ReturnType<typeof createStore>;
  type RootState = ReturnType<Store["getState"]>;
  type Dispatch = Store["dispatch"];

  const typedUseDispatch = useDispatch.withTypes<Dispatch>();
  const typedUseSelector = useSelector.withTypes<RootState>();
  const typedUseStore = useStore.withTypes<Store>();

  function EditorProvider({
    initialState,
    children,
  }: {
    initialState?: TState;
    children: ReactNode;
  }) {
    const storeRef = useRef<Store | null>(null);
    // eslint-disable-next-line react-hooks/refs
    if (!storeRef.current) {
      storeRef.current = createStore(initialState ?? createInitialState());
    }
    // eslint-disable-next-line react-hooks/refs
    return <Provider store={storeRef.current}>{children}</Provider>;
  }

  return {
    createStore,
    Provider: EditorProvider,
    useDispatch: typedUseDispatch,
    useSelector: typedUseSelector,
    useStore: typedUseStore,
  } as {
    createStore: (preloadedState?: TState) => Store;
    Provider: typeof EditorProvider;
    useDispatch: typeof typedUseDispatch;
    useSelector: typeof typedUseSelector;
    useStore: typeof typedUseStore;
  };
}
