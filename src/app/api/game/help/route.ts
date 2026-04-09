import { type NextRequest, NextResponse } from "next/server";
import { HELP_REGISTRY } from "@dge/srx/help-content";

/**
 * GET /api/game/help?game=srx
 *
 * Returns help content (title + markdown body) for the specified game type.
 * Served from the pre-compiled TypeScript string in games/srx/src/help-content.ts —
 * no filesystem reads at runtime.
 */
export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game") ?? "srx";
  const entry = HELP_REGISTRY[game];
  if (!entry) {
    return NextResponse.json({ error: `No help found for game: ${game}` }, { status: 404 });
  }
  return NextResponse.json({ title: entry.title, content: entry.content });
}
