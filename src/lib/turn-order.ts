/**
 * SRX — turn-order shim.
 *
 * Re-exports engine turn-order functions, injecting SRX-specific hooks
 * (runAndPersistTick, processAction) so that API routes and AI runners call
 * the same signatures as before.
 */

export {
  sessionCannotHaveActiveTurn,
  advanceTurn,
  type TurnOrderInfo,
} from "@dge/engine/turn-order";

import {
  getCurrentTurn as _getCurrentTurn,
} from "@dge/engine/turn-order";

import { processAction, runAndPersistTick } from "@/lib/game-engine";

/**
 * Get the player whose turn it is right now in a session.
 * If the current player has timed out, auto-skip them first.
 */
export async function getCurrentTurn(gameSessionId: string) {
  return _getCurrentTurn(gameSessionId, {
    async runTick(playerId) {
      await runAndPersistTick(playerId);
    },
    async processEndTurn(playerId) {
      await processAction(playerId, "end_turn");
    },
  });
}
