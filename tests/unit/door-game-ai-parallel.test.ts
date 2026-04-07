import { describe, it, expect, afterEach, vi } from "vitest";
import {
  isDoorAiParallelDecideEnabled,
  getDoorAiDecideBatchMax,
} from "@/lib/door-game-turns";
import { createAsyncSemaphore, parsePositiveInt } from "@/lib/ai-concurrency";

describe("door-game AI parallel decide env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parallel decide disabled when unset", () => {
    vi.stubEnv("DOOR_AI_PARALLEL_DECIDE", undefined);
    expect(isDoorAiParallelDecideEnabled()).toBe(false);
  });

  it("parallel decide enabled for 1 / true / yes", () => {
    vi.stubEnv("DOOR_AI_PARALLEL_DECIDE", "1");
    expect(isDoorAiParallelDecideEnabled()).toBe(true);
    vi.stubEnv("DOOR_AI_PARALLEL_DECIDE", "true");
    expect(isDoorAiParallelDecideEnabled()).toBe(true);
    vi.stubEnv("DOOR_AI_PARALLEL_DECIDE", "yes");
    expect(isDoorAiParallelDecideEnabled()).toBe(true);
  });

  it("batch max defaults to 4 and clamps to 1–128", () => {
    vi.stubEnv("DOOR_AI_DECIDE_BATCH_MAX", undefined);
    expect(getDoorAiDecideBatchMax()).toBe(4);
    vi.stubEnv("DOOR_AI_DECIDE_BATCH_MAX", "2");
    expect(getDoorAiDecideBatchMax()).toBe(2);
    vi.stubEnv("DOOR_AI_DECIDE_BATCH_MAX", "0");
    expect(getDoorAiDecideBatchMax()).toBe(4);
    vi.stubEnv("DOOR_AI_DECIDE_BATCH_MAX", "999");
    expect(getDoorAiDecideBatchMax()).toBe(128);
  });
});

describe("ai-concurrency helpers", () => {
  it("parsePositiveInt", () => {
    expect(parsePositiveInt(undefined, 3)).toBe(3);
    expect(parsePositiveInt("", 3)).toBe(3);
    expect(parsePositiveInt("5", 3)).toBe(5);
    expect(parsePositiveInt("0", 3)).toBe(3);
    expect(parsePositiveInt("-1", 3)).toBe(3);
  });

  it("createAsyncSemaphore limits concurrent async work", async () => {
    const run = createAsyncSemaphore(2);
    let concurrent = 0;
    let maxConcurrent = 0;
    const task = async (id: number) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 20));
      concurrent--;
      return id;
    };
    await Promise.all([run(() => task(1)), run(() => task(2)), run(() => task(3)), run(() => task(4))]);
    expect(maxConcurrent).toBe(2);
  });
});
