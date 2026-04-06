import { describe, it, expect } from "vitest";

describe("runEndgameSettlementTick export", () => {
  it("is exported from game-engine as a function", async () => {
    const g = await import("@/lib/game-engine");
    expect(typeof g.runEndgameSettlementTick).toBe("function");
  });
});
