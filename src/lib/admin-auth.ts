import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "admin_session";
const ADMIN_SETTINGS_ID = "admin";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verifies the admin password: if `AdminSettings` has a row, bcrypt against DB;
 * otherwise timing-safe compare to `INITIAL_ADMIN_PASSWORD` (default srxpass).
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const row = await prisma.adminSettings.findUnique({ where: { id: ADMIN_SETTINGS_ID } });
  if (row) {
    return bcrypt.compare(password, row.passwordHash);
  }
  const p = process.env.INITIAL_ADMIN_PASSWORD ?? "srxpass";
  return timingSafeEqualStr(password, p);
}

/** Username always from `ADMIN_USERNAME` (default admin); password from DB override or `INITIAL_ADMIN_PASSWORD`. */
export async function verifyAdminLogin(username: string, password: string): Promise<boolean> {
  const u = process.env.ADMIN_USERNAME ?? "admin";
  if (!timingSafeEqualStr(username, u)) return false;
  return verifyAdminPassword(password);
}

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.INITIAL_ADMIN_PASSWORD ?? "srxpass";
}

export function createAdminSessionToken(): string {
  return crypto.createHmac("sha256", sessionSecret()).update("srx-admin-auth-v1").digest("hex");
}

export function verifyAdminCookie(token: string | undefined): boolean {
  if (!token) return false;
  return timingSafeEqualStr(token, createAdminSessionToken());
}

/** Use on admin API routes: `const denied = requireAdmin(req); if (denied) return denied;` */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!verifyAdminCookie(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export { COOKIE_NAME };
