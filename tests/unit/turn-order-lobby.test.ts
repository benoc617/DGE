import { describe, it, expect } from "vitest";
import { sessionCannotHaveActiveTurn } from "@/lib/turn-order";

describe("sessionCannotHaveActiveTurn (lobby / no timer)", () => {
  it("true when waitingForHuman", () => {
    expect(
      sessionCannotHaveActiveTurn({ waitingForHuman: true, turnStartedAt: null }),
    ).toBe(true);
  });

  it("true when turnStartedAt is null (timer not running)", () => {
    expect(
      sessionCannotHaveActiveTurn({ waitingForHuman: false, turnStartedAt: null }),
    ).toBe(true);
  });

  it("false when game is active with a turn clock", () => {
    expect(
      sessionCannotHaveActiveTurn({ waitingForHuman: false, turnStartedAt: new Date() }),
    ).toBe(false);
  });
});
