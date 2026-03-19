import { describe, it, expect } from "vitest";
import { Entity } from "../entity";
import { DataEvent } from "../event";
import type { Event } from "../event";
import type { Behavior } from "../behavior";
import { LinkActivationBehavior } from "../behaviors/link-activation";
import { MediaActivationBehavior } from "../behaviors/media-activation";
import {
  ACTIVATION_LINK_URI,
  ACTIVATION_MEDIA_URL,
  ACTIVATION_MEDIA_MIME,
  SERVICE_HANDLERS,
  resolveAtUri,
  parseAtUri,
} from "../state/activation";

/** Captures "activate-response" events emitted during activation. */
class ResponseCapture implements Behavior {
  readonly eventTypes: ReadonlySet<string> = new Set(["activate-response"]);
  response: DataEvent | undefined;
  handle(_entity: Entity, event: Event): void {
    this.response = event as DataEvent;
  }
}

// ---------------------------------------------------------------------------
// parseAtUri
// ---------------------------------------------------------------------------

describe("parseAtUri", () => {
  it("parses a valid AT URI", () => {
    const result = parseAtUri("at://did:plc:abc123/app.bsky.feed.post/xyz");
    expect(result).toEqual({
      authority: "did:plc:abc123",
      collection: "app.bsky.feed.post",
      key: "xyz",
    });
  });

  it("parses a handle-based AT URI", () => {
    const result = parseAtUri("at://alice.bsky.social/app.bsky.feed.post/abc");
    expect(result).toEqual({
      authority: "alice.bsky.social",
      collection: "app.bsky.feed.post",
      key: "abc",
    });
  });

  it("returns null for invalid URIs", () => {
    expect(parseAtUri("")).toBeNull();
    expect(parseAtUri("https://example.com")).toBeNull();
    expect(parseAtUri("at://did:plc:abc")).toBeNull();
    expect(parseAtUri("at://did:plc:abc/collection")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveAtUri
// ---------------------------------------------------------------------------

describe("resolveAtUri", () => {
  it("uses provided handlers", () => {
    const handlers = [
      {
        collection: "app.bsky.feed.post",
        urlTemplate: "https://custom.app/{{authority}}/{{key}}",
      },
    ];
    const url = resolveAtUri(
      "at://did:plc:abc/app.bsky.feed.post/xyz",
      handlers,
    );
    expect(url).toBe("https://custom.app/did:plc:abc/xyz");
  });

  it("falls back to default handlers", () => {
    const url = resolveAtUri("at://did:plc:abc/app.bsky.feed.post/xyz", []);
    expect(url).toBe("https://bsky.app/profile/did:plc:abc/post/xyz");
  });

  it("uses default handler for whtwnd", () => {
    const url = resolveAtUri(
      "at://did:plc:abc/com.whtwnd.blog.entry/my-post",
      [],
    );
    expect(url).toBe("https://whtwnd.com/did:plc:abc/my-post");
  });

  it("prefers provided handlers over defaults", () => {
    const handlers = [
      {
        collection: "app.bsky.feed.post",
        urlTemplate: "https://my-viewer.com/post/{{authority}}/{{key}}",
      },
    ];
    const url = resolveAtUri(
      "at://alice.bsky.social/app.bsky.feed.post/abc",
      handlers,
    );
    expect(url).toBe("https://my-viewer.com/post/alice.bsky.social/abc");
  });

  it("returns null for unknown collection with no default", () => {
    const url = resolveAtUri(
      "at://did:plc:abc/com.example.unknown/xyz",
      [],
    );
    expect(url).toBeNull();
  });

  it("returns null for invalid URI", () => {
    expect(resolveAtUri("not-an-at-uri", [])).toBeNull();
  });

  it("resolves at.cozy-corner.* collections to in-app URLs", () => {
    const url = resolveAtUri(
      "at://did:plc:abc/at.cozy-corner.item/xyz",
      [],
    );
    expect(url).toBe("/did:plc:abc/at.cozy-corner.item/xyz");
  });

  it("resolves nested at.cozy-corner.* collections", () => {
    const url = resolveAtUri(
      "at://did:plc:abc/at.cozy-corner.house.room/xyz",
      [],
    );
    expect(url).toBe("/did:plc:abc/at.cozy-corner.house.room/xyz");
  });

  it("prefers explicit handler over cozy-corner fallback", () => {
    const handlers = [
      {
        collection: "at.cozy-corner.item",
        urlTemplate: "https://custom.app/{{authority}}/{{collection}}/{{key}}",
      },
    ];
    const url = resolveAtUri(
      "at://did:plc:abc/at.cozy-corner.item/xyz",
      handlers,
    );
    expect(url).toBe("https://custom.app/did:plc:abc/at.cozy-corner.item/xyz");
  });

  it("supports {{collection}} in url templates", () => {
    const handlers = [
      {
        collection: "app.bsky.feed.post",
        urlTemplate: "https://viewer.app/{{collection}}/{{authority}}/{{key}}",
      },
    ];
    const url = resolveAtUri(
      "at://did:plc:abc/app.bsky.feed.post/xyz",
      handlers,
    );
    expect(url).toBe("https://viewer.app/app.bsky.feed.post/did:plc:abc/xyz");
  });
});

// ---------------------------------------------------------------------------
// LinkActivationBehavior
// ---------------------------------------------------------------------------

describe("LinkActivationBehavior", () => {
  it("emits iframe response from AT URI using default handlers", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new LinkActivationBehavior(), capture]);
    entity.set(
      ACTIVATION_LINK_URI,
      "at://did:plc:abc/app.bsky.feed.post/xyz",
    );

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response?.data.get("type")).toBe("iframe");
    expect(capture.response?.data.get("url")).toBe(
      "https://bsky.app/profile/did:plc:abc/post/xyz",
    );
  });

  it("uses service handlers from ancestor entity", () => {
    const room = new Entity();
    room.set(SERVICE_HANDLERS, [
      {
        collection: "app.bsky.feed.post",
        urlTemplate: "https://custom.app/{{authority}}/{{key}}",
      },
    ]);

    const capture = new ResponseCapture();
    const item = new Entity([new LinkActivationBehavior(), capture]);
    item.set(
      ACTIVATION_LINK_URI,
      "at://did:plc:abc/app.bsky.feed.post/xyz",
    );
    room.addChild(item);

    item.emit(new DataEvent("activate", {}, 0));

    expect(capture.response?.data.get("type")).toBe("iframe");
    expect(capture.response?.data.get("url")).toBe(
      "https://custom.app/did:plc:abc/xyz",
    );
  });

  it("does nothing when no URI is set", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new LinkActivationBehavior(), capture]);

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response).toBeUndefined();
  });

  it("does nothing when URI collection has no handler", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new LinkActivationBehavior(), capture]);
    entity.set(
      ACTIVATION_LINK_URI,
      "at://did:plc:abc/com.example.unknown/xyz",
    );

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response).toBeUndefined();
  });

  it("emits iframe response for cozy-corner AT URIs", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new LinkActivationBehavior(), capture]);
    entity.set(
      ACTIVATION_LINK_URI,
      "at://did:plc:abc/at.cozy-corner.item/xyz",
    );

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response?.data.get("type")).toBe("iframe");
    expect(capture.response?.data.get("url")).toBe(
      "/did:plc:abc/at.cozy-corner.item/xyz",
    );
  });

  it("stops the event after emitting response", () => {
    const entity = new Entity([new LinkActivationBehavior()]);
    entity.set(
      ACTIVATION_LINK_URI,
      "at://did:plc:abc/app.bsky.feed.post/xyz",
    );

    const event = new DataEvent("activate", {}, 0);
    entity.emit(event);

    expect(event.stopped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MediaActivationBehavior
// ---------------------------------------------------------------------------

describe("MediaActivationBehavior", () => {
  it("emits image response for image/* MIME type", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new MediaActivationBehavior(), capture]);
    entity.set(ACTIVATION_MEDIA_URL, "https://pds.example/blob/abc");
    entity.set(ACTIVATION_MEDIA_MIME, "image/png");

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response?.data.get("type")).toBe("image");
    expect(capture.response?.data.get("url")).toBe("https://pds.example/blob/abc");
  });

  it("emits video response for video/* MIME type", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new MediaActivationBehavior(), capture]);
    entity.set(ACTIVATION_MEDIA_URL, "https://pds.example/blob/abc");
    entity.set(ACTIVATION_MEDIA_MIME, "video/mp4");

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response?.data.get("type")).toBe("video");
  });

  it("emits audio response for audio/* MIME type", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new MediaActivationBehavior(), capture]);
    entity.set(ACTIVATION_MEDIA_URL, "https://pds.example/blob/abc");
    entity.set(ACTIVATION_MEDIA_MIME, "audio/mpeg");

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response?.data.get("type")).toBe("audio");
  });

  it("defaults to image for unknown MIME type", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new MediaActivationBehavior(), capture]);
    entity.set(ACTIVATION_MEDIA_URL, "https://pds.example/blob/abc");
    entity.set(ACTIVATION_MEDIA_MIME, "application/octet-stream");

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response?.data.get("type")).toBe("image");
  });

  it("does nothing when URL is missing", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new MediaActivationBehavior(), capture]);
    entity.set(ACTIVATION_MEDIA_MIME, "image/png");

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response).toBeUndefined();
  });

  it("does nothing when MIME is missing", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new MediaActivationBehavior(), capture]);
    entity.set(ACTIVATION_MEDIA_URL, "https://pds.example/blob/abc");

    entity.emit(new DataEvent("activate", {}, 0));

    expect(capture.response).toBeUndefined();
  });

  it("stops the event after emitting response", () => {
    const entity = new Entity([new MediaActivationBehavior()]);
    entity.set(ACTIVATION_MEDIA_URL, "https://pds.example/blob/abc");
    entity.set(ACTIVATION_MEDIA_MIME, "video/webm");

    const event = new DataEvent("activate", {}, 0);
    entity.emit(event);

    expect(event.stopped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Remote origin suppression
// ---------------------------------------------------------------------------

describe("Remote origin suppression", () => {
  it("LinkActivationBehavior does nothing for remote events", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new LinkActivationBehavior(), capture]);
    entity.set(
      ACTIVATION_LINK_URI,
      "at://did:plc:abc/app.bsky.feed.post/xyz",
    );

    entity.emit(new DataEvent("activate", {}, 0, "remote"));

    expect(capture.response).toBeUndefined();
  });

  it("MediaActivationBehavior does nothing for remote events", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([new MediaActivationBehavior(), capture]);
    entity.set(ACTIVATION_MEDIA_URL, "https://pds.example/blob/abc");
    entity.set(ACTIVATION_MEDIA_MIME, "image/png");

    entity.emit(new DataEvent("activate", {}, 0, "remote"));

    expect(capture.response).toBeUndefined();
  });

  it("remote activate does not stop the event", () => {
    const entity = new Entity([new LinkActivationBehavior()]);
    entity.set(
      ACTIVATION_LINK_URI,
      "at://did:plc:abc/app.bsky.feed.post/xyz",
    );

    const event = new DataEvent("activate", {}, 0, "remote");
    entity.emit(event);

    expect(event.stopped).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Activation basics
// ---------------------------------------------------------------------------

describe("Activation", () => {
  it("activate event has correct type and time", () => {
    const event = new DataEvent("activate", {}, 42);
    expect(event.type).toBe("activate");
    expect(event.time).toBe(42);
  });

  it("only the first matching behavior emits a response (stop propagation)", () => {
    const capture = new ResponseCapture();
    const entity = new Entity([
      new MediaActivationBehavior(),
      new LinkActivationBehavior(),
      capture,
    ]);
    entity.set(ACTIVATION_MEDIA_URL, "https://pds.example/blob/abc");
    entity.set(ACTIVATION_MEDIA_MIME, "image/png");
    entity.set(
      ACTIVATION_LINK_URI,
      "at://did:plc:abc/app.bsky.feed.post/xyz",
    );

    entity.emit(new DataEvent("activate", {}, 0));

    // Media behavior runs first and stops the event
    expect(capture.response?.data.get("type")).toBe("image");
    expect(capture.response?.data.get("url")).toBe("https://pds.example/blob/abc");
  });
});
