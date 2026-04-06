import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

const take = Math.min(50, parseInt(process.argv[2] ?? "30", 10) || 30);

async function main() {
  const rows = await prisma.turnLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { player: { select: { name: true, isAI: true } } },
  });

  console.log(`--- Last ${rows.length} TurnLog rows (newest first) ---\n`);
  for (const r of rows) {
    const tag = r.player.isAI ? "[AI]" : "    ";
    const line = `${r.createdAt.toISOString()}  ${tag} ${r.player.name.padEnd(20)}  ${r.action}`;
    console.log(line);
    if (r.details && typeof r.details === "object") {
      const d = r.details as Record<string, unknown>;
      const msg = d.actionMsg ?? d.message;
      if (typeof msg === "string" && msg.length) console.log(`      → ${msg.slice(0, 120)}${msg.length > 120 ? "…" : ""}`);
      const cr = d.combatResult ?? (d as { report?: { events?: string[] } }).report;
      if (cr && typeof cr === "object" && "victory" in (cr as object)) {
        console.log(`      → combat victory: ${(cr as { victory?: boolean }).victory}`);
      }
    }
  }

  const sessions = await prisma.gameSession.findMany({
    where: { status: "active" },
    select: { id: true, galaxyName: true, playerNames: true, currentTurnPlayerId: true },
    take: 10,
  });
  console.log("\n--- Active GameSession (sample) ---\n");
  for (const s of sessions) {
    console.log(`${s.galaxyName ?? "(unnamed)"}  players: ${s.playerNames.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
