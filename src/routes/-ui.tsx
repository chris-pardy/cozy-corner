import { useState, useCallback, type FormEvent } from "react";
import { PDSBrowser, type BrowsableType } from "~/atproto/PDSBrowser";

// ---------------------------------------------------------------------------
// getErrorMessage — extract a message from an unknown caught value
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  return err instanceof Error ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// ErrorAlert — styled error message div
// ---------------------------------------------------------------------------

export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm">
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingMessage — centered loading text
// ---------------------------------------------------------------------------

export function LoadingMessage({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="text-text-muted text-xs py-8 text-center">
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDSBrowserModal — reusable modal wrapping PDSBrowser with handle lookup
// ---------------------------------------------------------------------------

export function PDSBrowserModal({
  title,
  pds,
  allowedTypes,
  defaultHandle,
  onSelectRecord,
  onClose,
}: {
  title: string;
  pds: string;
  allowedTypes: BrowsableType[];
  defaultHandle?: string;
  onSelectRecord: (uri: string, cid: string, value: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [handle, setHandle] = useState(defaultHandle ?? "");
  const [browseActor, setBrowseActor] = useState<string | null>(
    defaultHandle ?? null,
  );

  const handleLookup = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const v = handle.trim();
      if (v) setBrowseActor(v);
    },
    [handle],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative bg-bg-panel border-2 border-border rounded-sm p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xs text-accent-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xs cursor-pointer bg-transparent border-0"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleLookup} className="flex gap-2 mb-4">
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="handle or DID"
            className="flex-1 bg-bg-deep text-text-primary border-2 border-border rounded-sm px-2.5 py-2 font-body text-xs outline-none focus:border-accent-primary"
          />
          <button
            type="submit"
            className="bg-accent-primary/10 border-2 border-accent-primary rounded-sm text-accent-primary cursor-pointer font-heading text-[10px] py-2 px-4 hover:bg-accent-primary/20 active:bg-accent-primary/30"
          >
            Lookup
          </button>
        </form>

        {browseActor && pds && (
          <PDSBrowser
            key={browseActor}
            actor={browseActor}
            pds={pds}
            allowedTypes={allowedTypes}
            onSelectRecord={onSelectRecord}
          />
        )}
      </div>
    </div>
  );
}
