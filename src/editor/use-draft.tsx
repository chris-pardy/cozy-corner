import { useState, useEffect, useRef, useCallback } from "react";
import type { SpriteEditorResult } from "./SpritePixelEditor";
import {
  getDraft,
  putDraft,
  deleteDraft,
  serializeSprites,
  deserializeSprites,
} from "./draft-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftState {
  state: Record<string, unknown>;
  sprites: Map<string, SpriteEditorResult>;
}

export interface UseDraftResult {
  /** True while checking for an existing draft */
  isLoading: boolean;
  /** Non-null if there is a draft the user hasn't accepted or discarded */
  pendingDraft: { updatedAt: number; label: string } | null;
  /** Deserialize the pending draft into editor state */
  acceptDraft: () => Promise<DraftState>;
  /** Delete the pending draft */
  discardDraft: () => void;
  /** Schedule a debounced draft save (5 s) */
  saveDraft: (
    state: Record<string, unknown>,
    sprites: Map<string, SpriteEditorResult>,
    label: string,
  ) => void;
  /** Flush any pending debounced save immediately */
  flushDraft: () => Promise<void>;
  /** Clear the draft from IDB (call on successful PDS save) */
  clearDraft: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 5_000;

// eslint-disable-next-line react-refresh/only-export-components
export function useDraft(key: string | undefined): UseDraftResult {
  const [isLoading, setIsLoading] = useState(!!key);
  const [rawDraft, setRawDraft] = useState<{
    updatedAt: number;
    label: string;
    // Keep the full record for acceptDraft to deserialize
    _record: Awaited<ReturnType<typeof getDraft>>;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{
    state: Record<string, unknown>;
    sprites: Map<string, SpriteEditorResult>;
    label: string;
  } | null>(null);
  const keyRef = useRef(key);
  // eslint-disable-next-line react-hooks/refs
  keyRef.current = key;

  // Check for existing draft on mount
  useEffect(() => {
    if (!key) {
      queueMicrotask(() => setIsLoading(false));
      return;
    }
    let cancelled = false;
    getDraft(key)
      .then((d) => {
        if (cancelled) return;
        if (d) {
          setRawDraft({
            updatedAt: d.updatedAt,
            label: d.label,
            _record: d,
          });
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Internal save implementation
  const doSave = useCallback(async () => {
    const pending = pendingRef.current;
    const k = keyRef.current;
    if (!pending || !k) return;
    pendingRef.current = null;
    try {
      const serialized = await serializeSprites(pending.sprites);
      await putDraft({
        key: k,
        updatedAt: Date.now(),
        label: pending.label,
        state: pending.state,
        sprites: serialized,
      });
    } catch (e) {
      console.warn("Draft save failed:", e);
    }
  }, []);

  const saveDraft = useCallback(
    (
      state: Record<string, unknown>,
      sprites: Map<string, SpriteEditorResult>,
      label: string,
    ) => {
      pendingRef.current = { state, sprites, label };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doSave, DEBOUNCE_MS);
    },
    [doSave],
  );

  const flushDraft = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await doSave();
  }, [doSave]);

  const acceptDraft = useCallback(async (): Promise<DraftState> => {
    const record = rawDraft?._record;
    if (!record) throw new Error("No draft to accept");
    const sprites = await deserializeSprites(record.sprites);
    setRawDraft(null);
    return { state: record.state, sprites };
  }, [rawDraft]);

  const discardDraft = useCallback(() => {
    setRawDraft(null);
    if (key) deleteDraft(key).catch(() => {});
  }, [key]);

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    if (key) deleteDraft(key).catch(() => {});
  }, [key]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    isLoading,
    pendingDraft: rawDraft
      ? { updatedAt: rawDraft.updatedAt, label: rawDraft.label }
      : null,
    acceptDraft,
    discardDraft,
    saveDraft,
    flushDraft,
    clearDraft,
  };
}

// ---------------------------------------------------------------------------
// DraftBanner — shown when an unsaved draft exists
// ---------------------------------------------------------------------------

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DraftBanner({
  updatedAt,
  label,
  onResume,
  onDiscard,
  resuming,
}: {
  updatedAt: number;
  label: string;
  onResume: () => void;
  onDiscard: () => void;
  resuming?: boolean;
}) {
  const ago = formatTimeAgo(updatedAt);
  return (
    <div
      style={{
        maxWidth: 400,
        margin: "64px auto",
        padding: 24,
        background: "var(--bg-panel)",
        border:
          "2px solid color-mix(in srgb, var(--accent-primary) 40%, transparent)",
        borderRadius: 2,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 11,
          color: "var(--accent-primary)",
          marginBottom: 8,
        }}
      >
        Draft Found
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
        {label || "Untitled"}
      </div>
      <div
        style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 16 }}
      >
        Last edited {ago}
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button
          className="spe-done-btn"
          onClick={onResume}
          disabled={resuming}
        >
          {resuming ? "Loading..." : "Resume"}
        </button>
        <button
          className="spe-cancel-btn"
          onClick={onDiscard}
          disabled={resuming}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
