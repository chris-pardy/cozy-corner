import { useEffect, useRef, useState, useCallback } from "react";
import type { RoomStore } from "~/engine/store/store";
import type { ReduxEntity } from "~/engine/entity";
import {
  type Identity,
  type SnapshotEntity,
  applyTickSnapshot,
  removeAllRemotes,
} from "~/engine/store/applySnapshot";
import { selectOnlineCount } from "~/engine/store/selectors";
import { TICK_MS } from "~/engine/tick";

// ---------------------------------------------------------------------------
// Types matching server protocol (for JSON parsing)
// ---------------------------------------------------------------------------

interface TickSnapshotMessage {
  type: "tickSnapshot";
  tick: number;
  entities: SnapshotEntity[];
}

interface LeaveMessage {
  type: "leave";
  id: Identity;
}

type ServerMessage = TickSnapshotMessage | LeaveMessage;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseMultiplayerOptions {
  roomUri: string;
  roomCid: string;
  store?: RoomStore | null;
  entityRegistry?: Map<string, ReduxEntity> | null;
  /** The local user's DID (if authenticated). */
  localDid?: string;
  localHandle?: string;
}

interface UseMultiplayerResult {
  onlineCount: number;
  sendMoveTo: (x: number, y: number) => void;
  sendActivate: (x: number, y: number) => void;
  sendSay: (emoji: string, bubble: "thought" | "speech") => void;
}

/**
 * Multiplayer hook — snapshot-based.
 *
 * Connects to the server via WebSocket, receives authoritative tick
 * snapshots, and applies them to the entity tree. Exposes send
 * functions for client intents.
 */
export function useMultiplayer({
  roomUri,
  roomCid,
  store,
  entityRegistry,
  localDid,
  localHandle,
}: UseMultiplayerOptions): UseMultiplayerResult {
  const [onlineCount, setOnlineCount] = useState(1);
  const wsRef = useRef<WebSocket | null>(null);
  const timeOffsetRef = useRef<number | null>(null);
  const remoteEntitiesRef = useRef(new Map<string, ReduxEntity>());

  useEffect(() => {
    if (!roomUri || !roomCid || !store || !entityRegistry) return;

    // Reset remote entities map for new connection
    remoteEntitiesRef.current = new Map();

    // Build WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams({ roomUri, roomCid });
    if (localDid) params.set("token", localDid);
    if (localHandle) params.set("handle", localHandle);
    const wsUrl = `${protocol}//${window.location.host}/_ws?${params}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener("message", (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "tickSnapshot": {
          // Compute/update time offset: local time that corresponds to server tick 0
          const now = performance.now();
          const serverTime = msg.tick * TICK_MS;
          const newOffset = now - serverTime;

          if (timeOffsetRef.current === null) {
            timeOffsetRef.current = newOffset;
          } else {
            // EMA smoothing (0.9 old / 0.1 new)
            timeOffsetRef.current = timeOffsetRef.current * 0.9 + newOffset * 0.1;
          }

          applyTickSnapshot(
            entityRegistry,
            store,
            msg.entities,
            localDid ?? null,
            timeOffsetRef.current,
            remoteEntitiesRef.current,
          );

          // Update online count
          setOnlineCount(selectOnlineCount(store.getState()));
          break;
        }

        case "leave": {
          // Next snapshot will remove the entity, but update count immediately
          setOnlineCount(selectOnlineCount(store.getState()));
          break;
        }
      }
    });

    ws.addEventListener("close", () => {
      removeAllRemotes(entityRegistry, store, remoteEntitiesRef.current);
      setOnlineCount(1);
      wsRef.current = null;
    });

    return () => {
      ws.close();
      wsRef.current = null;
      removeAllRemotes(entityRegistry, store, remoteEntitiesRef.current);
    };
  }, [roomUri, roomCid, store, entityRegistry, localDid, localHandle]);

  const sendMoveTo = useCallback((x: number, y: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "moveTo", x, y }));
  }, []);

  const sendActivate = useCallback((x: number, y: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "activate", x, y }));
  }, []);

  const sendSay = useCallback(
    (emoji: string, bubble: "thought" | "speech") => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "say", emoji, bubble }));
    },
    [],
  );

  return { onlineCount, sendMoveTo, sendActivate, sendSay };
}
