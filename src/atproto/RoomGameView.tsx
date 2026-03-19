import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Provider, useSelector } from "react-redux";
import { useNavigate, Link } from "@tanstack/react-router";
import { useMultiplayer } from "~/atproto/useMultiplayer";
import {
  getSession,
  parseAtUri,
} from "~/lib/at-protocol";
import { Entity, resetEventBudget } from "~/engine/entity";
import { dataEvent } from "~/engine/store/actions";
import { AttributeMap, ATTRIBUTE_MAP } from "~/engine/state/attributes";
import { TILE_SHEET, TILE_ATLAS, TILE_POSITIONS, TILE_SIZE, type TileFrame, type PlacedTile } from "~/engine/state/tiles";
import { BLOCKING_GRID, type BlockingGrid } from "~/engine/state/blocking";
import { TileLayerCache } from "~/engine/render/cachedTileLayer";
import { LightOverlayCache } from "~/engine/render/lightOverlay";
import { renderEntity, TintCanvasPool } from "~/engine/render/composite";
import { selectEntityById } from "~/engine/store/selectors";
import type { RootState } from "~/engine/store/store";
import {
  POSITION,
  DIRECTION,
  MOVE_TARGET,
  type Position,
} from "~/engine/state/movement";
import {
  PROMPT_TEXT,
  PROMPT_OPTIONS,
  PROMPT_RESPONSE,
  PROMPT_ACTIVE,
} from "~/engine/state/prompt";
import {
  CAMERA_TARGET,
  VIEW_DISTANCE,
  DEFAULT_VIEW_DISTANCE,
  type CameraPosition,
} from "~/engine/state/camera";
import { TILE_PX } from "~/atproto/room-building";
import { useRoomLoader, PHASE_LABELS, PHASE_PROGRESS } from "~/atproto/useRoomLoader";

// Direction index -> exit bitmask (south->S, west->W, north->N, east->E)
const DIR_INDEX_TO_EXIT_MASK = [4, 8, 1, 2];

// ---------------------------------------------------------------------------
// RoomGameView component
// ---------------------------------------------------------------------------

export function RoomGameView({
  handle,
  tid,
}: {
  handle: string;
  tid: string;
}) {
  const { phase, error, builtRoom } = useRoomLoader(handle, tid);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const enteredRef = useRef(false);
  const wasMovingRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });

  const session = useMemo(() => getSession(), []);

  // Multiplayer — connect once room is built
  const { onlineCount, sendMoveTo } = useMultiplayer(
    builtRoom
      ? {
          roomUri: builtRoom.roomUri,
          roomCid: builtRoom.roomCid,
          store: builtRoom.store,
          entityRegistry: builtRoom.entityRegistry,
          localDid: session?.did,
          localHandle: session?.handle,
        }
      : {
          roomUri: "",
          roomCid: "",
        },
  );

  const MAX_TILE_PX = 48;

  // Game loop
  useEffect(() => {
    if (!builtRoom) return;
    enteredRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { roomEntity, playerEntity, store, exits } = builtRoom;

    // Create render caches (persist across frames, destroyed on cleanup)
    const bgTileCache = new TileLayerCache();
    const overheadTileCache = new TileLayerCache();
    const lightCache = new LightOverlayCache();
    const tintPool = new TintCanvasPool();

    function tick(time: number) {
      if (!ctx || !canvas) return;

      const vw = sizeRef.current.w;
      const vh = sizeRef.current.h;

      // Reset per-frame event budget before processing any events
      resetEventBudget();

      // 0. Enter — fire once on first tick
      if (!enteredRef.current) {
        enteredRef.current = true;
        store.dispatch(dataEvent({ entityId: "room", type: "enter", data: {}, time }));
      }

      // 1. Tick — propagates to children via behavior middleware
      store.dispatch(dataEvent({ entityId: "room", type: "tick", data: {}, time }));

      // 2. Attributes — reset and emit (propagates to children)
      const attrMap = roomEntity.get<AttributeMap>(ATTRIBUTE_MAP);
      if (attrMap) {
        attrMap.reset();
        store.dispatch(dataEvent({ entityId: "room", type: "emit-attributes", data: {}, time }));
        lightCache.dirty = true;
      }

      // 3. Exit check
      const currentPos = playerEntity.get<Position>(POSITION);
      const moveTarget = playerEntity.get<Position>(MOVE_TARGET);

      if (!moveTarget && wasMovingRef.current && currentPos) {
        wasMovingRef.current = false;
        const direction = playerEntity.get<number>(DIRECTION) ?? 0;
        const exitMask = DIR_INDEX_TO_EXIT_MASK[direction];

        for (const exit of exits) {
          if (!exit.targetUri) continue;
          if (!(exit.direction & exitMask)) continue;
          if (
            currentPos.x >= exit.x &&
            currentPos.x < exit.x + exit.width &&
            currentPos.y >= exit.y &&
            currentPos.y < exit.y + exit.height
          ) {
            // Navigate to target room
            const parsed = parseAtUri(exit.targetUri);
            if (parsed) {
              navigate({
                to: "/$handle/$nsid/$tid",
                params: {
                  handle: parsed.did,
                  nsid: parsed.collection,
                  tid: parsed.rkey,
                },
              });
              return;
            }
          }
        }
      }

      if (moveTarget) {
        wasMovingRef.current = true;
      }

      // 4. Camera is updated by CameraBehavior during tick (above).
      //    Read camera state from the room entity.
      const cam = roomEntity.get<CameraPosition>(CAMERA_TARGET);
      const vd = roomEntity.get<number>(VIEW_DISTANCE) ?? DEFAULT_VIEW_DISTANCE;

      // 5. Render — direct draw calls instead of RenderEvent
      const viewportTiles = vd * 2 + 1;
      const scale = sizeRef.current.w / (viewportTiles * TILE_PX);

      ctx.clearRect(0, 0, vw, vh);
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // Translate so camera center = canvas center, then scale
      ctx.translate(vw / 2, vh / 2);
      ctx.scale(scale, scale);
      if (cam) {
        ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
      }

      // Read tile data from room entity
      const sheet = roomEntity.get<CanvasImageSource>(TILE_SHEET);
      const atlas = roomEntity.get<TileFrame[]>(TILE_ATLAS);
      const tiles = roomEntity.get<PlacedTile[]>(TILE_POSITIONS);
      const tileSize = roomEntity.get<number>(TILE_SIZE);
      const grid = roomEntity.get<BlockingGrid>(BLOCKING_GRID);

      // Background tiles (cached, layer 0)
      if (sheet && atlas && tiles && tileSize && grid) {
        bgTileCache.draw(ctx, 0, sheet, atlas, tiles, tileSize, grid, time);
      }

      // Y-sorted entities (children of room)
      renderEntity(ctx, roomEntity, time, new Map(), tintPool);

      // Overhead tiles (cached, layer 2)
      if (sheet && atlas && tiles && tileSize && grid) {
        overheadTileCache.draw(ctx, 2, sheet, atlas, tiles, tileSize, grid, time);
      }

      // Light overlay
      if (attrMap && tileSize) {
        lightCache.draw(ctx, attrMap, tileSize);
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [builtRoom, navigate]);

  // Sync view distance from Redux store -> React state for canvas sizing + HUD
  const [viewDistance, setViewDistance] = useState(DEFAULT_VIEW_DISTANCE);
  useEffect(() => {
    if (!builtRoom) return;
    const { store } = builtRoom;
    // Subscribe to store changes for view distance updates
    const unsubscribe = store.subscribe(() => {
      const entity = selectEntityById(store.getState(), "room");
      const vd = (entity?.state[VIEW_DISTANCE] as number) ?? DEFAULT_VIEW_DISTANCE;
      setViewDistance((prev) => prev !== vd ? vd : prev);
    });
    return unsubscribe;
  }, [builtRoom]);
  const viewportTiles = viewDistance * 2 + 1;

  // Resize observer — observe container, size canvas to fit viewport tiles
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !builtRoom) return;

    function resize() {
      if (!container || !canvas || !builtRoom) return;
      const { width, height } = container.getBoundingClientRect();
      const vd = builtRoom.roomEntity.get<number>(VIEW_DISTANCE) ?? DEFAULT_VIEW_DISTANCE;
      const vt = vd * 2 + 1;
      const tilePx = Math.min(MAX_TILE_PX, Math.floor(width / vt), Math.floor(height / vt));
      const side = tilePx * vt;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = side * dpr;
      canvas.height = side * dpr;
      canvas.style.width = `${side}px`;
      canvas.style.height = `${side}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      sizeRef.current = { w: side, h: side };
    }

    resize();
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [builtRoom, viewDistance]);

  // Click handler
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!builtRoom) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Convert screen -> world -> tile
      const cam = builtRoom.roomEntity.get<CameraPosition>(CAMERA_TARGET);
      if (!cam) return;
      const side = sizeRef.current.w;
      const vd = builtRoom.roomEntity.get<number>(VIEW_DISTANCE) ?? DEFAULT_VIEW_DISTANCE;
      const vt = vd * 2 + 1;
      const scale = side / (vt * TILE_PX);
      const worldX = (screenX - side / 2) / scale + cam.x;
      const worldY = (screenY - side / 2) / scale + cam.y;
      const tileX = Math.floor(worldX / TILE_PX);
      const tileY = Math.floor(worldY / TILE_PX);

      // Bounds check
      if (
        tileX < 0 ||
        tileX >= builtRoom.roomWidth ||
        tileY < 0 ||
        tileY >= builtRoom.roomHeight
      ) {
        return;
      }

      // Optimistic local prediction
      builtRoom.store.dispatch(
        dataEvent({ entityId: "player", type: "moveTo", data: { x: tileX, y: tileY }, time: performance.now() }),
      );
      // Send intent to authoritative server
      sendMoveTo(tileX, tileY);
      wasMovingRef.current = true;
    },
    [builtRoom, sendMoveTo],
  );

  // Loading screen
  if (phase !== "done") {
    return (
      <div className="fixed inset-0 bg-bg-deep flex flex-col items-center justify-center gap-6">
        {phase === "error" ? (
          <div className="text-center">
            <div className="font-heading text-sm text-error mb-2">
              Failed to load room
            </div>
            <div className="text-[11px] text-text-muted max-w-xs">
              {error}
            </div>
          </div>
        ) : (
          <>
            {/* Pixel art spinner */}
            <style>{`@keyframes room-spin { to { transform: rotate(360deg); } }`}</style>
            <div
              className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full"
              style={{
                animation: "room-spin 1s steps(8) infinite",
              }}
            />
            <div className="font-heading text-xs text-accent-primary">
              Loading room...
            </div>
            <div className="text-[11px] text-text-muted">
              {PHASE_LABELS[phase]}
            </div>
            {/* Progress bar */}
            <div className="w-48 h-2 bg-bg-panel border border-border rounded-sm overflow-hidden">
              <div
                className="h-full bg-accent-primary transition-all duration-300"
                style={{
                  width: `${PHASE_PROGRESS[phase]}%`,
                  transition: "width 0.3s steps(5)",
                }}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // builtRoom is guaranteed non-null when phase === "done", but TS can't infer that.
  if (!builtRoom) return null;

  // Game canvas + HUD
  return (
    <div className="fixed inset-0 flex flex-col">
      {/* Nav bar */}
      <GameNavHeader />

      {/* Canvas area */}
      <div ref={containerRef} className="relative flex-1 min-h-0 flex items-center justify-center">
        <div className="relative">
          <canvas
            ref={canvasRef}
            onClick={handleClick}
className="border-2 border-border rounded-sm cursor-pointer"
            style={{ imageRendering: "pixelated" }}
          />

          {/* HUD overlay — bottom left */}
          <div className="absolute bottom-2 left-2 pointer-events-none">
            <div className="bg-bg-deep/80 border-2 border-border rounded-sm px-3 py-2 backdrop-blur-sm">
              <div className="font-heading text-xs text-accent-primary">
                {builtRoom.roomName}
              </div>
              <div className="font-heading text-[10px] text-text-muted mt-0.5">
                {onlineCount} online
              </div>
            </div>
          </div>

          {/* View distance control — bottom right */}
          <div className="absolute bottom-2 right-2">
            <div className="bg-bg-deep/80 border-2 border-border rounded-sm backdrop-blur-sm flex items-center gap-1 px-1.5 py-1">
              <button
                onClick={() => builtRoom.store.dispatch(dataEvent({ entityId: "room", type: "camera-set-view-distance", data: { distance: Math.max(2, viewDistance - 1) }, time: performance.now() }))}
                className="font-heading text-xs text-text-muted hover:text-accent-primary bg-transparent border-none cursor-pointer px-1 py-0.5 leading-none"
              >
                -
              </button>
              <span className="font-heading text-[10px] text-accent-primary min-w-[4em] text-center">
                {viewportTiles}x{viewportTiles}
              </span>
              <button
                onClick={() => builtRoom.store.dispatch(dataEvent({ entityId: "room", type: "camera-set-view-distance", data: { distance: Math.min(12, viewDistance + 1) }, time: performance.now() }))}
                className="font-heading text-xs text-text-muted hover:text-accent-primary bg-transparent border-none cursor-pointer px-1 py-0.5 leading-none"
              >
                +
              </button>
            </div>
          </div>

          {/* Bottom-screen dialogue prompt */}
          <Provider store={builtRoom.store}>
            <PromptOverlay roomEntity={builtRoom.roomEntity} />
          </Provider>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt overlay — bottom-of-screen dialogue box
// ---------------------------------------------------------------------------

function PromptOverlay({ roomEntity }: { roomEntity: Entity }) {
  const [prompt, setPrompt] = useState<{
    entity: Entity;
    text: string;
    options: string[] | null;
  } | null>(null);

  // Use Redux store subscription to detect prompt changes efficiently
  const activePrompt = useSelector((state: RootState) => {
    const roomRecord = selectEntityById(state, "room");
    if (!roomRecord) return null;
    for (const childId of roomRecord.childIds) {
      const child = selectEntityById(state, childId);
      if (child?.state[PROMPT_ACTIVE]) {
        return {
          entityId: childId,
          text: (child.state[PROMPT_TEXT] as string) ?? "",
          options: (child.state[PROMPT_OPTIONS] as string[] | null) ?? null,
        };
      }
    }
    return null;
  });

  // Keep entity reference in sync for response handling
  useEffect(() => {
    if (activePrompt) {
      const entity = roomEntity.children.find((c) => c.id === activePrompt.entityId);
      if (entity) {
        queueMicrotask(() =>
          setPrompt({
            entity,
            text: activePrompt.text,
            options: activePrompt.options,
          }),
        );
        return;
      }
    }
    queueMicrotask(() => setPrompt(null));
  }, [activePrompt, roomEntity]);

  if (!prompt) return null;

  const handleSelect = (choice: string) => {
    prompt.entity.set(PROMPT_RESPONSE, choice);
    setPrompt(null);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10">
      <div className="bg-bg-deep/90 border-t-2 border-border px-4 py-3 backdrop-blur-sm">
        <div className="font-heading text-sm text-text-primary leading-relaxed">
          {prompt.text}
        </div>
        {prompt.options && prompt.options.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {prompt.options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                className="font-heading text-xs px-3 py-1 bg-bg-panel border-2 border-border text-accent-primary hover:bg-bg-surface rounded-sm cursor-pointer transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => handleSelect("dismiss")}
            className="font-heading text-[10px] text-text-muted mt-2 cursor-pointer bg-transparent border-none p-0 hover:text-accent-primary transition-colors"
          >
            Click to continue...
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact nav header for game view
// ---------------------------------------------------------------------------

function GameNavHeader() {
  const [did, setDid] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("session");
      if (raw) {
        const session = JSON.parse(raw);
        if (session.did) queueMicrotask(() => setDid(session.did));
      }
    } catch {
      // no session
    }
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-2 border-b-2 border-border bg-bg-panel/90 backdrop-blur-sm z-10 shrink-0">
      <Link
        to="/"
        className="font-heading text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
      >
        cozy-corner.at
      </Link>
      <nav className="flex items-center gap-4">
        {did && (
          <Link
            to="/create/$actor/$nsid/$tid"
            params={{ actor: did, nsid: "at.cozy-corner.house", tid: "self" }}
            className="font-heading text-[10px] text-text-muted uppercase tracking-wide hover:text-accent-primary transition-colors"
          >
            My House
          </Link>
        )}
        {did && (
          <Link
            to="/create/$actor/$nsid/$tid"
            params={{ actor: did, nsid: "at.cozy-corner.avatar", tid: "self" }}
            className="font-heading text-[10px] text-text-muted uppercase tracking-wide hover:text-accent-primary transition-colors"
          >
            Avatar
          </Link>
        )}
        <Link
          to="/inventory"
          className="font-heading text-[10px] text-text-muted uppercase tracking-wide hover:text-accent-primary transition-colors"
        >
          Inventory
        </Link>
        <Link
          to="/create"
          className="font-heading text-[10px] text-text-muted uppercase tracking-wide hover:text-accent-primary transition-colors"
        >
          Create
        </Link>
      </nav>
    </header>
  );
}
