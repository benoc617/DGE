import { NextRequest, NextResponse } from "next/server";
import { AI_CONFIGS, createAIPlayersForSession } from "@/lib/create-ai-players";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const requestedNames: string[] | undefined = body.names;
  const count: number = body.count ?? 3;
  const gameSessionId: string | undefined = body.gameSessionId;

  if (!gameSessionId) {
    return NextResponse.json({ error: "gameSessionId required" }, { status: 400 });
  }

  const names =
    requestedNames?.length
      ? requestedNames
      : AI_CONFIGS.slice(0, Math.min(count, AI_CONFIGS.length)).map((c) => c.name);

  const { created } = await createAIPlayersForSession(gameSessionId, names);

  return NextResponse.json({ created, message: `Created ${created.length} AI players.` });
}
