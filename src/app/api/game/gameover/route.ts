import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { playerName } = await req.json();
  if (!playerName) {
    return NextResponse.json({ error: "playerName required" }, { status: 400 });
  }

  // Find the player and their session
  const requestingPlayer = await prisma.player.findFirst({
    where: { name: playerName, isAI: false },
    orderBy: { createdAt: "desc" },
    select: { gameSessionId: true },
  });

  const sessionId = requestingPlayer?.gameSessionId;

  // Fetch players scoped to the same session (or all if no session)
  const allPlayers = await prisma.player.findMany({
    where: sessionId ? { gameSessionId: sessionId } : {},
    include: { empire: { include: { planets: true, army: true } } },
  });

  const standings = allPlayers
    .filter((p) => p.empire)
    .map((p) => ({
      name: p.name,
      isAI: p.isAI,
      netWorth: p.empire!.netWorth,
      population: p.empire!.population,
      planets: p.empire!.planets.length,
      credits: p.empire!.credits,
      turnsPlayed: p.empire!.turnsPlayed,
      military: p.empire!.army
        ? p.empire!.army.soldiers + p.empire!.army.fighters +
          p.empire!.army.lightCruisers + p.empire!.army.heavyCruisers +
          p.empire!.army.carriers + p.empire!.army.defenseStations
        : 0,
    }))
    .sort((a, b) => b.netWorth - a.netWorth);

  const highScoreEntries = standings.map((s, i) => ({
    playerName: s.name,
    netWorth: s.netWorth,
    population: s.population,
    planets: s.planets,
    turnsPlayed: s.turnsPlayed,
    rank: i + 1,
    totalPlayers: standings.length,
  }));

  await prisma.highScore.createMany({ data: highScoreEntries });

  // Mark the session as finished
  if (sessionId) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: "finished",
        winnerId: allPlayers.find((p) => p.name === standings[0]?.name)?.id,
        winnerName: standings[0]?.name,
        finalScores: standings,
        finishedAt: new Date(),
      },
    });
  }

  const winner = standings[0];
  const playerRank = standings.findIndex((s) => s.name === playerName) + 1;

  const recentHighScores = await prisma.highScore.findMany({
    orderBy: { netWorth: "desc" },
    take: 10,
  });

  return NextResponse.json({
    gameOver: true,
    standings,
    winner: winner?.name ?? "Unknown",
    playerRank,
    playerScore: standings.find((s) => s.name === playerName),
    highScores: recentHighScores,
  });
}
