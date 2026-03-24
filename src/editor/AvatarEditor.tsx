import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PDSBrowser, type BrowsableType } from "~/atproto/PDSBrowser";
import type {
  AnimationLayer,
  ChannelTint,
  Transform,
  StateProperty,
  StateValue,
} from "~/atproto/generated/types/at/cozy-corner/defs";
import { StateValueEditor, type StatePropertyData } from "../editor/StatePropertyEditor";
import type { StateValueData } from "./editor-types";
import type * as Avatar from "~/atproto/generated/types/at/cozy-corner/avatar";
import {
  defaultAvatarUrl,
  defaultAvatarLayers,
} from "~/atproto/default-avatar-base";
import {
  getSession,
  ensureFreshSession,
  parseAtUri,
  extractBlobCid,
  blobUrl,
  loadImage,
} from "./load-record";
import {
  FreeTransformPreview,
  resolveTransform,
  type PreviewLayer,
} from "./FreeTransformPreview";
import {
  AvatarEditorProvider,
  createAvatarEditorInitialState,
  useAvatarDispatch,
  useAvatarSelector,
  useAvatarStore,
  type EquippedEntryData,
  setSelectedIndex,
  setBaseAvatar,
  setBaseAvatarTints,
  setBaseAvatarTransform,
  addWearable,
  removeWearable as removeWearableAction,
  moveWearable as moveWearableAction,
  setWearableTints,
  setWearableTransform,
  setWearableState,
} from "./store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadedLayer {
  image: HTMLImageElement;
  layers: AnimationLayer[];
  tints: ChannelTint[];
}

interface EquippedEntry {
  ref: { uri: string; cid: string };
  name: string;
  tints: ChannelTint[];
  transform?: Transform;
  state: StateValueData[];
  loaded: LoadedLayer | null;
  _overridableProps?: StatePropertyData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchRecord(
  pds: string,
  did: string,
  collection: string,
  rkey: string,
) {
  const qs = new URLSearchParams({ repo: did, collection, rkey }).toString();
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?${qs}`);
  if (!res.ok) return null;
  return (await res.json()) as {
    cid: string;
    value: Record<string, unknown>;
  };
}

async function loadWearableLayer(
  pds: string,
  ref: { uri: string; cid: string },
  tints: ChannelTint[],
): Promise<{ name: string; loaded: LoadedLayer | null; overridableProps: StatePropertyData[] }> {
  const parsed = parseAtUri(ref.uri);
  const rec = await fetchRecord(
    pds,
    parsed.did,
    parsed.collection,
    parsed.rkey,
  );
  if (!rec?.value?.spriteSheet)
    return { name: parsed.rkey, loaded: null, overridableProps: [] };

  const overridableProps = ((rec.value.stateProperties ?? []) as StateProperty[])
    .filter((sp) => sp.allowOverride)
    .map((sp) => ({ name: sp.name, type: sp.type, default: sp.default ?? "", allowOverride: true }));

  const blobCid = extractBlobCid(rec.value.spriteSheet);
  if (!blobCid)
    return {
      name: (rec.value.name as string) ?? parsed.rkey,
      loaded: null,
      overridableProps,
    };

  try {
    const img = await loadImage(blobUrl(pds, parsed.did, blobCid));
    return {
      name: (rec.value.name as string) ?? parsed.rkey,
      loaded: {
        image: img,
        layers: (rec.value.layers ?? []) as AnimationLayer[],
        tints,
      },
      overridableProps,
    };
  } catch {
    return {
      name: (rec.value.name as string) ?? parsed.rkey,
      loaded: null,
      overridableProps,
    };
  }
}

// ---------------------------------------------------------------------------
// Tint controls
// ---------------------------------------------------------------------------

function TintControls({
  layers,
  tints,
  onChange,
}: {
  layers: AnimationLayer[];
  tints: ChannelTint[];
  onChange: (tints: ChannelTint[]) => void;
}) {
  // Collect unique colorChannel values from the animation layers
  const channels = useMemo(() => {
    const seen = new Set<string>();
    for (const layer of layers) {
      if (layer.colorChannel) seen.add(layer.colorChannel);
    }
    return Array.from(seen);
  }, [layers]);

  // Build lookup: channel name → current tint color
  const tintByChannel = useMemo(() => {
    const result = new Map<string, string>();
    for (const { channel, tint } of tints) {
      result.set(channel, tint);
    }
    return result;
  }, [tints]);

  if (channels.length === 0) return null;

  const setTint = (channel: string, color: string | null) => {
    // Remove existing entry for this channel
    const newTints = tints.filter((t) => t.channel !== channel);

    if (color) {
      newTints.push({
        $type: "at.cozy-corner.defs#channelTint" as const,
        channel,
        tint: color,
      });
    }

    onChange(newTints);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-bg-panel border-2 border-border rounded-sm">
      <span className="font-heading text-[9px] uppercase tracking-wide text-text-muted w-full">
        Color
      </span>
      {channels.map((channel) => (
        <div key={channel} className="flex items-center gap-2">
          <span className="font-heading text-[9px] uppercase tracking-wide text-text-muted">
            {channel}
          </span>
          <div className="relative">
            <input
              type="color"
              value={tintByChannel.get(channel) ?? "#ffffff"}
              onChange={(e) => setTint(channel, e.target.value)}
              className="w-6 h-6 border-2 border-border rounded-sm cursor-pointer bg-transparent p-0"
            />
            {!tintByChannel.has(channel) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[8px] text-text-muted">
                --
              </div>
            )}
          </div>
          {tintByChannel.has(channel) && (
            <button
              onClick={() => setTint(channel, null)}
              className="text-[8px] text-text-muted hover:text-error cursor-pointer bg-transparent border-0"
            >
              &times;
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transform controls
// ---------------------------------------------------------------------------

function TransformControls({
  transform,
  frameWidth,
  frameHeight,
  onChange,
}: {
  transform: Transform;
  frameWidth: number;
  frameHeight: number;
  onChange: (t: Transform) => void;
}) {
  const t = transform;
  const offsetX = Math.round(t.e / 1000);
  const offsetY = Math.round(t.f / 1000);
  const widthPx = Math.round((t.a / 1000) * frameWidth);
  const heightPx = Math.round((t.d / 1000) * frameHeight);

  const setOffsetX = (v: number) => {
    onChange({ ...t, e: Math.round(v) * 1000 });
  };
  const setOffsetY = (v: number) => {
    onChange({ ...t, f: Math.round(v) * 1000 });
  };
  const setWidthPx = (v: number) => {
    const clamped = Math.max(1, Math.round(v));
    onChange({ ...t, a: Math.round((clamped * 1000) / frameWidth) });
  };
  const setHeightPx = (v: number) => {
    const clamped = Math.max(1, Math.round(v));
    onChange({ ...t, d: Math.round((clamped * 1000) / frameHeight) });
  };

  const flipH = () => {
    // Negate scaleX and adjust translate to keep center
    const newA = -t.a;
    const newE = t.e + (t.a / 1000) * frameWidth * 1000;
    onChange({ ...t, a: newA, e: Math.round(newE / 1000) * 1000 });
  };
  const flipV = () => {
    const newD = -t.d;
    const newF = t.f + (t.d / 1000) * frameHeight * 1000;
    onChange({ ...t, d: newD, f: Math.round(newF / 1000) * 1000 });
  };

  const reset = () => {
    onChange({ a: 1000, b: 0, c: 0, d: 1000, e: 0, f: 0 });
  };

  const inputClass =
    "w-16 bg-bg-deep text-text-primary border-2 border-border rounded-sm px-1.5 py-1 font-body text-[10px] outline-none focus:border-accent-primary text-center";
  const labelClass =
    "font-heading text-[9px] uppercase tracking-wide text-text-muted";

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 bg-bg-panel border-2 border-border rounded-sm">
      <div className="flex flex-col gap-1">
        <span className={labelClass}>X</span>
        <input
          type="number"
          value={offsetX}
          onChange={(e) => setOffsetX(Number(e.target.value))}
          step={1}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className={labelClass}>Y</span>
        <input
          type="number"
          value={offsetY}
          onChange={(e) => setOffsetY(Number(e.target.value))}
          step={1}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className={labelClass}>W</span>
        <input
          type="number"
          value={Math.abs(widthPx)}
          onChange={(e) =>
            setWidthPx(Number(e.target.value) * Math.sign(t.a || 1))
          }
          step={1}
          min={1}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className={labelClass}>H</span>
        <input
          type="number"
          value={Math.abs(heightPx)}
          onChange={(e) =>
            setHeightPx(Number(e.target.value) * Math.sign(t.d || 1))
          }
          step={1}
          min={1}
          className={inputClass}
        />
      </div>
      <div className="flex gap-1">
        <button
          onClick={flipH}
          className="font-heading text-[9px] px-2 py-1.5 rounded-sm border-2 border-border text-text-muted hover:border-border-hover hover:text-text-primary cursor-pointer bg-transparent"
          title="Flip horizontal"
        >
          Flip H
        </button>
        <button
          onClick={flipV}
          className="font-heading text-[9px] px-2 py-1.5 rounded-sm border-2 border-border text-text-muted hover:border-border-hover hover:text-text-primary cursor-pointer bg-transparent"
          title="Flip vertical"
        >
          Flip V
        </button>
        <button
          onClick={reset}
          className="font-heading text-[9px] px-2 py-1.5 rounded-sm border-2 border-border text-text-muted hover:border-border-hover hover:text-text-primary cursor-pointer bg-transparent"
          title="Reset transform"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AvatarEditor (outer – loading via React Query)
// ---------------------------------------------------------------------------

export function AvatarEditor({
  uri,
  editRkey,
}: {
  uri?: string;
  editRkey?: string;
}) {
  const session = getSession();
  const pds = session.pds;
  const sourceDid = uri ? parseAtUri(uri).did : session.did;

  const { data, isLoading, error } = useQuery({
    queryKey: ["avatar-editor", sourceDid, pds],
    queryFn: async () => {
      // Load avatar record
      const avatarRec = await fetchRecord(
        pds,
        sourceDid,
        "at.cozy-corner.avatar",
        "self",
      );

      const avatarValue = avatarRec?.value;

      // Load base avatar
      let baseEntry: EquippedEntry | null = null;
      if (avatarValue?.baseAvatar) {
        const ref = avatarValue.baseAvatar as { uri: string; cid: string };
        const tints = (avatarValue.baseAvatarTints ?? []) as ChannelTint[];
        const transform = avatarValue.baseAvatarTransform as
          | Transform
          | undefined;
        const { name, loaded, overridableProps } = await loadWearableLayer(pds, ref, tints);
        baseEntry = { ref, name, tints, transform, state: [], loaded, _overridableProps: overridableProps };
      } else {
        const img = await loadImage(defaultAvatarUrl);
        const tints = (avatarValue?.baseAvatarTints ?? []) as ChannelTint[];
        const transform = avatarValue?.baseAvatarTransform as
          | Transform
          | undefined;
        baseEntry = {
          ref: { uri: "", cid: "" },
          name: "Default",
          tints,
          transform,
          state: [],
          loaded: {
            image: img,
            layers: defaultAvatarLayers,
            tints,
          },
        };
      }

      // Load equipped wearables
      const rawWearables = (avatarValue?.wearables ??
        []) as Avatar.EquippedWearable[];
      const wearableEntries: EquippedEntry[] = [];

      for (const equipped of rawWearables) {
        const ref = equipped.wearable as { uri: string; cid: string };
        const tints = (equipped.tints ?? []) as ChannelTint[];
        const transform = equipped.transform as Transform | undefined;
        const state = ((equipped.state ?? []) as StateValue[]).map((sv) => ({ name: sv.name, value: sv.value ?? "" }));
        const { name, loaded, overridableProps } = await loadWearableLayer(pds, ref, tints);
        wearableEntries.push({ ref, name, tints, transform, state, loaded, _overridableProps: overridableProps });
      }

      return { baseAvatar: baseEntry, wearables: wearableEntries };
    },
  });

  if (isLoading) {
    return (
      <div className="text-text-muted text-xs py-8 text-center">
        Loading avatar...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm">
        {error instanceof Error ? error.message : "Failed to load avatar"}
      </div>
    );
  }

  return (
    <AvatarEditorForm
      key={sourceDid}
      initialData={data!}
      uri={uri}
      editRkey={editRkey}
    />
  );
}

// ---------------------------------------------------------------------------
// Helper: derive local maps from initial query data
// ---------------------------------------------------------------------------

const BASE_KEY = "__base__";

function loadedLayerKey(ref: { uri: string }): string {
  return ref.uri || BASE_KEY;
}

// ---------------------------------------------------------------------------
// AvatarEditorForm (creates Provider + local maps, wraps AvatarEditorInner)
// ---------------------------------------------------------------------------

function AvatarEditorForm({
  initialData,
  uri,
  editRkey,
}: {
  initialData: { baseAvatar: EquippedEntry | null; wearables: EquippedEntry[] };
  uri?: string;
  editRkey?: string;
}) {
  // Build Redux initial state (serializable subset)
  const reduxInitialState = useMemo(() => {
    const toData = (e: EquippedEntry): EquippedEntryData => ({
      ref: e.ref,
      name: e.name,
      tints: e.tints,
      transform: e.transform,
      state: e.state,
    });

    return createAvatarEditorInitialState({
      baseAvatar: initialData.baseAvatar ? toData(initialData.baseAvatar) : null,
      wearables: initialData.wearables.map(toData),
      selectedIndex: -1,
    });
  }, [initialData]);

  // Build initial local maps (non-serializable data)
  const initialLoadedLayers = useMemo(() => {
    const map = new Map<string, LoadedLayer>();
    if (initialData.baseAvatar?.loaded) {
      map.set(loadedLayerKey(initialData.baseAvatar.ref), initialData.baseAvatar.loaded);
    }
    for (const w of initialData.wearables) {
      if (w.loaded) {
        map.set(loadedLayerKey(w.ref), w.loaded);
      }
    }
    return map;
  }, [initialData]);

  const initialOverridableProps = useMemo(() => {
    const map = new Map<string, StatePropertyData[]>();
    if (initialData.baseAvatar?._overridableProps) {
      map.set(loadedLayerKey(initialData.baseAvatar.ref), initialData.baseAvatar._overridableProps);
    }
    for (const w of initialData.wearables) {
      if (w._overridableProps) {
        map.set(loadedLayerKey(w.ref), w._overridableProps);
      }
    }
    return map;
  }, [initialData]);

  return (
    <AvatarEditorProvider initialState={reduxInitialState}>
      <AvatarEditorInner
        uri={uri}
        editRkey={editRkey}
        initialLoadedLayers={initialLoadedLayers}
        initialOverridableProps={initialOverridableProps}
      />
    </AvatarEditorProvider>
  );
}

// ---------------------------------------------------------------------------
// AvatarEditorInner (uses Redux hooks + local maps)
// ---------------------------------------------------------------------------

function AvatarEditorInner({
  uri: _uri,
  editRkey,
  initialLoadedLayers,
  initialOverridableProps,
}: {
  uri?: string;
  editRkey?: string;
  initialLoadedLayers: Map<string, LoadedLayer>;
  initialOverridableProps: Map<string, StatePropertyData[]>;
}) {
  const session = getSession();
  const pds = session.pds;
  const isOwner = !!editRkey;

  const dispatch = useAvatarDispatch();
  const store = useAvatarStore();

  // Redux state
  const baseAvatar = useAvatarSelector((s) => s.editor.baseAvatar);
  const wearables = useAvatarSelector((s) => s.editor.wearables);
  const selectedIndex = useAvatarSelector((s) => s.editor.selectedIndex);

  // Local maps (non-serializable)
  const [loadedLayers, setLoadedLayers] = useState<Map<string, LoadedLayer>>(initialLoadedLayers);
  const [overridableProps, setOverridableProps] = useState<Map<string, StatePropertyData[]>>(initialOverridableProps);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Browser
  const [browseMode, setBrowseMode] = useState<"base" | "wearable" | null>(
    null,
  );
  const [browseHandle, setBrowseHandle] = useState("");
  const [browseActor, setBrowseActor] = useState<string | null>(null);

  // Derive preview layers (structural only, no transforms)
  const previewLayers: PreviewLayer[] = useMemo(() => {
    const result: PreviewLayer[] = [];
    if (baseAvatar) {
      const loaded = loadedLayers.get(loadedLayerKey(baseAvatar.ref));
      if (loaded) {
        result.push({
          image: loaded.image,
          layers: loaded.layers,
          tints: baseAvatar.tints,
        });
      }
    }
    for (const w of wearables) {
      const loaded = loadedLayers.get(loadedLayerKey(w.ref));
      if (loaded) {
        result.push({
          image: loaded.image,
          layers: loaded.layers,
          tints: w.tints,
        });
      }
    }
    return result;
  }, [baseAvatar, wearables, loadedLayers]);

  // Derive transforms array (parallel to previewLayers)
  const transforms: (Transform | undefined)[] = useMemo(() => {
    const result: (Transform | undefined)[] = [];
    if (baseAvatar) {
      const loaded = loadedLayers.get(loadedLayerKey(baseAvatar.ref));
      if (loaded) {
        result.push(baseAvatar.transform);
      }
    }
    for (const w of wearables) {
      const loaded = loadedLayers.get(loadedLayerKey(w.ref));
      if (loaded) {
        result.push(w.transform);
      }
    }
    return result;
  }, [baseAvatar, wearables, loadedLayers]);

  // Selected layer's frame size (for transform controls)
  const selectedFrameSize = useMemo(() => {
    if (selectedIndex < 0 || selectedIndex >= previewLayers.length)
      return { w: 32, h: 32 };
    const layer = previewLayers[selectedIndex];
    if (layer.layers.length > 0 && layer.layers[0].frames.length > 0) {
      return {
        w: layer.layers[0].frames[0].width,
        h: layer.layers[0].frames[0].height,
      };
    }
    return { w: 32, h: 32 };
  }, [previewLayers, selectedIndex]);

  // Map a previewLayers index back to a wearables array index.
  // previewLayers only includes entries with loaded data, so we need to
  // find the N-th loaded wearable (skipping unloaded ones).
  const previewIndexToWearableIndex = useCallback(
    (previewIdx: number): number => {
      const baseLoaded = baseAvatar ? loadedLayers.has(loadedLayerKey(baseAvatar.ref)) : false;
      const offset = baseLoaded ? 1 : 0;
      const nth = previewIdx - offset; // which loaded wearable (0-based)
      let count = 0;
      for (let i = 0; i < wearables.length; i++) {
        if (loadedLayers.has(loadedLayerKey(wearables[i].ref))) {
          if (count === nth) return i;
          count++;
        }
      }
      return -1;
    },
    [baseAvatar, wearables, loadedLayers],
  );

  // Transform change handler from the preview or numeric controls
  const handleTransformChange = useCallback(
    (layerIndex: number, newTransform: Transform) => {
      const baseLoaded = baseAvatar ? loadedLayers.has(loadedLayerKey(baseAvatar.ref)) : false;
      if (baseLoaded && layerIndex === 0) {
        dispatch(setBaseAvatarTransform(newTransform));
      } else {
        const wearableIdx = previewIndexToWearableIndex(layerIndex);
        if (wearableIdx < 0) return;
        dispatch(setWearableTransform({ index: wearableIdx, transform: newTransform }));
      }
    },
    [baseAvatar, loadedLayers, previewIndexToWearableIndex, dispatch],
  );

  // Derive base animation targets for the preview
  const baseTargets = useMemo(() => {
    if (!baseAvatar) return [];
    const loaded = loadedLayers.get(loadedLayerKey(baseAvatar.ref));
    if (!loaded) return [];
    const targetSet = new Set<string>();
    for (const l of loaded.layers) {
      targetSet.add(l.target);
    }
    return Array.from(targetSet);
  }, [baseAvatar, loadedLayers]);

  // Handle tint changes for the selected layer
  const handleTintsChange = useCallback(
    (newTints: ChannelTint[]) => {
      const baseLoaded = baseAvatar ? loadedLayers.has(loadedLayerKey(baseAvatar.ref)) : false;
      if (baseLoaded && selectedIndex === 0) {
        // Update Redux
        dispatch(setBaseAvatarTints(newTints));
        // Update local loaded data
        const key = loadedLayerKey(baseAvatar!.ref);
        setLoadedLayers((prev) => {
          const existing = prev.get(key);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(key, { ...existing, tints: newTints });
          return next;
        });
      } else {
        const wearableIdx = previewIndexToWearableIndex(selectedIndex);
        if (wearableIdx < 0) return;
        // Update Redux
        dispatch(setWearableTints({ index: wearableIdx, tints: newTints }));
        // Update local loaded data
        const key = loadedLayerKey(wearables[wearableIdx].ref);
        setLoadedLayers((prev) => {
          const existing = prev.get(key);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(key, { ...existing, tints: newTints });
          return next;
        });
      }
    },
    [selectedIndex, baseAvatar, wearables, loadedLayers, previewIndexToWearableIndex, dispatch],
  );

  // Selected entry for tint controls — combine Redux data with local loaded data
  const selectedEntry = useMemo(() => {
    if (selectedIndex < 0) return null;
    const baseLoaded = baseAvatar ? loadedLayers.has(loadedLayerKey(baseAvatar.ref)) : false;
    if (baseLoaded && selectedIndex === 0) {
      const loaded = loadedLayers.get(loadedLayerKey(baseAvatar!.ref)) ?? null;
      return { ...baseAvatar!, loaded };
    }
    const wearableIdx = previewIndexToWearableIndex(selectedIndex);
    if (wearableIdx >= 0) {
      const w = wearables[wearableIdx];
      const loaded = loadedLayers.get(loadedLayerKey(w.ref)) ?? null;
      return { ...w, loaded };
    }
    return null;
  }, [selectedIndex, baseAvatar, wearables, loadedLayers, previewIndexToWearableIndex]);

  // Clamp selection when layers change
  useEffect(() => {
    if (selectedIndex >= previewLayers.length) {
      dispatch(setSelectedIndex(-1));
    }
  }, [previewLayers.length, selectedIndex, dispatch]);

  // Remove wearable
  const handleRemoveWearable = useCallback(
    (index: number) => {
      const key = loadedLayerKey(wearables[index].ref);
      dispatch(removeWearableAction(index));
      setLoadedLayers((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setOverridableProps((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
    [wearables, dispatch],
  );

  // Move wearable up/down
  const handleMoveWearable = useCallback(
    (index: number, direction: -1 | 1) => {
      dispatch(moveWearableAction({ index, direction }));
    },
    [dispatch],
  );

  // Handle browse selection
  const handleSelectRecord = useCallback(
    async (selectedUri: string, _cid: string, value: Record<string, unknown>) => {
      const parsed = parseAtUri(selectedUri);
      const collection = parsed.collection;

      let recordCid = "";
      try {
        const rec = await fetchRecord(
          pds,
          parsed.did,
          parsed.collection,
          parsed.rkey,
        );
        if (rec) recordCid = rec.cid;
      } catch {
        // Best effort
      }

      const ref = { uri: selectedUri, cid: recordCid };
      const tints: ChannelTint[] = [];
      const name = (value.name as string) ?? parsed.rkey;

      let loaded: LoadedLayer | null = null;
      if (value.spriteSheet) {
        const blobCid = extractBlobCid(value.spriteSheet);
        if (blobCid) {
          try {
            const img = await loadImage(blobUrl(pds, parsed.did, blobCid));
            loaded = {
              image: img,
              layers: (value.layers ?? []) as AnimationLayer[],
              tints,
            };
          } catch {
            // Image unavailable
          }
        }
      }

      const recordOverridableProps = ((value.stateProperties ?? []) as StateProperty[])
        .filter((sp) => sp.allowOverride)
        .map((sp) => ({ name: sp.name, type: sp.type, default: sp.default ?? "", allowOverride: true }));

      const entryData: EquippedEntryData = { ref, name, tints, state: [] };

      if (
        browseMode === "base" &&
        collection === "at.cozy-corner.avatar.base"
      ) {
        dispatch(setBaseAvatar(entryData));
        const key = loadedLayerKey(ref);
        if (loaded) {
          setLoadedLayers((prev) => {
            const next = new Map(prev);
            next.set(key, loaded);
            return next;
          });
        }
        setOverridableProps((prev) => {
          const next = new Map(prev);
          next.set(key, recordOverridableProps);
          return next;
        });
        setBrowseMode(null);
      } else if (
        browseMode === "wearable" &&
        collection === "at.cozy-corner.avatar.wearable"
      ) {
        dispatch(addWearable(entryData));
        const key = loadedLayerKey(ref);
        if (loaded) {
          setLoadedLayers((prev) => {
            const next = new Map(prev);
            next.set(key, loaded);
            return next;
          });
        }
        setOverridableProps((prev) => {
          const next = new Map(prev);
          next.set(key, recordOverridableProps);
          return next;
        });
        setBrowseMode(null);
      }
    },
    [pds, browseMode, dispatch],
  );

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const { baseAvatar: base, wearables: ws } = store.getState().editor;

      const record: Record<string, unknown> = {
        $type: "at.cozy-corner.avatar",
        createdAt: new Date().toISOString(),
      };

      if (base && base.ref.uri) {
        record.baseAvatar = base.ref;
        if (base.tints.length > 0) {
          record.baseAvatarTints = base.tints;
        }
        if (base.transform) {
          record.baseAvatarTransform = base.transform;
        }
      }

      if (ws.length > 0) {
        record.wearables = ws.map((w: EquippedEntryData) => {
          const entry: Record<string, unknown> = {
            $type: "at.cozy-corner.avatar#equippedWearable",
            wearable: w.ref,
          };
          if (w.tints.length > 0) entry.tints = w.tints;
          if (w.transform) entry.transform = w.transform;
          const stateValues = w.state.filter((s: StateValueData) => s.value !== "");
          if (stateValues.length > 0) entry.state = stateValues.map((sv: StateValueData) => ({ $type: "at.cozy-corner.defs#stateValue" as const, name: sv.name, value: sv.value }));
          return entry;
        });
      }

      const fresh = await ensureFreshSession();
      const res = await fetch(
        `${fresh.pds}/xrpc/com.atproto.repo.putRecord`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${fresh.accessJwt}`,
          },
          body: JSON.stringify({
            repo: fresh.did,
            collection: "at.cozy-corner.avatar",
            rkey: "self",
            record,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Save failed (${res.status})`);
      }

      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [store]);

  // Browser helpers
  const openBrowser = useCallback(
    (mode: "base" | "wearable") => {
      setBrowseMode(mode);
      setBrowseHandle(session.handle);
      setBrowseActor(session.handle);
    },
    [session],
  );

  const handleLookup = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const v = browseHandle.trim();
      if (v) setBrowseActor(v);
    },
    [browseHandle],
  );

  const browseTypes: BrowsableType[] =
    browseMode === "base" ? ["base"] : ["wearable"];

  // Layer list index mapping: base = 0 in previewLayers, wearables start at offset
  const baseLoaded = baseAvatar ? loadedLayers.has(loadedLayerKey(baseAvatar.ref)) : false;
  const basePreviewIndex = baseLoaded ? 0 : -1;

  // Map wearable array index to previewLayers index (accounting for unloaded entries)
  const wearableToPreviewIndex = useCallback(
    (wearableIdx: number): number => {
      if (!loadedLayers.has(loadedLayerKey(wearables[wearableIdx]?.ref))) return -1;
      const offset = baseLoaded ? 1 : 0;
      let loadedCount = 0;
      for (let i = 0; i < wearableIdx; i++) {
        if (loadedLayers.has(loadedLayerKey(wearables[i].ref))) loadedCount++;
      }
      return offset + loadedCount;
    },
    [baseLoaded, wearables, loadedLayers],
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <span className="font-heading text-[10px] uppercase tracking-wide text-accent-secondary">
          Avatar
        </span>
        {!isOwner && (
          <div className="text-[11px] text-text-muted mt-1">
            Editing a copy — will save to your account
          </div>
        )}
      </div>

      {saveError && (
        <div className="text-[11px] text-error px-2 py-1.5 bg-error/8 border border-error/20 rounded-sm mb-4">
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="text-[11px] text-success px-2 py-1.5 bg-success/8 border border-success/20 rounded-sm mb-4">
          {isOwner ? "Avatar saved" : "Avatar replaced"}
        </div>
      )}

        <div className="flex flex-col gap-6">
          {/* Interactive preview */}
          <FreeTransformPreview
            previewLayers={previewLayers}
            transforms={transforms}
            selectedIndex={selectedIndex}
            onTransformChange={handleTransformChange}
            size={192}
            baseTargets={baseTargets}
          />

          {/* Color controls (when a layer is selected) */}
          {selectedIndex >= 0 && selectedEntry?.loaded && (
            <TintControls
              layers={selectedEntry.loaded.layers}
              tints={selectedEntry.tints}
              onChange={handleTintsChange}
            />
          )}

          {/* Transform controls (when a layer is selected) */}
          {selectedIndex >= 0 && selectedIndex < transforms.length && (
            <TransformControls
              transform={resolveTransform(transforms[selectedIndex])}
              frameWidth={selectedFrameSize.w}
              frameHeight={selectedFrameSize.h}
              onChange={(t) => handleTransformChange(selectedIndex, t)}
            />
          )}

          {/* Base Avatar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-heading text-[10px] uppercase tracking-wide text-accent-tertiary">
                Base Avatar
              </span>
              <button
                onClick={() => openBrowser("base")}
                className="font-heading text-[10px] px-2.5 py-1 rounded-sm border-2 border-accent-primary/50 text-accent-primary/80 hover:border-accent-primary hover:text-accent-primary cursor-pointer bg-transparent transition-colors"
              >
                Change
              </button>
            </div>
            <button
              onClick={() =>
                dispatch(setSelectedIndex(
                  selectedIndex === basePreviewIndex ? -1 : basePreviewIndex,
                ))
              }
              className={`w-full text-left p-2 border-2 rounded-sm text-[11px] text-text-primary cursor-pointer bg-transparent transition-colors ${
                selectedIndex === basePreviewIndex
                  ? "border-accent-primary bg-accent-primary/5"
                  : "border-border bg-bg-panel hover:border-border-hover"
              }`}
            >
              {baseAvatar?.name ?? "Default"}
            </button>
          </div>

          {/* Wearables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-heading text-[10px] uppercase tracking-wide text-accent-secondary">
                Wearables ({wearables.length}/32)
              </span>
              {wearables.length < 32 && (
                <button
                  onClick={() => openBrowser("wearable")}
                  className="font-heading text-[10px] px-2.5 py-1 rounded-sm border-2 border-accent-primary/50 text-accent-primary/80 hover:border-accent-primary hover:text-accent-primary cursor-pointer bg-transparent transition-colors"
                >
                  + Add
                </button>
              )}
            </div>

            {wearables.length === 0 && (
              <div className="text-text-muted text-xs py-4 text-center border-2 border-border rounded-sm bg-bg-panel">
                No wearables equipped
              </div>
            )}

            <div className="flex flex-col gap-1">
              {wearables.map((w: EquippedEntryData, i: number) => {
                const previewIdx = wearableToPreviewIndex(i);
                const hasLoaded = previewIdx >= 0;
                const isSelected = hasLoaded && selectedIndex === previewIdx;
                const wOverridableProps = overridableProps.get(loadedLayerKey(w.ref));

                return (
                  <div key={`${w.ref.uri}-${i}`} className="flex flex-col">
                    <div
                      className={`flex items-center gap-2 p-2 border-2 rounded-sm group cursor-pointer transition-colors ${
                        isSelected
                          ? "border-accent-primary bg-accent-primary/5"
                          : "border-border bg-bg-panel hover:border-border-hover"
                      }`}
                      onClick={() => {
                        if (!hasLoaded) return;
                        dispatch(setSelectedIndex(isSelected ? -1 : previewIdx));
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveWearable(i, -1);
                          }}
                          disabled={i === 0}
                          className="text-[8px] text-text-muted hover:text-text-primary cursor-pointer bg-transparent border-0 disabled:opacity-20 disabled:cursor-default px-1"
                        >
                          ▲
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveWearable(i, 1);
                          }}
                          disabled={i === wearables.length - 1}
                          className="text-[8px] text-text-muted hover:text-text-primary cursor-pointer bg-transparent border-0 disabled:opacity-20 disabled:cursor-default px-1"
                        >
                          ▼
                        </button>
                      </div>

                      <span className="flex-1 text-[11px] text-text-primary truncate">
                        {w.name}
                      </span>

                      <span className="text-[8px] text-text-muted">
                        Layer {i + 1}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveWearable(i);
                        }}
                        className="text-error/60 hover:text-error text-xs cursor-pointer bg-transparent border-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        &times;
                      </button>
                    </div>
                    {isSelected && wOverridableProps && wOverridableProps.length > 0 && (
                      <div
                        className="px-2 pb-2 flex flex-col gap-2 border-2 border-t-0 border-accent-primary/30 rounded-b-sm bg-bg-panel"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-heading text-[9px] uppercase tracking-wide text-text-muted pt-1">State</span>
                        {wOverridableProps.map((prop) => {
                          const sv = w.state.find((s: StateValueData) => s.name === prop.name);
                          return (
                            <StateValueEditor
                              key={prop.name}
                              property={prop}
                              value={sv?.value ?? ""}
                              onChange={(val) => {
                                const newState = w.state.filter((s: StateValueData) => s.name !== prop.name);
                                newState.push({ name: prop.name, value: val });
                                dispatch(setWearableState({ index: i, state: newState }));
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`font-heading text-xs py-2 px-5 rounded-sm border-2 cursor-pointer disabled:opacity-50 disabled:cursor-default ${
                isOwner
                  ? "bg-accent-primary/10 border-accent-primary text-accent-primary hover:bg-accent-primary/20 active:bg-accent-primary/30"
                  : "bg-accent-secondary/10 border-accent-secondary text-accent-secondary hover:bg-accent-secondary/20 active:bg-accent-secondary/30"
              }`}
            >
              {saving ? "Saving..." : isOwner ? "Save" : "Replace"}
            </button>
          </div>
        </div>

      {/* Browser modal */}
      {browseMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setBrowseMode(null)}
          />
          <div className="relative bg-bg-panel border-2 border-border rounded-sm p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xs text-accent-primary">
                {browseMode === "base"
                  ? "Choose Base Avatar"
                  : "Add Wearable"}
              </h2>
              <button
                onClick={() => setBrowseMode(null)}
                className="text-text-muted hover:text-text-primary text-xs cursor-pointer bg-transparent border-0"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleLookup} className="flex gap-2 mb-4">
              <input
                type="text"
                value={browseHandle}
                onChange={(e) => setBrowseHandle(e.target.value)}
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

            {browseActor && (
              <PDSBrowser
                key={browseActor}
                actor={browseActor}
                pds={pds}
                allowedTypes={browseTypes}
                onSelectRecord={handleSelectRecord}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
