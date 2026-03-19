import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  getSession,
  fetchRecord,
  saveRecord,
  type Session,
} from "~/editor/load-record";
import { DEFAULT_SERVICE_HANDLERS } from "~/engine/state/activation";
import type { ServiceHandler } from "~/atproto/generated/types/at/cozy-corner/settings";
import { ErrorAlert, LoadingMessage, getErrorMessage } from "~/routes/-ui";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION = "at.cozy-corner.settings";
const RKEY = "self";

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

function SettingsPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // Loaded handlers from PDS
  const [handlers, setHandlers] = useState<ServiceHandler[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auth check
  useEffect(() => {
    try {
      const s = getSession();
      setSession(s);
      setReady(true);
    } catch {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  // Load settings record
  useEffect(() => {
    if (!ready || !session) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const record = await fetchRecord(
          session!.pds,
          session!.did,
          COLLECTION,
          RKEY,
        );
        if (!cancelled) {
          const value = record.value as { serviceHandlers?: ServiceHandler[] };
          setHandlers(value.serviceHandlers ?? []);
        }
      } catch {
        // No settings record yet — start with empty list
        if (!cancelled) setHandlers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ready, session]);

  // Save
  const handleSave = useCallback(async () => {
    if (!session) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveRecord(
        session,
        COLLECTION,
        {
          $type: COLLECTION,
          serviceHandlers: handlers,
          createdAt: new Date().toISOString(),
        },
        RKEY,
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }, [session, handlers]);

  // Add empty handler
  const addHandler = useCallback(() => {
    setHandlers((prev) => [...prev, { collection: "", urlTemplate: "" }]);
  }, []);

  // Update handler field
  const updateHandler = useCallback(
    (index: number, field: "collection" | "urlTemplate", value: string) => {
      setHandlers((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  // Remove handler
  const removeHandler = useCallback((index: number) => {
    setHandlers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  if (!ready) return null;

  return (
    <div className="min-h-screen font-body">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-heading text-sm text-accent-primary mb-6">
          Settings
        </h1>

        {/* ----------------------------------------------------------------- */}
        {/* Service Handlers */}
        {/* ----------------------------------------------------------------- */}

        <section className="mb-8">
          <h2 className="font-heading text-[11px] text-text-primary uppercase tracking-wide mb-1">
            Service Handlers
          </h2>
          <p className="text-[11px] text-text-muted mb-4 leading-relaxed">
            When you click a linked AT Protocol record in a room, the client
            opens it in an iframe. Service handlers map record collections to
            front-end URLs. Your overrides take priority over the built-in
            defaults below.
          </p>

          {/* Built-in defaults (read-only) */}
          <div className="mb-6">
            <div className="font-heading text-[10px] text-text-muted uppercase tracking-wide mb-2">
              Built-in defaults
            </div>
            {DEFAULT_SERVICE_HANDLERS.map((h) => (
              <div
                key={h.collection}
                className="flex items-start gap-3 p-3 bg-bg-surface border-2 border-border rounded-sm mb-2 opacity-60"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-text-muted font-heading uppercase tracking-wide mb-1">
                    Collection
                  </div>
                  <div className="text-[11px] text-text-primary font-mono truncate">
                    {h.collection}
                  </div>
                </div>
                <div className="flex-[2] min-w-0">
                  <div className="text-[10px] text-text-muted font-heading uppercase tracking-wide mb-1">
                    URL Template
                  </div>
                  <div className="text-[11px] text-text-primary font-mono truncate">
                    {h.urlTemplate}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-[10px] text-text-muted italic mt-1">
              Additionally, any <span className="font-mono">at.cozy-corner.*</span> record
              opens in-app automatically.
            </div>
          </div>

          {/* User overrides */}
          <div>
            <div className="font-heading text-[10px] text-text-muted uppercase tracking-wide mb-2">
              Your overrides
            </div>

            {loading && (
              <LoadingMessage />
            )}

            {error && (
              <div className="mb-3">
                <ErrorAlert message={error} />
              </div>
            )}

            {!loading && handlers.length === 0 && (
              <div className="text-[11px] text-text-muted py-4 text-center border-2 border-dashed border-border rounded-sm">
                No custom handlers. Add one to override a default or handle a
                new collection.
              </div>
            )}

            {!loading &&
              handlers.map((h, i) => (
                <div
                  key={i}
                  className="p-3 bg-bg-panel border-2 border-border rounded-sm mb-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] text-text-muted font-heading uppercase tracking-wide block mb-1">
                        Collection
                      </label>
                      <input
                        type="text"
                        value={h.collection}
                        onChange={(e) =>
                          updateHandler(i, "collection", e.target.value)
                        }
                        placeholder="app.bsky.feed.post"
                        className="w-full bg-bg-deep border-2 border-border rounded-sm px-2 py-1.5 text-[11px] text-text-primary font-mono focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex-[2] min-w-0">
                      <label className="text-[10px] text-text-muted font-heading uppercase tracking-wide block mb-1">
                        URL Template
                      </label>
                      <input
                        type="text"
                        value={h.urlTemplate}
                        onChange={(e) =>
                          updateHandler(i, "urlTemplate", e.target.value)
                        }
                        placeholder="https://example.com/{{authority}}/{{key}}"
                        className="w-full bg-bg-deep border-2 border-border rounded-sm px-2 py-1.5 text-[11px] text-text-primary font-mono focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => removeHandler(i)}
                      className="mt-5 shrink-0 text-[10px] text-error/70 hover:text-error bg-transparent border-none cursor-pointer font-heading uppercase tracking-wide p-0"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-[9px] text-text-muted mt-1.5">
                    Use{" "}
                    <span className="font-mono">{"{{authority}}"}</span>,{" "}
                    <span className="font-mono">{"{{collection}}"}</span>,{" "}
                    <span className="font-mono">{"{{key}}"}</span> as
                    placeholders.
                  </div>
                </div>
              ))}

            {!loading && (
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={addHandler}
                  className="font-heading text-[10px] px-3 py-1.5 rounded-sm border-2 border-accent-primary/50 text-accent-primary/80 hover:border-accent-primary hover:text-accent-primary bg-transparent cursor-pointer uppercase tracking-wide transition-colors"
                >
                  + Add Handler
                </button>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="font-heading text-[10px] px-4 py-1.5 rounded-sm border-2 border-accent-primary bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 cursor-pointer uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-default"
                >
                  {saving ? "Saving..." : "Save"}
                </button>

                {saveSuccess && (
                  <span className="text-[10px] text-clr-success font-heading">
                    Saved
                  </span>
                )}

                {saveError && (
                  <span className="text-[10px] text-error font-heading">
                    {saveError}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
