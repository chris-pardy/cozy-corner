import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  getPds,
  resolveHandle,
  extractBlobCid,
  blobUrl,
  fetchRecord as sharedFetchRecord,
} from "~/lib/at-protocol";
import { ErrorAlert, LoadingMessage, getErrorMessage } from "~/routes/-ui";

/**
 * Fetch a record, returning null instead of throwing on failure.
 * (The house view treats a missing record as "no house found".)
 */
async function fetchRecord(
  pds: string,
  did: string,
  collection: string,
  rkey: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { value } = await sharedFetchRecord(pds, did, collection, rkey);
    return value;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HouseView — loads house record and shows splash + enter button
// ---------------------------------------------------------------------------

interface HouseData {
  name?: string;
  splashUrl?: string;
  entryRoomUri?: string;
}

export function HouseView({ handle }: { handle: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [house, setHouse] = useState<HouseData | null>(null);
  const [pds] = useState(() => getPds());
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        let did: string;
        if (handle.startsWith("did:")) {
          did = handle;
        } else {
          did = await resolveHandle(pds, handle);
        }

        const value = await fetchRecord(
          pds,
          did,
          "at.cozy-corner.house",
          "self",
        );

        if (!value) {
          if (!cancelled) {
            setError("No house found");
            setLoading(false);
          }
          return;
        }

        const data: HouseData = {
          name: value.name as string | undefined,
        };

        // Resolve splash image
        if (value.splash) {
          const cid = extractBlobCid(value.splash);
          if (cid) {
            data.splashUrl = blobUrl(pds, did, cid);
          }
        }

        // Resolve entry room URI
        const entry = value.entry as { uri?: string } | undefined;
        if (entry?.uri) {
          data.entryRoomUri = entry.uri;
        }

        if (!cancelled) {
          setHouse(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Failed to load house"));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [handle, pds]);

  function enterHouse() {
    if (!house?.entryRoomUri) return;
    // URI format: at://did:xxx/at.cozy-corner.house.room/rkey
    const parts = house.entryRoomUri.replace("at://", "").split("/");
    const roomDid = parts[0];
    const collection = parts[1];
    const rkey = parts[2];
    navigate({
      to: "/$handle/$nsid/$tid",
      params: { handle: roomDid, nsid: collection, tid: rkey },
    });
  }

  return (
    <div className="min-h-screen font-body">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {loading && <LoadingMessage message="Loading house..." />}

        <ErrorAlert message={error} />

        {!loading && !error && house && (
          <div className="flex flex-col items-center gap-6">
            {house.name && (
              <h1 className="font-heading text-sm text-text-primary">
                {house.name}
              </h1>
            )}

            {house.splashUrl && (
              <div className="border-2 border-border rounded-sm bg-bg-panel p-4 flex items-center justify-center">
                <img
                  src={house.splashUrl}
                  alt={house.name ?? "House splash"}
                  style={{ imageRendering: "pixelated", maxWidth: "100%" }}
                />
              </div>
            )}

            {house.entryRoomUri && (
              <button
                onClick={enterHouse}
                className="btn font-heading text-xs px-6 py-3 cursor-pointer"
              >
                Enter House
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
