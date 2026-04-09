import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGame } from "@dge/engine/registry";
import { GalaxyBusyError } from "@/lib/db-context";
import { canPlayerAct } from "@/lib/door-game-turns";
import { logSrxTiming, msElapsed } from "@/lib/srx-timing";
import { invalidatePlayer } from "@/lib/game-state-service";
import "@/lib/srx-registration"; // ensure SRX game is registered before any dispatch

export async function POST(req: NextRequest) {
  const tRoute = performance.now();
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
      select: { waitingForHuman: true, turnMode: true, actionsPerDay: true, gameType: true },
    });

    if (sess?.waitingForHuman) {
      logSrxTiming("tick_denied", { playerName, reason: "waiting_for_human" });
      return NextResponse.json({ error: "Galaxy has not started yet.", waitingForGameStart: true }, { status: 409 });
    }

    const gameType = sess?.gameType ?? "srx";
    const game = requireGame(gameType);

    // -----------------------------------------------------------------------
    // Door-game (simultaneous) tick path
    // -----------------------------------------------------------------------
    if (sess?.turnMode === "simultaneous") {
      // Pre-lock checks (cheap, no lock needed).
      if (!canPlayerAct(player.empire, sess.actionsPerDay)) {
        logSrxTiming("tick_denied", { playerName, reason: "no_full_turns_left_today" });
        return NextResponse.json(
          { error: "No full turns left today in this calendar round." },
          { status: 409 },
        );
      }
      if (player.empire.turnOpen) {
        logSrxTiming("tick_denied", { playerName, reason: "already_open" });
        return NextResponse.json(
          { error: "Turn already open — take actions or end_turn.", alreadyOpen: true },
          { status: 409 },
        );
      }

      const tLock0 = performance.now();
      try {
        const { report, turnOpened } = await game.orchestrator.processDoorTick(
          player.gameSessionId,
          player.id,
        );

        void invalidatePlayer(player.id).catch(() => {});
        logSrxTiming("tick_route_door", {
          playerName, sessionId: player.gameSessionId,
          routeTotalMs: msElapsed(tRoute),
          lockCallMs: msElapsed(tLock0),
        });

        if (turnOpened && !report) {
          return NextResponse.json({ turnReport: null, turnOpened: true });
        }
        if (!report) {
          return NextResponse.json({ alreadyProcessed: true });
        }
        return NextResponse.json({ turnReport: report });
      } catch (err) {
        if (err instanceof GalaxyBusyError) {
          logSrxTiming("tick_galaxy_busy", { playerName, sessionId: player.gameSessionId });
          return NextResponse.json(
            { error: err.message, galaxyBusy: true },
            { status: 409, headers: { "Retry-After": "0" } },
          );
        }
        throw err;
      }
    }

    // -----------------------------------------------------------------------
    // Sequential tick path
    // -----------------------------------------------------------------------
    const outcome = await game.orchestrator.processSequentialTick(
      player.gameSessionId,
      player.id,
    );

    if (outcome.noActiveTurn) {
      logSrxTiming("tick_denied", { playerName, reason: "no_active_turn" });
      return NextResponse.json({ error: "No active turn in this session." }, { status: 409 });
    }
    if (outcome.notYourTurn) {
      logSrxTiming("tick_denied", { playerName, reason: "not_your_turn" });
      return NextResponse.json({
        error: `It's ${outcome.currentPlayerName}'s turn`,
        notYourTurn: true,
      }, { status: 409 });
    }

    void invalidatePlayer(player.id).catch(() => {});
    logSrxTiming("tick_route_sequential", {
      playerName, sessionId: player.gameSessionId,
      routeTotalMs: msElapsed(tRoute),
    });

    if (!outcome.report) {
      return NextResponse.json({ alreadyProcessed: true });
    }
    return NextResponse.json({ turnReport: outcome.report });
  }

  // -------------------------------------------------------------------------
  // No-session tick path (legacy / solo play)
  // -------------------------------------------------------------------------
  const game = requireGame("srx");
  const report = await game.definition.processFullTick!(player.id);
  void invalidatePlayer(player.id).catch(() => {});
  logSrxTiming("tick_route_sequential", {
    playerName, sessionId: null,
    routeTotalMs: msElapsed(tRoute),
  });

  if (!report) {
    return NextResponse.json({ alreadyProcessed: true });
  }
  return NextResponse.json({ turnReport: report });
}
