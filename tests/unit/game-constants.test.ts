import { describe, it, expect, beforeEach } from "vitest";
import * as rng from "@/lib/rng";
import {
  getTaxBirthMultiplier,
  alterNumber,
  generatePlanetName,
  PLANET_CONFIG,
  PLANET_TYPES,
  POP,
  ECON,
  START,
  UNIT_COST,
} from "@/lib/game-constants";

describe("game-constants", () => {
  beforeEach(() => {
    rng.setSeed(42);
  });

  describe("getTaxBirthMultiplier", () => {
    it("returns 0.25 for low tax rates (0-50)", () => {
      expect(getTaxBirthMultiplier(0)).toBe(0.25);
      expect(getTaxBirthMultiplier(30)).toBe(0.25);
      expect(getTaxBirthMultiplier(50)).toBe(0.25);
    });

    it("scales up with higher tax rates", () => {
      expect(getTaxBirthMultiplier(51)).toBe(0.5);
      expect(getTaxBirthMultiplier(61)).toBe(1.0);
      expect(getTaxBirthMultiplier(71)).toBe(1.5);
      expect(getTaxBirthMultiplier(81)).toBe(2.0);
      expect(getTaxBirthMultiplier(91)).toBe(3.5);
      expect(getTaxBirthMultiplier(101)).toBe(4.0);
    });

    it("is monotonically non-decreasing", () => {
      let prev = getTaxBirthMultiplier(0);
      for (let tax = 1; tax <= 150; tax++) {
        const cur = getTaxBirthMultiplier(tax);
        expect(cur).toBeGreaterThanOrEqual(prev);
        prev = cur;
      }
    });
  });

  describe("alterNumber", () => {
    it("returns the value itself when variance is 0", () => {
      expect(alterNumber(100, 0)).toBe(100);
    });

    it("stays within expected bounds", () => {
      for (let i = 0; i < 100; i++) {
        const result = alterNumber(1000, 10);
        expect(result).toBeGreaterThanOrEqual(900);
        expect(result).toBeLessThanOrEqual(1100);
      }
    });

    it("is deterministic with seed", () => {
      rng.setSeed(7);
      const a = alterNumber(500, 20);
      rng.setSeed(7);
      const b = alterNumber(500, 20);
      expect(a).toBe(b);
    });
  });

  describe("generatePlanetName", () => {
    it("returns a non-empty string", () => {
      const name = generatePlanetName();
      expect(name.length).toBeGreaterThan(0);
    });

    it("produces deterministic names with same seed", () => {
      rng.setSeed(1);
      const name1 = generatePlanetName();
      rng.setSeed(1);
      const name2 = generatePlanetName();
      expect(name1).toBe(name2);
    });

    it("produces different names with different seeds", () => {
      const names = new Set<string>();
      for (let s = 0; s < 20; s++) {
        rng.setSeed(s);
        names.add(generatePlanetName());
      }
      expect(names.size).toBeGreaterThan(1);
    });
  });

  describe("PLANET_CONFIG", () => {
    it("has entries for all planet types", () => {
      for (const type of PLANET_TYPES) {
        expect(PLANET_CONFIG[type]).toBeDefined();
        expect(PLANET_CONFIG[type].label).toBeTruthy();
        expect(PLANET_CONFIG[type].baseCost).toBeGreaterThan(0);
      }
    });

    it("RESEARCH labs are priced to encourage tech play vs other premium types", () => {
      expect(PLANET_CONFIG.RESEARCH.baseCost).toBe(25000);
      expect(PLANET_CONFIG.RESEARCH.baseCost).toBeLessThanOrEqual(PLANET_CONFIG.SUPPLY.baseCost * 1.5);
    });
  });

  describe("START", () => {
    it("has reasonable starting values", () => {
      expect(START.CREDITS).toBeGreaterThan(0);
      expect(START.FOOD).toBeGreaterThan(0);
      expect(START.POPULATION).toBeGreaterThan(0);
      expect(START.TURNS).toBeGreaterThan(0);
      expect(START.PLANETS.length).toBeGreaterThan(0);
    });
  });

  describe("UNIT_COST", () => {
    it("has positive costs for all unit types", () => {
      for (const [key, cost] of Object.entries(UNIT_COST)) {
        expect(cost).toBeGreaterThan(0);
      }
    });
  });

  describe("constants integrity", () => {
    it("POP.FOOD_PER_PERSON is a small fraction", () => {
      expect(POP.FOOD_PER_PERSON).toBeGreaterThan(0);
      expect(POP.FOOD_PER_PERSON).toBeLessThan(1);
    });

    it("ECON prices are positive", () => {
      expect(ECON.BASE_FOOD_PRICE).toBeGreaterThan(0);
      expect(ECON.BASE_ORE_PRICE).toBeGreaterThan(0);
      expect(ECON.BASE_PETRO_PRICE).toBeGreaterThan(0);
    });
  });
});
