import { describe, it, expect } from "vitest";
import {
  canPlayerAct,
  isStuckDoorTurnAfterSkipEndLog,
  isSessionRoundTimedOut,
} from "@/lib/door-game-turns";
import { hashSessionIdToBigInt } from "@/lib/db-context";

describe("canPlayerAct", () => {
  it("is true when turns remain and daily full turns not exhausted", () => {
    expect(canPlayerAct({ turnsLeft: 10, fullTurnsUsedThisRound: 0 }, 5)).toBe(true);
    expect(canPlayerAct({ turnsLeft: 10, fullTurnsUsedThisRound: 4 }, 5)).toBe(true);
  });

  it("is false when no game turns left", () => {
    expect(canPlayerAct({ turnsLeft: 0, fullTurnsUsedThisRound: 0 }, 5)).toBe(false);
  });

  it("is false when daily full turns are exhausted", () => {
    expect(canPlayerAct({ turnsLeft: 10, fullTurnsUsedThisRound: 5 }, 5)).toBe(false);
  });
});

describe("isStuckDoorTurnAfterSkipEndLog", () => {
  it("is true when turn is open but last log was end_turn (orphan skip)", () => {
    expect(isStuckDoorTurnAfterSkipEndLog(true, "end_turn")).toBe(true);
  });

  it("is false when turn closed or last action was not end_turn", () => {
    expect(isStuckDoorTurnAfterSkipEndLog(false, "end_turn")).toBe(false);
    expect(isStuckDoorTurnAfterSkipEndLog(true, "buy_planet")).toBe(false);
    expect(isStuckDoorTurnAfterSkipEndLog(true, undefined)).toBe(false);
  });
});

describe("isSessionRoundTimedOut", () => {
  it("is false when roundStartedAt is null", () => {
    expect(isSessionRoundTimedOut(null, 86400, 1_000_000)).toBe(false);
  });

  it("is false before roundStartedAt + turnTimeoutSecs", () => {
    const t0 = new Date("2026-01-01T12:00:00.000Z");
    expect(isSessionRoundTimedOut(t0, 3600, t0.getTime() + 3599_000)).toBe(false);
  });

  it("is true at or after roundStartedAt + turnTimeoutSecs", () => {
    const t0 = new Date("2026-01-01T12:00:00.000Z");
    expect(isSessionRoundTimedOut(t0, 3600, t0.getTime() + 3600_000)).toBe(true);
    expect(isSessionRoundTimedOut(t0, 3600, t0.getTime() + 7200_000)).toBe(true);
  });
});

describe("hashSessionIdToBigInt", () => {
  it("is deterministic and fits signed 64-bit range", () => {
    const a = hashSessionIdToBigInt("session-abc");
    const b = hashSessionIdToBigInt("session-abc");
    expect(a).toBe(b);
    expect(a < BigInt(2) ** BigInt(63)).toBe(true);
  });
});
