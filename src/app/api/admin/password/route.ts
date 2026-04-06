import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, verifyAdminPassword } from "@/lib/admin-auth";

const ADMIN_ID = "admin";
const MIN_NEW_LEN = 8;

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "currentPassword and newPassword are required" }, { status: 400 });
  }
  if (newPassword.length < MIN_NEW_LEN) {
    return NextResponse.json({ error: `New password must be at least ${MIN_NEW_LEN} characters` }, { status: 400 });
  }

  const ok = await verifyAdminPassword(currentPassword);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.adminSettings.upsert({
    where: { id: ADMIN_ID },
    create: { id: ADMIN_ID, passwordHash },
    update: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
