import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  register,
  joinGame,
  getGameLog,
  getLeaderboard,
  getHighscores,
  getMessages,
  postMessage,
  uniqueName,
  uniqueGalaxy,
  api,
  postGameOver,
  runAI,
  scheduleTestGalaxyDeletion,
  deleteTestGalaxySession,
  TEST_PASSWORD,
} from "./helpers";

describe("E2E: auxiliary API routes", () => {
  it("GET /api/game/log returns export shape", async () => {
    const { status, data } = await getGameLog();
    expect(status).toBe(200);
    expect(data).toHaveProperty("turnLogs");
    expect(data).toHaveProperty("gameEvents");
    expect(data).toHaveProperty("totalTurnLogs");
    expect(Array.isArray((data as { turnLogs: unknown }).turnLogs)).toBe(true);
  });

  it("GET /api/game/leaderboard returns ranked list", async () => {
    const { status, data } = await getLeaderboard();
    expect(status).toBe(200);
    const lb = (data as { leaderboard: unknown[] }).leaderboard;
    expect(Array.isArray(lb)).toBe(true);
  });

  it("GET /api/game/highscores returns scores array", async () => {
    const { status, data } = await getHighscores();
    expect(status).toBe(200);
    expect(Array.isArray((data as { scores: unknown[] }).scores)).toBe(true);
  });

  it("POST /api/game/gameover returns standings and marks game over", async () => {
    const name = uniqueName("GOE2E");
    const { status: regStatus, data: reg } = await register(name, TEST_PASSWORD, { galaxyName: uniqueGalaxy("GOGal") });
    expect(regStatus).toBe(201);
    scheduleTestGalaxyDeletion((reg as { gameSessionId?: string }).gameSessionId);
    const { status, data } = await postGameOver(name);
    expect(status).toBe(200);
    const d = data as { gameOver: boolean; standings: unknown[]; winner: string };
    expect(d.gameOver).toBe(true);
    expect(Array.isArray(d.standings)).toBe(true);
    expect(d.winner).toBeTruthy();
  });

  it("POST /api/ai/run-all requires gameSessionId", async () => {
    const { status } = await api("/api/ai/run-all", { method: "POST", body: JSON.stringify({}) });
    expect(status).toBe(400);
  });

  it("POST /api/ai/run-all returns results array (empty when human's turn)", async () => {
    const name = uniqueName("RunAllE2E");
    const { data } = await register(name, TEST_PASSWORD, { galaxyName: uniqueGalaxy("RunAllGal") });
    scheduleTestGalaxyDeletion(data.gameSessionId as string);
    const { status, data: out } = await runAI(data.gameSessionId as string);
    expect(status).toBe(200);
    expect(Array.isArray((out as { results: unknown[] }).results)).toBe(true);
  });

  it("POST /api/ai/turn rejects non-AI player", async () => {
    const name = uniqueName("NotAI");
    const { data: reg } = await register(name, TEST_PASSWORD, { galaxyName: uniqueGalaxy("AiTurnGal") });
    scheduleTestGalaxyDeletion((reg as { gameSessionId?: string }).gameSessionId);
    const { status } = await api("/api/ai/turn", {
      method: "POST",
      body: JSON.stringify({ playerName: name }),
    });
    expect(status).toBe(400);
  });

  it("GET /api/game/messages 404 for unknown player", async () => {
    const { status } = await getMessages(`NoSuchPlayer_${Date.now()}`);
    expect(status).toBe(404);
  });

  describe("session-scoped messaging", () => {
    const a = uniqueName("MsgA");
    const b = uniqueName("MsgB");
    const password = TEST_PASSWORD;
    let sessionId: string;

    beforeAll(async () => {
      const { data } = await register(a, password, { galaxyName: uniqueGalaxy("MsgGal") });
      sessionId = data.gameSessionId as string;
      const invite = data.inviteCode as string;
      await joinGame(b, password, { inviteCode: invite });
    });

    afterAll(async () => {
      await deleteTestGalaxySession(sessionId);
    });

    it("POST and GET /api/game/messages", async () => {
      const { status: postSt } = await postMessage(a, b, "Ping from E2E");
      expect(postSt).toBe(201);
      const { status, data } = await getMessages(b);
      expect(status).toBe(200);
      const msgs = (data as { messages: { body: string }[] }).messages;
      expect(msgs.some((m) => m.body.includes("Ping from E2E"))).toBe(true);
    });
  });
});
