import { describe, it, expect, afterEach } from "vitest";
import { getGeminiRequestTimeoutMs, shouldLogAiTiming } from "@/lib/gemini";

describe("getGeminiRequestTimeoutMs", () => {
  afterEach(() => {
    delete process.env.GEMINI_TIMEOUT_MS;
  });

  it("defaults to 60s when unset", () => {
    expect(getGeminiRequestTimeoutMs()).toBe(60_000);
  });

  it("respects GEMINI_TIMEOUT_MS when valid", () => {
    process.env.GEMINI_TIMEOUT_MS = "45000";
    expect(getGeminiRequestTimeoutMs()).toBe(45_000);
  });

  it("clamps to minimum 1000ms", () => {
    process.env.GEMINI_TIMEOUT_MS = "500";
    expect(getGeminiRequestTimeoutMs()).toBe(1000);
  });

  it("clamps to maximum 300000ms", () => {
    process.env.GEMINI_TIMEOUT_MS = "999999";
    expect(getGeminiRequestTimeoutMs()).toBe(300_000);
  });

  it("falls back to default on invalid", () => {
    process.env.GEMINI_TIMEOUT_MS = "not-a-number";
    expect(getGeminiRequestTimeoutMs()).toBe(60_000);
  });
});

describe("shouldLogAiTiming", () => {
  afterEach(() => {
    delete process.env.SRX_LOG_AI_TIMING;
  });

  it("is false when unset", () => {
    expect(shouldLogAiTiming()).toBe(false);
  });

  it("is true for 1 or true", () => {
    process.env.SRX_LOG_AI_TIMING = "1";
    expect(shouldLogAiTiming()).toBe(true);
    process.env.SRX_LOG_AI_TIMING = "true";
    expect(shouldLogAiTiming()).toBe(true);
  });
});
