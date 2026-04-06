import { describe, expect, it } from "vitest";
import { formatUnitLosses, formatUnitLossesOrNone } from "@/lib/combat-loss-format";

describe("combat-loss-format", () => {
  it("formatUnitLosses lists non-zero entries with labels", () => {
    expect(
      formatUnitLosses({ soldiers: 1200, fighters: 5, generals: 0 }),
    ).toBe("1,200 soldiers, 5 fighters");
  });

  it("formatUnitLosses returns empty string when nothing lost", () => {
    expect(formatUnitLosses({})).toBe("");
    expect(formatUnitLosses({ soldiers: 0 })).toBe("");
  });

  it("formatUnitLossesOrNone uses fallback", () => {
    expect(formatUnitLossesOrNone({}, "none")).toBe("none");
    expect(formatUnitLossesOrNone({ soldiers: 1 }, "none")).toBe("1 soldiers");
  });
});
