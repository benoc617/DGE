import { describe, it, expect } from "vitest";
import {
  api,
  register,
  joinGame,
  getStatus,
  doTick,
  doAction,
  setupAI,
  getLeaderboard,
  uniqueName,
  uniqueGalaxy,
  completeDoorDaySlots,
  pollStatusUntil,
  scheduleTestGalaxyDeletion,
  TEST_PASSWORD,
} from "./helpers";
import { ACTIONS_PER_DAY, START } from "../../src/lib/game-constants";

describe("door-game simultaneous mode", () => {
  it("two players use POST /action; full turns and round fields", async () => {
    const g = uniqueGalaxy("Door");
    const player1Name = uniqueName("Door1");
    const player2Name = uniqueName("Door2");
    const password = TEST_PASSWORD;

    const r1 = await register(player1Name, password, { galaxyName: g, turnMode: "simultaneous" });
    expect(r1.status).toBe(201);
    scheduleTestGalaxyDeletion((r1.data as { gameSessionId?: string }).gameSessionId);
    const p1Id = (r1.data as { id?: string }).id;
    expect(p1Id).toBeTruthy();

    const r2 = await joinGame(player2Name, password, { inviteCode: (r1.data as { inviteCode?: string }).inviteCode });
    expect(r2.status).toBe(201);

    const s1a = await getStatus(p1Id!);
    expect(s1a.status).toBe(200);
    const d1 = s1a.data as {
      turnMode?: string;
      fullTurnsLeftToday?: number;
      turnOpen?: boolean;
      canAct?: boolean;
      empire?: { fullTurnsUsedThisRound?: number };
    };
    expect(d1.turnMode).toBe("simultaneous");
    expect(d1.fullTurnsLeftToday).toBe(ACTIONS_PER_DAY);
    expect(d1.canAct).toBe(true);

    const t1 = await doTick(player1Name);
    expect(t1.status).toBe(200);

    const s1b = await getStatus(p1Id!);
    const d1b = s1b.data as { turnOpen?: boolean; fullTurnsLeftToday?: number };
    expect(d1b.turnOpen).toBe(true);

    const a1 = await doAction(player1Name, "buy_soldiers", { amount: 1 });
    expect(a1.status).toBe(200);
    expect((a1.data as { success?: boolean }).success).toBe(true);

    const s1c = await getStatus(p1Id!);
    const d1c = s1c.data as {
      fullTurnsLeftToday?: number;
      empire?: { fullTurnsUsedThisRound?: number; turnsLeft?: number };
    };
    expect(d1c.fullTurnsLeftToday).toBe(ACTIONS_PER_DAY - 1);
    expect(d1c.empire?.fullTurnsUsedThisRound).toBe(1);
    expect(d1c.empire?.turnsLeft).toBe(START.TURNS - 1);

    const p2Id = (r2.data as { id?: string }).id;
    const t2 = await doTick(player2Name);
    expect(t2.status).toBe(200);
    const e2 = await doAction(player2Name, "end_turn");
    expect(e2.status).toBe(200);
    const s2 = await getStatus(p2Id!);
    const d2 = s2.data as {
      fullTurnsLeftToday?: number;
      empire?: { fullTurnsUsedThisRound?: number; turnsLeft?: number };
    };
    expect(d2.fullTurnsLeftToday).toBe(ACTIONS_PER_DAY - 1);
    expect(d2.empire?.fullTurnsUsedThisRound).toBe(1);
    expect(d2.empire?.turnsLeft).toBe(START.TURNS - 1);
  });

  it("concurrent POST /action from one player: one 200 and one 409 galaxy busy (advisory lock)", async () => {
    const g = uniqueGalaxy("DoorLock");
    const player1Name = uniqueName("DoorL1");
    const password = TEST_PASSWORD;

    const r1 = await register(player1Name, password, { galaxyName: g, turnMode: "simultaneous" });
    expect(r1.status).toBe(201);
    scheduleTestGalaxyDeletion((r1.data as { gameSessionId?: string }).gameSessionId);

    await doTick(player1Name);
    const [a, b] = await Promise.all([
      api("/api/game/action", {
        method: "POST",
        body: JSON.stringify({ playerName: player1Name, action: "buy_soldiers", amount: 1 }),
      }),
      api("/api/game/action", {
        method: "POST",
        body: JSON.stringify({ playerName: player1Name, action: "buy_soldiers", amount: 1 }),
      }),
    ]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([200, 409]);
    const busyPayload = [a.data, b.data].some(
      (d) => typeof d === "object" && d !== null && (d as { galaxyBusy?: boolean }).galaxyBusy === true,
    );
    expect(busyPayload).toBe(true);
  });

  it("after five full turns each, calendar round rolls; each full turn decremented turnsLeft", async () => {
    const g = uniqueGalaxy("DoorRoll");
    const player1Name = uniqueName("DoorR1");
    const player2Name = uniqueName("DoorR2");
    const password = TEST_PASSWORD;

    const r1 = await register(player1Name, password, { galaxyName: g, turnMode: "simultaneous" });
    expect(r1.status).toBe(201);
    scheduleTestGalaxyDeletion((r1.data as { gameSessionId?: string }).gameSessionId);
    const p1Id = (r1.data as { id?: string }).id!;

    const r2 = await joinGame(player2Name, password, { inviteCode: (r1.data as { inviteCode?: string }).inviteCode });
    expect(r2.status).toBe(201);
    const p2Id = (r2.data as { id?: string }).id!;

    const before1 = await getStatus(p1Id);
    const before2 = await getStatus(p2Id);
    const tl0 = (before1.data as { empire?: { turnsLeft?: number } }).empire?.turnsLeft;
    expect(tl0).toBeDefined();
    expect((before2.data as { empire?: { turnsLeft?: number } }).empire?.turnsLeft).toBe(tl0);

    await completeDoorDaySlots(player1Name);
    await completeDoorDaySlots(player2Name);

    const after1 = await getStatus(p1Id);
    const after2 = await getStatus(p2Id);
    const tl1 = (after1.data as { empire?: { turnsLeft?: number } }).empire?.turnsLeft;
    const tl2 = (after2.data as { empire?: { turnsLeft?: number } }).empire?.turnsLeft;
    expect(tl1).toBe((tl0 ?? 0) - ACTIONS_PER_DAY);
    expect(tl2).toBe((tl0 ?? 0) - ACTIONS_PER_DAY);

    const d1 = after1.data as { dayNumber?: number; fullTurnsLeftToday?: number };
    expect(d1.fullTurnsLeftToday).toBe(ACTIONS_PER_DAY);
    expect(d1.dayNumber).toBe(2);
  });

  it("human can tick with AI in session; status polls run AIs; calendar day rolls when all daily slots done", async () => {
    const g = uniqueGalaxy("DoorAI");
    const humanName = uniqueName("DoorHum");
    const password = TEST_PASSWORD;

    const r1 = await register(humanName, password, { galaxyName: g, turnMode: "simultaneous" });
    expect(r1.status).toBe(201);
    const p1Id = (r1.data as { id?: string }).id!;
    const sessionId = (r1.data as { gameSessionId?: string }).gameSessionId!;
    scheduleTestGalaxyDeletion(sessionId);
    const aiName = "Admiral Koss";

    const aiRes = await setupAI([aiName], sessionId);
    expect(aiRes.status).toBe(200);

    // completeDoorDaySlots opens each slot with doTick (do not pre-tick).
    await completeDoorDaySlots(humanName);

    const fin = await pollStatusUntil(
      p1Id,
      (d) =>
        d.dayNumber === 2 &&
        (d.empire as { turnsLeft?: number } | undefined)?.turnsLeft === START.TURNS - ACTIONS_PER_DAY,
      { timeoutMs: 120_000, intervalMs: 400 },
    );
    expect(fin.dayNumber).toBe(2);
    expect((fin.empire as { turnsLeft?: number }).turnsLeft).toBe(START.TURNS - ACTIONS_PER_DAY);

    const lb = await getLeaderboard(humanName);
    expect(lb.status).toBe(200);
    const rows = (lb.data as { leaderboard?: { name: string; turnsPlayed?: number }[] }).leaderboard ?? [];
    const aiRow = rows.find((x) => x.name === aiName);
    expect(aiRow).toBeDefined();
    const humanTp = (fin.empire as { turnsPlayed?: number }).turnsPlayed ?? 0;
    const aiTp = (aiRow as { turnsPlayed?: number }).turnsPlayed ?? 0;
    expect(humanTp).toBe(ACTIONS_PER_DAY);
    expect(aiTp).toBeGreaterThanOrEqual(ACTIONS_PER_DAY);
  }, 180_000);
});
