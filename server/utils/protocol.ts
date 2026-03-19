/**
 * Multiplayer protocol types.
 *
 * Server is authoritative — runs a fixed-rate tick loop and broadcasts
 * full entity state snapshots. Clients send intents, receive snapshots.
 */

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export type Identity =
  | { type: "did"; did: string }
  | { type: "anonymousId"; anonymousId: string };

export function identityKey(id: Identity): string {
  return id.type === "did" ? id.did : id.anonymousId;
}

// ---------------------------------------------------------------------------
// Snapshot entity (server → client)
// ---------------------------------------------------------------------------

export interface SnapshotEntity {
  id: Identity;
  handle: string;
  x: number;
  y: number;
  direction: number;
  animState: string;
  moveTargetX?: number;
  moveTargetY?: number;
  moveStartTick?: number;
  moveSpeed?: number;
  target?: string;
  targetStartTick?: number;
  speechText?: string;
  speechBubble?: "thought" | "speech";
  speechStartTick?: number;
  speechDuration?: number;
}

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

export interface TickSnapshotMessage {
  type: "tickSnapshot";
  tick: number;
  entities: SnapshotEntity[];
}

export interface LeaveMessage {
  type: "leave";
  id: Identity;
}

export type ServerMessage = TickSnapshotMessage | LeaveMessage;

// ---------------------------------------------------------------------------
// Client → Server messages (intents only)
// ---------------------------------------------------------------------------

export interface ClientMoveToMessage {
  type: "moveTo";
  x: number;
  y: number;
}

export interface ClientActivateMessage {
  type: "activate";
  x: number;
  y: number;
}

export interface ClientSayMessage {
  type: "say";
  emoji: string;
  bubble: "thought" | "speech";
}

export interface ClientPromptResponseMessage {
  type: "promptResponse";
  response: string;
}

export type ClientMessage =
  | ClientMoveToMessage
  | ClientActivateMessage
  | ClientSayMessage
  | ClientPromptResponseMessage;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MOVE_RATE_LIMIT = 100;
export const ACTIVATE_RATE_LIMIT = 500;
export const SAY_RATE_LIMIT = 1000;
