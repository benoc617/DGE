"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/client-fetch";

// ---------------------------------------------------------------------------
// Types (mirror what buildStatus returns)
// ---------------------------------------------------------------------------

interface Piece { type: string; color: string }
type Board = (Piece | null)[][];

interface ChessStatus {
  playerId: string;
  name: string;
  sessionId: string;
  galaxyName: string | null;
  gameStatus: string;
  winner: string | null;
  myColor: string;
  inCheck: boolean;
  isYourTurn: boolean;
  currentTurnPlayer: string;
  board: Board;
  turn: string;
  moveHistory: string[];
  capturedByWhite: string[];
  capturedByBlack: string[];
  fullMoveNumber: number;
  halfMoveClock: number;
  turnOrder: { name: string; isAI: boolean; isCurrent: boolean }[];
  game?: string;
}

// ---------------------------------------------------------------------------
// Piece rendering (Unicode chess symbols)
// ---------------------------------------------------------------------------

const PIECE_CHARS: Record<string, Record<string, string>> = {
  white: { K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658", P: "\u2659" },
  black: { K: "\u265A", Q: "\u265B", R: "\u265C", B: "\u265D", N: "\u265E", P: "\u265F" },
};

const PIECE_NAMES: Record<string, string> = { K: "King", Q: "Queen", R: "Rook", B: "Bishop", N: "Knight", P: "Pawn" };

function squareToAlgebraic(rank: number, file: number): string {
  return `${String.fromCharCode(97 + file)}${rank + 1}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChessGameScreenProps {
  playerName: string;
  sessionPlayerId: string | null;
  gameSessionId: string | null;
  initialInviteCode: string;
  initialGalaxyName: string;
  initialIsPublic: boolean;
  isCreator: boolean;
  initialEvents: string[];
  onLogout: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChessGameScreen({
  playerName,
  sessionPlayerId,
  gameSessionId,
  onLogout,
}: ChessGameScreenProps) {
  const [status, setStatus] = useState<ChessStatus | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [legalTargets, setLegalTargets] = useState<Set<string>>(new Set());
  const [legalMoves, setLegalMoves] = useState<{ from: string; to: string; promotion?: string }[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------------------
  // Status polling
  // -------------------------------------------------------------------------

  const fetchStatus = useCallback(async () => {
    if (!sessionPlayerId) return;
    try {
      const res = await apiFetch(`/api/game/status?id=${sessionPlayerId}`);
      if (res.ok) {
        const data = await res.json() as ChessStatus;
        setStatus(data);
      }
    } catch { /* ignore */ }
  }, [sessionPlayerId]);

  useEffect(() => {
    fetchStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!status) return;
    if (status.gameStatus !== "playing") return;
    if (!status.isYourTurn) {
      pollRef.current = setInterval(fetchStatus, 1500);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, fetchStatus]);

  // -------------------------------------------------------------------------
  // Compute legal moves for the selected piece
  // -------------------------------------------------------------------------

  const computeLegalMoves = useCallback(async (rank: number, file: number) => {
    if (!status?.board) return;
    const piece = status.board[rank][file];
    if (!piece || piece.color !== status.myColor) return;

    // Fetch legal moves from server-side via a status re-fetch
    // For now compute client-side from the board by calling the action endpoint
    // with a test. Actually, let's just compute locally:
    // We'll get legal moves by trying all possible destinations via the rules.
    // Since the rules engine runs server-side, we'll use a simpler approach:
    // fetch the full move list from a lightweight endpoint, or compute on client.
    // For simplicity, let's request moves from the server.
    try {
      const res = await apiFetch(`/api/game/chess/moves?id=${sessionPlayerId}`);
      if (res.ok) {
        const data = await res.json() as { moves: { from: string; to: string; promotion?: string }[] };
        const fromStr = squareToAlgebraic(rank, file);
        const forPiece = data.moves.filter((m) => m.from === fromStr);
        setLegalMoves(forPiece);
        setLegalTargets(new Set(forPiece.map((m) => m.to)));
      }
    } catch { /* ignore */ }
  }, [status, sessionPlayerId]);

  // -------------------------------------------------------------------------
  // Board click handler
  // -------------------------------------------------------------------------

  const handleSquareClick = useCallback(async (rank: number, file: number) => {
    if (!status || status.gameStatus !== "playing" || !status.isYourTurn || loading) return;

    // Promotion dialog active — ignore board clicks
    if (promotionPending) return;

    const piece = status.board[rank][file];

    if (selectedSquare) {
      const [sr, sf] = selectedSquare;
      const targetStr = squareToAlgebraic(rank, file);

      // Clicking the same square deselects (but we allow switching pieces)
      if (sr === rank && sf === file) {
        setSelectedSquare(null);
        setLegalTargets(new Set());
        setLegalMoves([]);
        return;
      }

      // Clicking own piece: switch selection
      if (piece && piece.color === status.myColor) {
        setSelectedSquare([rank, file]);
        await computeLegalMoves(rank, file);
        return;
      }

      // Clicking a legal target: execute the move
      if (legalTargets.has(targetStr)) {
        const matching = legalMoves.filter((m) => m.to === targetStr);
        // Check if promotion is needed (multiple moves to same square with different promotions)
        if (matching.length > 1) {
          setPromotionPending({ from: [sr, sf], to: [rank, file] });
          return;
        }
        await executeMove(matching[0].from + matching[0].to + (matching[0].promotion ?? ""));
        return;
      }

      // Clicked non-legal square — keep selection
      return;
    }

    // No selection yet: select own piece
    if (piece && piece.color === status.myColor) {
      setSelectedSquare([rank, file]);
      await computeLegalMoves(rank, file);
    }
  }, [status, selectedSquare, legalTargets, legalMoves, loading, promotionPending, computeLegalMoves]);

  // -------------------------------------------------------------------------
  // Execute move
  // -------------------------------------------------------------------------

  const executeMove = useCallback(async (moveStr: string) => {
    setLoading(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName, action: "move", move: moveStr }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message || "Move played.");
      } else {
        setMessage(data.message || data.error || "Move failed.");
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setSelectedSquare(null);
      setLegalTargets(new Set());
      setLegalMoves([]);
      setPromotionPending(null);
      setLoading(false);
      await fetchStatus();
    }
  }, [playerName, fetchStatus]);

  // -------------------------------------------------------------------------
  // Promotion handler
  // -------------------------------------------------------------------------

  const handlePromotion = useCallback(async (pieceType: string) => {
    if (!promotionPending) return;
    const fromStr = squareToAlgebraic(promotionPending.from[0], promotionPending.from[1]);
    const toStr = squareToAlgebraic(promotionPending.to[0], promotionPending.to[1]);
    await executeMove(fromStr + toStr + pieceType.toLowerCase());
  }, [promotionPending, executeMove]);

  // -------------------------------------------------------------------------
  // Resign
  // -------------------------------------------------------------------------

  const handleResign = useCallback(async () => {
    if (!status || status.gameStatus !== "playing" || loading) return;
    if (!confirm("Are you sure you want to resign?")) return;
    setLoading(true);
    try {
      await apiFetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName, action: "resign" }),
      });
    } catch { /* ignore */ }
    setLoading(false);
    await fetchStatus();
  }, [status, playerName, loading, fetchStatus]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!status) {
    return <div className="flex items-center justify-center h-screen text-green-400">Loading chess...</div>;
  }

  const isFlipped = status.myColor === "black";
  const gameOver = status.gameStatus !== "playing";

  return (
    <div className="flex flex-col items-center min-h-screen bg-black text-green-400 p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-2xl">
        <h1 className="text-xl font-bold">Chess</h1>
        <div className="flex gap-3 items-center text-sm">
          <span className="text-yellow-400">{playerName}</span>
          <span>({status.myColor})</span>
          <button onClick={onLogout} className="text-red-400 hover:text-red-300 underline">
            Leave
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="w-full max-w-2xl text-center text-sm">
        {gameOver ? (
          <div className="text-yellow-400 font-bold text-lg">
            {status.gameStatus === "checkmate" && `Checkmate! ${status.winner === status.myColor ? "You win!" : "You lose."}`}
            {status.gameStatus === "stalemate" && "Stalemate — Draw!"}
            {status.gameStatus === "resigned" && `${status.winner === status.myColor ? "Opponent resigned — You win!" : "You resigned."}`}
            {status.gameStatus.startsWith("draw_") && status.gameStatus !== "stalemate" && "Draw!"}
          </div>
        ) : (
          <div>
            {status.isYourTurn ? (
              <span className="text-cyan-400 font-bold">Your turn</span>
            ) : (
              <span className="text-yellow-400">Waiting for {status.currentTurnPlayer}...</span>
            )}
            {status.inCheck && <span className="text-red-400 font-bold ml-2">CHECK!</span>}
            <span className="ml-3 text-gray-500">Move {status.fullMoveNumber}</span>
          </div>
        )}
      </div>

      {/* Captured pieces (opponent's captured = at top) */}
      <CapturedPieces
        pieces={isFlipped ? status.capturedByWhite : status.capturedByBlack}
        color={isFlipped ? "black" : "white"}
        label={isFlipped ? "Captured by white" : "Captured by black"}
      />

      {/* Board */}
      <div className="relative">
        <div className="grid grid-cols-8 border-2 border-green-800" style={{ width: "min(90vw, 480px)", height: "min(90vw, 480px)" }}>
          {Array.from({ length: 64 }).map((_, i) => {
            const displayRow = Math.floor(i / 8);
            const displayCol = i % 8;
            const rank = isFlipped ? displayRow : 7 - displayRow;
            const file = isFlipped ? 7 - displayCol : displayCol;
            const piece = status.board[rank][file];
            const isLight = (rank + file) % 2 === 1;
            const isSelected = selectedSquare?.[0] === rank && selectedSquare?.[1] === file;
            const sqStr = squareToAlgebraic(rank, file);
            const isTarget = legalTargets.has(sqStr);
            const isLastMoveSquare = status.moveHistory.length > 0 && (() => {
              const last = status.moveHistory[status.moveHistory.length - 1];
              const from = last.slice(0, 2);
              const to = last.slice(2, 4);
              return sqStr === from || sqStr === to;
            })();

            let bg = isLight ? "bg-amber-100" : "bg-amber-800";
            if (isSelected) bg = "bg-blue-500";
            else if (isLastMoveSquare) bg = isLight ? "bg-yellow-200" : "bg-yellow-700";

            return (
              <button
                key={`${rank}-${file}`}
                className={`${bg} relative flex items-center justify-center transition-colors`}
                style={{ aspectRatio: "1" }}
                onClick={() => handleSquareClick(rank, file)}
                disabled={loading}
                title={`${sqStr}${piece ? ` — ${piece.color} ${PIECE_NAMES[piece.type] ?? piece.type}` : ""}`}
              >
                {/* Legal move indicator */}
                {isTarget && !piece && (
                  <div className="absolute w-3 h-3 rounded-full bg-green-500 opacity-60" />
                )}
                {isTarget && piece && (
                  <div className="absolute inset-0 border-4 border-red-500 rounded-sm opacity-70" />
                )}
                {/* Piece */}
                {piece && (
                  <span className={`text-3xl sm:text-4xl select-none ${piece.color === "white" ? "drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" : ""}`}
                    style={{ lineHeight: 1, filter: piece.color === "black" ? "drop-shadow(0 1px 1px rgba(255,255,255,0.3))" : undefined }}>
                    {PIECE_CHARS[piece.color]?.[piece.type] ?? "?"}
                  </span>
                )}
                {/* Rank/file labels */}
                {displayCol === 0 && (
                  <span className="absolute top-0.5 left-0.5 text-[9px] text-gray-600 font-mono">{rank + 1}</span>
                )}
                {displayRow === 7 && (
                  <span className="absolute bottom-0.5 right-0.5 text-[9px] text-gray-600 font-mono">
                    {String.fromCharCode(97 + file)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Promotion dialog overlay */}
        {promotionPending && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
            <div className="bg-gray-900 border border-green-600 rounded p-4 text-center">
              <p className="text-green-400 mb-3 font-bold">Promote pawn to:</p>
              <div className="flex gap-3 justify-center">
                {(["Q", "R", "B", "N"] as const).map((pt) => (
                  <button
                    key={pt}
                    onClick={() => handlePromotion(pt)}
                    className="text-4xl p-2 hover:bg-green-900 rounded transition-colors"
                    title={PIECE_NAMES[pt]}
                  >
                    {PIECE_CHARS[status.myColor]?.[pt]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Captured pieces (own captured = at bottom) */}
      <CapturedPieces
        pieces={isFlipped ? status.capturedByBlack : status.capturedByWhite}
        color={isFlipped ? "white" : "black"}
        label={isFlipped ? "Captured by black" : "Captured by white"}
      />

      {/* Controls */}
      <div className="flex gap-3 items-center">
        {!gameOver && status.isYourTurn && (
          <button
            onClick={handleResign}
            disabled={loading}
            className="px-4 py-2 bg-red-900 text-red-300 rounded hover:bg-red-800 disabled:opacity-50 text-sm font-bold"
          >
            Resign
          </button>
        )}
        {gameOver && (
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-green-900 text-green-300 rounded hover:bg-green-800 text-sm font-bold"
          >
            Back to Lobby
          </button>
        )}
      </div>

      {/* Message */}
      {message && <div className="text-sm text-gray-400 max-w-md text-center">{message}</div>}

      {/* Move history */}
      {status.moveHistory.length > 0 && (
        <div className="w-full max-w-2xl mt-2">
          <h3 className="text-xs text-gray-500 mb-1 font-bold">MOVE HISTORY</h3>
          <div className="text-xs text-gray-400 font-mono flex flex-wrap gap-1">
            {status.moveHistory.map((m, i) => (
              <span key={i} className={i === status.moveHistory.length - 1 ? "text-yellow-400 font-bold" : ""}>
                {i % 2 === 0 && <span className="text-gray-600">{Math.floor(i / 2) + 1}.</span>}
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Captured pieces sub-component
// ---------------------------------------------------------------------------

function CapturedPieces({ pieces, color, label }: { pieces: string[]; color: string; label: string }) {
  if (pieces.length === 0) return null;
  const captured = color === "white" ? "black" : "white";
  return (
    <div className="text-center">
      <span className="text-[10px] text-gray-600 uppercase">{label}</span>
      <div className="flex justify-center gap-0.5">
        {pieces.map((pt, i) => (
          <span key={i} className="text-lg opacity-70">
            {PIECE_CHARS[captured]?.[pt] ?? "?"}
          </span>
        ))}
      </div>
    </div>
  );
}
