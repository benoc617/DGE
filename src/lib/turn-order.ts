import { prisma } from "@/lib/prisma";
import { processAction, runAndPersistTick } from "@/lib/game-engine";

export interface TurnOrderInfo {
  currentPlayerId: string;
  currentPlayerName: string;
  isAI: boolean;
  turnStartedAt: string;
  turnDeadline: string;
  order: { name: string; isAI: boolean; turnOrder: number; isCurrent: boolean }[];
}

type ActivePlayer = { id: string; name: string; isAI: boolean; turnOrder: number };

/**
 * True when the session cannot have an active turn: admin lobby (`waitingForHuman`)
 * or timer not started (`turnStartedAt` null). Exported for unit tests.
 */
export function sessionCannotHaveActiveTurn(session: {
  waitingForHuman: boolean;
  turnStartedAt: Date | null;
}): boolean {
  return session.waitingForHuman || session.turnStartedAt == null;
}

/**
 * Get the ordered list of active players in a session.
 */
async function getActivePlayers(gameSessionId: string): Promise<ActivePlayer[]> {
  return prisma.player.findMany({
    where: { gameSessionId, empire: { turnsLeft: { gt: 0 } } },
    orderBy: { turnOrder: "asc" },
    select: { id: true, name: true, isAI: true, turnOrder: true },
  });
}

/**
 * Find the next player after the given one in turn order.
 * Wraps around to the beginning.
 */
function nextPlayer(players: ActivePlayer[], currentId: string): ActivePlayer {
  const idx = players.findIndex((p) => p.id === currentId);
  return players[(idx + 1) % players.length];
}

/**
 * Resolve who the current turn player actually is.
 * If currentTurnPlayerId is null or points to an eliminated player,
 * falls back to the first player in turnOrder.
 */
function resolveCurrentPlayer(players: ActivePlayer[], storedId: string | null): ActivePlayer {
  if (storedId) {
    const found = players.find((p) => p.id === storedId);
    if (found) return found;
  }
  return players[0];
}

function buildInfo(
  current: ActivePlayer,
  players: ActivePlayer[],
  turnStartedAt: Date,
  turnTimeoutSecs: number,
): TurnOrderInfo {
  const deadline = new Date(turnStartedAt.getTime() + turnTimeoutSecs * 1000);
  return {
    currentPlayerId: current.id,
    currentPlayerName: current.name,
    isAI: current.isAI,
    turnStartedAt: turnStartedAt.toISOString(),
    turnDeadline: deadline.toISOString(),
    order: players.map((p) => ({
      name: p.name,
      isAI: p.isAI,
      turnOrder: p.turnOrder,
      isCurrent: p.id === current.id,
    })),
  };
}

/**
 * Get the player whose turn it is right now in a session.
 * If the current player has timed out, auto-skip them first.
 */
export async function getCurrentTurn(gameSessionId: string): Promise<TurnOrderInfo | null> {
  for (let guard = 0; guard < 20; guard++) {
    const session = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      select: {
        currentTurnPlayerId: true,
        turnStartedAt: true,
        turnTimeoutSecs: true,
        waitingForHuman: true,
      },
    });
    if (!session) return null;

    if (sessionCannotHaveActiveTurn(session)) return null;
    const turnStartedAt = session.turnStartedAt!;

    const players = await getActivePlayers(gameSessionId);
    if (players.length === 0) return null;

    const current = resolveCurrentPlayer(players, session.currentTurnPlayerId);

    // Sync currentTurnPlayerId if it was null or stale
    if (session.currentTurnPlayerId !== current.id) {
      await prisma.gameSession.update({
        where: { id: gameSessionId },
        data: { currentTurnPlayerId: current.id },
      });
    }

    const deadline = new Date(turnStartedAt.getTime() + session.turnTimeoutSecs * 1000);

    // Auto-skip timed-out human players
    if (!current.isAI && new Date() > deadline) {
      await runAndPersistTick(current.id);
      await processAction(current.id, "end_turn");
      const next = nextPlayer(players, current.id);
      await prisma.gameSession.update({
        where: { id: gameSessionId },
        data: { currentTurnPlayerId: next.id, turnStartedAt: new Date() },
      });
      continue;
    }

    return buildInfo(current, players, turnStartedAt, session.turnTimeoutSecs);
  }

  return null;
}

/**
 * Advance to the next player in turn order. Resets the turn timer.
 */
export async function advanceTurn(gameSessionId: string): Promise<TurnOrderInfo | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: gameSessionId },
    select: { currentTurnPlayerId: true, turnTimeoutSecs: true, waitingForHuman: true },
  });
  if (!session || session.waitingForHuman) return null;

  const players = await getActivePlayers(gameSessionId);
  if (players.length === 0) return null;

  const current = resolveCurrentPlayer(players, session.currentTurnPlayerId);
  const next = nextPlayer(players, current.id);
  const now = new Date();

  await prisma.gameSession.update({
    where: { id: gameSessionId },
    data: { currentTurnPlayerId: next.id, turnStartedAt: now },
  });

  return buildInfo(next, players, now, session.turnTimeoutSecs);
}
