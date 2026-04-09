import { describe, it, expect } from "vitest";
import { createInitialState, getLegalMoves, applyMove, stringToMove, cloneState } from "@dge/chess";
import { chessSearchFunctions } from "@dge/chess";
import { mctsSearch } from "@dge/engine/search";

describe("Chess MCTS search functions", () => {
  it("applyTick returns state unchanged", () => {
    const state = createInitialState("w", "b");
    const result = chessSearchFunctions.applyTick(state, 0, Math.random, 2);
    expect(result).toBe(state);
  });

  it("applyAction handles a legal move", () => {
    const state = createInitialState("w", "b");
    const { state: after, success } = chessSearchFunctions.applyAction(
      state, 0, "move", { move: "e2e4" }, Math.random,
    );
    expect(success).toBe(true);
    expect(after.board[3][4]?.type).toBe("P");
    expect(after.turn).toBe("black");
  });

  it("applyAction rejects an illegal move", () => {
    const state = createInitialState("w", "b");
    const { success } = chessSearchFunctions.applyAction(
      state, 0, "move", { move: "e2e5" }, Math.random,
    );
    expect(success).toBe(false);
  });

  it("evalState returns higher score for material advantage", () => {
    let state = createInitialState("w", "b");
    const move = stringToMove("e2e4");
    const legal = getLegalMoves(state);
    const m = legal.find(
      (l) => l.from[0] === move.from[0] && l.from[1] === move.from[1] &&
             l.to[0] === move.to[0] && l.to[1] === move.to[1],
    );
    state = applyMove(state, m!);
    // Move d7d5, then exd5 — white captures a pawn
    const m2 = stringToMove("d7d5");
    const legal2 = getLegalMoves(state);
    const match2 = legal2.find(
      (l) => l.from[0] === m2.from[0] && l.from[1] === m2.from[1] &&
             l.to[0] === m2.to[0] && l.to[1] === m2.to[1],
    );
    state = applyMove(state, match2!);
    const cap = stringToMove("e4d5");
    const legal3 = getLegalMoves(state);
    const match3 = legal3.find(
      (l) => l.from[0] === cap.from[0] && l.from[1] === cap.from[1] &&
             l.to[0] === cap.to[0] && l.to[1] === cap.to[1],
    );
    state = applyMove(state, match3!);

    const whiteScore = chessSearchFunctions.evalState(state, 0);
    const blackScore = chessSearchFunctions.evalState(state, 1);
    expect(whiteScore).toBeGreaterThan(0);
    expect(blackScore).toBeLessThan(0);
  });

  it("generateCandidateMoves returns all legal moves", () => {
    const state = createInitialState("w", "b");
    const moves = chessSearchFunctions.generateCandidateMoves(state, 0, 100);
    expect(moves.length).toBe(20);
  });

  it("isTerminal detects game over", () => {
    const state = createInitialState("w", "b");
    expect(chessSearchFunctions.isTerminal(state, 0)).toBe(false);
    state.status = "checkmate";
    expect(chessSearchFunctions.isTerminal(state, 0)).toBe(true);
  });

  it("getPlayerCount returns 2", () => {
    const state = createInitialState("w", "b");
    expect(chessSearchFunctions.getPlayerCount(state)).toBe(2);
  });

  it("cloneState creates independent copy", () => {
    const state = createInitialState("w", "b");
    const copy = chessSearchFunctions.cloneState(state);
    copy.board[0][0] = null;
    expect(state.board[0][0]).not.toBeNull();
  });
});

describe("Chess MCTS integration", () => {
  it("returns a valid move from the initial position", () => {
    const state = createInitialState("w", "b");
    const move = mctsSearch(chessSearchFunctions, cloneState(state), 0, {
      iterations: 100,
      rolloutDepth: 10,
      explorationC: Math.SQRT2,
      branchFactor: 20,
    });
    expect(move).toBeDefined();
    expect(move!.action).toBe("move");
    const moveStr = move!.params.move as string;
    expect(moveStr.length).toBeGreaterThanOrEqual(4);

    // Verify the returned move is legal
    const legal = getLegalMoves(state);
    const parsed = stringToMove(moveStr);
    const match = legal.find(
      (m) => m.from[0] === parsed.from[0] && m.from[1] === parsed.from[1] &&
             m.to[0] === parsed.to[0] && m.to[1] === parsed.to[1],
    );
    expect(match).toBeDefined();
  });

  it("finds a winning move when mate in 1 is available", () => {
    // Ra1-a8# position: white Kg6, Ra1. Black Kh8 (only piece).
    // After Ra8+: rank 8 blocked, king can only try h7 but Kg6 controls h7. Checkmate.
    const state = createInitialState("w", "b");
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) state.board[r][f] = null;

    state.board[5][6] = { type: "K", color: "white" }; // Kg6 (rank 5, file 6)
    state.board[0][0] = { type: "R", color: "white" }; // Ra1 (rank 0, file 0)
    state.board[7][7] = { type: "K", color: "black" }; // Kh8 (rank 7, file 7)
    state.castling = { whiteKingside: false, whiteQueenside: false, blackKingside: false, blackQueenside: false };
    state.enPassant = null;
    state.positionHistory = [];

    const move = mctsSearch(chessSearchFunctions, cloneState(state), 0, {
      iterations: 1000,
      rolloutDepth: 5,
      explorationC: Math.SQRT2,
      branchFactor: 30,
    });

    expect(move).toBeDefined();
    const moveStr = move!.params.move as string;
    expect(moveStr).toBe("a1a8");
  }, 10000);
});
