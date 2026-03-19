import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PDSBrowser } from "~/atproto/PDSBrowser";
import { getSession, saveRecord, parseAtUri, fetchRecord } from "./load-record";
import "./editor.css";

export function HouseEditor({
  uri,
}: {
  uri?: string;
  editRkey?: string;
}) {
  const session = (() => {
    try {
      return getSession();
    } catch {
      return null;
    }
  })();

  if (!session) {
    return (
      <div className="text-text-muted text-xs py-8 text-center">
        You must be logged in to create a house.
      </div>
    );
  }

  return <HouseEditorForm key={uri} session={session} uri={uri} />;
}

interface SelectedRoom {
  uri: string;
  cid: string;
  name: string;
}

function HouseEditorForm({
  session,
  uri,
}: {
  session: { accessJwt: string; did: string; handle: string; pds: string };
  uri?: string;
}) {
  const [name, setName] = useState("");
  const [entryRoom, setEntryRoom] = useState<SelectedRoom | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!uri);

  // Load existing house record
  useState(() => {
    if (!uri) return;
    const { did, collection, rkey } = parseAtUri(uri);
    fetchRecord(session.pds, did, collection, rkey)
      .then((rec) => {
        const v = rec.value;
        if (v.name) setName(v.name as string);
        const entry = v.entry as { uri?: string; cid?: string } | undefined;
        if (entry?.uri && entry?.cid) {
          // Try to load room name
          const parsed = parseAtUri(entry.uri);
          fetchRecord(session.pds, parsed.did, parsed.collection, parsed.rkey)
            .then((roomRec) => {
              setEntryRoom({
                uri: entry.uri!,
                cid: entry.cid!,
                name: (roomRec.value.name as string) ?? parsed.rkey,
              });
            })
            .catch(() => {
              setEntryRoom({
                uri: entry.uri!,
                cid: entry.cid!,
                name: parsed.rkey,
              });
            })
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  });

  function handleSelectRecord(
    recUri: string,
    cid: string,
    value: Record<string, unknown>,
  ) {
    setEntryRoom({
      uri: recUri,
      cid,
      name: (value.name as string) ?? parseAtUri(recUri).rkey,
    });
  }

  async function doSave() {
    if (!entryRoom) return;
    setSaving(true);
    setSaveError(null);

    try {
      const record = {
        $type: "at.cozy-corner.house",
        ...(name.trim() ? { name: name.trim() } : {}),
        entry: {
          uri: entryRoom.uri,
          cid: entryRoom.cid,
        },
        createdAt: new Date().toISOString(),
      };

      // House is always rkey "self"
      const saved = await saveRecord(
        session,
        "at.cozy-corner.house",
        record,
        "self",
      );
      setSavedUri(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-text-muted text-xs py-8 text-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="font-heading text-sm text-accent-primary mb-6">
        {uri ? "Edit House" : "Create House"}
      </h2>

      {/* Name */}
      <div className="mb-6">
        <div className="ale-label">Name</div>
        <input
          className="bae-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Cozy Home"
          maxLength={64}
        />
      </div>

      {/* Entry Room */}
      <div className="mb-6">
        <div className="ale-label">Entry Room</div>
        {entryRoom ? (
          <div className="flex items-center gap-3 p-3 bg-bg-panel border-2 border-accent-primary/30 rounded-sm">
            <div className="flex-1 min-w-0">
              <div className="font-heading text-[11px] text-text-primary">
                {entryRoom.name}
              </div>
              <div className="text-[9px] text-text-muted truncate mt-0.5">
                {entryRoom.uri}
              </div>
            </div>
            <button
              onClick={() => setEntryRoom(null)}
              className="text-text-muted hover:text-error text-xs cursor-pointer bg-transparent border-0 flex-shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-text-muted mb-2">
            Select a room from the browser below
          </div>
        )}
      </div>

      {/* PDS Browser for rooms */}
      {!entryRoom && (
        <div className="mb-6 p-4 bg-bg-panel border-2 border-border rounded-sm">
          <PDSBrowser
            actor={session.did}
            pds={session.pds}
            allowedTypes={["room"]}
            onSelectRecord={handleSelectRecord}
          />
        </div>
      )}

      {/* Enter House — show when a room is set and house has been saved */}
      {entryRoom && (savedUri || uri) && (
        <div className="mb-6">
          <Link
            to="/$handle/$nsid"
            params={{
              handle: session.handle || session.did,
              nsid: "at.cozy-corner.house",
            }}
            className="spe-done-btn block text-center no-underline"
            style={{ width: "100%" }}
          >
            Enter House
          </Link>
        </div>
      )}

      {/* Save */}
      <div className="flex flex-col gap-2">
        <button
          className="spe-done-btn"
          disabled={!entryRoom || saving}
          onClick={doSave}
          style={{ width: "100%" }}
        >
          {saving ? "Saving..." : "Save House"}
        </button>
        {saveError && (
          <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm">
            {saveError}
          </div>
        )}
        {savedUri && (
          <div className="text-[11px] text-success px-2 py-1.5 bg-success/8 border border-success/20 rounded-sm">
            Saved
          </div>
        )}
      </div>
    </div>
  );
}
