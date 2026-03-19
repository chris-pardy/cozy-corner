import { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  StreamLanguage,
} from "@codemirror/language";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import type { Script as ScriptModel } from "~/atproto/generated/types/at/cozy-corner/script";
import "./editor.css";

// ---------------------------------------------------------------------------
// Autocomplete
// ---------------------------------------------------------------------------

const LUA_KEYWORDS = [
  "and", "break", "do", "else", "elseif", "end", "false", "for",
  "function", "if", "in", "local", "nil", "not", "or", "repeat",
  "return", "then", "true", "until", "while",
];

const API_FUNCTIONS = [
  { label: "on", detail: "(eventType, handler)", type: "function" },
  { label: "off", detail: "(eventType, handler)", type: "function" },
  { label: "stop", detail: "()", type: "function" },
  { label: "move_to", detail: "(x, y)", type: "function" },
  { label: "animate", detail: "(target)", type: "function" },
  { label: "emit", detail: "(type, data)", type: "function" },
  { label: "find_best_tile", detail: "(range, weights)", type: "function" },
  { label: "find_matching_tile", detail: "(range, matchers)", type: "function" },
  { label: "find_nearest", detail: "(range, match)", type: "function" },
  { label: "get_attribute", detail: "(attr, x, y)", type: "function" },
  { label: "is_blocked", detail: "(x, y)", type: "function" },
  { label: "time", detail: "()", type: "function" },
  { label: "chance", detail: "(p)", type: "function" },
  { label: "wait", detail: "(ms)", type: "function" },
  { label: "self", detail: "entity proxy", type: "variable" },
];

function scriptCompletions(ctx: CompletionContext) {
  const word = ctx.matchBefore(/[a-zA-Z_][a-zA-Z0-9_]*/);
  if (!word) return null;
  if (word.from === word.to && !ctx.explicit) return null;

  const options = [
    ...LUA_KEYWORDS.map((k) => ({ label: k, type: "keyword" })),
    ...API_FUNCTIONS,
  ];

  return {
    from: word.from,
    options,
    validFor: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  };
}

// ---------------------------------------------------------------------------
// CodeMirror theme matching Warm Hearth palette (reused from BehaviorEditor)
// ---------------------------------------------------------------------------

const scriptTheme = EditorView.theme({
  "&": {
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  ".cm-content": {
    caretColor: "var(--accent-primary)",
    padding: "8px 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent-primary)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent-primary) 20%, transparent) !important",
  },
  ".cm-activeLine": {
    background: "color-mix(in srgb, var(--accent-primary) 5%, transparent)",
  },
  ".cm-gutters": {
    background: "var(--bg-panel)",
    color: "var(--text-muted)",
    border: "none",
    borderRight: "1px solid var(--border-color)",
  },
  ".cm-activeLineGutter": {
    background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 4px",
  },
  ".cm-tooltip": {
    background: "var(--bg-panel)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    background: "color-mix(in srgb, var(--accent-primary) 20%, transparent)",
    color: "var(--text-primary)",
  },
});

// ---------------------------------------------------------------------------
// ScriptEditor
// ---------------------------------------------------------------------------

export interface ScriptEditorProps {
  script: ScriptModel;
  onChange: (script: ScriptModel) => void;
}

export function ScriptEditor({ script, onChange }: ScriptEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastCodeRef = useRef<string>(script.code ?? "");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const scriptRef = useRef(script);
  scriptRef.current = script;

  const handleUpdate = useCallback((text: string) => {
    lastCodeRef.current = text;
    onChangeRef.current({ ...scriptRef.current, code: text });
  }, []);

  // Create CodeMirror instance
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        handleUpdate(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: script.code ?? "",
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        bracketMatching(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle),
        StreamLanguage.define(lua),
        scriptTheme,
        autocompletion({ override: [scriptCompletions] }),
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only create the editor once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync incoming prop changes (external model changes)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const incomingCode = script.code ?? "";
    const currentText = view.state.doc.toString();

    if (incomingCode !== currentText && incomingCode !== lastCodeRef.current) {
      lastCodeRef.current = incomingCode;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: incomingCode },
      });
    }
  }, [script]);

  return <div className="be-code-editor" ref={containerRef} />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Summarize a script by scanning for on() handler registrations. */
// eslint-disable-next-line react-refresh/only-export-components
export function scriptSummary(s: ScriptModel): string {
  const code = s.code ?? "";
  const matches = [...code.matchAll(/on\s*\(\s*"([^"]+)"/g)];
  const events = matches.map((m) => m[1]);
  const name = s.name;
  if (events.length === 0) {
    return name ? `${name}: (no handlers)` : "(no handlers)";
  }
  const triggers = [...new Set(events)].join(", ");
  return name ? `${name}: on ${triggers}` : `on ${triggers}`;
}

/** Create a new empty script. */
// eslint-disable-next-line react-refresh/only-export-components
export function newScript(): ScriptModel {
  return {
    code: `on("tick", function(event)\n  -- handler code here\nend)\n`,
  };
}
