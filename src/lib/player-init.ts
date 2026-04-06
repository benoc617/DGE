import { START, generatePlanetName } from "@/lib/game-constants";
import * as rng from "@/lib/rng";
import type { PlanetType } from "@prisma/client";

/** Build the Prisma create-data array for a new player's starting planets. */
export function createStarterPlanets() {
  return START.PLANETS.flatMap((spec) =>
    Array.from({ length: spec.count }, () => ({
      name: generatePlanetName(),
      sector: rng.randomInt(1, 100),
      type: spec.type as PlanetType,
      longTermProduction: 100,
      shortTermProduction: 100,
    })),
  );
}

/** Build the nested Prisma create-data for a new player's empire, army, supply rates, and research. */
export function createStarterEmpire(planetCreateData: ReturnType<typeof createStarterPlanets>) {
  return {
    credits: START.CREDITS,
    food: START.FOOD,
    ore: START.ORE,
    fuel: START.FUEL,
    population: START.POPULATION,
    taxRate: START.TAX_RATE,
    turnsLeft: START.TURNS,
    protectionTurns: START.PROTECTION_TURNS,
    planets: { create: planetCreateData },
    army: {
      create: {
        soldiers: START.SOLDIERS,
        generals: START.GENERALS,
        fighters: START.FIGHTERS,
      },
    },
    supplyRates: { create: {} },
    research: { create: {} },
  };
}
