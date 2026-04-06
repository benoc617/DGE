import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDb } from "@/lib/db-context";
import { runAndPersistTick } from "@/lib/game-engine";
import { getCurrentTurn } from "@/lib/turn-order";
import {
  withCommitLock,
  GalaxyBusyError,
  canPlayerAct,
  openFullTurn,
  tryRollRound,
} from "@/lib/door-game-turns";

export async function POST(req: NextRequest) {
  const { playerName } = await req.json();

  if (!playerName) {
    return NextResponse.json({ error: "playerName required" }, { status: 400 });
  }

  const player = await prisma.player.findFirst({
    where: { name: playerName, isAI: false, empire: { turnsLeft: { gt: 0 } } },
    orderBy: { createdAt: "desc" },
    include: { empire: true },
  });
  if (!player || !player.empire) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (player.gameSessionId) {
    const sess = await prisma.gameSession.findUnique({
      where: { id: player.gameSessionId },
      select: {
        waitingForHuman: true,
        turnMode: true,
        actionsPerDay: true,
      },
    });
    if (sess?.waitingForHuman) {
      return NextResponse.json({
        error: "Galaxy has not started yet.",
        waitingForGameStart: true,
      }, { status: 409 });
    }

    if (sess?.turnMode === "simultaneous") {
      if (!canPlayerAct(player.empire, sess.actionsPerDay)) {
        return NextResponse.json(
          { error: "No full turns left today in this calendar round." },
          { status: 409 },
        );
      }
      if (player.empire.turnOpen) {
        return NextResponse.json({ error: "Turn already open — take actions or end_turn.", alreadyOpen: true }, { status: 409 });
      }

      try {
        return await withCommitLock(player.gameSessionId, async () => {
          await tryRollRound(player.gameSessionId!);
          const report = await openFullTurn(player.id);
          const p2 = await getDb().player.findUnique({
            where: { id: player.id },
            include: { empire: true },
          });
          if (p2?.empire?.turnOpen && !report) {
            return NextResponse.json({ turnReport: null, turnOpened: true });
          }
          if (!report) {
            return NextResponse.json({ alreadyProcessed: true });
          }
          return NextResponse.json({ turnReport: report });
        });
      } catch (err) {
        if (err instanceof GalaxyBusyError) {
          return NextResponse.json(
            { error: err.message, galaxyBusy: true },
            { status: 409, headers: { "Retry-After": "0" } },
          );
        }
        throw err;
      }
    }

    const turn = await getCurrentTurn(player.gameSessionId);
    if (!turn) {
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
