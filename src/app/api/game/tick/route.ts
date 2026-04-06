import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAndPersistTick } from "@/lib/game-engine";
import { getCurrentTurn } from "@/lib/turn-order";

export async function POST(req: NextRequest) {
  const { playerName } = await req.json();

  if (!playerName) {
    return NextResponse.json({ error: "playerName required" }, { status: 400 });
  }

  const player = await prisma.player.findFirst({
    where: { name: playerName, isAI: false, empire: { turnsLeft: { gt: 0 } } },
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
          error: "Galaxy has not started yet.",
          waitingForGameStart: true,
        }, { status: 409 });
      }
      return NextResponse.json({ error: "No active turn in this session." }, { status: 409 });
    }
    if (turn.currentPlayerId !== player.id) {
      return NextResponse.json({
        error: `It's ${turn.currentPlayerName}'s turn`,
        notYourTurn: true,
      }, { status: 409 });
    }
  }

  const turnReport = await runAndPersistTick(player.id);

  if (!turnReport) {
    return NextResponse.json({ alreadyProcessed: true });
  }

  return NextResponse.json({ turnReport });
}
