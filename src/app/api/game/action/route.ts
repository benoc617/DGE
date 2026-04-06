import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDb } from "@/lib/db-context";
import { processAction, type ActionType } from "@/lib/game-engine";
import { getCurrentTurn, advanceTurn } from "@/lib/turn-order";
import { runAISequence } from "@/lib/ai-runner";
import {
  withCommitLock,
  GalaxyBusyError,
  canPlayerAct,
  openFullTurn,
  closeFullTurn,
  doorGameAutoCloseFullTurnAfterAction,
  runDoorGameAITurns,
} from "@/lib/door-game-turns";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { playerName, action, ...params } = body;

  if (!playerName || !action) {
    return NextResponse.json({ error: "playerName and action required" }, { status: 400 });
  }

  const player = await prisma.player.findFirst({
    where: { name: playerName, empire: { turnsLeft: { gt: 0 } } },
    orderBy: { createdAt: "desc" },
    include: { empire: true },
  });
  if (!player || !player.empire) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (!player.gameSessionId) {
    const result = await processAction(player.id, action as ActionType, params);
    return NextResponse.json(result);
  }

  const sess = await prisma.gameSession.findUnique({
    where: { id: player.gameSessionId },
    select: { turnMode: true, waitingForHuman: true },
  });

  if (sess?.turnMode === "simultaneous") {
    if (sess.waitingForHuman) {
      return NextResponse.json({
        success: false,
        error: "Galaxy has not started yet.",
        waitingForGameStart: true,
      }, { status: 409 });
    }

    try {
      return await withCommitLock(player.gameSessionId, async () => {
        const p = await getDb().player.findUnique({
          where: { id: player.id },
          include: { empire: true },
        });
        if (!p?.empire) {
          return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }

        const session = await getDb().gameSession.findUnique({
          where: { id: player.gameSessionId! },
          select: { actionsPerDay: true },
        });
        if (!session) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const e = p.empire;
        if (!canPlayerAct(e, session.actionsPerDay)) {
          return NextResponse.json(
            { success: false, error: "No full turns remaining today in this calendar round." },
            { status: 409 },
          );
        }

        if (!e.turnOpen) {
          if (action === "end_turn") {
            return NextResponse.json(
              {
                success: false,
                error: "No open turn to end. Open a turn with POST /api/game/tick first (or take an action).",
              },
              { status: 409 },
            );
          }
          await openFullTurn(p.id);
        }

        const doorOpts =
          action === "end_turn"
            ? {
                tickOptions: { decrementTurnsLeft: false as const },
                keepTickProcessed: false as const,
                skipEndgameSettlement: true as const,
              }
            : {
                tickOptions: { decrementTurnsLeft: false as const },
                keepTickProcessed: true as const,
                skipEndgameSettlement: true as const,
              };

        const result = await processAction(p.id, action as ActionType, params, doorOpts);
        const sid = p.gameSessionId;

        if (result.success && action === "end_turn" && sid) {
          await closeFullTurn(p.id, sid);
          after(() => {
            void runDoorGameAITurns(sid).catch((err) => {
              console.error("[door-game] runDoorGameAITurns after human end_turn", sid, err);
            });
          });
        }

        if (result.success && action !== "end_turn" && sid) {
          await doorGameAutoCloseFullTurnAfterAction(p.id, sid);
          after(() => {
            void runDoorGameAITurns(sid).catch((err) => {
              console.error("[door-game] runDoorGameAITurns after human action", sid, err);
            });
          });
        }

        return NextResponse.json(result);
      });
    } catch (err) {
      if (err instanceof GalaxyBusyError) {
        return NextResponse.json(
          { success: false, error: err.message, galaxyBusy: true },
          { status: 409, headers: { "Retry-After": "0" } },
        );
      }
      throw err;
    }
  }

  const turn = await getCurrentTurn(player.gameSessionId);
  if (!turn) {
    const s = await prisma.gameSession.findUnique({
      where: { id: player.gameSessionId },
      select: { waitingForHuman: true },
    });
    if (s?.waitingForHuman) {
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

  const result = await processAction(player.id, action as ActionType, params);

  if (result.success && player.gameSessionId) {
    await advanceTurn(player.gameSessionId);
    runAISequence(player.gameSessionId).catch(() => {});
  }

  return NextResponse.json(result);
}
