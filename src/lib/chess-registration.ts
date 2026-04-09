/**
 * Chess — game registration side-effect module.
 *
 * Import this once at app startup (via game-bootstrap.ts) to register
 * the chess game with the engine.
 */

import { registerGame } from "@dge/engine/registry";
import { chessGameDefinition } from "@dge/chess";
import { chessHttpAdapter } from "@/lib/chess-http-adapter";
import type { GameMetadata } from "@dge/shared";

const chessMetadata: GameMetadata = {
  game: "chess",
  displayName: "Chess",
  description: "Classic chess against an MCTS AI opponent.",
  playerRange: [2, 2],
  supportsJoin: false,
  autoCreateAI: true,
  createOptions: [],
};

registerGame("chess", {
  definition: chessGameDefinition,
  metadata: chessMetadata,
  adapter: chessHttpAdapter,
  hooks: {
    turnOrder: {
      async runTick() {}, // Chess has no tick
      async processEndTurn(playerId: string) {
        // Chess doesn't use end_turn — moves are the only action
        // This is called by auto-skip on timeout; treat as a loss
        const { getDb } = await import("@dge/engine/db-context");
        const player = await getDb().player.findUnique({
          where: { id: playerId },
          select: { gameSessionId: true },
        });
        if (!player?.gameSessionId) return;

        const session = await getDb().gameSession.findUnique({
          where: { id: player.gameSessionId },
          select: { log: true },
        });
        if (!session?.log) return;

        const { resign } = await import("@dge/chess");
        const state = session.log as unknown as import("@dge/chess").ChessState;
        if (state.status !== "playing") return;

        const resigned = resign(state);
        await getDb().gameSession.update({
          where: { id: player.gameSessionId },
          data: {
            log: JSON.parse(JSON.stringify(resigned)),
            status: "complete",
          },
        });
      },
      // No getActivePlayers hook — default (all players) is correct for chess.
      // Chess doesn't eliminate players mid-session; the game ends when
      // status changes to checkmate/stalemate/draw/resigned.
    },
  },
});
