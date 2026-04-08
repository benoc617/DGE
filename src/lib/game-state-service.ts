/**
 * Cache-aside helpers for SRX hot read paths.
 * Thin wrappers around @dge/engine/cache with the "srx" namespace.
 *
 * empire:srx:{playerId}          TTL 30s — full player+empire graph
 * leaderboard:srx:{sessionId}    TTL 15s — ranked leaderboard array
 */
import {
  getCachedPlayer as _getCachedPlayer,
  getCachedLeaderboard as _getCachedLeaderboard,
  invalidatePlayer as _invalidatePlayer,
  invalidateLeaderboard as _invalidateLeaderboard,
  invalidatePlayerAndLeaderboard as _invalidatePlayerAndLeaderboard,
} from "@dge/engine/cache";

const NS = "srx";

export async function getCachedPlayer<T>(
  playerId: string,
  fetch: () => Promise<T | null>,
): Promise<T | null> {
  return _getCachedPlayer(NS, playerId, fetch);
}

export async function getCachedLeaderboard<T>(
  sessionId: string,
  fetch: () => Promise<T>,
): Promise<T> {
  return _getCachedLeaderboard(NS, sessionId, fetch);
}

export async function invalidatePlayer(playerId: string): Promise<void> {
  return _invalidatePlayer(NS, playerId);
}

export async function invalidateLeaderboard(sessionId: string): Promise<void> {
  return _invalidateLeaderboard(NS, sessionId);
}

export async function invalidatePlayerAndLeaderboard(
  playerId: string,
  sessionId: string | null | undefined,
): Promise<void> {
  return _invalidatePlayerAndLeaderboard(NS, playerId, sessionId);
}
