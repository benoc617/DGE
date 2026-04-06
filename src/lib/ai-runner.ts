import { prisma } from "@/lib/prisma";
import { getAIMove, AI_PERSONAS, type AIMoveContext } from "@/lib/gemini";
import { processAction, runAndPersistTick, type ActionType } from "@/lib/game-engine";
import { processAiMoveOrSkip } from "@/lib/ai-process-move";
import { getCurrentTurn, advanceTurn } from "@/lib/turn-order";

/**
 * Run a single AI player's turn: get their decision and execute it.
 */
async function runOneAI(playerId: string, playerName: string, persona: string | null) {
  // Phase 1: run tick so AI sees post-tick state
  await runAndPersistTick(playerId);

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      empire: { include: { planets: true, army: true, supplyRates: true, research: true } },
    },
  });

  if (!player?.empire || player.empire.turnsLeft < 1) {
    return { name: playerName, action: "skip", success: false, message: "No turns left" };
  }

  const gameSessionId = player.gameSessionId;
  const rivals = gameSessionId
    ? await prisma.player.findMany({
        where: { gameSessionId, id: { not: playerId } },
        select: { name: true, isAI: true },
      })
    : [];

  const ctx: AIMoveContext = {
    commanderName: playerName,
    rivalNames: rivals.map((r) => r.name),
  };

  const recentEvents = gameSessionId
    ? await prisma.gameEvent.findMany({
        where: { gameSessionId },
        orderBy: { createdAt: "desc" },
        take: 16,
      })
    : [];

  const eventStrings = recentEvents
    .reverse()
    .map((ev) => `[${ev.type}] ${ev.message}`);

  try {
    const e = player.empire;
    const move = await getAIMove(
      persona ?? AI_PERSONAS.economist,
      {
        credits: e.credits,
        food: e.food,
        ore: e.ore,
        fuel: e.fuel,
        population: e.population,
        taxRate: e.taxRate,
        civilStatus: e.civilStatus,
        turnsPlayed: e.turnsPlayed,
        turnsLeft: e.turnsLeft,
        netWorth: e.netWorth,
        isProtected: e.isProtected,
        protectionTurns: e.protectionTurns,
        foodSellRate: e.foodSellRate,
        oreSellRate: e.oreSellRate,
        petroleumSellRate: e.petroleumSellRate,
        planets: e.planets.map((p) => ({
          type: p.type,
          shortTermProduction: p.shortTermProduction,
        })),
        army: e.army ? {
          soldiers: e.army.soldiers,
          generals: e.army.generals,
          fighters: e.army.fighters,
          defenseStations: e.army.defenseStations,
          lightCruisers: e.army.lightCruisers,
          heavyCruisers: e.army.heavyCruisers,
          carriers: e.army.carriers,
          covertAgents: e.army.covertAgents,
          commandShipStrength: e.army.commandShipStrength,
          effectiveness: e.army.effectiveness,
          covertPoints: e.army.covertPoints,
        } : undefined,
        research: e.research ? {
          accumulatedPoints: e.research.accumulatedPoints,
          unlockedTechIds: e.research.unlockedTechIds,
        } : undefined,
      },
      eventStrings,
      ctx,
    );

    const llmSource = move.llmSource;

    const params: Record<string, unknown> = {};
    if (move.target) params.target = move.target;
    if (move.amount) params.amount = move.amount;
    if (move.type) params.type = move.type;
    if (move.rate !== undefined) params.rate = move.rate;
    if (move.techId) params.techId = move.techId;
    if (move.opType !== undefined) params.opType = move.opType;
    if (move.resource) params.resource = move.resource;
    if (move.foodSellRate !== undefined) params.foodSellRate = move.foodSellRate;
    if (move.oreSellRate !== undefined) params.oreSellRate = move.oreSellRate;
    if (move.petroleumSellRate !== undefined) params.petroleumSellRate = move.petroleumSellRate;
    if (move.name) params.name = move.name;
    if (move.treatyType) params.treatyType = move.treatyType;

    const { finalResult, skipped, invalidMessage } = await processAiMoveOrSkip(
      playerId,
      move.action as ActionType,
      params,
      { llmSource, aiReasoning: move.reasoning },
    );

    const displayMessage =
      finalResult.success && skipped && invalidMessage
        ? `${invalidMessage} — skipped turn.`
        : finalResult.message;

    await prisma.gameEvent.create({
      data: {
        gameSessionId: gameSessionId ?? undefined,
        type: "ai_turn",
        message: `[${llmSource}] ${playerName}: ${displayMessage}`,
        details: {
          llmSource,
          action: skipped ? "end_turn" : move.action,
          attemptedAction: move.action,
          skippedInvalid: skipped,
          reasoning: move.reasoning,
          success: finalResult.success,
        } as object,
      },
    });

    return {
      name: playerName,
      action: skipped ? "end_turn" : move.action,
      success: finalResult.success,
      message: displayMessage,
    };
  } catch {
    const result = await processAction(playerId, "end_turn", undefined, {
      logMeta: { llmSource: "fallback", aiReasoning: "exception fallback" },
    });
    await prisma.gameEvent.create({
      data: {
        gameSessionId: gameSessionId ?? undefined,
        type: "ai_turn",
        message: `[fallback] ${playerName}: ${result.message}`,
        details: { llmSource: "fallback", action: "end_turn", reasoning: "exception fallback", success: result.success } as object,
      },
    });
    return { name: playerName, action: "end_turn (fallback)", success: result.success, message: result.message };
  }
}

/**
 * Starting from the current turn, run all consecutive AI players in sequence.
 * Stops when it reaches a human player (their turn) or wraps fully around.
 * Returns the list of AI actions taken.
 */
export async function runAISequence(gameSessionId: string): Promise<{ name: string; action: string; message: string }[]> {
  const results: { name: string; action: string; message: string }[] = [];
  const maxIterations = 20; // safety cap

  for (let i = 0; i < maxIterations; i++) {
    const turn = await getCurrentTurn(gameSessionId);
    if (!turn) break;

    // Stop if the current player is human — it's their turn now
    if (!turn.isAI) break;

    // Run this AI's turn
    const aiPlayer = await prisma.player.findUnique({
      where: { id: turn.currentPlayerId },
      select: { aiPersona: true },
    });

    const result = await runOneAI(turn.currentPlayerId, turn.currentPlayerName, aiPlayer?.aiPersona ?? null);
    results.push({ name: result.name, action: result.action, message: result.message });

    // Advance to the next player
    await advanceTurn(gameSessionId);
  }

  return results;
}
