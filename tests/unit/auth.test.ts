import { describe, it, expect } from "vitest";
import { normalizeUsername, normalizeEmail, isValidEmail, clampMaxPlayers, validatePasswordStrength } from "@/lib/auth";
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

  describe("validatePasswordStrength", () => {
    it("accepts a strong password", () => {
      expect(validatePasswordStrength("MyStr0ng!Pass")).toBeNull();
    });
    it("accepts password with space as special char", () => {
      expect(validatePasswordStrength("My Pass w0rd")).toBeNull();
    });
    it("rejects too short", () => {
      expect(validatePasswordStrength("Ab1!")).toMatch(/at least/);
    });
    it("rejects no lowercase", () => {
      expect(validatePasswordStrength("ABCDEFGH1!")).toMatch(/lowercase/);
    });
    it("rejects no uppercase", () => {
      expect(validatePasswordStrength("abcdefgh1!")).toMatch(/uppercase/);
    });
    it("rejects no digit", () => {
      expect(validatePasswordStrength("Abcdefgh!!")).toMatch(/number/);
    });
    it("rejects no special character", () => {
      expect(validatePasswordStrength("Abcdefgh12")).toMatch(/special/);
    });
    it("respects custom min length", () => {
      expect(validatePasswordStrength("Ab1!cdef", 12)).toMatch(/at least 12/);
      expect(validatePasswordStrength("Ab1!cdefghij", 12)).toBeNull();
    });
  });
});
