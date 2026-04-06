import { describe, expect, it } from "vitest";
import { defenderCovertAlertMessage, type CovertOpResult } from "@/lib/espionage";

function baseResult(over: Partial<CovertOpResult>): CovertOpResult {
  return {
    success: false,
    detected: false,
    agentsLost: 0,
    messages: [],
    effects: {},
    ...over,
  };
}

describe("defenderCovertAlertMessage", () => {
  it("returns null on failed op when not detected", () => {
    expect(defenderCovertAlertMessage("Att", 6, baseResult({ success: false, detected: false }))).toBeNull();
  });

  it("returns alert on failed op when detected", () => {
    const m = defenderCovertAlertMessage("Att", 6, baseResult({ success: false, detected: true }));
    expect(m).toContain("Att");
    expect(m).toContain("detected");
  });

  it("spy success without detection is stealthy", () => {
    expect(
      defenderCovertAlertMessage("Att", 0, baseResult({ success: true, detected: false, effects: {} })),
    ).toBeNull();
  });

  it("spy success with detection notifies defender", () => {
    const m = defenderCovertAlertMessage("Att", 0, baseResult({ success: true, detected: true, effects: {} }));
    expect(m).toContain("spy");
  });

  it("take hostages success notifies with credits", () => {
    const m = defenderCovertAlertMessage("Att", 6, baseResult({ success: true, detected: false, effects: { creditsStolen: 500 } }));
    expect(m).toContain("500");
    expect(m).toContain("ransom");
  });
});
