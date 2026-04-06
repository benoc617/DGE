import { NextRequest, NextResponse } from "next/server";
import { runAISequence } from "@/lib/ai-runner";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const gameSessionId: string | undefined = body.gameSessionId;

  if (!gameSessionId) {
    return NextResponse.json({ error: "gameSessionId required" }, { status: 400 });
  }

  const results = await runAISequence(gameSessionId);
  return NextResponse.json({ results });
}
