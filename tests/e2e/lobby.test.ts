import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  register,
  joinGame,
  getLobbies,
  getSession,
  patchSession,
  uniqueName,
  uniqueGalaxy,
  deleteTestGalaxySession,
  TEST_PASSWORD,
} from "./helpers";

describe("E2E: Lobby System", () => {
  describe("public galaxy", () => {
    const galaxy = uniqueGalaxy("PubLobby");
    const creatorName = uniqueName("Creator");
    const joinerName = uniqueName("Joiner");
    const password = TEST_PASSWORD;
    let sessionId: string;

    beforeAll(async () => {
      const { data } = await register(creatorName, password, { galaxyName: galaxy, isPublic: true });
      sessionId = data.gameSessionId;
    });

    afterAll(async () => {
      await deleteTestGalaxySession(sessionId);
    });

    it("public galaxy appears in lobby list", async () => {
      const { status, data } = await getLobbies();
      expect(status).toBe(200);
      const found = data.find((l: { galaxyName: string }) => l.galaxyName === galaxy);
      expect(found).toBeDefined();
      expect(found.createdBy).toBe(creatorName);
    });

    it("can join a public galaxy by sessionId (no invite code)", async () => {
      const { status, data } = await joinGame(joinerName, password, { sessionId });
      expect(status).toBe(201);
      expect(data.gameSessionId).toBe(sessionId);
    });

    it("session shows both players", async () => {
      const { data } = await getSession(sessionId);
      expect(data.playerNames).toContain(creatorName);
      expect(data.playerNames).toContain(joinerName);
    });
  });

  describe("private galaxy", () => {
    const galaxy = uniqueGalaxy("PrivLobby");
    const creatorName = uniqueName("PrivCreator");
    const joinerName = uniqueName("PrivJoiner");
    const password = TEST_PASSWORD;
    let sessionId: string;
    let inviteCode: string;

    beforeAll(async () => {
      const { data } = await register(creatorName, password, { galaxyName: galaxy, isPublic: false });
      sessionId = data.gameSessionId;
      inviteCode = data.inviteCode;
    });

    afterAll(async () => {
      await deleteTestGalaxySession(sessionId);
    });

    it("private galaxy does NOT appear in lobby list", async () => {
      const { data } = await getLobbies();
      const found = data.find((l: { galaxyName: string }) => l.galaxyName === galaxy);
      expect(found).toBeUndefined();
    });

    it("cannot join private galaxy by sessionId alone", async () => {
      const { status } = await joinGame(joinerName, password, { sessionId });
      expect(status).toBe(403);
    });

    it("can join private galaxy with invite code", async () => {
      const { status, data } = await joinGame(joinerName, password, { inviteCode });
      expect(status).toBe(201);
    });
  });

  describe("visibility toggle", () => {
    const galaxy = uniqueGalaxy("ToggleLobby");
    const creatorName = uniqueName("ToggleCreator");
    const otherName = uniqueName("ToggleOther");
    const password = TEST_PASSWORD;
    let sessionId: string;

    beforeAll(async () => {
      const { data } = await register(creatorName, password, { galaxyName: galaxy, isPublic: true });
      sessionId = data.gameSessionId;
    });

    afterAll(async () => {
      await deleteTestGalaxySession(sessionId);
    });

    it("creator can make galaxy private", async () => {
      const { status, data } = await patchSession(sessionId, creatorName, false);
      expect(status).toBe(200);
      expect(data.isPublic).toBe(false);
    });

    it("non-creator cannot toggle visibility", async () => {
      const { status } = await patchSession(sessionId, "someone_else", true);
      expect(status).toBe(403);
    });

    it("creator can make it public again", async () => {
      const { data } = await patchSession(sessionId, creatorName, true);
      expect(data.isPublic).toBe(true);
    });
  });

  describe("capacity", () => {
    const galaxy = uniqueGalaxy("CapLobby");
    const creatorName = uniqueName("CapCreator");
    const password = TEST_PASSWORD;
    let inviteCode: string;
    let sessionId: string;

    beforeAll(async () => {
      const { data } = await register(creatorName, password, { galaxyName: galaxy });
      inviteCode = data.inviteCode;
      sessionId = data.gameSessionId;
    });

    afterAll(async () => {
      await deleteTestGalaxySession(sessionId);
    });

    it("rejects duplicate name in same galaxy", async () => {
      const { status } = await joinGame(creatorName, password, { inviteCode });
      expect(status).toBe(409);
    });
  });

  describe("galaxy name uniqueness", () => {
    const galaxy = uniqueGalaxy("UniqueName");
    const password = TEST_PASSWORD;
    let sessionId: string;

    beforeAll(async () => {
      const { data } = await register(uniqueName(), password, { galaxyName: galaxy });
      sessionId = data.gameSessionId;
    });

    afterAll(async () => {
      await deleteTestGalaxySession(sessionId);
    });

    it("rejects duplicate galaxy name", async () => {
      const { status, data } = await register(uniqueName(), password, { galaxyName: galaxy });
      expect(status).toBe(409);
    });
  });
});
