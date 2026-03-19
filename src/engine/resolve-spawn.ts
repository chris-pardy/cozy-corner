/**
 * Resolves where a player should spawn when entering a room.
 *
 * For room-to-room transitions (resolveSpawnExit):
 * 1. If source exit has targetExit and target CID matches → use that exit
 * 2. Reciprocal matching: find exit in target room pointing back to source
 * 3. Room's spawn tiles
 * 4. Fallback to (0, 0)
 *
 * For external entry (resolveSpawnTiles):
 * Picks a random valid tile from the spawn mask, or (0, 0) if none.
 */

/** Direction bitmask constants */
const DIR_N = 1;
const DIR_E = 2;
const DIR_S = 4;
const DIR_W = 8;

interface ExitLike {
  x: number;
  y: number;
  width?: number;
  height?: number;
  direction?: number;
  target?: { uri: string; cid: string } | null;
  targetExit?: number;
}

export interface SpawnResult {
  x: number;
  y: number;
}

/**
 * Offset one tile away from the exit's traversal direction
 * so the player appears "just inside" the room, not on the exit trigger.
 */
function exitOffset(direction: number): { dx: number; dy: number } {
  if (direction & DIR_N) return { dx: 0, dy: -1 };
  if (direction & DIR_S) return { dx: 0, dy: 1 };
  if (direction & DIR_W) return { dx: -1, dy: 0 };
  if (direction & DIR_E) return { dx: 1, dy: 0 };
  return { dx: 0, dy: 0 };
}

function spawnAtExit(exit: ExitLike): SpawnResult {
  const w = exit.width ?? 1;
  const h = exit.height ?? 1;
  const dir = exit.direction ?? 15;

  const cx = exit.x + Math.floor(w / 2);
  const cy = exit.y + Math.floor(h / 2);

  const { dx, dy } = exitOffset(dir);
  return { x: cx + dx, y: cy + dy };
}

/**
 * Resolve the spawn position from a spawn tile mask.
 * Picks a random valid tile, or falls back to (0, 0).
 *
 * @param rng - Random number generator returning [0,1). Pass a seeded
 *   PRNG (from `src/engine/prng.ts`) for deterministic results that
 *   agree between client and server.
 */
export function resolveSpawnTiles(
  spawnTiles: number[] | null | undefined,
  roomWidth: number,
  rng: () => number = Math.random,
): SpawnResult {
  if (!spawnTiles) return { x: 0, y: 0 };
  const valid: SpawnResult[] = [];
  for (let i = 0; i < spawnTiles.length; i++) {
    if (spawnTiles[i]) {
      valid.push({ x: i % roomWidth, y: Math.floor(i / roomWidth) });
    }
  }
  if (valid.length === 0) return { x: 0, y: 0 };
  return valid[Math.floor(rng() * valid.length)];
}

/**
 * Resolve the spawn position in a target room when entering via an exit.
 *
 * @param sourceRoomUri - AT URI of the room the player is leaving
 * @param sourceExit - The exit the player walked through
 * @param targetRoom - The target room's data
 * @param targetRoomCid - The current CID of the target room record
 * @param targetRoomWidth - The width of the target room in tiles
 */
export function resolveSpawnExit(
  sourceRoomUri: string,
  sourceExit: ExitLike,
  targetRoom: { exits?: ExitLike[]; spawnTiles?: number[] | null },
  targetRoomCid: string,
  targetRoomWidth: number,
): SpawnResult {
  const exits = targetRoom.exits ?? [];

  // 1. Pinned exit: if targetExit is set, trust it when:
  //    - Same-room exit (CID always stale after save, so skip check)
  //    - Cross-room exit with matching CID
  const isSameRoom = sourceExit.target?.uri === sourceRoomUri;
  if (sourceExit.targetExit != null) {
    const cidMatch = isSameRoom || sourceExit.target?.cid === targetRoomCid;
    if (cidMatch) {
      const pinned = exits[sourceExit.targetExit];
      if (pinned) return spawnAtExit(pinned);
    }
  }

  // 2. Reciprocal matching: find an exit in target room pointing back to source
  const reciprocal = exits.find(
    (e) => e.target?.uri === sourceRoomUri,
  );
  if (reciprocal) return spawnAtExit(reciprocal);

  // 3. Room's spawn tiles
  return resolveSpawnTiles(targetRoom.spawnTiles, targetRoomWidth);
}
