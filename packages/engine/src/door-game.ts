/**
 * @dge/engine — Simultaneous ("door-game") turn management.
 *
 * Game-agnostic: uses the shared engine DB schema fields
 * (`Empire.turnOpen`, `Empire.fullTurnsUsedThisRound`, `GameSession.dayNumber`, etc.).
 *
 * SRX-specific operations (tick, endgame settlement, cache invalidation, AI job
 * enqueueing) are injected via DoorGameHooks so this module has no dependency on
 * game-engine.ts, ai-job-queue.ts, or game-state-service.ts.
 */

import { getDb } from "./db-context";

// ---------------------------------------------------------------------------
// Hooks (game-specific callbacks injected by the SRX layer)
// ---------------------------------------------------------------------------

/**
 * Callbacks for door-game lifecycle events that require game-specific logic.
 */
export interface DoorGameHooks {
  /**
   * Run and persist the economy tick for the given player.
   * `opts.decrementTurnsLeft` defaults to true; door-game passes false
   * because turnsLeft is decremented by closeFullTurn instead.
   */
  runTick(
    playerId: string,
    opts?: { decrementTurnsLeft?: boolean },
  ): Promise<unknown | null>;

  /**
   * Run the endgame settlement tick when a player's turnsLeft hits 0.
   * Called at the end of closeFullTurn and round-timeout forfeiture.
   */
  runEndgameTick(playerId: string): Promise<void>;

  /**
   * Optional: fire-and-forget cache invalidation for a player's empire.
   * Called after empire update in closeFullTurn.
   */
  invalidatePlayer?(playerId: string): void;

  /**
   * Optional: fire-and-forget cache invalidation for the session leaderboard.
   * Called after tryRollRound advances the calendar day.
   */
  invalidateLeaderboard?(sessionId: string): void;

  /**
   * Optional: called after a new calendar day begins (day_complete event fired).
   * Used by SRX to enqueue AI turn jobs in the ai-worker queue.
   * Pass scheduleAiDrain:false from headless sims to disable.
   */
  onDayComplete?(sessionId: string): void;
}

// ---------------------------------------------------------------------------
// Pure utilities (no hooks, no DB)
// ---------------------------------------------------------------------------

/**
 * True when the player has turns left and hasn't used all daily full-turn slots.
 */
export function canPlayerAct(
  empire: { turnsLeft: number; fullTurnsUsedThisRound: number },
  actionsPerDay: number,
): boolean {
  return empire.turnsLeft > 0 && empire.fullTurnsUsedThisRound < actionsPerDay;
}

/**
 * True when `roundStartedAt + turnTimeoutSecs` has passed (door-game round deadline).
 */
export function isSessionRoundTimedOut(
  roundStartedAt: Date | null,
  turnTimeoutSecs: number,
  nowMs: number = Date.now(),
): boolean {
  if (!roundStartedAt) return false;
  return nowMs >= roundStartedAt.getTime() + turnTimeoutSecs * 1000;
}

/**
 * True when the skip-path bug left an empire with turnOpen set, the last logged
 * action was end_turn, and closeFullTurn never ran (tick still "unprocessed"
 * for the open slot).
 */
export function isStuckDoorTurnAfterSkipEndLog(
  turnOpen: boolean,
  lastTurnLogAction: string | null | undefined,
  tickProcessed: boolean | undefined,
): boolean {
  return turnOpen === true && lastTurnLogAction === "end_turn" && tickProcessed === false;
}

// ---------------------------------------------------------------------------
// Core door-game lifecycle functions
// ---------------------------------------------------------------------------

/**
 * Run economy tick for a new full turn and mark the empire as mid-turn (`turnOpen`).
 * Returns the tick result (TurnReport in SRX) or null if not applicable.
 */
export async function openFullTurn(
  playerId: string,
  hooks: DoorGameHooks,
): Promise<unknown> {
  const player = await getDb().player.findUnique({
    where: { id: playerId },
    include: { empire: true },
  });
  if (!player?.empire || player.empire.turnsLeft < 1) return null;
  if (player.empire.turnOpen) {
    return null;
  }

  if (player.empire.tickProcessed) {
    await getDb().empire.update({
      where: { id: player.empire.id },
      data: { turnOpen: true },
    });
    return null;
  }

  const report = await hooks.runTick(playerId, { decrementTurnsLeft: false });
  if (!report) return null;

  await getDb().empire.update({
    where: { id: player.empire.id },
    data: { turnOpen: true },
  });

  return report;
}

/**
 * After `end_turn` processAction: close the full turn, count it for the round,
 * decrement `turnsLeft` (one game turn per full turn / miniturn), maybe roll the
 * calendar day.
 */
export async function closeFullTurn(
  playerId: string,
  sessionId: string,
  hooks: DoorGameHooks,
): Promise<void> {
  try {
    const result = await getDb().empire.updateMany({
      where: { playerId, turnsLeft: { gt: 0 } },
      data: {
        turnOpen: false,
        tickProcessed: false,
        fullTurnsUsedThisRound: { increment: 1 },
        turnsLeft: { decrement: 1 },
      },
    });
    if (result.count === 0) {
      throw new Error(
        `closeFullTurn: no empire updated for playerId=${playerId} (missing or turnsLeft<=0)`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `closeFullTurn: failed to update empire for playerId=${playerId}: ${msg}`,
    );
  }

  const empAfter = await getDb().empire.findUnique({
    where: { playerId },
    select: { turnsLeft: true },
  });
  if (empAfter?.turnsLeft === 0) {
    await hooks.runEndgameTick(playerId);
  }

  hooks.invalidatePlayer?.(playerId);
  await tryRollRound(sessionId, hooks);
}

/**
 * When every active empire has used all full turns for the round (or the round
 * deadline passed), advance the calendar day.
 *
 * `turnsLeft` is consumed per full turn in `closeFullTurn`, not here.
 * Round deadline: `roundStartedAt` + `turnTimeoutSecs` — remaining daily slots are
 * skipped (forfeit); each forfeited slot also consumes one `turnsLeft`.
 *
 * @returns true if a day roll occurred.
 */
export async function tryRollRound(
  sessionId: string,
  hooks: DoorGameHooks,
): Promise<boolean> {
  const session = await getDb().gameSession.findUnique({
    where: { id: sessionId },
    include: {
      players: {
        where: { empire: { turnsLeft: { gt: 0 } } },
        include: { empire: true },
      },
    },
  });

  if (!session || session.turnMode !== "simultaneous" || session.waitingForHuman) {
    return false;
  }

  const apd = session.actionsPerDay;

  // Round deadline: forfeit remaining slots for empires that haven't finished.
  if (isSessionRoundTimedOut(session.roundStartedAt, session.turnTimeoutSecs)) {
    const db = getDb();
    const stuck = await db.empire.findMany({
      where: {
        player: { gameSessionId: sessionId },
        turnsLeft: { gt: 0 },
        fullTurnsUsedThisRound: { lt: apd },
      },
      select: {
        id: true,
        playerId: true,
        fullTurnsUsedThisRound: true,
        turnsLeft: true,
      },
    });
    let forgivenCount = 0;
    for (const emp of stuck) {
      const used = emp.fullTurnsUsedThisRound ?? 0;
      const slotsLeft = apd - used;
      if (slotsLeft <= 0) continue;
      const newTurnsLeft = Math.max(0, emp.turnsLeft - slotsLeft);
      await db.empire.update({
        where: { id: emp.id },
        data: {
          fullTurnsUsedThisRound: apd,
          turnOpen: false,
          tickProcessed: false,
          turnsLeft: newTurnsLeft,
        },
      });
      if (newTurnsLeft === 0) {
        await hooks.runEndgameTick(emp.playerId);
      }
      forgivenCount++;
    }
    if (forgivenCount > 0) {
      await db.gameEvent.create({
        data: {
          gameSessionId: sessionId,
          type: "round_timeout",
          message: `Calendar day ${session.dayNumber}: round timer — remaining full turns skipped (${forgivenCount} empires).`,
          details: { empireCount: forgivenCount, dayNumber: session.dayNumber } as object,
        },
      });
    }
  }

  // Re-fetch after potential timeout forfeiture
  const session2 = await getDb().gameSession.findUnique({
    where: { id: sessionId },
    include: {
      players: {
        where: { empire: { turnsLeft: { gt: 0 } } },
        include: { empire: true },
      },
    },
  });
  if (!session2) return false;

  const active = session2.players.filter(
    (p: (typeof session2.players)[number]) => p.empire,
  );
  if (active.length === 0) return false;

  const allDone = active.every(
    (p: (typeof active)[number]) =>
      (p.empire!.fullTurnsUsedThisRound ?? 0) >= session2.actionsPerDay,
  );

  if (!allDone) {
    return false;
  }

  // All players done — advance the calendar day.
  const db = getDb();
  await db.empire.updateMany({
    where: { player: { gameSessionId: sessionId } },
    data: {
      fullTurnsUsedThisRound: 0,
      tickProcessed: false,
      turnOpen: false,
    },
  });

  await db.gameSession.update({
    where: { id: sessionId },
    data: {
      dayNumber: session2.dayNumber + 1,
      roundStartedAt: new Date(),
    },
  });

  await db.gameEvent.create({
    data: {
      gameSessionId: sessionId,
      type: "day_complete",
      message: `Calendar day ${session2.dayNumber} complete — day ${session2.dayNumber + 1} begins.`,
      details: { previousDay: session2.dayNumber } as object,
    },
  });

  hooks.invalidateLeaderboard?.(sessionId);
  hooks.onDayComplete?.(sessionId);

  return true;
}
