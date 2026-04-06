import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { START, generatePlanetName } from "@/lib/game-constants";
import * as rng from "@/lib/rng";
import type { PlanetType } from "@prisma/client";
import { resolvePlayerCredentials } from "@/lib/player-auth";

export async function POST(req: NextRequest) {
  const { name, password, inviteCode, sessionId } = await req.json();

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

  let session;

  if (inviteCode) {
    session = await prisma.gameSession.findUnique({
      where: { inviteCode: inviteCode.toUpperCase().trim() },
    });
    if (!session) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }
  } else if (sessionId) {
    session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (!session.isPublic) {
      return NextResponse.json({ error: "This galaxy requires an invite code" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Provide either inviteCode or sessionId" }, { status: 400 });
  }

  if (session.status !== "active") {
    return NextResponse.json({ error: "This galaxy is no longer active" }, { status: 410 });
  }

  if (session.playerNames.length >= session.maxPlayers) {
    return NextResponse.json({ error: "Galaxy is full" }, { status: 409 });
  }

  const existingPlayer = await prisma.player.findFirst({
    where: { name: cred.playerName, gameSessionId: session.id },
  });
  if (existingPlayer) {
    return NextResponse.json({ error: "Name already taken in this galaxy" }, { status: 409 });
  }

  const planetCreateData = START.PLANETS.flatMap((spec) =>
    Array.from({ length: spec.count }, () => ({
      name: generatePlanetName(),
      sector: rng.randomInt(1, 100),
      type: spec.type as PlanetType,
      longTermProduction: 100,
      shortTermProduction: 100,
    })),
  );

  const player = await prisma.$transaction(async (tx) => {
    const humansBefore = await tx.player.count({
      where: { gameSessionId: session.id, isAI: false },
    });
    const sess = await tx.gameSession.findUnique({ where: { id: session.id } });
    if (!sess) throw new Error("Session missing");

    const isFirstHumanActivating = sess.waitingForHuman && humansBefore === 0;

    let turnOrder: number;
    if (isFirstHumanActivating) {
      await tx.player.updateMany({
        where: { gameSessionId: session.id, isAI: true },
        data: { turnOrder: { increment: 1 } },
      });
      turnOrder = 0;
    } else {
      const maxOrder = await tx.player.aggregate({
        _max: { turnOrder: true },
        where: { gameSessionId: session.id },
      });
      turnOrder = (maxOrder._max.turnOrder ?? 0) + 1;
    }

    const p = await tx.player.create({
      data: {
        name: cred.playerName,
        passwordHash: cred.passwordHash,
        userId: cred.userId,
        turnOrder,
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

    if (isFirstHumanActivating) {
      await tx.gameSession.update({
        where: { id: session.id },
        data: {
          waitingForHuman: false,
          currentTurnPlayerId: p.id,
          turnStartedAt: new Date(),
          playerNames: { push: cred.playerName },
        },
      });
    } else {
      await tx.gameSession.update({
        where: { id: session.id },
        data: { playerNames: { push: cred.playerName } },
      });
    }

    return p;
  });

  return NextResponse.json({
    ...player,
    gameSessionId: session.id,
    galaxyName: session.galaxyName,
  }, { status: 201 });
}
