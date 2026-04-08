import { describe, it, expect } from "vitest";
import {
  Direction,
  Edge,
  directionName,
  directionDelta,
  directionFromDelta,
  entryEdge,
} from "../types";

describe("directionName", () => {
  it("maps each direction to its string", () => {
    expect(directionName(Direction.South)).toBe("south");
    expect(directionName(Direction.West)).toBe("west");
    expect(directionName(Direction.North)).toBe("north");
    expect(directionName(Direction.East)).toBe("east");
  });
});

describe("directionDelta", () => {
  it("returns correct dx/dy for each direction", () => {
    expect(directionDelta(Direction.South)).toEqual({ x: 0, y: 1 });
    expect(directionDelta(Direction.North)).toEqual({ x: 0, y: -1 });
    expect(directionDelta(Direction.West)).toEqual({ x: -1, y: 0 });
    expect(directionDelta(Direction.East)).toEqual({ x: 1, y: 0 });
  });
});

describe("directionFromDelta", () => {
  it("infers direction from deltas", () => {
    expect(directionFromDelta(0, 1)).toBe(Direction.South);
    expect(directionFromDelta(0, -1)).toBe(Direction.North);
    expect(directionFromDelta(-1, 0)).toBe(Direction.West);
    expect(directionFromDelta(1, 0)).toBe(Direction.East);
  });

  it("defaults to South for zero delta", () => {
    expect(directionFromDelta(0, 0)).toBe(Direction.South);
  });
});

describe("entryEdge", () => {
  it("walking south enters from north edge of destination", () => {
    expect(entryEdge(Direction.South)).toBe(Edge.N);
  });

  it("walking north enters from south edge of destination", () => {
    expect(entryEdge(Direction.North)).toBe(Edge.S);
  });

  it("walking east enters from west edge of destination", () => {
    expect(entryEdge(Direction.East)).toBe(Edge.W);
  });

  it("walking west enters from east edge of destination", () => {
    expect(entryEdge(Direction.West)).toBe(Edge.E);
  });
});
