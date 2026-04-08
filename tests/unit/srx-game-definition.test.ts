/**
 * Unit tests for SrxGameDefinition — pure track only (no DB, no async).
 *
 * Tests the applyTick, applyAction, evalState, and generateCandidateMoves
 * methods against the GameDefinition<SrxWorldState> interface contract.
 */

import { describe, it, expect } from "vitest";
import { srxGameDefinition } from "@dge/srx";
import type { SrxWorldState } from "@dge/srx";
import type { PureEmpireState } from "@/lib/sim-state";
import { START, UNIT_COST } from "@/lib/game-constants";
import type { Rng } from "@dge/shared";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEmpire(id: string, name: string, overrides: Partial<PureEmpireState> = {}): PureEmpireState {
  return {
    id,
    name,
    credits: START.CREDITS,
    food: START.FOOD,
    ore: START.ORE,
    fuel: START.FUEL,
    population: START.POPULATION,
    taxRate: START.TAX_RATE,
    civilStatus: 0,
    netWorth: 10,
    turnsLeft: START.TURNS,
    turnsPlayed: 0,
    isProtected: true,
    protectionTurns: START.PROTECTION_TURNS,
    foodSellRate: 0,
    oreSellRate: 50,
    petroleumSellRate: 50,
    planets: [
      { type: "FOOD", shortTermProduction: 100, longTermProduction: 100 },
      { type: "FOOD", shortTermProduction: 100, longTermProduction: 100 },
      { type: "ORE", shortTermProduction: 100, longTermProduction: 100 },
      { type: "ORE", shortTermProduction: 100, longTermProduction: 100 },
      { type: "URBAN", shortTermProduction: 100, longTermProduction: 100 },
      { type: "URBAN", shortTermProduction: 100, longTermProduction: 100 },
      { type: "GOVERNMENT", shortTermProduction: 100, longTermProduction: 100 },
    ],
    army: {
      soldiers: START.SOLDIERS,
      generals: START.GENERALS,
      fighters: START.FIGHTERS,
      defenseStations: 0,
      lightCruisers: 0,
      heavyCruisers: 0,
      carriers: 0,
      covertAgents: 0,
      commandShipStrength: 0,
      effectiveness: 50,
      covertPoints: 0,
      soldiersLevel: 1,
      fightersLevel: 1,
      stationsLevel: 1,
      lightCruisersLevel: 1,
      heavyCruisersLevel: 1,
    },
    research: { accumulatedPoints: 0, unlockedTechIds: [] },
    supplyRates: {
      rateSoldier: 50,
      rateFighter: 50,
      rateStation: 0,
      rateHeavyCruiser: 0,
      rateCarrier: 0,
      rateGeneral: 0,
      rateCovert: 0,
      rateCredits: 0,
    },
    loans: 0,
    ...overrides,
  };
}

function makeWorld(overrides: Partial<SrxWorldState> = {}): SrxWorldState {
  return {
    sessionId: "test-session",
    empires: [
      makeEmpire("empire-1", "Alpha"),
      makeEmpire("empire-2", "Beta"),
    ],
    armyIds: ["army-1", "army-2"],
    playerCount: 2,
    ...overrides,
  };
}

/** Deterministic Rng backed by a simple sequence. */
function seededRng(seed = 42): Rng {
  let s = seed >>> 0;
  const next = () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
  return {
    random: next,
    randomInt(min: number, max: number) { return Math.floor(next() * (max - min + 1)) + min; },
    chance(p: number) { return next() < p; },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

// ---------------------------------------------------------------------------
// applyTick
// ---------------------------------------------------------------------------

describe("SrxGameDefinition.applyTick", () => {
  it("increments turnsPlayed and decrements turnsLeft for all empires", () => {
    const world = makeWorld();
    const result = srxGameDefinition.applyTick!(world, seededRng());
    expect(result.state.empires[0].turnsPlayed).toBe(1);
    expect(result.state.empires[0].turnsLeft).toBe(START.TURNS - 1);
    expect(result.state.empires[1].turnsPlayed).toBe(1);
  });

  it("produces income (credits increase after tick)", () => {
    const world = makeWorld();
    const initial = world.empires[0].credits;
    const result = srxGameDefinition.applyTick!(world, seededRng());
    // After a tick the empire should have earned income (credits change)
    expect(result.state.empires[0].credits).not.toBe(initial);
  });

  it("does not mutate the original world state", () => {
    const world = makeWorld();
    const originalCredits = world.empires[0].credits;
    srxGameDefinition.applyTick!(world, seededRng());
    expect(world.empires[0].credits).toBe(originalCredits);
  });
});

// ---------------------------------------------------------------------------
// applyAction
// ---------------------------------------------------------------------------

describe("SrxGameDefinition.applyAction", () => {
  it("returns success: false when playerId is not in world state", () => {
    const world = makeWorld();
    const result = srxGameDefinition.applyAction(world, "nonexistent-id", "end_turn", {}, seededRng());
    expect(result.success).toBe(false);
  });

  it("end_turn succeeds and returns updated state", () => {
    const world = makeWorld();
    const result = srxGameDefinition.applyAction(world, "empire-1", "end_turn", {}, seededRng());
    expect(result.success).toBe(true);
    expect(result.state).toBeDefined();
  });

  it("set_tax_rate updates the acting player's tax rate", () => {
    const world = makeWorld();
    const result = srxGameDefinition.applyAction(world, "empire-1", "set_tax_rate", { rate: 40 }, seededRng());
    expect(result.success).toBe(true);
    const acting = result.state!.empires.find((e) => e.id === "empire-1")!;
    expect(acting.taxRate).toBe(40);
    // Other player unaffected
    const other = result.state!.empires.find((e) => e.id === "empire-2")!;
    expect(other.taxRate).toBe(START.TAX_RATE);
  });

  it("buy_soldiers deducts credits and adds soldiers", () => {
    const world = makeWorld({
      empires: [
        makeEmpire("empire-1", "Alpha", { credits: 100_000 }),
        makeEmpire("empire-2", "Beta"),
      ],
    });
    const before = world.empires.find((e) => e.id === "empire-1")!;
    const result = srxGameDefinition.applyAction(
      world, "empire-1", "buy_soldiers", { count: 10 }, seededRng(),
    );
    expect(result.success).toBe(true);
    const after = result.state!.empires.find((e) => e.id === "empire-1")!;
    expect(after.army.soldiers).toBe(before.army.soldiers + 10);
    expect(after.credits).toBeLessThan(before.credits);
  });

  it("buy_soldiers fails when insufficient credits", () => {
    const world = makeWorld({
      empires: [
        makeEmpire("empire-1", "Alpha", { credits: 0 }),
        makeEmpire("empire-2", "Beta"),
      ],
    });
    const result = srxGameDefinition.applyAction(
      world, "empire-1", "buy_soldiers", { count: 1000 }, seededRng(),
    );
    expect(result.success).toBe(false);
  });

  it("does not mutate the original world state", () => {
    const world = makeWorld({ empires: [makeEmpire("empire-1", "Alpha", { credits: 100_000 }), makeEmpire("empire-2", "Beta")] });
    const originalCredits = world.empires[0].credits;
    srxGameDefinition.applyAction(world, "empire-1", "buy_soldiers", { count: 5 }, seededRng());
    expect(world.empires[0].credits).toBe(originalCredits);
  });
});

// ---------------------------------------------------------------------------
// evalState
// ---------------------------------------------------------------------------

describe("SrxGameDefinition.evalState", () => {
  it("returns a number in [0, 1] for a starting empire", () => {
    const world = makeWorld();
    const score = srxGameDefinition.evalState(world, "empire-1");
    expect(typeof score).toBe("number");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns 0 for an unknown playerId", () => {
    const world = makeWorld();
    expect(srxGameDefinition.evalState(world, "nonexistent")).toBe(0);
  });

  it("wealthier empire scores higher than poorer one", () => {
    const richWorld = makeWorld({
      empires: [
        makeEmpire("empire-1", "Alpha", { credits: 1_000_000, netWorth: 10_000, population: 1_000_000 }),
        makeEmpire("empire-2", "Beta"),
      ],
    });
    const poorWorld = makeWorld({
      empires: [
        makeEmpire("empire-1", "Alpha", { credits: 0, netWorth: 1, population: 1000 }),
        makeEmpire("empire-2", "Beta", { credits: 1_000_000, netWorth: 10_000, population: 1_000_000 }),
      ],
    });
    const richScore = srxGameDefinition.evalState(richWorld, "empire-1");
    const poorScore = srxGameDefinition.evalState(poorWorld, "empire-1");
    expect(richScore).toBeGreaterThan(poorScore);
  });
});

// ---------------------------------------------------------------------------
// generateCandidateMoves
// ---------------------------------------------------------------------------

describe("SrxGameDefinition.generateCandidateMoves", () => {
  it("returns a non-empty move list for a starting empire", () => {
    const world = makeWorld();
    const moves = srxGameDefinition.generateCandidateMoves(world, "empire-1");
    expect(moves.length).toBeGreaterThan(0);
  });

  it("each move has action, params, and label fields", () => {
    const world = makeWorld();
    const moves = srxGameDefinition.generateCandidateMoves(world, "empire-1");
    for (const m of moves) {
      expect(typeof m.action).toBe("string");
      expect(typeof m.params).toBe("object");
      expect(typeof m.label).toBe("string");
    }
  });

  it("always includes end_turn", () => {
    const world = makeWorld();
    const moves = srxGameDefinition.generateCandidateMoves(world, "empire-1");
    expect(moves.some((m) => m.action === "end_turn")).toBe(true);
  });

  it("returns empty array for unknown playerId", () => {
    const world = makeWorld();
    const moves = srxGameDefinition.generateCandidateMoves(world, "nonexistent");
    expect(moves).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// toPureState
// ---------------------------------------------------------------------------

describe("SrxGameDefinition.toPureState", () => {
  it("returns a deep clone (mutations to the clone don't affect original)", () => {
    const world = makeWorld();
    const pure = srxGameDefinition.toPureState!(world);
    pure.empires[0].credits = 999_999;
    expect(world.empires[0].credits).toBe(START.CREDITS);
  });
});

// ---------------------------------------------------------------------------
// GameDefinition interface compliance
// ---------------------------------------------------------------------------

describe("SrxGameDefinition interface compliance", () => {
  it("implements all required GameDefinition methods", () => {
    expect(typeof srxGameDefinition.loadState).toBe("function");
    expect(typeof srxGameDefinition.saveState).toBe("function");
    expect(typeof srxGameDefinition.applyAction).toBe("function");
    expect(typeof srxGameDefinition.evalState).toBe("function");
    expect(typeof srxGameDefinition.generateCandidateMoves).toBe("function");
    // Optional methods that SRX implements:
    expect(typeof srxGameDefinition.applyTick).toBe("function");
    expect(typeof srxGameDefinition.toPureState).toBe("function");
    expect(typeof srxGameDefinition.projectState).toBe("function");
  });
});
