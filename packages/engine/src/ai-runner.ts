/**
 * @dge/engine — Generic AI sequential turn runner.
 *
 * Walks through consecutive AI players in a session and runs each one's turn.
 * The game-specific AI logic (how to pick a move, what to log) is injected
 * via AiRunnerHooks so this module has no SRX-specific dependencies.
 */

import type { TurnOrderInfo } from "./turn-order";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Callbacks needed by runAISequence.
 * Pass the SRX shim versions of getCurrentTurn/advanceTurn (which already
 * have the SRX TurnOrderHooks baked in).
 */
export interface AiRunnerHooks {
  /** Returns the current turn info or null when the session has no active turn. */
  getCurrentTurn(sessionId: string): Promise<TurnOrderInfo | null>;
  /** Advance to the next player. Returns new turn info (may be unused). */
  advanceTurn(sessionId: string): Promise<TurnOrderInfo | null>;
  /**
   * Execute one AI player's turn.
   * Returns a summary of what the AI did (action + message).
   */
  runAI(
    playerId: string,
    playerName: string,
  ): Promise<{ action: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Starting from the current turn, run all consecutive AI players in sequence.
 * Stops when a human player's turn is reached (or after the safety cap).
 * Returns the list of AI actions taken.
 */
export async function runAISequence(
  gameSessionId: string,
  hooks: AiRunnerHooks,
): Promise<{ name: string; action: string; message: string }[]> {
  const results: { name: string; action: string; message: string }[] = [];
  const maxIterations = 20; // safety cap

  for (let i = 0; i < maxIterations; i++) {
    const turn = await hooks.getCurrentTurn(gameSessionId);
    if (!turn) break;

    // Stop if the current player is human — it's their turn now
    if (!turn.isAI) break;

    // Run this AI's turn
    const result = await hooks.runAI(turn.currentPlayerId, turn.currentPlayerName);
    results.push({ name: turn.currentPlayerName, action: result.action, message: result.message });

    // Advance to the next player
    await hooks.advanceTurn(gameSessionId);
  }

  return results;
}
