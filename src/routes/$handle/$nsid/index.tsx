import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import type {
  AnimationLayer,
  LayerTint,
  Transform,
} from "~/atproto/generated/types/at/cozy-corner/defs";
import type * as Avatar from "~/atproto/generated/types/at/cozy-corner/avatar";
import {
  defaultAvatarUrl,
  defaultAvatarLayers,
} from "~/atproto/default-avatar-base";
import { Entity } from "~/engine/entity";
import { RenderEvent } from "~/engine/event";
import { CompositeRenderBehavior } from "~/engine/behaviors/composite-render";
import { LayerStackRenderBehavior } from "~/engine/behaviors/layer-stack-render";
import {
  LAYERS,
  SPRITE_SHEET,
  TARGET,
  TARGET_START_TIME,
  CHILD_RENDER_CONFIG,
  type ChildRenderConfig,
} from "~/engine/state/render";
import { CATEGORY_COLORS } from "~/atproto/inventory";
import { InventoryCategoryGrid } from "~/atproto/InventoryCategoryGrid";
import { useInventoryManagement } from "~/atproto/useInventoryManagement";
import {
  getSession,
  getPds,
  resolveHandle,
  extractBlobCid,
  blobUrl,
  loadImage,
  fetchRecord as sharedFetchRecord,
  parseAtUri,
} from "~/lib/at-protocol";
import { HouseView } from "~/routes/-house-view";
import { ErrorAlert, LoadingMessage, getErrorMessage } from "~/routes/-ui";

/**
 * Fetch a record value, returning null instead of throwing on failure.
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

export const Route = createFileRoute("/$handle/$nsid/")({
  component: CollectionPage,
});


// ---------------------------------------------------------------------------
// CollectionPage — dispatches based on nsid
// ---------------------------------------------------------------------------

function CollectionPage() {
  const { handle, nsid } = Route.useParams();

  if (nsid === "at.cozy-corner.house") {
    return <HouseView handle={handle} />;
  }

  if (nsid === "at.cozy-corner.inventory") {
    return <InventoryView handle={handle} />;
  }

  if (nsid === "at.cozy-corner.avatar") {
    return <AvatarView handle={handle} />;
  }

  return (
    <div className="min-h-screen font-body">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="text-text-muted text-xs py-8 text-center">
          Unknown collection: {nsid}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar helpers & types
// ---------------------------------------------------------------------------

interface LoadedAvatarLayer {
  image: HTMLImageElement;
  layers: AnimationLayer[];
  tints: LayerTint[];
  transform?: Transform;
}

const DIRECTION_TARGETS = [
  { label: "S", target: "idle-south" },
  { label: "N", target: "idle-north" },
  { label: "E", target: "idle-east" },
  { label: "W", target: "idle-west" },
  { label: "Walk S", target: "walk-south" },
  { label: "Walk N", target: "walk-north" },
  { label: "Walk E", target: "walk-east" },
  { label: "Walk W", target: "walk-west" },
] as const;

// ---------------------------------------------------------------------------
// AvatarPreview — animated composite avatar with rAF loop
// ---------------------------------------------------------------------------

function AvatarPreview({
  loadedLayers,
  size = 192,
}: {
  loadedLayers: LoadedAvatarLayer[];
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<Entity | null>(null);
  const rafRef = useRef<number>(0);
  const [activeTarget, setActiveTarget] = useState("idle-south");
  // eslint-disable-next-line react-hooks/purity
  const startTimeRef = useRef(performance.now());

  const frameSize = useMemo(() => {
    let w = 0;
    let h = 0;
    for (const loaded of loadedLayers) {
      for (const layer of loaded.layers) {
        if (layer.target === activeTarget && layer.frames.length > 0) {
          w = Math.max(w, layer.frames[0].width);
          h = Math.max(h, layer.frames[0].height);
        }
      }
    }
    return { w: w || 32, h: h || 32 };
  }, [loadedLayers, activeTarget]);

  // Build entity tree when loadedLayers or target changes
  useEffect(() => {
    const root = new Entity([new CompositeRenderBehavior()]);
    const configMap = new Map<Entity, ChildRenderConfig>();

    for (const loaded of loadedLayers) {
      const child = new Entity([new LayerStackRenderBehavior()]);
      child.set(LAYERS, loaded.layers);
      child.set(SPRITE_SHEET, loaded.image);
      child.set(TARGET, activeTarget);
      child.set(TARGET_START_TIME, startTimeRef.current);
      root.addChild(child);

      configMap.set(child, {
        tints: loaded.tints,
        transform: loaded.transform,
      });
    }

    root.set(CHILD_RENDER_CONFIG, configMap);
    rootRef.current = root;
  }, [loadedLayers, activeTarget]);

  // Reset start time when target changes
  useEffect(() => {
    startTimeRef.current = performance.now();
  }, [activeTarget]);

  const scale = Math.max(
    1,
    Math.floor(size / Math.max(frameSize.w, frameSize.h)),
  );
  const cw = frameSize.w * scale;
  const ch = frameSize.h * scale;

  // rAF draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = cw;
    canvas.height = ch;

    function draw(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, cw, ch);

      // Checkerboard background
      const checkSize = scale * 4;
      for (let cy = 0; cy < ch; cy += checkSize) {
        for (let cx = 0; cx < cw; cx += checkSize) {
          ctx.fillStyle =
            (Math.floor(cx / checkSize) + Math.floor(cy / checkSize)) % 2 === 0
              ? "#1a2035"
              : "#141a2e";
          ctx.fillRect(cx, cy, checkSize, checkSize);
        }
      }

      // Render entity tree
      const root = rootRef.current;
      if (root) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.scale(scale, scale);
        root.emit(new RenderEvent(ctx, time));
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cw, ch, scale]);

  // Determine which targets are available
  const availableTargets = useMemo(() => {
    const targetSet = new Set<string>();
    for (const loaded of loadedLayers) {
      for (const layer of loaded.layers) {
        targetSet.add(layer.target);
      }
    }
    return DIRECTION_TARGETS.filter((d) => targetSet.has(d.target));
  }, [loadedLayers]);

  return (
    <div>
      <div className="border-2 border-border rounded-sm bg-bg-panel p-4 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            imageRendering: "pixelated",
            width: cw,
            height: ch,
          }}
        />
      </div>

      {availableTargets.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {availableTargets.map((d) => (
            <button
              key={d.target}
              onClick={() => setActiveTarget(d.target)}
              className={`font-heading text-[10px] px-2.5 py-1.5 rounded-sm border-2 cursor-pointer ${
                activeTarget === d.target
                  ? "bg-accent-primary/15 border-accent-primary text-accent-primary"
                  : "bg-bg-surface border-border text-text-muted hover:border-border-hover hover:text-text-primary"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AvatarView — loads and displays the composited avatar
// ---------------------------------------------------------------------------

function AvatarView({ handle }: { handle: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedLayers, setLoadedLayers] = useState<LoadedAvatarLayer[]>([]);
  const [pds] = useState(() => getPds());
  const [session] = useState(() => getSession());
  const [resolvedDid, setResolvedDid] = useState<string | null>(null);

  const isOwner = useMemo(() => {
    if (!session || !resolvedDid) return false;
    return session.did === resolvedDid;
  }, [session, resolvedDid]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Resolve handle -> DID
        let did: string;
        if (handle.startsWith("did:")) {
          did = handle;
        } else {
          did = await resolveHandle(pds, handle);
        }
        if (!cancelled) setResolvedDid(did);

        // Fetch avatar record (rkey = "self")
        const avatarValue = await fetchRecord(
          pds,
          did,
          "at.cozy-corner.avatar",
          "self",
        );

        const layers: LoadedAvatarLayer[] = [];

        // Load base avatar
        if (avatarValue?.baseAvatar) {
          const ref = avatarValue.baseAvatar as { uri: string; cid: string };
          const parsed = parseAtUri(ref.uri);
          if (!parsed) throw new Error("Invalid base avatar URI");
          const baseRec = await fetchRecord(
            pds,
            parsed.did,
            parsed.collection,
            parsed.rkey,
          );
          if (baseRec?.spriteSheet) {
            const blobCid = extractBlobCid(baseRec.spriteSheet);
            if (blobCid) {
              const img = await loadImage(blobUrl(pds, parsed.did, blobCid));
              layers.push({
                image: img,
                layers: (baseRec.layers ?? []) as AnimationLayer[],
                tints: (avatarValue.baseAvatarTints ?? []) as LayerTint[],
                transform: avatarValue.baseAvatarTransform as
                  | Transform
                  | undefined,
              });
            }
          }
        } else {
          // Use default avatar base
          const img = await loadImage(defaultAvatarUrl);
          layers.push({
            image: img,
            layers: defaultAvatarLayers,
            tints: (avatarValue?.baseAvatarTints ?? []) as LayerTint[],
            transform: avatarValue?.baseAvatarTransform as
              | Transform
              | undefined,
          });
        }

        // Load equipped wearables
        const wearables = (avatarValue?.wearables ??
          []) as Avatar.EquippedWearable[];
        for (const equipped of wearables) {
          const ref = equipped.wearable as { uri: string; cid: string };
          const parsed = parseAtUri(ref.uri);
          if (!parsed) continue;
          const wearableRec = await fetchRecord(
            pds,
            parsed.did,
            parsed.collection,
            parsed.rkey,
          );
          if (wearableRec?.spriteSheet) {
            const blobCid = extractBlobCid(wearableRec.spriteSheet);
            if (blobCid) {
              try {
                const img = await loadImage(
                  blobUrl(pds, parsed.did, blobCid),
                );
                layers.push({
                  image: img,
                  layers: (wearableRec.layers ?? []) as AnimationLayer[],
                  tints: (equipped.tints ?? []) as LayerTint[],
                  transform: equipped.transform as Transform | undefined,
                });
              } catch {
                // Skip wearable if image fails to load
              }
            }
          }
        }

        if (!cancelled) {
          setLoadedLayers(layers);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            getErrorMessage(err, "Failed to load avatar"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [handle, pds]);

  return (
    <div className="min-h-screen font-body">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {loading && <LoadingMessage message="Loading avatar..." />}

        <ErrorAlert message={error} />

        {!loading && !error && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="font-heading text-[10px] uppercase tracking-wide text-accent-secondary">
                Avatar
              </span>
              <div className="flex items-center justify-between mt-1">
                <h1 className="font-heading text-sm text-text-primary">
                  {handle}
                </h1>
                {session && resolvedDid && (
                  <Link
                    to="/create/$actor/$nsid/$tid"
                    params={{
                      actor: isOwner ? session.did : resolvedDid,
                      nsid: "at.cozy-corner.avatar",
                      tid: "self",
                    }}
                    className="font-heading text-[10px] px-3 py-1.5 rounded-sm border-2 border-accent-secondary/50 text-accent-secondary/80 hover:border-accent-secondary hover:text-accent-secondary transition-colors"
                  >
                    {isOwner ? "Edit" : "Fork"}
                  </Link>
                )}
              </div>
            </div>

            <AvatarPreview loadedLayers={loadedLayers} size={192} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InventoryView
// ---------------------------------------------------------------------------

function InventoryView({ handle }: { handle: string }) {
  const [pds] = useState(() => getPds());
  const [session] = useState(() => getSession());

  // Resolved DID for the handle
  const [did, setDid] = useState<string | null>(
    handle.startsWith("did:") ? handle : null,
  );
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Is this the logged-in user's inventory?
  const isOwner = useMemo(() => {
    if (!session || !did) return false;
    return session.did === did;
  }, [session, did]);

  // Resolve handle -> DID
  useEffect(() => {
    if (handle.startsWith("did:")) {
      queueMicrotask(() => setDid(handle));
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        const resolved = await resolveHandle(pds, handle);
        if (!cancelled) setDid(resolved);
      } catch (err) {
        if (!cancelled)
          setResolveError(
            getErrorMessage(err, "Failed to resolve handle"),
          );
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [handle, pds]);

  // Inventory state via shared hook
  const { entries, loading, error } = useInventoryManagement(pds, did);

  if (resolveError) {
    return (
      <div className="min-h-screen font-body">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <ErrorAlert message={resolveError} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-body">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-sm text-accent-primary">
              Inventory
            </h1>
            <div className="text-[11px] text-text-muted mt-1">{handle}</div>
          </div>
          <div className="flex items-center gap-3">
            {isOwner && (
              <Link
                to="/inventory"
                className="font-heading text-[10px] px-3 py-1.5 rounded-sm border-2 border-accent-secondary/50 text-accent-secondary/80 hover:border-accent-secondary hover:text-accent-secondary transition-colors"
              >
                Manage
              </Link>
            )}
          </div>
        </div>

        {loading && <LoadingMessage message="Loading inventory..." />}

        <ErrorAlert message={error} />

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-muted text-xs mb-4">
              This inventory is empty.
            </p>
          </div>
        )}

        {!loading && !error && (
          <InventoryCategoryGrid
            entries={entries}
            renderLabel={(entry) => {
              const parsed = parseAtUri(entry.subjectUri);
              if (!parsed) return null;
              return (
                <Link
                  to="/$handle/$nsid/$tid"
                  params={{
                    handle: parsed.did,
                    nsid: parsed.collection,
                    tid: parsed.rkey,
                  }}
                  className="flex-1 min-w-0 no-underline"
                >
                  <div className="text-[11px] text-text-primary truncate hover:text-accent-primary transition-colors">
                    {entry.name}
                  </div>
                  <div
                    className="text-[8px] mt-0.5"
                    style={{ color: CATEGORY_COLORS[entry.category] }}
                  >
                    {entry.category}
                  </div>
                </Link>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
