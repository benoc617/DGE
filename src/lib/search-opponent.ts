/**
 * SRX adapter for the @dge/engine generic MCTS/MaxN search.
 *
 * Wraps PureEmpireState[] into a single SrxSearchState so the engine search
 * can operate on a unified world state. The rival-propagation pattern
 * (applyAction returns updated rival credits/population/army) is handled
 * entirely inside the adapter functions — the engine never sees it.
 *
 * Public API is identical to the previous implementation so all callers
 * (gemini.ts, simulation.ts) remain unchanged.
 */

import {
  type PureEmpireState,
  type RivalView,
  type CandidateMove,
  applyTick as srxApplyTick,
  applyAction as srxApplyAction,
  generateCandidateMoves as srxGenerateCandidateMoves,
  evalState as srxEvalState,
  makeRng,
  cloneEmpire,
  pickRolloutMove as srxPickRolloutMove,
} from "./sim-state";
import {
  mctsSearch as engineMctsSearch,
  mctsSearchAsync as engineMctsSearchAsync,
  maxNMove as engineMaxNMove,
  type SearchGameFunctions,
  type MCTSConfig,
  type MaxNConfig,
  type SearchOpponentConfig,
} from "@dge/engine/search";
import type { Move } from "@dge/shared";

// Re-export config types so callers that import from this module still work.
export type { MCTSConfig, MaxNConfig, SearchOpponentConfig, SearchStrategy } from "@dge/engine/search";
export { DEFAULT_MCTS_CONFIG, DEFAULT_MAXN_CONFIG } from "@dge/engine/search";

// ---------------------------------------------------------------------------
// SrxSearchState — single world state wrapping the per-player empire array
// ---------------------------------------------------------------------------

/**
 * Single world state for the SRX MCTS search.
 * Wraps PureEmpireState[] so the generic engine sees one TState object.
 */
interface SrxSearchState {
  empires: PureEmpireState[];
}

// ---------------------------------------------------------------------------
// SRX SearchGameFunctions adapter
// ---------------------------------------------------------------------------

function makeRivalViews(empires: PureEmpireState[], exceptIdx: number): RivalView[] {
  return empires
    .filter((_, i) => i !== exceptIdx)
    .map((x) => ({
      id: x.id,
      name: x.name,
      netWorth: x.netWorth,
      isProtected: x.isProtected,
      credits: x.credits,
      population: x.population,
      planets: x.planets,
      army: x.army,
    }));
}

const srxSearchFunctions: SearchGameFunctions<SrxSearchState> = {
  applyTick(state, playerIdx, rng, playerCount) {
    const empires = state.empires.map((e, i) =>
      i === playerIdx ? srxApplyTick(e, rng, playerCount, true) : e,
    );
    return { empires };
  },

  applyAction(state, playerIdx, action, params, rng) {
    const rivals = makeRivalViews(state.empires, playerIdx);
    const result = srxApplyAction(
      state.empires[playerIdx],
      action as Parameters<typeof srxApplyAction>[1],
      params,
      rivals,
      rng,
    );

    // Merge rival state changes back into the world state.
    const empires = state.empires.map((e, i) => {
      if (i === playerIdx) return result.state;
      const updated = result.rivals.find((r) => r.id === e.id);
      if (!updated) return e;
      return {
        ...e,
        credits: updated.credits,
        population: updated.population,
        army: { ...updated.army },
      };
    });

    return { state: { empires }, success: result.success };
  },

  evalState(state, playerIdx) {
    return srxEvalState(state.empires[playerIdx], state.empires);
  },

  generateCandidateMoves(state, playerIdx, maxMoves) {
    const rivals = makeRivalViews(state.empires, playerIdx);
    return srxGenerateCandidateMoves(state.empires[playerIdx], rivals, maxMoves) as Move[];
  },

  cloneState(state) {
    return { empires: state.empires.map(cloneEmpire) };
  },

  pickRolloutMove(state, playerIdx, candidates, rng) {
    return srxPickRolloutMove(state.empires[playerIdx], candidates as CandidateMove[], rng) as Move;
  },

  getPlayerCount(state) {
    return state.empires.length;
  },

  isTerminal(state, playerIdx) {
    return state.empires[playerIdx].turnsLeft <= 0;
  },
};

// ---------------------------------------------------------------------------
// Public API — identical signatures to the old search-opponent.ts
// ---------------------------------------------------------------------------

/**
 * Run N-player MCTS and return the best move for `playerIdx`.
 */
export function mctsSearch(
  states: PureEmpireState[],
  playerIdx: number,
  config: Partial<MCTSConfig> = {},
): CandidateMove {
  const state: SrxSearchState = { empires: states };
  const move = engineMctsSearch(srxSearchFunctions, state, playerIdx, config);
  return move as CandidateMove;
}

/**
 * Async variant — yields the event loop periodically to avoid starving HTTP
 * requests during long (e.g. 45s) MCTS budgets.
 */
export async function mctsSearchAsync(
  states: PureEmpireState[],
  playerIdx: number,
  config: Partial<MCTSConfig> = {},
): Promise<CandidateMove> {
  const state: SrxSearchState = { empires: states };
  const move = await engineMctsSearchAsync(srxSearchFunctions, state, playerIdx, config);
  return move as CandidateMove;
}

/**
 * Run shallow MaxN and return the best move for `playerIdx`.
 */
export function maxNMove(
  states: PureEmpireState[],
  playerIdx: number,
  config: Partial<MaxNConfig> = {},
): CandidateMove {
  const state: SrxSearchState = { empires: states };
  const move = engineMaxNMove(srxSearchFunctions, state, playerIdx, config);
  return move as CandidateMove;
}

/**
 * Async variant of searchOpponentMove — use from live server paths.
 */
export async function searchOpponentMoveAsync(
  states: PureEmpireState[],
  playerIdx: number,
  cfg: SearchOpponentConfig = { strategy: "mcts" },
): Promise<CandidateMove> {
  if (cfg.strategy === "maxn") return maxNMove(states, playerIdx, cfg.maxn);
  return mctsSearchAsync(states, playerIdx, cfg.mcts);
}

/**
 * Pick a move for `playerIdx` using the specified search strategy.
 */
export function searchOpponentMove(
  states: PureEmpireState[],
  playerIdx: number,
  cfg: SearchOpponentConfig = { strategy: "mcts" },
): CandidateMove {
  if (cfg.strategy === "maxn") return maxNMove(states, playerIdx, cfg.maxn);
  return mctsSearch(states, playerIdx, cfg.mcts);
}

/**
 * Convenience: build a `states` array with self at index 0 and rivals after.
 */
export function buildSearchStates(
  self: PureEmpireState,
  rivals: PureEmpireState[],
): { states: PureEmpireState[]; playerIdx: number } {
  return {
    states: [self, ...rivals],
    playerIdx: 0,
  };
}
