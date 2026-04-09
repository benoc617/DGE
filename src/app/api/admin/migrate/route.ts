import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * POST /api/admin/migrate
 * Runs `prisma db push --skip-generate` to sync the schema with the database.
 * This is a convenience for hot-patching schema changes without a full redeploy.
 * Returns stdout/stderr from the prisma command.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { stdout, stderr } = await execAsync(
      "npx prisma db push --skip-generate --accept-data-loss",
      { cwd: process.cwd(), timeout: 120_000 },
    );
    return NextResponse.json({
      ok: true,
      stdout: stdout.slice(0, 4000),
      stderr: stderr.slice(0, 2000),
    });
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return NextResponse.json(
      {
        ok: false,
        error: e.message ?? "exec failed",
        stdout: (e.stdout ?? "").slice(0, 4000),
        stderr: (e.stderr ?? "").slice(0, 2000),
      },
      { status: 500 },
    );
  }
}
