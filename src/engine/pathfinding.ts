import type { Position } from "./state/movement";
import { DIRECTION_DELTAS, deltaToDirection } from "./state/movement";
import { type BlockingGrid, isEdgeBlocked } from "./state/blocking";

/**
 * A* pathfinding on a tile grid with edge blocking.
 *
 * Returns an array of positions from start (exclusive) to the destination
 * (inclusive). If the exact goal is unreachable, returns the path to the
 * closest reachable tile (by Manhattan distance to goal, then shortest
 * path as tiebreak). Returns null only when no reachable tile exists
 * other than the start, or the goal is out of bounds.
 */
export function findPath(
  grid: BlockingGrid,
  start: Position,
  goal: Position,
): Position[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];

  const { width, height } = grid;

  // Out of bounds goal
  if (goal.x < 0 || goal.x >= width || goal.y < 0 || goal.y >= height) {
    return null;
  }

  const key = (x: number, y: number) => y * width + x;
  const startKey = key(start.x, start.y);
  const goalKey = key(goal.x, goal.y);

  const gScore = new Map<number, number>();
  gScore.set(startKey, 0);

  const cameFrom = new Map<number, number>();

  // Simple binary-bucketed open set: array of [key, fScore] sorted by insertion.
  // For small grids a linear scan beats a heap's overhead.
  const open: number[] = [startKey];
  const fScore = new Map<number, number>();
  const h = (x: number, y: number) =>
    Math.abs(x - goal.x) + Math.abs(y - goal.y);
  fScore.set(startKey, h(start.x, start.y));

  const inOpen = new Set<number>([startKey]);

  // Track closest reachable tile to goal (fallback when goal is unreachable)
  let closestKey = -1;
  let closestH = Infinity;
  let closestG = Infinity;

  while (open.length > 0) {
    // Find node in open with lowest fScore
    let bestIdx = 0;
    let bestF = fScore.get(open[0])!;
    for (let i = 1; i < open.length; i++) {
      const f = fScore.get(open[i])!;
      if (f < bestF) {
        bestF = f;
        bestIdx = i;
      }
    }

    const currentKey = open[bestIdx];
    open[bestIdx] = open[open.length - 1];
    open.pop();
    inOpen.delete(currentKey);

    if (currentKey === goalKey) {
      return reconstructPath(cameFrom, goalKey, startKey, width);
    }

    const cx = currentKey % width;
    const cy = (currentKey / width) | 0;
    const currentG = gScore.get(currentKey)!;

    // Track closest visited node to goal (excluding start)
    if (currentKey !== startKey) {
      const currentH = h(cx, cy);
      if (
        currentH < closestH ||
        (currentH === closestH && currentG < closestG)
      ) {
        closestH = currentH;
        closestG = currentG;
        closestKey = currentKey;
      }
    }

    for (let dir = 0; dir < 4; dir++) {
      if (isEdgeBlocked(grid, cx, cy, dir)) continue;

      const [dx, dy] = DIRECTION_DELTAS[dir];
      const nx = cx + dx;
      const ny = cy + dy;

      // Bounds already checked by isEdgeBlocked, but guard anyway
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const nk = key(nx, ny);
      const tentativeG = currentG + 1;

      const prevG = gScore.get(nk);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      cameFrom.set(nk, currentKey);
      gScore.set(nk, tentativeG);
      fScore.set(nk, tentativeG + h(nx, ny));

      if (!inOpen.has(nk)) {
        open.push(nk);
        inOpen.add(nk);
      }
    }
  }

  // Goal unreachable — path to closest reachable tile
  if (closestKey >= 0) {
    return reconstructPath(cameFrom, closestKey, startKey, width);
  }

  return null;
}

function reconstructPath(
  cameFrom: Map<number, number>,
  endKey: number,
  startKey: number,
  width: number,
): Position[] {
  const path: Position[] = [];
  let k = endKey;
  while (k !== startKey) {
    path.push({ x: k % width, y: (k / width) | 0 });
    k = cameFrom.get(k)!;
  }
  path.reverse();
  return path;
}

/** Convert a path step into a direction index. */
export function stepDirection(from: Position, to: Position): number {
  return deltaToDirection(to.x - from.x, to.y - from.y);
}
