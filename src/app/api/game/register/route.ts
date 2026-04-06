import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { START, generatePlanetName } from "@/lib/game-constants";
import * as rng from "@/lib/rng";
import type { PlanetType } from "@prisma/client";
import { randomBytes } from "crypto";
import { clampMaxPlayers } from "@/lib/auth";
import { resolvePlayerCredentials } from "@/lib/player-auth";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function POST(req: NextRequest) {
  const { name, password, galaxyName, isPublic, turnTimeoutSecs, maxPlayers } = await req.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const cred = await resolvePlayerCredentials(name, password);
  if ("error" in cred) {
    return NextResponse.json({ error: cred.error }, { status: cred.status });
  }

  if (galaxyName && galaxyName.trim().length < 2) {
    return NextResponse.json({ error: "Galaxy name must be at least 2 characters" }, { status: 400 });
  }

  if (galaxyName) {
    const existingGalaxy = await prisma.gameSession.findUnique({
      where: { galaxyName: galaxyName.trim() },
    });
    if (existingGalaxy) {
      return NextResponse.json({ error: "Galaxy name already taken" }, { status: 409 });
    }
  }

  const inviteCode = generateInviteCode();
  const timeout = typeof turnTimeoutSecs === "number" && turnTimeoutSecs > 0 ? turnTimeoutSecs : 86400;
  const cap = clampMaxPlayers(maxPlayers);

  const now = new Date();
  const session = await prisma.gameSession.create({
    data: {
      galaxyName: galaxyName?.trim() || null,
      createdBy: cred.playerName,
      isPublic: isPublic !== false,
      inviteCode,
      maxPlayers: cap,
      playerNames: [cred.playerName],
      totalTurns: START.TURNS,
      turnTimeoutSecs: timeout,
      waitingForHuman: false,
      turnStartedAt: now,
    },
  });

  const planetCreateData = START.PLANETS.flatMap((spec) =>
    Array.from({ length: spec.count }, () => ({
      name: generatePlanetName(),
      sector: rng.randomInt(1, 100),
      type: spec.type as PlanetType,
      longTermProduction: 100,
      shortTermProduction: 100,
    })),
  );

  const player = await prisma.player.create({
    data: {
      name: cred.playerName,
      passwordHash: cred.passwordHash,
      userId: cred.userId,
      gameSessionId: session.id,
      empire: {
        create: {
          credits: START.CREDITS,
          food: START.FOOD,
          ore: START.ORE,
          fuel: START.FUEL,
          population: START.POPULATION,
          taxRate: START.TAX_RATE,
          turnsLeft: START.TURNS,
          protectionTurns: START.PROTECTION_TURNS,
          planets: { create: planetCreateData },
          army: {
            create: {
              soldiers: START.SOLDIERS,
              generals: START.GENERALS,
              fighters: START.FIGHTERS,
            },
          },
          supplyRates: { create: {} },
          research: { create: {} },
        },
      },
    },
    include: {
      empire: { include: { planets: true, army: true, supplyRates: true } },
    },
  });

  await prisma.gameSession.update({
    where: { id: session.id },
    data: { currentTurnPlayerId: player.id },
  });

  const marketCount = await prisma.market.count();
  if (marketCount === 0) {
    await prisma.market.create({ data: {} });
  }

  return NextResponse.json(
    {
      ...player,
      gameSessionId: session.id,
      inviteCode: session.inviteCode,
      galaxyName: session.galaxyName,
      isPublic: session.isPublic,
      maxPlayers: session.maxPlayers,
    },
    { status: 201 },
  );
}
