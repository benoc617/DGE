import { type NextRequest, NextResponse } from "next/server";
import "@/lib/game-bootstrap";
import { prisma } from "@/lib/prisma";
import type { ChessState } from "@dge/chess";
import { getLegalMoves, moveToString } from "@dge/chess";

/**
 * GET /api/game/chess/moves?id=<playerId>
 *
 * Returns the list of legal moves for the current position from the perspective
 * of the requesting player. Each move is { from, to, promotion? } in algebraic notation.
 */
export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("id");
  if (!playerId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      gameSession: { select: { log: true, status: true } },
    },
  });

  if (!player?.gameSession?.log) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const state = player.gameSession.log as unknown as ChessState;
  if (state.status !== "playing") {
    return NextResponse.json({ moves: [] });
  }

  // Only return moves when it's this player's turn
  const currentPlayerId = state.turn === "white" ? state.whitePlayerId : state.blackPlayerId;
  if (currentPlayerId !== playerId) {
    return NextResponse.json({ moves: [] });
  }

  const legal = getLegalMoves(state);
  const moves = legal.map((m) => {
    const moveStr = moveToString(m);
    return {
      from: moveStr.slice(0, 2),
      to: moveStr.slice(2, 4),
      promotion: moveStr.length > 4 ? moveStr[4] : undefined,
    };
  });

  return NextResponse.json({ moves });
}
