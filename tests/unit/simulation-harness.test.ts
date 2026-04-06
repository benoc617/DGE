import { describe, it, expect } from "vitest";
import { phaseTurnForStrategy } from "@/lib/simulation-harness";

describe("simulation-harness", () => {
  it("phaseTurnForStrategy is 0 before first action, then increments with actions taken", () => {
    expect(phaseTurnForStrategy(100, 100)).toBe(0);
    expect(phaseTurnForStrategy(100, 99)).toBe(1);
    expect(phaseTurnForStrategy(100, 1)).toBe(99);
  });
});
