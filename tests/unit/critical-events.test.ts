import { describe, it, expect } from "vitest";
import { classifyTurnEvents, CRITICAL_EVENT_PATTERNS } from "@/lib/critical-events";

describe("classifyTurnEvents", () => {
  it("flags fuel and food crises as critical", () => {
    const { critical, warnings, info } = classifyTurnEvents([
      "FUEL DEFICIT: units disbanded",
      "STARVATION reported in sector 3",
      "Minor tax adjustment",
    ]);
    expect(critical.length).toBe(2);
    expect(warnings).toContain("Minor tax adjustment");
    expect(info.length).toBe(0);
  });

  it("classifies random production lines as info", () => {
    const { info } = classifyTurnEvents(["RANDOM EVENT: solar flare", "Research planets produced 5 fighters."]);
    expect(info.length).toBe(2);
  });

  it("has at least one pattern per critical category doc", () => {
    expect(CRITICAL_EVENT_PATTERNS.length).toBe(9);
  });

  it("treats defender ALERT lines as critical", () => {
    const { critical } = classifyTurnEvents(["ALERT: Invasion by X: your forces repelled the attack."]);
    expect(critical.length).toBe(1);
  });
});
