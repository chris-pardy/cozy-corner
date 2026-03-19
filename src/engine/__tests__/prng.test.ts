import { describe, it, expect } from "vitest";
import { mulberry32, hashString } from "../prng";
import { resolveSpawnTiles } from "../resolve-spawn";

describe("mulberry32", () => {
  it("produces deterministic sequence from same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences from different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    // At least one of the first 10 values should differ
    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (a() !== b()) allSame = false;
    }
    expect(allSame).toBe(false);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashString", () => {
  it("produces same hash for same input", () => {
    expect(hashString("hello")).toBe(hashString("hello"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashString("hello")).not.toBe(hashString("world"));
  });
});

describe("resolveSpawnTiles with seeded RNG", () => {
  const spawnTiles = [0, 1, 0, 1, 0, 0, 1, 0, 0];
  const width = 3;

  it("produces deterministic spawn from same seed", () => {
    const a = resolveSpawnTiles(spawnTiles, width, mulberry32(hashString("room-cid-1")));
    const b = resolveSpawnTiles(spawnTiles, width, mulberry32(hashString("room-cid-1")));
    expect(a).toEqual(b);
  });

  it("client and server agree on spawn position", () => {
    // Simulate: both sides seed from the same room CID
    const roomCid = "bafyreiabc123";
    const seed = hashString(roomCid);

    const clientRng = mulberry32(seed);
    const serverRng = mulberry32(seed);

    const clientSpawn = resolveSpawnTiles(spawnTiles, width, clientRng);
    const serverSpawn = resolveSpawnTiles(spawnTiles, width, serverRng);

    expect(clientSpawn).toEqual(serverSpawn);
  });
});
