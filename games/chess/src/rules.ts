/**
 * Pure chess rules engine. No side effects, no DB — just board logic.
 */

import type {
  Board, Piece, Color, PieceType, ChessMove, CastlingRights, ChessState, GameStatus,
} from "./types";

// ---------------------------------------------------------------------------
// Board helpers
// ---------------------------------------------------------------------------

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let f = 0; f < 8; f++) {
    board[0][f] = { type: backRank[f], color: "white" };
    board[1][f] = { type: "P", color: "white" };
    board[6][f] = { type: "P", color: "black" };
    board[7][f] = { type: backRank[f], color: "black" };
  }
  return board;
}

export function createInitialState(whitePlayerId: string, blackPlayerId: string): ChessState {
  const state: ChessState = {
    board: createInitialBoard(),
    turn: "white",
    castling: { whiteKingside: true, whiteQueenside: true, blackKingside: true, blackQueenside: true },
    enPassant: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    status: "playing",
    winner: null,
    whitePlayerId,
    blackPlayerId,
    moveHistory: [],
    capturedByWhite: [],
    capturedByBlack: [],
    positionHistory: [],
    inCheck: false,
  };
  state.positionHistory.push(boardPositionKey(state));
  return state;
}

export function cloneState(s: ChessState): ChessState {
  return {
    ...s,
    board: s.board.map((r) => r.map((p) => (p ? { ...p } : null))),
    castling: { ...s.castling },
    enPassant: s.enPassant ? [...s.enPassant] as [number, number] : null,
    moveHistory: [...s.moveHistory],
    capturedByWhite: [...s.capturedByWhite],
    capturedByBlack: [...s.capturedByBlack],
    positionHistory: [...s.positionHistory],
  };
}

function inBounds(r: number, f: number): boolean {
  return r >= 0 && r < 8 && f >= 0 && f < 8;
}

function opponent(c: Color): Color {
  return c === "white" ? "black" : "white";
}

// ---------------------------------------------------------------------------
// Position key for repetition detection (board + turn + castling + en-passant)
// ---------------------------------------------------------------------------

export function boardPositionKey(s: ChessState): string {
  const parts: string[] = [];
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.board[r][f];
      if (!p) { empty++; continue; }
      if (empty > 0) { parts.push(String(empty)); empty = 0; }
      const ch = p.color === "white" ? p.type : p.type.toLowerCase();
      parts.push(ch);
    }
    if (empty > 0) parts.push(String(empty));
    parts.push("/");
  }
  parts.push(` ${s.turn[0]} `);
  let castleStr = "";
  if (s.castling.whiteKingside) castleStr += "K";
  if (s.castling.whiteQueenside) castleStr += "Q";
  if (s.castling.blackKingside) castleStr += "k";
  if (s.castling.blackQueenside) castleStr += "q";
  parts.push(castleStr || "-");
  if (s.enPassant) {
    parts.push(` ${String.fromCharCode(97 + s.enPassant[1])}${s.enPassant[0] + 1}`);
  } else {
    parts.push(" -");
  }
  return parts.join("");
}

// ---------------------------------------------------------------------------
// Attack detection (is a square attacked by a given color?)
// ---------------------------------------------------------------------------

function isSquareAttackedBy(board: Board, r: number, f: number, byColor: Color): boolean {
  // Pawn attacks
  const pawnDir = byColor === "white" ? 1 : -1;
  for (const df of [-1, 1]) {
    const pr = r - pawnDir;
    const pf = f + df;
    if (inBounds(pr, pf)) {
      const p = board[pr][pf];
      if (p && p.color === byColor && p.type === "P") return true;
    }
  }

  // Knight attacks
  const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  for (const [dr, df] of knightMoves) {
    const nr = r + dr, nf = f + df;
    if (inBounds(nr, nf)) {
      const p = board[nr][nf];
      if (p && p.color === byColor && p.type === "N") return true;
    }
  }

  // King attacks (adjacent)
  for (let dr = -1; dr <= 1; dr++) {
    for (let df = -1; df <= 1; df++) {
      if (dr === 0 && df === 0) continue;
      const nr = r + dr, nf = f + df;
      if (inBounds(nr, nf)) {
        const p = board[nr][nf];
        if (p && p.color === byColor && p.type === "K") return true;
      }
    }
  }

  // Sliding pieces (rook/queen along ranks/files, bishop/queen along diagonals)
  const directions = [
    { dr: 0, df: 1, types: ["R", "Q"] as PieceType[] },
    { dr: 0, df: -1, types: ["R", "Q"] as PieceType[] },
    { dr: 1, df: 0, types: ["R", "Q"] as PieceType[] },
    { dr: -1, df: 0, types: ["R", "Q"] as PieceType[] },
    { dr: 1, df: 1, types: ["B", "Q"] as PieceType[] },
    { dr: 1, df: -1, types: ["B", "Q"] as PieceType[] },
    { dr: -1, df: 1, types: ["B", "Q"] as PieceType[] },
    { dr: -1, df: -1, types: ["B", "Q"] as PieceType[] },
  ];
  for (const { dr, df, types } of directions) {
    let nr = r + dr, nf = f + df;
    while (inBounds(nr, nf)) {
      const p = board[nr][nf];
      if (p) {
        if (p.color === byColor && types.includes(p.type)) return true;
        break;
      }
      nr += dr;
      nf += df;
    }
  }

  return false;
}

function findKing(board: Board, color: Color): [number, number] {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p && p.type === "K" && p.color === color) return [r, f];
    }
  }
  throw new Error(`No ${color} king found`);
}

export function isInCheck(board: Board, color: Color): boolean {
  const [kr, kf] = findKing(board, color);
  return isSquareAttackedBy(board, kr, kf, opponent(color));
}

// ---------------------------------------------------------------------------
// Move generation (pseudo-legal, then filtered for legality)
// ---------------------------------------------------------------------------

function pseudoLegalMoves(state: ChessState): ChessMove[] {
  const moves: ChessMove[] = [];
  const { board, turn, castling, enPassant } = state;
  const dir = turn === "white" ? 1 : -1;
  const startRank = turn === "white" ? 1 : 6;
  const promoRank = turn === "white" ? 7 : 0;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece || piece.color !== turn) continue;

      if (piece.type === "P") {
        // Forward one
        const r1 = r + dir;
        if (inBounds(r1, f) && !board[r1][f]) {
          if (r1 === promoRank) {
            for (const pt of ["Q", "R", "B", "N"] as PieceType[]) {
              moves.push({ from: [r, f], to: [r1, f], promotion: pt });
            }
          } else {
            moves.push({ from: [r, f], to: [r1, f] });
          }
          // Forward two from starting rank
          const r2 = r + 2 * dir;
          if (r === startRank && inBounds(r2, f) && !board[r2][f]) {
            moves.push({ from: [r, f], to: [r2, f] });
          }
        }
        // Captures (including en passant)
        for (const df of [-1, 1]) {
          const nf = f + df;
          if (!inBounds(r1, nf)) continue;
          const target = board[r1][nf];
          const isEnPassant = enPassant && enPassant[0] === r1 && enPassant[1] === nf;
          if (target && target.color !== turn) {
            if (r1 === promoRank) {
              for (const pt of ["Q", "R", "B", "N"] as PieceType[]) {
                moves.push({ from: [r, f], to: [r1, nf], promotion: pt });
              }
            } else {
              moves.push({ from: [r, f], to: [r1, nf] });
            }
          } else if (isEnPassant) {
            moves.push({ from: [r, f], to: [r1, nf] });
          }
        }
      } else if (piece.type === "N") {
        for (const [dr, df] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
          const nr = r + dr, nf = f + df;
          if (inBounds(nr, nf) && (!board[nr][nf] || board[nr][nf]!.color !== turn)) {
            moves.push({ from: [r, f], to: [nr, nf] });
          }
        }
      } else if (piece.type === "K") {
        for (let dr = -1; dr <= 1; dr++) {
          for (let df = -1; df <= 1; df++) {
            if (dr === 0 && df === 0) continue;
            const nr = r + dr, nf = f + df;
            if (inBounds(nr, nf) && (!board[nr][nf] || board[nr][nf]!.color !== turn)) {
              moves.push({ from: [r, f], to: [nr, nf] });
            }
          }
        }
        // Castling
        const rank = turn === "white" ? 0 : 7;
        if (r === rank && f === 4) {
          const opp = opponent(turn);
          // Kingside
          const ks = turn === "white" ? castling.whiteKingside : castling.blackKingside;
          if (ks && !board[rank][5] && !board[rank][6] && board[rank][7]?.type === "R") {
            if (!isSquareAttackedBy(board, rank, 4, opp) &&
                !isSquareAttackedBy(board, rank, 5, opp) &&
                !isSquareAttackedBy(board, rank, 6, opp)) {
              moves.push({ from: [rank, 4], to: [rank, 6] });
            }
          }
          // Queenside
          const qs = turn === "white" ? castling.whiteQueenside : castling.blackQueenside;
          if (qs && !board[rank][1] && !board[rank][2] && !board[rank][3] && board[rank][0]?.type === "R") {
            if (!isSquareAttackedBy(board, rank, 4, opp) &&
                !isSquareAttackedBy(board, rank, 3, opp) &&
                !isSquareAttackedBy(board, rank, 2, opp)) {
              moves.push({ from: [rank, 4], to: [rank, 2] });
            }
          }
        }
      } else {
        // Sliding pieces: R, B, Q
        const dirs: [number, number][] = [];
        if (piece.type === "R" || piece.type === "Q") {
          dirs.push([0, 1], [0, -1], [1, 0], [-1, 0]);
        }
        if (piece.type === "B" || piece.type === "Q") {
          dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        }
        for (const [dr, df] of dirs) {
          let nr = r + dr, nf = f + df;
          while (inBounds(nr, nf)) {
            const target = board[nr][nf];
            if (!target) {
              moves.push({ from: [r, f], to: [nr, nf] });
            } else {
              if (target.color !== turn) {
                moves.push({ from: [r, f], to: [nr, nf] });
              }
              break;
            }
            nr += dr;
            nf += df;
          }
        }
      }
    }
  }
  return moves;
}

function applyMoveToBoard(state: ChessState, move: ChessMove): ChessState {
  const s = cloneState(state);
  const { board, turn } = s;
  const [fr, ff] = move.from;
  const [tr, tf] = move.to;
  const piece = board[fr][ff]!;
  const captured = board[tr][tf];

  // En passant capture
  if (piece.type === "P" && s.enPassant && tr === s.enPassant[0] && tf === s.enPassant[1]) {
    const capturedPawnRank = turn === "white" ? tr - 1 : tr + 1;
    const ep = board[capturedPawnRank][tf];
    if (ep) {
      if (turn === "white") s.capturedByWhite.push(ep.type);
      else s.capturedByBlack.push(ep.type);
    }
    board[capturedPawnRank][tf] = null;
  } else if (captured) {
    if (turn === "white") s.capturedByWhite.push(captured.type);
    else s.capturedByBlack.push(captured.type);
  }

  // Move piece
  board[tr][tf] = move.promotion ? { type: move.promotion, color: turn } : piece;
  board[fr][ff] = null;

  // Castling: move the rook
  if (piece.type === "K") {
    if (tf - ff === 2) { // Kingside
      board[tr][5] = board[tr][7];
      board[tr][7] = null;
    } else if (ff - tf === 2) { // Queenside
      board[tr][3] = board[tr][0];
      board[tr][0] = null;
    }
  }

  // Update castling rights
  if (piece.type === "K") {
    if (turn === "white") { s.castling.whiteKingside = false; s.castling.whiteQueenside = false; }
    else { s.castling.blackKingside = false; s.castling.blackQueenside = false; }
  }
  if (piece.type === "R") {
    if (turn === "white") {
      if (fr === 0 && ff === 0) s.castling.whiteQueenside = false;
      if (fr === 0 && ff === 7) s.castling.whiteKingside = false;
    } else {
      if (fr === 7 && ff === 0) s.castling.blackQueenside = false;
      if (fr === 7 && ff === 7) s.castling.blackKingside = false;
    }
  }
  // If a rook is captured on its starting square
  if (tr === 0 && tf === 0) s.castling.whiteQueenside = false;
  if (tr === 0 && tf === 7) s.castling.whiteKingside = false;
  if (tr === 7 && tf === 0) s.castling.blackQueenside = false;
  if (tr === 7 && tf === 7) s.castling.blackKingside = false;

  // En passant target
  if (piece.type === "P" && Math.abs(tr - fr) === 2) {
    s.enPassant = [(fr + tr) / 2, ff];
  } else {
    s.enPassant = null;
  }

  // Half-move clock
  if (piece.type === "P" || captured) {
    s.halfMoveClock = 0;
  } else {
    s.halfMoveClock++;
  }

  // Full move number
  if (turn === "black") s.fullMoveNumber++;

  // Switch turn
  s.turn = opponent(turn);

  return s;
}

function isLegalAfterMove(state: ChessState, move: ChessMove): boolean {
  const after = applyMoveToBoard(state, move);
  // The side that just moved must not be in check
  return !isInCheck(after.board, state.turn);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getLegalMoves(state: ChessState): ChessMove[] {
  if (state.status !== "playing") return [];
  return pseudoLegalMoves(state).filter((m) => isLegalAfterMove(state, m));
}

export function moveToString(m: ChessMove): string {
  const fromStr = `${String.fromCharCode(97 + m.from[1])}${m.from[0] + 1}`;
  const toStr = `${String.fromCharCode(97 + m.to[1])}${m.to[0] + 1}`;
  return `${fromStr}${toStr}${m.promotion ? m.promotion.toLowerCase() : ""}`;
}

export function stringToMove(s: string): ChessMove {
  const ff = s.charCodeAt(0) - 97;
  const fr = parseInt(s[1]) - 1;
  const tf = s.charCodeAt(2) - 97;
  const tr = parseInt(s[3]) - 1;
  const promotion = s.length > 4 ? s[4].toUpperCase() as PieceType : undefined;
  return { from: [fr, ff], to: [tr, tf], promotion };
}

export function applyMove(state: ChessState, move: ChessMove): ChessState {
  const s = applyMoveToBoard(state, move);

  // Record move
  s.moveHistory.push(moveToString(move));

  // Check status
  const posKey = boardPositionKey(s);
  s.positionHistory.push(posKey);
  s.inCheck = isInCheck(s.board, s.turn);

  const legal = getLegalMoves(s);
  if (legal.length === 0) {
    if (s.inCheck) {
      s.status = "checkmate";
      s.winner = opponent(s.turn);
    } else {
      s.status = "stalemate";
    }
  } else if (s.halfMoveClock >= 100) {
    s.status = "draw_50move";
  } else if (s.positionHistory.filter((k) => k === posKey).length >= 3) {
    s.status = "draw_repetition";
  } else if (isInsufficientMaterial(s.board)) {
    s.status = "draw_insufficient";
  }

  return s;
}

export function resign(state: ChessState): ChessState {
  const s = cloneState(state);
  s.status = "resigned";
  s.winner = opponent(s.turn);
  return s;
}

// ---------------------------------------------------------------------------
// Insufficient material detection
// ---------------------------------------------------------------------------

function isInsufficientMaterial(board: Board): boolean {
  const pieces: { type: PieceType; color: Color; rank: number; file: number }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p) pieces.push({ type: p.type, color: p.color, rank: r, file: f });
    }
  }
  // K vs K
  if (pieces.length === 2) return true;
  // K+B vs K or K+N vs K
  if (pieces.length === 3) {
    const nonKing = pieces.find((p) => p.type !== "K");
    if (nonKing && (nonKing.type === "B" || nonKing.type === "N")) return true;
  }
  // K+B vs K+B (same color bishops)
  if (pieces.length === 4) {
    const bishops = pieces.filter((p) => p.type === "B");
    if (bishops.length === 2 && bishops[0].color !== bishops[1].color) {
      const sq1 = (bishops[0].rank + bishops[0].file) % 2;
      const sq2 = (bishops[1].rank + bishops[1].file) % 2;
      if (sq1 === sq2) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Material evaluation for AI
// ---------------------------------------------------------------------------

const PIECE_VALUES: Record<PieceType, number> = {
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0,
};

export function evaluateMaterial(board: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      const val = PIECE_VALUES[p.type];
      score += p.color === "white" ? val : -val;
    }
  }
  return score;
}
