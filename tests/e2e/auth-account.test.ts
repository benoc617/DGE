import { describe, it, expect } from "vitest";
import { api, register, uniqueName, uniqueGalaxy } from "./helpers";

describe("auth account API", () => {
  it("signup then login returns user and empty games", async () => {
    const u = uniqueName("acct");
    const signup = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: u,
        fullName: "Test Commander",
        email: `${u}@test.invalid`,
        password: "password123",
        passwordConfirm: "password123",
      }),
    });
    expect(signup.status).toBe(201);

    const authLogin = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: u, password: "password123" }),
    });
    expect(authLogin.status).toBe(200);
    const d = authLogin.data as { user: { username: string }; games: unknown[] };
    expect(d.user.username).toBe(u.toLowerCase());
    expect(Array.isArray(d.games)).toBe(true);
    expect(d.games.length).toBe(0);
  });

  it("register links UserAccount and login lists active game", async () => {
    const u = uniqueName("lnk");
    const signup = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: u,
        fullName: "Link Test",
        email: `${u}@test.invalid`,
        password: "password123",
        passwordConfirm: "password123",
      }),
    });
    expect(signup.status).toBe(201);

    const { status, data } = await register(u, "password123", { galaxyName: uniqueGalaxy("AuthLnk") });
    expect(status).toBe(201);
    expect((data as { name?: string }).name).toBe(u.toLowerCase());

    const authLogin = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: u, password: "password123" }),
    });
    expect(authLogin.status).toBe(200);
    const d = authLogin.data as { games: { playerId: string }[] };
    expect(d.games.length).toBe(1);
    expect(d.games[0].playerId).toBeTruthy();
  });
});
