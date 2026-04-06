import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerName = searchParams.get("player");

  if (!playerName) {
    return NextResponse.json({ error: "player param required" }, { status: 400 });
  }

  const player = await prisma.player.findFirst({
    where: { name: playerName },
    orderBy: { createdAt: "desc" },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { toPlayerId: player.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const { fromName, toName, subject, body } = await req.json();

  if (!fromName || !toName || !body) {
    return NextResponse.json({ error: "fromName, toName, and body required" }, { status: 400 });
  }

  const from = await prisma.player.findFirst({ where: { name: fromName }, orderBy: { createdAt: "desc" } });
  const to = await prisma.player.findFirst({ where: { name: toName }, orderBy: { createdAt: "desc" } });

  if (!from || !to) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const msg = await prisma.message.create({
    data: {
      fromPlayerId: from.id,
      toPlayerId: to.id,
      subject: subject ?? "No subject",
      body,
    },
  });

  return NextResponse.json(msg, { status: 201 });
}
