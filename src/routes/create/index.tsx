import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { type BrowsableType } from "~/atproto/PDSBrowser";
import { parseAtUri } from "~/lib/at-protocol";
import { listDrafts, deleteDraft, type DraftRecord } from "~/editor/draft-store";
import { KNOWN_NSIDS, getNsidLabel } from "~/lib/nsid-registry";
import { PDSBrowserModal } from "~/routes/-ui";

export const Route = createFileRoute("/create/")({
  component: CreateIndex,
});

const LOAD_TYPES: BrowsableType[] = [
  "item",
  "base",
  "wearable",
  "critter",
  "tileset",
  "starterPack",
  "room",
];

const choices = [
  { label: "Base Avatar", nsid: "at.cozy-corner.avatar.base", desc: "Create a base body for avatars" },
  { label: "Wearable", nsid: "at.cozy-corner.avatar.wearable", desc: "Clothing, hair, and accessories" },
  { label: "Item", nsid: "at.cozy-corner.item", desc: "Furniture and decorations" },
  { label: "Critter", nsid: "at.cozy-corner.critter", desc: "NPCs and creatures" },
  { label: "Tileset", nsid: "at.cozy-corner.tileset", desc: "Floor and wall tiles" },
  { label: "Starter Pack", nsid: "at.cozy-corner.starterPack", desc: "Curated collections" },
  { label: "Room", nsid: "at.cozy-corner.house.room", desc: "Design a room in your house" },
];

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

function CreateIndex() {
  const navigate = useNavigate();
  const [showBrowser, setShowBrowser] = useState(false);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);

  const session = JSON.parse(localStorage.getItem("session") ?? "{}");
  const sessionPds: string | undefined = session.pds;
  const myHandle: string | undefined = session.handle;

  useEffect(() => {
    listDrafts().then(setDrafts).catch(() => {});
  }, []);

  function handleSelectRecord(uri: string) {
    const parsed = parseAtUri(uri);
    if (!parsed) return;
    const { did, collection, rkey } = parsed;
    if (KNOWN_NSIDS.has(collection)) {
      setShowBrowser(false);
      navigate({
        to: "/create/$actor/$nsid/$tid",
        params: { actor: did, nsid: collection, tid: rkey },
      });
    }
  }

  function openBrowser() {
    setShowBrowser(true);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-heading text-sm text-accent-primary mb-8">
        What would you like to create?
      </h1>

      <button
        onClick={openBrowser}
        className="w-full mb-4 flex flex-col gap-2 p-5 bg-bg-panel border-2 border-accent-secondary/50 rounded-sm hover:border-accent-secondary hover:bg-bg-surface transition-colors group text-left cursor-pointer"
      >
        <span className="font-heading text-xs text-text-primary group-hover:text-accent-secondary transition-colors">
          Load Existing
        </span>
        <span className="text-[11px] text-text-muted">
          Load from any PDS to edit or save a copy
        </span>
      </button>

      {drafts.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-[10px] text-text-muted mb-3 uppercase tracking-wider">
            Unsaved Drafts
          </h2>
          <div className="flex flex-col gap-2">
            {drafts.map((d) => {
              // Parse key: "nsid|actor|tid"
              const [nsid, actor, tid] = d.key.split("|");
              const typeLabel = getNsidLabel(nsid);
              return (
                <div
                  key={d.key}
                  className="flex items-center gap-3 p-3 bg-bg-panel border-2 border-accent-primary/30 rounded-sm"
                >
                  <button
                    onClick={() =>
                      navigate({
                        to: "/create/$actor/$nsid/$tid",
                        params: { actor, nsid, tid },
                      })
                    }
                    className="flex-1 text-left bg-transparent border-0 cursor-pointer p-0"
                  >
                    <span className="font-heading text-xs text-accent-primary">
                      {d.label || "Untitled"}
                    </span>
                    <span className="text-[10px] text-text-muted ml-2">
                      {typeLabel} &middot; {formatTimeAgo(d.updatedAt)}
                    </span>
                  </button>
                  <button
                    onClick={async () => {
                      await deleteDraft(d.key);
                      setDrafts((prev) => prev.filter((x) => x.key !== d.key));
                    }}
                    className="text-[10px] text-text-muted hover:text-error bg-transparent border-0 cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {myHandle && choices.map((c) => (
          <Link
            key={c.nsid}
            to="/create/$actor/$nsid/$tid"
            params={{ actor: myHandle, nsid: c.nsid, tid: "new" }}
            className="flex flex-col gap-2 p-5 bg-bg-panel border-2 border-border rounded-sm hover:border-border-hover hover:bg-bg-surface transition-colors group"
          >
            <span className="font-heading text-xs text-text-primary group-hover:text-accent-primary transition-colors">
              {c.label}
            </span>
            <span className="text-[11px] text-text-muted">
              {c.desc}
            </span>
          </Link>
        ))}
      </div>

      {showBrowser && sessionPds && (
        <PDSBrowserModal
          title="Load from PDS"
          pds={sessionPds}
          allowedTypes={LOAD_TYPES}
          defaultHandle={myHandle}
          onSelectRecord={handleSelectRecord}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  );
}
