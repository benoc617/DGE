import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CIVIL_STATUS_NAMES, PLANET_CONFIG } from "@/lib/game-constants";
import { getCurrentTurn } from "@/lib/turn-order";
import bcrypt from "bcryptjs";

const playerInclude = {
  empire: {
    include: {
      planets: { orderBy: { createdAt: "asc" as const } },
      army: true,
      supplyRates: true,
      research: true,
    },
  },
};

type FullPlayer = NonNullable<Awaited<ReturnType<typeof findActivePlayer>>>;

function findActivePlayer(name: string) {
  return prisma.player.findFirst({
    where: { name, isAI: false, empire: { turnsLeft: { gt: 0 } } },
    orderBy: { createdAt: "desc" },
    include: playerInclude,
  });
}

function findPlayerById(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: playerInclude,
  });
}

async function buildResponse(player: FullPlayer) {
  const e = player.empire!;
  const planetSummary: Record<string, number> = {};
  for (const p of e.planets) {
    planetSummary[p.type] = (planetSummary[p.type] || 0) + 1;
  }

  let isYourTurn = false;
  let currentTurnPlayer: string | null = null;
  let turnDeadline: string | null = null;
  let turnOrder: { name: string; isAI: boolean }[] = [];
  let turnTimeoutSecs = 86400;
  let waitingForGameStart = false;

  if (player.gameSessionId) {
    const sess = await prisma.gameSession.findUnique({
      where: { id: player.gameSessionId },
      select: { turnTimeoutSecs: true, waitingForHuman: true },
    });
    if (sess) {
      turnTimeoutSecs = sess.turnTimeoutSecs;
      waitingForGameStart = sess.waitingForHuman === true;
    }

    const turn = await getCurrentTurn(player.gameSessionId);
    if (turn) {
      isYourTurn = turn.currentPlayerId === player.id;
      currentTurnPlayer = turn.currentPlayerName;
      turnDeadline = turn.turnDeadline;
      turnOrder = turn.order.map((p) => ({ name: p.name, isAI: p.isAI }));
    } else {
      const roster = await prisma.player.findMany({
        where: { gameSessionId: player.gameSessionId, empire: { turnsLeft: { gt: 0 } } },
        orderBy: { turnOrder: "asc" },
        select: { name: true, isAI: true },
      });
      turnOrder = roster.map((p) => ({ name: p.name, isAI: p.isAI }));
    }
  }

  return {
    player: { id: player.id, name: player.name, isAI: player.isAI },
    gameSessionId: player.gameSessionId,
    isYourTurn,
    currentTurnPlayer,
    turnDeadline,
    turnOrder,
    turnTimeoutSecs,
    waitingForGameStart,
    empire: {
      credits: e.credits,
      food: e.food,
      ore: e.ore,
      fuel: e.fuel,
      population: e.population,
      taxRate: e.taxRate,
      civilStatus: e.civilStatus,
      civilStatusName: CIVIL_STATUS_NAMES[e.civilStatus] ?? "Unknown",
      foodSellRate: e.foodSellRate,
      oreSellRate: e.oreSellRate,
      petroleumSellRate: e.petroleumSellRate,
      netWorth: e.netWorth,
      turnsPlayed: e.turnsPlayed,
      turnsLeft: e.turnsLeft,
      isProtected: e.isProtected,
      protectionTurns: e.protectionTurns,
    },
    planets: e.planets.map((p) => ({
      id: p.id,
      name: p.name,
      sector: p.sector,
      type: p.type,
      typeLabel: PLANET_CONFIG[p.type as keyof typeof PLANET_CONFIG]?.label ?? p.type,
      population: p.population,
      longTermProduction: p.longTermProduction,
      shortTermProduction: p.shortTermProduction,
      defenses: p.defenses,
      isRadiated: p.isRadiated,
    })),
    planetSummary,
    army: e.army
      ? {
          soldiers: e.army.soldiers,
          generals: e.army.generals,
          fighters: e.army.fighters,
          defenseStations: e.army.defenseStations,
          lightCruisers: e.army.lightCruisers,
          heavyCruisers: e.army.heavyCruisers,
          carriers: e.army.carriers,
          covertAgents: e.army.covertAgents,
          commandShipStrength: e.army.commandShipStrength,
          effectiveness: e.army.effectiveness,
          covertPoints: e.army.covertPoints,
          soldiersLevel: e.army.soldiersLevel,
          fightersLevel: e.army.fightersLevel,
          stationsLevel: e.army.stationsLevel,
          lightCruisersLevel: e.army.lightCruisersLevel,
          heavyCruisersLevel: e.army.heavyCruisersLevel,
        }
      : null,
    supplyRates: e.supplyRates,
    research: e.research
      ? {
          accumulatedPoints: e.research.accumulatedPoints,
          unlockedTechIds: e.research.unlockedTechIds,
        }
      : null,
  };
}

// GET — unauthenticated status refresh (used after initial login, keyed by player ID)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerName = searchParams.get("player");
  const playerId = searchParams.get("id");

  if (!playerName && !playerId) {
    return NextResponse.json({ error: "player or id param required" }, { status: 400 });
  }

  const player = playerId
    ? await findPlayerById(playerId)
    : await prisma.player.findFirst({
        where: { name: playerName!, isAI: false },
        orderBy: { createdAt: "desc" },
        include: playerInclude,
      });

  if (!player || !player.empire) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json(await buildResponse(player));
}

// POST — authenticated login (resume game with password)
export async function POST(req: NextRequest) {
  const { name, password } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const player = await findActivePlayer(name);

  if (!player) {
    const finished = await prisma.player.findFirst({
      where: { name, isAI: false },
      include: { empire: true },
    });
    if (finished?.empire && finished.empire.turnsLeft <= 0) {
      return NextResponse.json({ error: "This game is over. Start a new empire!" }, { status: 410 });
    }
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (!player.empire) {
    return NextResponse.json({ error: "Empire not found" }, { status: 404 });
  }

  if (player.passwordHash) {
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 401 });
    }
    const valid = await bcrypt.compare(password, player.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
  }

  if (player.userId) {
    await prisma.userAccount.update({
      where: { id: player.userId },
      data: { lastLoginAt: new Date() },
    });
  }

  return NextResponse.json(await buildResponse(player));
}
