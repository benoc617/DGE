/**
 * @dge/engine — GameOrchestrator<TState>
 *
 * The orchestrator is the "full track" complement to GameDefinition.applyAction.
 *
 * Responsibilities:
 *   1. Acquire a per-session advisory lock (withCommitLock).
 *   2. Call definition.loadState to fetch world state from the DB.
 *   3. Optionally apply a tick via definition.applyTick.
 *   4. Call definition.applyAction (synchronous, pure).
 *   5. Call definition.saveState to persist the updated world state.
 *   6. Process side effects declared in ActionResult.sideEffects.
 *   7. Return the ActionResult to the caller.
 *
 * Migration status (Phase 2):
 *   The orchestrator is created but NOT yet wired into the SRX API routes.
 *   API routes still call game-engine.processAction directly. The orchestrator
 *   will take over incrementally as action handlers are extracted into
 *   GameDefinition.applyAction in Phase 3+.
 *
 * RNG:
 *   The orchestrator creates a fresh non-deterministic Rng for each action.
 *   Pass an explicit `rng` option for reproducible tests.
 */

import type { GameDefinition, ActionResult, TickResult, Rng, Move } from "@dge/shared";
import { withCommitLock } from "./db-context";

// ---------------------------------------------------------------------------
// Minimal Rng implementation for the orchestrator
// (games provide their own for simulation / MCTS; this is for live paths)
// ---------------------------------------------------------------------------

function makeProductionRng(): Rng {
  return {
    random: Math.random,
    randomInt(min: number, max: number): number {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    chance(p: number): boolean {
      return Math.random() < p;
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

// ---------------------------------------------------------------------------
// Orchestrator options
// ---------------------------------------------------------------------------

export interface OrchestratorActionOptions {
  /** Override the RNG (useful for deterministic testing). */
  rng?: Rng;
  /**
   * When true, the tick is NOT applied before the action.
   * Use this when the caller has already run the tick (e.g. the door-game
   * path that pre-runs the tick before opening the action window).
   */
  skipTick?: boolean;
}

export interface OrchestratorTickOptions {
  rng?: Rng;
}

// ---------------------------------------------------------------------------
// GameOrchestrator
// ---------------------------------------------------------------------------

/**
 * Coordinates the full action/tick lifecycle for a game session.
 *
 * @param TState  The game's world state type (e.g. SrxWorldState for SRX).
 */
export class GameOrchestrator<TState> {
  constructor(readonly definition: GameDefinition<TState>) {}

  /**
   * Apply a tick (economy pass) for the given player, within a session lock.
   * Returns the TickResult from GameDefinition.applyTick, or null if the
   * game has no tick (e.g. chess).
   */
  async processTick(
    sessionId: string,
    playerId: string,
    opts: OrchestratorTickOptions = {},
  ): Promise<TickResult<TState> | null> {
    if (!this.definition.applyTick) return null;

    const rng = opts.rng ?? makeProductionRng();

    return withCommitLock(sessionId, async () => {
      // Cast is safe: game state types are plain objects, never thenables.
      const state = (await this.definition.loadState(sessionId, playerId, "__tick__", null)) as TState;
      const result = this.definition.applyTick!(state, rng);
      await this.definition.saveState(sessionId, result.state, null);
      return result;
    });
  }

  /**
   * Apply a player action within a session lock.
   *
   * Full track:
   *   withCommitLock → loadState → [applyTick] → applyAction → saveState → [side effects]
   */
  async processAction(
    sessionId: string,
    playerId: string,
    action: string,
    params: unknown,
    opts: OrchestratorActionOptions = {},
  ): Promise<ActionResult<TState>> {
    const rng = opts.rng ?? makeProductionRng();

    return withCommitLock(sessionId, async () => {
      // 1. Load world state
      // Cast is safe: game state types are plain objects, never thenables.
      const state = (await this.definition.loadState(sessionId, playerId, action, null)) as TState;

      // 2. Optionally apply tick first (unless caller pre-ran it)
      let currentState: TState = state;
      if (!opts.skipTick && this.definition.applyTick) {
        const tickResult = this.definition.applyTick(currentState, rng);
        currentState = tickResult.state;
      }

      // 3. Apply the action (pure, synchronous)
      const result = this.definition.applyAction(currentState, playerId, action, params, rng);

      // 4. Persist updated state
      if (result.success && result.state) {
        await this.definition.saveState(sessionId, result.state, null);
      }

      // 5. Process side effects (Phase 3+ will implement this fully)
      if (result.sideEffects?.length) {
        await this._processSideEffects(sessionId, playerId, result.sideEffects);
      }

      return result;
    });
  }

  /**
   * Generate candidate moves for a player (for AI decision-making without
   * running a full search).
   */
  async getCandidateMoves(
    sessionId: string,
    playerId: string,
  ): Promise<Move[]> {
    const state = (await this.definition.loadState(sessionId, playerId, "__candidates__", null)) as TState;
    return this.definition.generateCandidateMoves(state, playerId);
  }

  // ---------------------------------------------------------------------------
  // Side effect processing (stub — Phase 3+ will implement fully)
  // ---------------------------------------------------------------------------

  private async _processSideEffects(
    sessionId: string,
    playerId: string,
    sideEffects: NonNullable<ActionResult<TState>["sideEffects"]>,
  ): Promise<void> {
    // Phase 2 stub: side effects are logged but not persisted.
    // Phase 3+ will process gameEvent, turnLog, defenderAlert side effects.
    for (const effect of sideEffects) {
      void sessionId;
      void playerId;
      void effect;
      // TODO: implement side effect persistence in Phase 3+
    }
  }
}
