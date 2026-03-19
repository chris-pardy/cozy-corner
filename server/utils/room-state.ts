/**
 * Room session management backed by the authoritative game engine.
 *
 * Each active room gets a RoomEngine with a fixed-rate tick loop.
 * The engine broadcasts snapshots to all connected peers via direct
 * send functions (no pub/sub relay).
 */

import { fetchRecord, parseAtUri } from "./pds-fetch";
import { mulberry32, hashString } from "../../src/engine/prng";
import { type Identity, type SnapshotEntity, type ServerMessage, identityKey } from "./protocol";
import { RoomEngine } from "./room-engine";

// ---------------------------------------------------------------------------
// Peer info (per-connection metadata)
// ---------------------------------------------------------------------------

export interface PeerInfo {
  entityId: string;
  identity: Identity;
  handle: string;
  sendFn: (msg: string) => void;
  /** Timestamp of last moveTo (for rate limiting). */
  lastMoveAt: number;
  /** Timestamp of last activate (for rate limiting). */
  lastActivateAt: number;
  /** Timestamp of last say (for rate limiting). */
  lastSayAt: number;
}

// ---------------------------------------------------------------------------
// Room Session
// ---------------------------------------------------------------------------

export interface RoomSession {
  roomUri: string;
  roomCid: string;
  engine: RoomEngine;
  peers: Map<string, PeerInfo>; // peerId → PeerInfo
}

/** Active sessions. Promise handles concurrent init. */
const sessions = new Map<string, RoomSession | Promise<RoomSession>>();

export function sessionKey(roomUri: string, roomCid: string): string {
  return `${roomUri}:${roomCid}`;
}

/**
 * Get or create a room session. Fetches room record from PDS on
 * first connect (for blocking grid, spawn tiles), then caches.
 */
export async function getOrCreateSession(
  roomUri: string,
  roomCid: string,
): Promise<RoomSession> {
  const key = sessionKey(roomUri, roomCid);
  const existing = sessions.get(key);
  if (existing) return existing;

  const promise = initSession(roomUri, roomCid);
  sessions.set(key, promise);
  try {
    const session = await promise;
    sessions.set(key, session);
    return session;
  } catch (err) {
    sessions.delete(key);
    throw err;
  }
}

async function initSession(
  roomUri: string,
  roomCid: string,
): Promise<RoomSession> {
  const parsed = parseAtUri(roomUri);
  if (!parsed) throw new Error(`Invalid room URI: ${roomUri}`);

  const { value: roomValue } = await fetchRecord(
    parsed.did,
    parsed.collection,
    parsed.rkey,
  );
  const room = roomValue as Record<string, unknown>;

  const width = room.width as number;
  const spawnTiles = (room.spawnTiles as number[] | null) ?? null;
  const blockingEdges = (room.blockingEdges as number[] | null) ?? null;

  // Compute room height from grid arrays
  const gridLen = spawnTiles?.length ?? blockingEdges?.length ?? 0;
  const height = gridLen > 0 ? Math.ceil(gridLen / width) : width;

  // Build blocking grid (room-level edges only for now)
  const size = width * height;
  const edges = new Array<number>(size).fill(0);
  if (blockingEdges) {
    for (let i = 0; i < Math.min(blockingEdges.length, size); i++) {
      edges[i] |= blockingEdges[i];
    }
  }

  const rng = mulberry32(hashString(roomCid));

  const engine = new RoomEngine(
    { edges, width, height },
    width,
    height,
    spawnTiles,
    rng,
  );

  const session: RoomSession = {
    roomUri,
    roomCid,
    engine,
    peers: new Map(),
  };

  // Wire engine tick callback to broadcast snapshots
  engine.onTick = (tick, snapshot) => {
    broadcastSnapshot(session, tick, snapshot);
  };

  return session;
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

function broadcastSnapshot(
  session: RoomSession,
  tick: number,
  snapshot: SnapshotEntity[],
): void {
  const msg = JSON.stringify({
    type: "tickSnapshot",
    tick,
    entities: snapshot,
  } satisfies ServerMessage);

  for (const peer of session.peers.values()) {
    peer.sendFn(msg);
  }
}

// ---------------------------------------------------------------------------
// Peer lifecycle
// ---------------------------------------------------------------------------

/** Add a peer to the session. Starts tick loop if first peer. Returns peer info. */
export function addPeer(
  session: RoomSession,
  peerId: string,
  identity: Identity,
  handle: string,
  sendFn: (msg: string) => void,
): PeerInfo {
  const entityId = `player:${identityKey(identity)}`;
  session.engine.addPlayer(entityId, identity, handle);

  const info: PeerInfo = {
    entityId,
    identity,
    handle,
    sendFn,
    lastMoveAt: 0,
    lastActivateAt: 0,
    lastSayAt: 0,
  };

  session.peers.set(peerId, info);

  // Start tick loop on first peer
  if (session.peers.size === 1) {
    session.engine.startTickLoop();
  }

  return info;
}

/** Remove a peer. Stops tick loop and destroys session if last peer. */
export function removePeer(
  session: RoomSession,
  peerId: string,
): PeerInfo | undefined {
  const info = session.peers.get(peerId);
  if (!info) return undefined;

  session.engine.removePlayer(info.entityId);
  session.peers.delete(peerId);

  if (session.peers.size === 0) {
    session.engine.stopTickLoop();
    sessions.delete(sessionKey(session.roomUri, session.roomCid));
  }

  return info;
}

// ---------------------------------------------------------------------------
// Snapshot helpers (for initial join)
// ---------------------------------------------------------------------------

export function buildInitialSnapshot(session: RoomSession): { tick: number; entities: SnapshotEntity[] } {
  return {
    tick: session.engine.tick,
    entities: session.engine.buildTickSnapshot(),
  };
}
