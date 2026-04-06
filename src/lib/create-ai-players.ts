import { prisma } from "./prisma";
import { AI_PERSONAS } from "./gemini";
import { AI_CONFIGS, type AIPersonaKey } from "./ai-builtin-config";
import { createStarterPlanets, createStarterEmpire } from "./player-init";

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

    await prisma.player.create({
      data: {
        name: cfg.name,
        isAI: true,
        aiPersona: AI_PERSONAS[cfg.persona],
        turnOrder: nextTurnOrder++,
        gameSessionId,
        empire: { create: createStarterEmpire(createStarterPlanets()) },
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
