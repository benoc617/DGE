import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AUTH } from "@/lib/game-constants";
import { normalizeEmail, normalizeUsername, isValidEmail } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = typeof body.username === "string" ? body.username : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

  const normUser = normalizeUsername(username);
  if (normUser.length < 2) {
    return NextResponse.json({ error: "Username must be at least 2 characters" }, { status: 400 });
  }
  if (fullName.length < 1) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
  }
  if (password.length < AUTH.PASSWORD_MIN_SIGNUP) {
    return NextResponse.json(
      { error: `Password must be at least ${AUTH.PASSWORD_MIN_SIGNUP} characters` },
      { status: 400 },
    );
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  const normEmail = normalizeEmail(email);
  const existingUser = await prisma.userAccount.findFirst({
    where: { OR: [{ username: normUser }, { email: normEmail }] },
  });
  if (existingUser) {
    if (existingUser.username === normUser) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.userAccount.create({
    data: {
      username: normUser,
      fullName,
      email: normEmail,
      passwordHash,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
