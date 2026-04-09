/**
 * Session log export and purge.
 *
 * When a game completes (all players reach turnsLeft=0), dumps all TurnLog
 * and GameEvent rows to stdout as [srx-gamelog] JSON lines, then deletes them.
 * This keeps the DB lean while preserving a full audit trail in Docker logs.
 *
 * The admin maintenance API uses `dumpAndPurgeSessionLogs` to manually purge
 * completed sessions' logs on demand.
 */

import { prisma } from "./prisma";

/**
 * Dump all TurnLog + GameEvent rows for a session to stdout, then delete them.
 * Returns row counts for the caller's confirmation.
 */
export async function dumpAndPurgeSessionLogs(sessionId: string): Promise<{ turnLogCount: number; gameEventCount: number }> {
  const players = await prisma.player.findMany({
    where: { gameSessionId: sessionId },
    select: { id: true, name: true },
  });
  const playerIds = players.map((p) => p.id);

  const [turnLogs, gameEvents] = await Promise.all([
    playerIds.length > 0
      ? prisma.turnLog.findMany({
          where: { playerId: { in: playerIds } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.gameEvent.findMany({
      where: { gameSessionId: sessionId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  console.info("[srx-gamelog]", JSON.stringify({
    type: "session_log_dump_start",
    sessionId,
    turnLogCount: turnLogs.length,
    gameEventCount: gameEvents.length,
  }));
  for (const log of turnLogs) {
    console.info("[srx-gamelog]", JSON.stringify({ type: "turn_log", sessionId, ...log }));
  }
  for (const event of gameEvents) {
    console.info("[srx-gamelog]", JSON.stringify({ logKind: "game_event", ...event }));
  }

  await prisma.$transaction(async (tx) => {
    if (playerIds.length > 0) {
      await tx.turnLog.deleteMany({ where: { playerId: { in: playerIds } } });
    }
    await tx.gameEvent.deleteMany({ where: { gameSessionId: sessionId } });
  });

  console.info("[srx-gamelog]", JSON.stringify({
    type: "session_log_purge_complete",
    sessionId,
    turnLogCount: turnLogs.length,
    gameEventCount: gameEvents.length,
  }));

  return { turnLogCount: turnLogs.length, gameEventCount: gameEvents.length };
}

/**
 * Check if all empires in the session have finished (turnsLeft === 0).
 * If so, fire-and-forget dump + purge. Safe to call after every player's endgame tick.
 */
export function dumpAndPurgeSessionLogsIfComplete(sessionId: string): void {
  void (async () => {
    try {
      const activeCount = await prisma.empire.count({
        where: { player: { gameSessionId: sessionId }, turnsLeft: { gt: 0 } },
      });
      if (activeCount > 0) return;
      await dumpAndPurgeSessionLogs(sessionId);
    } catch (err) {
      console.error("[srx-gamelog] auto-purge error", sessionId, err);
    }
  })();
}
