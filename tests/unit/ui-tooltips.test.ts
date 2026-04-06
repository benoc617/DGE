import { describe, it, expect } from "vitest";
import { LEADERBOARD, EMPIRE, EMPIRE_UNITS, COMMAND_CENTER, MILITARY_BUY } from "@/lib/ui-tooltips";

describe("ui-tooltips", () => {
  it("exports non-empty tooltip strings for panels", () => {
    expect(LEADERBOARD.panelTitle.length).toBeGreaterThan(20);
    expect(COMMAND_CENTER.panelTitle.length).toBeGreaterThan(20);
    expect(EMPIRE.militaryHeading.length).toBeGreaterThan(10);
  });

  it("covers empire unit abbreviations and military buy keys", () => {
    for (const k of ["Sol", "Gen", "Ftr", "Stn", "LC", "HC", "Car", "Cov"]) {
      expect(EMPIRE_UNITS[k]?.length ?? 0).toBeGreaterThan(30);
    }
    expect(MILITARY_BUY.buy_soldiers).toBe(EMPIRE_UNITS.Sol);
    expect(MILITARY_BUY.buy_command_ship).toBe(EMPIRE.commandShip);
  });
});
