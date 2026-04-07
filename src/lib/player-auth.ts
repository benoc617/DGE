import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AUTH } from "@/lib/game-constants";
import { BCRYPT_ROUNDS } from "@/lib/admin-auth";
import { normalizeUsername, validatePasswordStrength } from "@/lib/auth";

export type ResolvedPlayerCredentials =
  | { playerName: string; passwordHash: string; userId: string | null }
  | { error: string; status: number };

/**
 * Resolve commander name + password for creating a Player.
 * If a UserAccount exists for this username, password must match and we link `userId`
 * and reuse the account password hash on the Player row.
 */
export async function resolvePlayerCredentials(
  name: string,
  password: string,
): Promise<ResolvedPlayerCredentials> {
  const norm = normalizeUsername(name);
  const trimmed = name.trim();

  const account = await prisma.userAccount.findUnique({
    where: { username: norm },
  });

  if (account) {
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      return { error: "Incorrect password", status: 401 };
    }
    return {
      playerName: account.username,
      passwordHash: account.passwordHash,
      userId: account.id,
    };
  }

  if (trimmed.length < 2) {
    return { error: "Name must be at least 2 characters", status: 400 };
  }
  const pwErr = validatePasswordStrength(password, AUTH.PASSWORD_MIN_GAME_LEGACY);
  if (pwErr) {
    return { error: pwErr, status: 400 };
  }
  return {
    playerName: trimmed,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    userId: null,
  };
}
