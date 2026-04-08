import type { Dispatch } from "@reduxjs/toolkit";
import { TICK } from "./entity-slice";

const FRAME_MS = 1000 / 24; // ~41.67 ms per tick

export class TickLoop {
  private interval: ReturnType<typeof setInterval> | null = null;
  private tickNumber = 0;

  constructor(private dispatch: Dispatch) {}

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.dispatch({ type: TICK, payload: { tick: ++this.tickNumber } });
    }, FRAME_MS);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** Current tick count (monotonic). */
  get tick() {
    return this.tickNumber;
  }

  get running() {
    return this.interval !== null;
  }
}
