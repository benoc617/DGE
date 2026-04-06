import { describe, it, expect, vi, beforeEach } from "vitest";

const { processAction } = vi.hoisted(() => ({
  processAction: vi.fn(),
}));

vi.mock("@/lib/game-engine", () => ({
  processAction,
}));

import { processAiMoveOrSkip } from "@/lib/ai-process-move";

describe("processAiMoveOrSkip", () => {
  beforeEach(() => {
    processAction.mockReset();
  });

  it("returns on first call when the AI action succeeds", async () => {
    processAction.mockResolvedValueOnce({ success: true, message: "Built 5 soldiers." });

    const out = await processAiMoveOrSkip("p1", "buy_soldiers", { amount: 5 }, { llmSource: "gemini" });

    expect(out.skipped).toBe(false);
    expect(out.finalResult.success).toBe(true);
    expect(out.finalResult.message).toBe("Built 5 soldiers.");
    expect(processAction).toHaveBeenCalledTimes(1);
    expect(processAction).toHaveBeenCalledWith("p1", "buy_soldiers", { amount: 5 }, {
      logMeta: { llmSource: "gemini" },
    });
  });

  it("runs end_turn when the first action fails (invalid / insufficient resources)", async () => {
    processAction
      .mockResolvedValueOnce({ success: false, message: "Need 50000 credits." })
      .mockResolvedValueOnce({ success: true, message: "Turn ended." });

    const out = await processAiMoveOrSkip("p1", "buy_planet", { type: "FOOD" }, { llmSource: "gemini" });

    expect(out.skipped).toBe(true);
    expect(out.invalidMessage).toBe("Need 50000 credits.");
    expect(out.finalResult.success).toBe(true);
    expect(processAction).toHaveBeenCalledTimes(2);
    expect(processAction).toHaveBeenNthCalledWith(
      2,
      "p1",
      "end_turn",
      undefined,
      expect.objectContaining({
        logMeta: expect.objectContaining({
          skippedAfterInvalid: true,
          invalidAction: "buy_planet",
          invalidMessage: "Need 50000 credits.",
        }),
      }),
    );
  });
});
