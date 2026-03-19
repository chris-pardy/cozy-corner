/**
 * Tick system constants.
 *
 * A tick is the fundamental unit of game time. Both client and server
 * agree on the fixed duration so behaviors see consistent time.
 */

/** Milliseconds per tick. 50ms = 20 ticks/second. */
export const TICK_MS = 50;

/** Convert a tick number to a time value (ms) usable by behaviors. */
export function tickToTime(tick: number): number {
  return tick * TICK_MS;
}

/** Convert a wall-clock time (ms) to the nearest tick number. */
export function timeToTick(time: number): number {
  return Math.floor(time / TICK_MS);
}
