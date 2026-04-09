/**
 * E2E tests for chess — covers registration, status, moves, and AI play.
 */

import { describe, it, expect, afterAll } from "vitest";
import {
  api, getStatus, doAction,
  deleteTestGalaxySession, scheduleTestGalaxyDeletion,
  scheduleTestUserDeletion,
  uniqueGalaxy, uniqueName,
  TEST_PASSWORD,
} from "./helpers";

const CHESS_GALAXY = uniqueGalaxy("ChessE2E");
const CHESS_USER = uniqueName("chess_e2e");
let sessionId: string | null = null;
let playerId: string | null = null;

afterAll(async () => {
  if (sessionId) await deleteTestGalaxySession(sessionId);
  scheduleTestUserDeletion(CHESS_USER);
});

describe("Chess E2E", () => {
  it("registers a chess game session", async () => {
    // Sign up
    const signupRes = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: CHESS_USER,
        fullName: "Chess Test",
        email: `${CHESS_USER}@test.local`,
        password: TEST_PASSWORD,
        passwordConfirm: TEST_PASSWORD,
      }),
    });
    expect([201, 409].includes(signupRes.status)).toBe(true);

    // Register chess game
    const res = await api("/api/game/register", {
      method: "POST",
      body: JSON.stringify({
        name: CHESS_USER,
        password: TEST_PASSWORD,
        game: "chess",
        galaxyName: CHESS_GALAXY,
      }),
    });
    expect(res.status).toBe(201);
    const data = res.data as Record<string, unknown>;
    expect(data.game).toBe("chess");
    sessionId = data.gameSessionId as string;
    playerId = data.id as string;
    expect(sessionId).toBeTruthy();
    expect(playerId).toBeTruthy();
    scheduleTestGalaxyDeletion(sessionId);
  });

  it("returns chess status with board", async () => {
    expect(playerId).toBeTruthy();
    const res = await getStatus(playerId!);
    expect(res.status).toBe(200);
    const data = res.data as Record<string, unknown>;
    expect(data.myColor).toBe("white");
    expect(data.isYourTurn).toBe(true);
    expect(data.gameStatus).toBe("playing");
    expect(data.board).toBeDefined();
    expect(Array.isArray(data.board)).toBe(true);
    expect((data.board as unknown[]).length).toBe(8);
    expect(data.moveHistory).toEqual([]);
    expect(data.capturedByWhite).toEqual([]);
    expect(data.capturedByBlack).toEqual([]);
  });

  it("returns legal moves via chess moves endpoint", async () => {
    expect(playerId).toBeTruthy();
    const res = await api(`/api/game/chess/moves?id=${playerId}`);
    expect(res.status).toBe(200);
    const data = res.data as { moves: { from: string; to: string }[] };
    expect(data.moves.length).toBe(20); // 20 legal opening moves
  });

  it("makes a move (e2e4)", async () => {
    expect(playerId).toBeTruthy();
    const res = await doAction(CHESS_USER, "move", { move: "e2e4" });
    expect(res.status).toBe(200);
    const data = res.data as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect((data.message as string)).toContain("e2e4");
  });

  it("AI responds (waits for AI move)", async () => {
    expect(playerId).toBeTruthy();
    // Poll status until it's our turn again (AI should move)
    let isOurTurn = false;
    for (let i = 0; i < 30; i++) {
      const res = await getStatus(playerId!);
      const data = res.data as Record<string, unknown>;
      if (data.isYourTurn === true) {
        isOurTurn = true;
        // Verify move history includes AI's move
        const history = data.moveHistory as string[];
        expect(history.length).toBeGreaterThanOrEqual(2);
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(isOurTurn).toBe(true);
  }, 60000); // long timeout for MCTS

  it("rejects illegal moves", async () => {
    expect(playerId).toBeTruthy();
    const res = await doAction(CHESS_USER, "move", { move: "a1a8" });
    expect(res.status).toBe(200);
    const data = res.data as Record<string, unknown>;
    expect(data.success).toBe(false);
    expect((data.message as string)).toContain("Illegal");
  });

  it("can resign", async () => {
    expect(playerId).toBeTruthy();
    const res = await doAction(CHESS_USER, "resign");
    expect(res.status).toBe(200);
    const data = res.data as Record<string, unknown>;
    expect(data.success).toBe(true);

    // Verify game is over
    const statusRes = await getStatus(playerId!);
    const statusData = statusRes.data as Record<string, unknown>;
    expect(statusData.gameStatus).toBe("resigned");
    expect(statusData.winner).toBe("black");
  });

  it("returns 410 for actions after game over", async () => {
    expect(playerId).toBeTruthy();
    const res = await doAction(CHESS_USER, "move", { move: "e2e4" });
    expect(res.status).toBe(410);
  });
});
