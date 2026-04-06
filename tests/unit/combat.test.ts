import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  runGuerrillaAttack,
  runPsionicBomb,
  runPirateRaid,
  runNuclearStrike,
  runChemicalWarfare,
} from "@/lib/combat";
import * as rng from "@/lib/rng";

function baseArmy(over: Record<string, number> = {}) {
  return {
    soldiers: 1000,
    generals: 2,
    fighters: 10,
    defenseStations: 0,
    lightCruisers: 0,
    heavyCruisers: 0,
    carriers: 0,
    covertAgents: 0,
    commandShipStrength: 0,
    effectiveness: 100,
    soldiersLevel: 0,
    fightersLevel: 0,
    stationsLevel: 0,
    lightCruisersLevel: 0,
    heavyCruisersLevel: 0,
    ...over,
  };
}

describe("combat (deterministic with RNG seed)", () => {
  beforeEach(() => rng.setSeed(42));
  afterEach(() => rng.setSeed(null));

  it("runGuerrillaAttack produces stable results for fixed seed", () => {
    const atk = baseArmy({ soldiers: 500 });
    const def = baseArmy({ soldiers: 400 });
    const a = runGuerrillaAttack(atk, def);
    rng.setSeed(42);
    const b = runGuerrillaAttack(atk, def);
    expect(a.damageDealt.soldiers).toBe(b.damageDealt.soldiers);
    expect(a.attackerLosses.soldiers).toBe(b.attackerLosses.soldiers);
  });

  it("runPsionicBomb returns civil and effectiveness deltas", () => {
    rng.setSeed(99);
    const r = runPsionicBomb();
    expect(r.civilStatusIncrease).toBeGreaterThanOrEqual(2);
    expect(r.effectivenessLoss).toBeGreaterThan(0);
  });

  it("runPirateRaid returns structured pirate result", () => {
    rng.setSeed(7);
    const atk = baseArmy({ soldiers: 200, fighters: 50 });
    const r = runPirateRaid(atk, 5);
    expect(typeof r.victory).toBe("boolean");
    expect(r.messages.length).toBeGreaterThan(0);
  });

  it("runNuclearStrike returns planetCasualties aligned with planetsRadiated and messages", () => {
    rng.setSeed(1);
    const planets = [
      { id: "a", name: "Prime", population: 1_000_000 },
      { id: "b", name: "Secundus", population: 500_000 },
    ];
    const r = runNuclearStrike(planets, 2);
    expect(r.planetsRadiated.length).toBe(2);
    expect(r.planetCasualties.length).toBe(2);
    expect(r.planetCasualties[0].planetName).toBe("Prime");
    expect(r.planetCasualties[0].populationKilled).toBeGreaterThan(0);
    expect(r.populationKilled).toBe(r.planetCasualties[0].populationKilled + r.planetCasualties[1].populationKilled);
  });

  it("runChemicalWarfare returns planetCasualties for affected planets", () => {
    rng.setSeed(2);
    const planets = [
      { id: "x", name: "Chem I", population: 100_000 },
      { id: "y", name: "Chem II", population: 80_000 },
    ];
    const r = runChemicalWarfare(planets);
    expect(r.planetsAffected.length).toBeGreaterThan(0);
    expect(r.planetCasualties.length).toBe(r.planetsAffected.length);
    expect(r.planetCasualties.every((p) => p.populationKilled > 0)).toBe(true);
  });
});
