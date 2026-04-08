import { useEffect, useRef } from 'react';
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { StreamLanguage } from '@codemirror/language';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion, type CompletionContext, type Completion } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

/** Dark theme matching the project's Starlit Workshop palette. */
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#08081a',
    color: '#e8e0f8',
    fontSize: '11px',
    fontFamily: '"JetBrains Mono", monospace',
  },
  '.cm-content': { caretColor: '#fbbf24' },
  '.cm-cursor': { borderLeftColor: '#fbbf24' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#2a2a5e',
  },
  '.cm-gutters': {
    backgroundColor: '#10102a',
    color: '#7878a8',
    border: 'none',
  },
  '.cm-activeLineGutter': { backgroundColor: '#1a1a3e' },
  '.cm-activeLine': { backgroundColor: '#1a1a3e40' },
  '.cm-tooltip': {
    backgroundColor: '#10102a',
    color: '#e8e0f8',
    border: '1px solid #2a2a5e',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: '#2a2a5e',
    color: '#fbbf24',
  },
}, { dark: true });

/** Lua API completions for the Cozy Corner scripting environment. */
const API_COMPLETIONS: Completion[] = [
  // Events
  { label: 'when', type: 'function', detail: '(event) → table', info: 'Pause until event fires. Returns event data. Events: "interact", "tick", "message"' },

  // State
  { label: 'getState', type: 'function', detail: '(key) → string|nil', info: 'Get state value for the current entity' },
  { label: 'setState', type: 'function', detail: '(key, value)', info: 'Set state value on the current entity' },

  // Position & Movement
  { label: 'getPosition', type: 'function', detail: '() → x, y', info: 'Get current grid position' },
  { label: 'getDirection', type: 'function', detail: '() → number', info: 'Get facing direction (SOUTH=0, WEST=1, NORTH=2, EAST=3)' },
  { label: 'moveTo', type: 'function', detail: '(x, y) → boolean', info: 'Pathfind and move to target. Returns true if path found.' },
  { label: 'stopMoving', type: 'function', detail: '()', info: 'Immediately stop current movement' },

  // Animation
  { label: 'setAnimTarget', type: 'function', detail: '(target)', info: 'Set animation target (e.g. "idle-south", "walk-north")' },
  { label: 'say', type: 'function', detail: '(text, bubbleType?)', info: 'Show speech bubble. bubbleType: "speech" (default) or "thought"' },

  // Messages
  { label: 'sendMessage', type: 'function', detail: '(targetId, name, data?)', info: 'Send message to another entity' },

  // Camera
  { label: 'cameraFollow', type: 'function', detail: '(pcId, targetId, radius?)', info: 'Attach camera to follow an entity' },
  { label: 'cameraPan', type: 'function', detail: '(pcId, x, y, radius?, duration?)', info: 'Pan camera to grid position' },

  // Constants
  { label: 'ENTITY_ID', type: 'constant', detail: 'string', info: 'ID of the current entity' },
  { label: 'SOUTH', type: 'constant', detail: '= 0', info: 'Direction toward camera' },
  { label: 'NORTH', type: 'constant', detail: '= 2', info: 'Direction away from camera' },
  { label: 'EAST', type: 'constant', detail: '= 3', info: 'Direction right' },
  { label: 'WEST', type: 'constant', detail: '= 1', info: 'Direction left' },
];

function luaCompletions(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: API_COMPLETIONS,
  };
}

interface LuaEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function LuaEditor({ value, onChange, placeholder }: LuaEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        StreamLanguage.define(lua),
        darkTheme,
        history(),
        highlightSelectionMatches(),
        autocompletion({ override: [luaCompletions] }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
        ...(placeholder ? [placeholderExt(placeholder)] : []),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only create once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. switching between behaviors)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden rounded-sm border border-surface-border [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
    />
  );
}
