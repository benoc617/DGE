import { prisma } from "./prisma";
import { AI_PERSONAS } from "./gemini";
import { AI_CONFIGS, type AIPersonaKey } from "./ai-builtin-config";
import { generatePlanetName, START } from "./game-constants";
import * as rng from "./rng";
import type { PlanetType } from "@prisma/client";

export type { AIPersonaKey };

/**
 * Create AI players in a session (same starting state as POST /api/ai/setup).
 * Skips names that already exist in the session.
 */
export async function createAIPlayersForSession(
  gameSessionId: string,
  requestedNames?: string[],
): Promise<{ created: string[] }> {
  const configs = requestedNames?.length
    ? AI_CONFIGS.filter((c) => requestedNames.includes(c.name))
    : AI_CONFIGS;

  const created: string[] = [];

  let nextTurnOrder = 1;
  const maxOrder = await prisma.player.aggregate({
    _max: { turnOrder: true },
    where: { gameSessionId },
  });
  nextTurnOrder = (maxOrder._max.turnOrder ?? 0) + 1;

  for (const cfg of configs) {
    const existing = await prisma.player.findFirst({
      where: { name: cfg.name, gameSessionId },
    });
    if (existing) {
      created.push(`${cfg.name} (already exists)`);
      continue;
    }

    const planetCreateData = START.PLANETS.flatMap((spec) =>
      Array.from({ length: spec.count }, () => ({
        name: generatePlanetName(),
        sector: rng.randomInt(1, 100),
        type: spec.type as PlanetType,
        longTermProduction: 100,
        shortTermProduction: 100,
      })),
    );

    await prisma.player.create({
      data: {
        name: cfg.name,
        isAI: true,
        aiPersona: AI_PERSONAS[cfg.persona],
        turnOrder: nextTurnOrder++,
        gameSessionId,
        empire: {
          create: {
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
          },
        },
      },
    });

    await prisma.gameSession.update({
      where: { id: gameSessionId },
      data: { playerNames: { push: cfg.name } },
    });

    created.push(cfg.name);
  }

  const marketCount = await prisma.market.count();
  if (marketCount === 0) await prisma.market.create({ data: {} });

  return { created };
}

export { AI_CONFIGS } from "./ai-builtin-config";
