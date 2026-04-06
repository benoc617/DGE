import { describe, expect, it } from "vitest";
import { toEmpireUpdateData } from "@/lib/empire-prisma";

describe("toEmpireUpdateData", () => {
  it("maps pendingDefenderAlerts to Prisma { set } for scalar list", () => {
    const u = toEmpireUpdateData({ credits: 100, pendingDefenderAlerts: [] });
    expect(u.credits).toBe(100);
    expect(u.pendingDefenderAlerts).toEqual({ set: [] });
  });

  it("omits pendingDefenderAlerts when undefined", () => {
    const u = toEmpireUpdateData({ credits: 50 });
    expect(u.pendingDefenderAlerts).toBeUndefined();
  });
});
