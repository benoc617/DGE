import { describe, it, expect } from "vitest";
import { normalizeUsername, normalizeEmail, isValidEmail, clampMaxPlayers } from "@/lib/auth";
import { SESSION } from "@/lib/game-constants";

describe("auth helpers", () => {
  it("normalizes username", () => {
    expect(normalizeUsername("  Alice  ")).toBe("alice");
  });

  it("normalizes email", () => {
    expect(normalizeEmail("  Test@EXAMPLE.COM ")).toBe("test@example.com");
  });

  it("validates email", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("clamps max players", () => {
    expect(clampMaxPlayers(undefined)).toBe(SESSION.MAX_PLAYERS_DEFAULT);
    expect(clampMaxPlayers(1)).toBe(SESSION.MIN_PLAYERS);
    expect(clampMaxPlayers(999)).toBe(SESSION.MAX_PLAYERS_CAP);
    expect(clampMaxPlayers(50)).toBe(50);
  });
});
