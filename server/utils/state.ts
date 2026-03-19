/**
 * Global peer registry for online lookup (e.g. getOnlineFriends).
 *
 * Entity state lives in RoomSession (room-state.ts).
 * This module only tracks which DIDs are online and where.
 */

import type { Identity } from "./protocol";
import { parseAtUri } from "./pds-fetch";

// ---------------------------------------------------------------------------
// Peer registry
// ---------------------------------------------------------------------------

interface PeerInfo {
  identity: Identity;
  roomUri: string;
}

const peers = new Map<string, PeerInfo>();

export function registerPeer(peerId: string, info: PeerInfo): void {
  peers.set(peerId, info);
}

export function unregisterPeer(peerId: string): PeerInfo | undefined {
  const info = peers.get(peerId);
  if (info) peers.delete(peerId);
  return info;
}

// ---------------------------------------------------------------------------
// Online lookup (for getOnlineFriends)
// ---------------------------------------------------------------------------

export function getOnlineDids(): Map<string, { houseDid: string }> {
  const result = new Map<string, { houseDid: string }>();
  for (const info of peers.values()) {
    if (info.identity.type === "did") {
      const parsed = parseAtUri(info.roomUri);
      const houseDid = parsed?.did ?? "";
      result.set(info.identity.did, { houseDid });
    }
  }
  return result;
}
