import { defineWebSocketHandler } from "h3";
import {
  type ClientMessage,
  type ServerMessage,
  type Identity,
  MOVE_RATE_LIMIT,
  ACTIVATE_RATE_LIMIT,
  SAY_RATE_LIMIT,
} from "../utils/protocol";
import { registerPeer, unregisterPeer } from "../utils/state";
import {
  getOrCreateSession,
  addPeer,
  removePeer,
  buildInitialSnapshot,
  type RoomSession,
  type PeerInfo,
} from "../utils/room-state";

// ---------------------------------------------------------------------------
// Peer → session lookup
// ---------------------------------------------------------------------------

const peerSessions = new Map<
  string,
  { session: RoomSession; peer: PeerInfo }
>();

let anonCounter = 0;

export default defineWebSocketHandler({
  async open(peer) {
    const url = new URL(peer.request.url, "http://localhost");
    const roomUri = url.searchParams.get("roomUri");
    const roomCid = url.searchParams.get("roomCid");

    if (!roomUri || !roomCid) {
      peer.close(4000, "Missing roomUri or roomCid");
      return;
    }

    // Determine identity
    const token = url.searchParams.get("token");
    const handle = url.searchParams.get("handle") ?? "";
    let identity: Identity;
    if (token) {
      identity = { type: "did", did: token };
    } else {
      anonCounter++;
      identity = { type: "anonymousId", anonymousId: `anon-${anonCounter}` };
    }

    // Get or create room session (fetches room from PDS on first connect)
    let session: RoomSession;
    try {
      session = await getOrCreateSession(roomUri, roomCid);
    } catch {
      peer.close(4001, "Failed to initialize room session");
      return;
    }

    // Add peer with direct send function — engine broadcasts via this
    const sendFn = (msg: string) => {
      try {
        peer.send(msg);
      } catch {
        // Peer may have disconnected
      }
    };
    const peerInfo = addPeer(session, peer.id, identity, handle, sendFn);

    // Store peer → session mapping
    peerSessions.set(peer.id, { session, peer: peerInfo });

    // Register for online lookup
    registerPeer(peer.id, { identity, roomUri });

    // Send initial snapshot to joiner
    const initial = buildInitialSnapshot(session);
    peer.send(JSON.stringify({
      type: "tickSnapshot",
      tick: initial.tick,
      entities: initial.entities,
    } satisfies ServerMessage));
  },

  message(peer, message) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message.text()) as ClientMessage;
    } catch {
      return;
    }

    const entry = peerSessions.get(peer.id);
    if (!entry) return;

    const { session, peer: peerInfo } = entry;
    const now = Date.now();

    if (msg.type === "moveTo") {
      if (now - peerInfo.lastMoveAt < MOVE_RATE_LIMIT) return;
      peerInfo.lastMoveAt = now;

      session.engine.dispatchMoveTo(peerInfo.entityId, msg.x, msg.y);
    } else if (msg.type === "activate") {
      if (now - peerInfo.lastActivateAt < ACTIVATE_RATE_LIMIT) return;
      peerInfo.lastActivateAt = now;

      // TODO: dispatch activate to entities at the tile
    } else if (msg.type === "say") {
      if (now - peerInfo.lastSayAt < SAY_RATE_LIMIT) return;
      peerInfo.lastSayAt = now;

      session.engine.dispatchSay(peerInfo.entityId, msg.emoji, msg.bubble);
    }
  },

  close(peer) {
    const entry = peerSessions.get(peer.id);
    if (entry) {
      const { session, peer: peerInfo } = entry;

      // Broadcast leave immediately (before next snapshot)
      const leaveMsg = JSON.stringify({
        type: "leave",
        id: peerInfo.identity,
      } satisfies ServerMessage);
      for (const otherPeer of session.peers.values()) {
        if (otherPeer !== peerInfo) {
          otherPeer.sendFn(leaveMsg);
        }
      }

      removePeer(session, peer.id);
      peerSessions.delete(peer.id);
    }

    unregisterPeer(peer.id);
  },
});
