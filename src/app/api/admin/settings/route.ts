import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { maskGeminiApiKeyPreview } from "@/lib/system-settings";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const row = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  const gem = maskGeminiApiKeyPreview(row?.geminiApiKey);

  return NextResponse.json({
    geminiApiKeyConfigured: gem.configured,
    geminiApiKeyPreview: gem.preview,
    geminiModel: row?.geminiModel ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
  });
}

export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const existing = await prisma.systemSettings.findUnique({ where: { id: "default" } });

  let geminiApiKey = existing?.geminiApiKey ?? null;
  let geminiModel = existing?.geminiModel ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

  if ("geminiApiKey" in body) {
    if (body.geminiApiKey === null) {
      geminiApiKey = null;
    } else if (typeof body.geminiApiKey === "string") {
      const t = body.geminiApiKey.trim();
      geminiApiKey = t.length ? t : null;
    } else {
      return NextResponse.json({ error: "geminiApiKey must be string or null" }, { status: 400 });
    }
  }

  if ("geminiModel" in body) {
    if (body.geminiModel === null) {
      geminiModel = DEFAULT_GEMINI_MODEL;
    } else if (typeof body.geminiModel === "string") {
      const t = body.geminiModel.trim();
      geminiModel = t.length ? t : DEFAULT_GEMINI_MODEL;
    } else {
      return NextResponse.json({ error: "geminiModel must be string or null" }, { status: 400 });
    }
  }

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      geminiApiKey,
      geminiModel,
    },
    update: {
      geminiApiKey,
      geminiModel,
    },
  });

  return NextResponse.json({ ok: true });
}
