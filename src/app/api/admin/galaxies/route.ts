import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { createAIPlayersForSession } from "@/lib/create-ai-players";
import { deleteGameSession } from "@/lib/delete-game-session";
import { START } from "@/lib/game-constants";

async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const clash = await prisma.gameSession.findUnique({ where: { inviteCode: code } });
    if (!clash) return code;
  }
  throw new Error("Could not allocate invite code");
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const sessions = await prisma.gameSession.findMany({
    where: { status: "active" },
    include: {
      players: { select: { isAI: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  const list = sessions.map((s) => {
    const humans = s.players.filter((p) => !p.isAI).length;
    const ais = s.players.filter((p) => p.isAI).length;
    return {
      id: s.id,
      galaxyName: s.galaxyName,
      inviteCode: s.inviteCode,
      isPublic: s.isPublic,
      createdBy: s.createdBy,
      waitingForHuman: s.waitingForHuman,
      turnStartedAt: s.turnStartedAt?.toISOString() ?? null,
      turnTimeoutSecs: s.turnTimeoutSecs,
      currentTurnPlayerId: s.currentTurnPlayerId,
      playerCount: s.players.length,
      humanCount: humans,
      aiCount: ais,
      maxPlayers: s.maxPlayers,
      startedAt: s.startedAt.toISOString(),
    };
  });

  return NextResponse.json({ galaxies: list });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const rawName = typeof body.galaxyName === "string" ? body.galaxyName.trim() : "";
  const galaxyName = rawName.length >= 2 ? rawName : null;
  const isPublic = body.isPublic !== false;
  const aiNames = Array.isArray(body.aiNames) ? body.aiNames.filter((x: unknown) => typeof x === "string") : [];

  if (galaxyName) {
    const taken = await prisma.gameSession.findFirst({ where: { galaxyName, status: "active" } });
    if (taken) {
      return NextResponse.json({ error: "Session name already taken" }, { status: 409 });
    }
  }

  const inviteCode = await generateUniqueInviteCode();

  const session = await prisma.gameSession.create({
    data: {
      galaxyName,
      createdBy: "admin",
      isPublic,
      inviteCode,
      playerNames: [],
      totalTurns: START.TURNS,
      waitingForHuman: true,
      turnStartedAt: null,
      currentTurnPlayerId: null,
    },
  });

  if (aiNames.length > 0) {
    await createAIPlayersForSession(session.id, aiNames);
  }

  const marketCount = await prisma.market.count();
  if (marketCount === 0) {
    await prisma.market.create({ data: {} });
  }

  return NextResponse.json(
    {
      sessionId: session.id,
      inviteCode: session.inviteCode,
      galaxyName: session.galaxyName,
      waitingForHuman: session.waitingForHuman,
    },
    { status: 201 },
  );
}

/** Body: `{ ids: string[] }` — session CUIDs to delete (per-row or bulk). */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Request body must include ids: string[]" }, { status: 400 });
  }

  const results: { id: string; ok: boolean }[] = [];
  for (const id of ids) {
    const ok = await deleteGameSession(id);
    results.push({ id, ok });
  }

  const deleted = results.filter((r) => r.ok).length;
  return NextResponse.json({ deleted, results });
}
