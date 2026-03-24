export type RenderContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

/** Whether an event originated from the local client or a remote player. */
export type EventOrigin = "local" | "remote";

/** Base event class. Call stop() to prevent further behaviors from handling. */
export class Event {
  /** String tag for fast type matching in emit(). Override in subclasses. */
  readonly type: string = "event";
  #stopped = false;

  stop() {
    this.#stopped = true;
  }

  get stopped() {
    return this.#stopped;
  }
}

/**
 * Generic data event. Carries a dynamic type string, a properties map, and a timestamp.
 * Accepts a plain object or Map for data; undefined values are filtered out.
 */
export class DataEvent extends Event {
  override readonly type: string;
  readonly data: ReadonlyMap<string, number | string>;
  readonly time: number;
  readonly origin: EventOrigin;

  constructor(
    type: string,
    data:
      | Record<string, number | string | undefined>
      | ReadonlyMap<string, number | string>,
    time: number,
    origin: EventOrigin = "local",
  ) {
    super();
    this.type = type;
    if (data instanceof Map) {
      this.data = data;
    } else {
      const map = new Map<string, number | string>();
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) map.set(k, v);
      }
      this.data = map;
    }
    this.time = time;
    this.origin = origin;
  }
}

/** Render event carrying canvas context, timestamp, and per-channel tint map. */
export class RenderEvent extends Event {
  override readonly type = "render";
  readonly ctx: RenderContext;
  readonly time: number;
  readonly tintMap: ReadonlyMap<string, string>;

  constructor(
    ctx: RenderContext,
    time: number,
    tintMap: ReadonlyMap<string, string> = new Map(),
  ) {
    super();
    this.ctx = ctx;
    this.time = time;
    this.tintMap = tintMap;
  }
}
