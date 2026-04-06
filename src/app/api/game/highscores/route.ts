import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const scores = await prisma.highScore.findMany({
    orderBy: { netWorth: "desc" },
    take: 20,
  });
  return NextResponse.json({ scores });
}
