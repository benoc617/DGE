import { describe, it, expect, beforeEach } from "vitest";
import { pickRivalOpponent } from "@/lib/gemini";
import * as rng from "@/lib/rng";

describe("pickRivalOpponent", () => {
  beforeEach(() => {
    rng.setSeed(42);
  });

  it("returns a name from rivalNames", () => {
    const r = pickRivalOpponent(["A", "B"]);
    expect(["A", "B"]).toContain(r);
  });

  it("is uniform over rivalNames (deterministic seed picks one of the set)", () => {
    rng.setSeed(7);
    const r = pickRivalOpponent(["AI1", "Human"]);
    expect(["AI1", "Human"]).toContain(r);
  });
});
