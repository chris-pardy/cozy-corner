import { Direction, directionFromDelta, entryEdge, type Point } from "./types";

/**
 * A* pathfinding on a blocking grid with per-edge directional bitmasks.
 *
 * Returns the path as an array of points from (but not including) `start`
 * to `end`, or `null` if no path exists.
 *
 * Only physical blocking bits (0-3) are checked — ephemeral bits are ignored.
 */
export function findPath(
  grid: Uint8Array,
  width: number,
  height: number,
  start: Point,
  end: Point,
): Point[] | null {
  if (start.x === end.x && start.y === end.y) return [];
  if (!inBounds(end.x, end.y, width, height)) return null;

  const size = width * height;
  const gScore = new Float64Array(size).fill(Infinity);
  const fScore = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);

  const startIdx = start.y * width + start.x;
  const endIdx = end.y * width + end.x;

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(start, end);

  // Min-heap keyed by fScore (simple array-based for small grids)
  const open = new MinHeap();
  open.push(startIdx, fScore[startIdx]);
  const inOpen = new Uint8Array(size);
  inOpen[startIdx] = 1;

  while (open.size > 0) {
    const current = open.pop()!;
    if (current === endIdx) return reconstructPath(cameFrom, current, width);

    inOpen[current] = 0;
    const cx = current % width;
    const cy = (current - cx) / width;

    for (let d = 0; d < 4; d++) {
      const dir = d as Direction;
      const nx = cx + DX[dir];
      const ny = cy + DY[dir];
      if (!inBounds(nx, ny, width, height)) continue;

      const neighborIdx = ny * width + nx;

      // Check blocking: destination tile's entry edge must be clear (physical bits only)
      const destBlocking = grid[neighborIdx] & 0x0f;
      if (destBlocking & entryEdge(dir)) continue;

      const tentativeG = gScore[current] + 1;
      if (tentativeG >= gScore[neighborIdx]) continue;

      cameFrom[neighborIdx] = current;
      gScore[neighborIdx] = tentativeG;
      fScore[neighborIdx] = tentativeG + heuristic({ x: nx, y: ny }, end);

      if (!inOpen[neighborIdx]) {
        open.push(neighborIdx, fScore[neighborIdx]);
        inOpen[neighborIdx] = 1;
      }
    }
  }

  return null; // No path found
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DX = [0, -1, 0, 1]; // S W N E
const DY = [1, 0, -1, 0];

function inBounds(x: number, y: number, w: number, h: number) {
  return x >= 0 && x < w && y >= 0 && y < h;
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstructPath(
  cameFrom: Int32Array,
  current: number,
  width: number,
): Point[] {
  const path: Point[] = [];
  let c = current;
  while (cameFrom[c] !== -1) {
    path.push({ x: c % width, y: Math.floor(c / width) });
    c = cameFrom[c];
  }
  path.reverse();
  return path;
}

// ---------------------------------------------------------------------------
// Minimal binary min-heap
// ---------------------------------------------------------------------------

class MinHeap {
  private heap: number[] = [];
  private priorities: number[] = [];

  get size() {
    return this.heap.length;
  }

  push(value: number, priority: number) {
    this.heap.push(value);
    this.priorities.push(priority);
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): number | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const lastVal = this.heap.pop()!;
    const lastPri = this.priorities.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = lastVal;
      this.priorities[0] = lastPri;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[i]) break;
      this._swap(i, parent);
      i = parent;
    }
  }

  private _sinkDown(i: number) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.priorities[l] < this.priorities[smallest]) smallest = l;
      if (r < n && this.priorities[r] < this.priorities[smallest]) smallest = r;
      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
  }

  private _swap(a: number, b: number) {
    [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];
    [this.priorities[a], this.priorities[b]] = [
      this.priorities[b],
      this.priorities[a],
    ];
  }
}
