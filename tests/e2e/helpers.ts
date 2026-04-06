/**
 * E2E test helpers — talks to the running dev server via HTTP.
 * Use `npm run test:e2e` (starts Next automatically) or run `npm run dev` and `vitest run tests/e2e`.
 */

export const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

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

export async function register(name: string, password: string, opts?: { galaxyName?: string; isPublic?: boolean }) {
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
