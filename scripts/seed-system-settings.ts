/**
 * One-shot: copy GEMINI_API_KEY and GEMINI_MODEL from .env into SystemSettings.
 * Usage: npx tsx scripts/seed-system-settings.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = (process.env.GEMINI_MODEL ?? "gemini-2.5-flash").trim();
  if (!key) {
    console.error("GEMINI_API_KEY not set in environment (.env)");
    process.exit(1);
  }
  await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: { id: "default", geminiApiKey: key, geminiModel: model },
    update: { geminiApiKey: key, geminiModel: model },
  });
  console.log(`SystemSettings upserted (geminiModel: ${model})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
