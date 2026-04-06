import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processAction, type ActionType } from "@/lib/game-engine";
import { getCurrentTurn, advanceTurn } from "@/lib/turn-order";
import { runAISequence } from "@/lib/ai-runner";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { playerName, action, ...params } = body;

  if (!playerName || !action) {
    return NextResponse.json({ error: "playerName and action required" }, { status: 400 });
  }

  const player = await prisma.player.findFirst({
    where: { name: playerName, empire: { turnsLeft: { gt: 0 } } },
    orderBy: { createdAt: "desc" },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (player.gameSessionId) {
    const turn = await getCurrentTurn(player.gameSessionId);
    if (!turn) {
      const sess = await prisma.gameSession.findUnique({
        where: { id: player.gameSessionId },
        select: { waitingForHuman: true },
      });
      if (sess?.waitingForHuman) {
        return NextResponse.json({
          success: false,
          error: "Galaxy has not started yet.",
          waitingForGameStart: true,
        }, { status: 409 });
      }
      return NextResponse.json({
        success: false,
        error: "No active turn in this session.",
      }, { status: 409 });
    }
    if (turn.currentPlayerId !== player.id) {
      return NextResponse.json({
        error: `It's ${turn.currentPlayerName}'s turn`,
        success: false,
        notYourTurn: true,
        currentTurnPlayer: turn.currentPlayerName,
      }, { status: 409 });
    }
  }

  const result = await processAction(player.id, action as ActionType, params);

  if (result.success && player.gameSessionId) {
    await advanceTurn(player.gameSessionId);
    runAISequence(player.gameSessionId).catch(() => {});
  }

  return NextResponse.json(result);
}
