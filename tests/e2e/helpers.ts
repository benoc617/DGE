/**
 * E2E test helpers — talks to the running dev server via HTTP.
 * Use `npm run test:e2e` (starts Next automatically) or run `npm run dev` and `vitest run tests/e2e`.
 */

import { ACTIONS_PER_DAY } from "../../src/lib/game-constants";

export const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** For E2E that must hit a rival (guerrilla, etc.): clear new-empire protection on named players. */
export async function clearNewEmpireProtectionForPlayers(names: string[]) {
  const { prisma } = await import("@/lib/prisma");
  await prisma.empire.updateMany({
    where: { player: { name: { in: names } } },
    data: { isProtected: false, protectionTurns: 0 },
  });
}

export async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { _parseError: true as const, raw: text.slice(0, 500) };
    }
  }
  return { status: res.status, data };
}

export async function register(
  name: string,
  password: string,
  opts?: { galaxyName?: string; isPublic?: boolean; turnMode?: "sequential" | "simultaneous" },
) {
  return api("/api/game/register", {
    method: "POST",
    body: JSON.stringify({ name, password, ...opts }),
  });
}

export async function login(name: string, password: string) {
  return api("/api/game/status", {
    method: "POST",
    body: JSON.stringify({ name, password }),
  });
}

export async function joinGame(name: string, password: string, opts: { inviteCode?: string; sessionId?: string }) {
  return api("/api/game/join", {
    method: "POST",
    body: JSON.stringify({ name, password, ...opts }),
  });
}

export async function getStatus(playerId: string) {
  return api(`/api/game/status?id=${playerId}`);
}

export async function doAction(playerName: string, action: string, params?: Record<string, unknown>) {
  return api("/api/game/action", {
    method: "POST",
    body: JSON.stringify({ playerName, action, ...params }),
  });
}

/** Run the turn tick for the current player (situation report). Idempotent if already processed. */
export async function doTick(playerName: string) {
  return api("/api/game/tick", {
    method: "POST",
    body: JSON.stringify({ playerName }),
  });
}

/**
 * Poll GET /api/game/status until predicate holds. Status polls also trigger door-game AI catch-up.
 */
export async function pollStatusUntil(
  playerId: string,
  predicate: (data: Record<string, unknown>) => boolean,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<Record<string, unknown>> {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const intervalMs = opts?.intervalMs ?? 400;
  const start = Date.now();
  let last: Record<string, unknown> = {};
  while (Date.now() - start < timeoutMs) {
    const s = await getStatus(playerId);
    last = (s.data ?? {}) as Record<string, unknown>;
    if (s.status === 200 && predicate(last)) return last;
    await sleep(intervalMs);
  }
  throw new Error(`pollStatusUntil timeout after ${timeoutMs}ms; last=${JSON.stringify(last).slice(0, 800)}`);
}

/** One commander uses all daily full-turn slots (tick + end_turn each). */
export async function completeDoorDaySlots(playerName: string, slots = ACTIONS_PER_DAY) {
  for (let i = 0; i < slots; i++) {
    const t = await doTick(playerName);
    if (t.status !== 200) {
      throw new Error(`doTick failed: ${t.status} ${JSON.stringify(t.data)}`);
    }
    const e = await doAction(playerName, "end_turn");
    if (e.status !== 200) {
      throw new Error(`end_turn failed: ${e.status} ${JSON.stringify(e.data)}`);
    }
    if (!(e.data as { success?: boolean }).success) {
      throw new Error(`end_turn not success: ${JSON.stringify(e.data)}`);
    }
  }
}

export async function setupAI(names: string[], gameSessionId: string) {
  return api("/api/ai/setup", {
    method: "POST",
    body: JSON.stringify({ names, gameSessionId }),
  });
}

export async function runAI(gameSessionId: string) {
  return api("/api/ai/run-all", {
    method: "POST",
    body: JSON.stringify({ gameSessionId }),
  });
}

export async function getLobbies() {
  return api("/api/game/lobbies");
}

export async function getSession(sessionId: string) {
  return api(`/api/game/session?id=${sessionId}`);
}

export async function patchSession(sessionId: string, playerName: string, isPublic: boolean) {
  return api("/api/game/session", {
    method: "PATCH",
    body: JSON.stringify({ sessionId, playerName, isPublic }),
  });
}

/** Generate a unique name to avoid collisions between test runs */
export function uniqueName(prefix = "TestCmdr") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function uniqueGalaxy(prefix = "TestGalaxy") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function getGameLog(playerName?: string) {
  const q = playerName ? `?player=${encodeURIComponent(playerName)}` : "";
  return api(`/api/game/log${q}`);
}

export async function getLeaderboard(playerName?: string) {
  const q = playerName ? `?player=${encodeURIComponent(playerName)}` : "";
  return api(`/api/game/leaderboard${q}`);
}

export async function getHighscores() {
  return api("/api/game/highscores");
}

export async function postGameOver(playerName: string) {
  return api("/api/game/gameover", {
    method: "POST",
    body: JSON.stringify({ playerName }),
  });
}

export async function getMessages(playerName: string) {
  return api(`/api/game/messages?player=${encodeURIComponent(playerName)}`);
}

export async function postMessage(fromName: string, toName: string, body: string, subject?: string) {
  return api("/api/game/messages", {
    method: "POST",
    body: JSON.stringify({ fromName, toName, body, ...(subject ? { subject } : {}) }),
  });
}

/** Parse first `name=value` from Set-Cookie for Cookie header replay in Node fetch. */
export function cookieHeaderFromSetCookie(setCookie: string | null): string | undefined {
  if (!setCookie) return undefined;
  return setCookie.split(";")[0]?.trim() || undefined;
}

export async function adminLogin(username = "admin", password = "srxpass") {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const raw = res.headers.get("set-cookie");
  return { status: res.status, cookie: cookieHeaderFromSetCookie(raw) };
}

export async function adminGalaxies(cookie: string) {
  return fetch(`${BASE}/api/admin/galaxies`, {
    headers: { Cookie: cookie },
  }).then(async (r) => ({
    status: r.status,
    data: r.headers.get("content-type")?.includes("json") ? await r.json() : null,
  }));
}

export async function adminCreateGalaxy(
  cookie: string,
  body: { galaxyName?: string; isPublic?: boolean; aiNames?: string[] },
) {
  return fetch(`${BASE}/api/admin/galaxies`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  }).then(async (r) => ({
    status: r.status,
    data: r.headers.get("content-type")?.includes("json") ? await r.json() : null,
  }));
}

export async function adminDeleteGalaxies(cookie: string, ids: string[]) {
  return fetch(`${BASE}/api/admin/galaxies`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ ids }),
  }).then(async (r) => ({
    status: r.status,
    data: r.headers.get("content-type")?.includes("json") ? await r.json() : null,
  }));
}

/** Remove E2E game sessions via admin API (default admin / srxpass). No-op if login fails. */
export async function deleteTestGalaxySessions(sessionIds: string[]): Promise<void> {
  const ids = [...new Set(sessionIds.filter(Boolean))];
  if (ids.length === 0) return;
  const { status, cookie } = await adminLogin();
  if (status !== 200 || !cookie) return;
  try {
    await adminDeleteGalaxies(cookie, ids);
  } finally {
    await adminLogout(cookie);
  }
}

export async function deleteTestGalaxySession(sessionId: string | undefined | null): Promise<void> {
  if (!sessionId) return;
  await deleteTestGalaxySessions([sessionId]);
}

let pendingGalaxyDeletes: string[] = [];

/** Queue a session for deletion after the current test (see `tests/e2e/setup.ts` + `flushScheduledTestGalaxyDeletions`). */
export function scheduleTestGalaxyDeletion(sessionId: string | undefined | null) {
  if (sessionId) pendingGalaxyDeletes.push(sessionId);
}

export async function flushScheduledTestGalaxyDeletions(): Promise<void> {
  const ids = [...new Set(pendingGalaxyDeletes)];
  pendingGalaxyDeletes = [];
  await deleteTestGalaxySessions(ids);
}

/**
 * Remove `UserAccount` rows created during E2E (signup). Unlinks `Player.userId` first so FK is satisfied.
 * Uses Prisma (same process as the app under test — run E2E against a server that shares this DB).
 */
export async function deleteTestUserAccountsByUsernames(usernames: string[]): Promise<void> {
  const normalized = [...new Set(usernames.map((u) => u.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return;
  const { prisma } = await import("@/lib/prisma");
  const accounts = await prisma.userAccount.findMany({
    where: { username: { in: normalized } },
    select: { id: true },
  });
  for (const { id } of accounts) {
    await prisma.player.updateMany({ where: { userId: id }, data: { userId: null } });
    await prisma.userAccount.delete({ where: { id } }).catch(() => {});
  }
}

let pendingUserDeletes: string[] = [];

/** Queue a username for `UserAccount` deletion after the current test (runs after galaxy flush). */
export function scheduleTestUserDeletion(username: string | undefined | null) {
  if (username) pendingUserDeletes.push(username.trim().toLowerCase());
}

export async function flushScheduledTestUserDeletions(): Promise<void> {
  const names = [...new Set(pendingUserDeletes)];
  pendingUserDeletes = [];
  await deleteTestUserAccountsByUsernames(names);
}

export async function adminLogout(cookie: string) {
  return fetch(`${BASE}/api/admin/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  }).then((r) => ({ status: r.status }));
}

export async function adminChangePassword(cookie: string, currentPassword: string, newPassword: string) {
  return fetch(`${BASE}/api/admin/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ currentPassword, newPassword }),
  }).then(async (r) => ({
    status: r.status,
    data: r.headers.get("content-type")?.includes("json") ? await r.json() : null,
  }));
}

/** Clears DB-stored admin password so login uses `INITIAL_ADMIN_PASSWORD` env only. For E2E isolation. */
export async function resetAdminPasswordOverride() {
  const { prisma } = await import("@/lib/prisma");
  await prisma.adminSettings.deleteMany();
}

/** Clears `SystemSettings` row so integration tests start from env-only. */
export async function resetSystemSettings() {
  const { prisma } = await import("@/lib/prisma");
  await prisma.systemSettings.deleteMany();
}

export async function adminGetSettings(cookie: string) {
  return fetch(`${BASE}/api/admin/settings`, {
    headers: { Cookie: cookie },
  }).then(async (r) => ({
    status: r.status,
    data: r.headers.get("content-type")?.includes("json") ? await r.json() : null,
  }));
}

export async function adminPatchSettings(cookie: string, body: Record<string, unknown>) {
  return fetch(`${BASE}/api/admin/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  }).then(async (r) => ({
    status: r.status,
    data: r.headers.get("content-type")?.includes("json") ? await r.json() : null,
  }));
}

export async function adminListUsers(cookie: string) {
  return fetch(`${BASE}/api/admin/users`, {
    headers: { Cookie: cookie },
  }).then(async (r) => ({
    status: r.status,
    data: r.headers.get("content-type")?.includes("json") ? await r.json() : null,
  }));
}

export async function adminSetUserPassword(cookie: string, userId: string, newPassword: string) {
  return fetch(`${BASE}/api/admin/users`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ userId, newPassword }),
  }).then(async (r) => ({
    status: r.status,
    data: r.headers.get("content-type")?.includes("json") ? await r.json() : null,
  }));
}

export async function adminDeleteUser(cookie: string, userId: string) {
  return fetch(`${BASE}/api/admin/users?id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  }).then(async (r) => ({
    status: r.status,
    data: r.headers.get("content-type")?.includes("json") ? await r.json() : null,
  }));
}
