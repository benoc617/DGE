import { processAction, type ActionType, type ProcessActionOptions } from "@/lib/game-engine";

export type AiMoveSkipResult = {
  finalResult: Awaited<ReturnType<typeof processAction>>;
  skipped: boolean;
  invalidMessage?: string;
};

/**
 * Run an AI-chosen action. If validation fails (same as a human's failed attempt),
 * complete the turn with `end_turn` so the slot still produces a TurnLog and advances fairly.
 */
export async function processAiMoveOrSkip(
  playerId: string,
  action: ActionType,
  params: Record<string, unknown>,
  logMeta: ProcessActionOptions["logMeta"],
): Promise<AiMoveSkipResult> {
  const first = await processAction(playerId, action, params, { logMeta });
  if (first.success) {
    return { finalResult: first, skipped: false };
  }
  const second = await processAction(playerId, "end_turn", undefined, {
    logMeta: {
      ...logMeta,
      skippedAfterInvalid: true,
      invalidAction: action,
      invalidMessage: first.message,
    },
  });
  return {
    finalResult: second,
    skipped: true,
    invalidMessage: first.message,
  };
}
