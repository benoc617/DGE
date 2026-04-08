/**
 * SRX world state — the complete game state passed through the DGE engine.
 *
 * Uses PureEmpireState (from sim-state.ts) as the empire representation so
 * the same type serves both the pure MCTS track (applyAction / evalState)
 * and the full DB track (loadState / saveState).
 *
 * PureEmpireState.id == Prisma empire ID, so saveState can identify rows.
 * Army rows are tracked separately in armyIds (parallel to empires[]).
 */
import type { PureEmpireState } from "@/lib/sim-state";

export interface SrxWorldState {
  /** Prisma GameSession.id — used by saveState to scope writes. */
  sessionId: string;

  /**
   * All empire states loaded for this action.
   * Index 0 is always the acting player.
   * Rivals follow at index 1+ (only those relevant to the action are loaded).
   * PureEmpireState.id == Prisma Empire.id for DB writes.
   */
  empires: PureEmpireState[];

  /**
   * Prisma Army IDs — parallel to empires[].
   * Needed by saveState to update army rows (army is a separate table).
   */
  armyIds: string[];

  /**
   * Total number of players in the session.
   * Used by applyTick (player count affects some economy formulas).
   */
  playerCount: number;
}
